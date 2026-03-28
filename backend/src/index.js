import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import db from "./db.js";
import { computeScores } from "./scores.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ── Themes ────────────────────────────────────────────────────────────────────

app.get("/api/themes", (_req, res) => {
  const themes = db.prepare("SELECT * FROM themes ORDER BY id").all();
  const subDims = db.prepare("SELECT * FROM sub_dimensions ORDER BY theme_id, id").all();
  const questions = db.prepare("SELECT * FROM questions ORDER BY sub_dimension_id, ord").all();

  const sdMap = {};
  for (const sd of subDims) {
    if (!sdMap[sd.theme_id]) sdMap[sd.theme_id] = [];
    sdMap[sd.theme_id].push({ ...sd, questions: [] });
  }

  const qMap = {};
  for (const q of questions) {
    if (!qMap[q.sub_dimension_id]) qMap[q.sub_dimension_id] = [];
    qMap[q.sub_dimension_id].push({ ...q, order: q.ord });
  }

  const result = themes.map((t) => ({
    ...t,
    sub_dimensions: (sdMap[t.id] || []).map((sd) => ({
      ...sd,
      questions: qMap[sd.id] || [],
    })),
  }));

  res.json(result);
});

// ── Engagements ───────────────────────────────────────────────────────────────

app.get("/api/engagements", (_req, res) => {
  res.json(db.prepare("SELECT * FROM engagements ORDER BY created_at DESC").all());
});

app.post("/api/engagements", (req, res) => {
  const { client_name, consultant_name } = req.body;
  if (!client_name) return res.status(400).json({ error: "client_name required" });
  const result = db.prepare(
    "INSERT INTO engagements (client_name, consultant_name) VALUES (?, ?)"
  ).run(client_name, consultant_name || null);
  const eng = db.prepare("SELECT * FROM engagements WHERE id = ?").get(result.lastInsertRowid);
  res.json(eng);
});

app.get("/api/engagements/:id", (req, res) => {
  const eng = db.prepare("SELECT * FROM engagements WHERE id = ?").get(req.params.id);
  if (!eng) return res.status(404).json({ error: "Not found" });
  res.json(eng);
});

app.delete("/api/engagements/:id", (req, res) => {
  db.prepare("DELETE FROM engagements WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── Responses ─────────────────────────────────────────────────────────────────

app.get("/api/engagements/:id/responses", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM responses WHERE engagement_id = ?"
  ).all(req.params.id);
  const map = {};
  for (const r of rows) {
    map[r.question_id] = {
      current_score: r.current_score,
      target_score: r.target_score,
      notes: r.notes,
    };
  }
  res.json(map);
});

app.put("/api/engagements/:id/responses", (req, res) => {
  const { question_id, current_score, target_score, notes } = req.body;
  db.prepare(`
    INSERT INTO responses (engagement_id, question_id, current_score, target_score, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(engagement_id, question_id) DO UPDATE SET
      current_score = excluded.current_score,
      target_score = excluded.target_score,
      notes = excluded.notes
  `).run(req.params.id, question_id, current_score ?? null, target_score ?? null, notes ?? null);
  res.json({ ok: true });
});

// ── Scores ────────────────────────────────────────────────────────────────────

app.get("/api/engagements/:id/scores", (req, res) => {
  const eng = db.prepare("SELECT * FROM engagements WHERE id = ?").get(req.params.id);
  if (!eng) return res.status(404).json({ error: "Not found" });
  res.json(computeScores(parseInt(req.params.id)));
});

// ── Applications ──────────────────────────────────────────────────────────────

// GET all applications
app.get("/api/applications", (_req, res) => {
  const apps = db.prepare("SELECT * FROM applications ORDER BY product, ord").all();
  res.json(apps);
});

// GET application assessments for an engagement (with left join overlay)
app.get("/api/engagements/:id/app-assessments", (req, res) => {
  const { id } = req.params;
  const assessments = db.prepare(`
    SELECT a.*, aa.business_criticality, aa.current_usage_score, aa.cloud_readiness_score,
           aa.migration_priority, aa.consultant_notes, aa.recommended_action, aa.estimated_effort_days
    FROM applications a
    LEFT JOIN app_assessments aa ON aa.application_id = a.id AND aa.engagement_id = ?
    ORDER BY a.product, a.ord
  `).all(id);
  res.json(assessments);
});

// PUT upsert an app assessment
app.put("/api/engagements/:id/app-assessments/:appId", (req, res) => {
  const { id, appId } = req.params;
  const {
    business_criticality,
    current_usage_score,
    cloud_readiness_score,
    migration_priority,
    consultant_notes,
    recommended_action,
    estimated_effort_days,
  } = req.body;
  db.prepare(`
    INSERT INTO app_assessments (engagement_id, application_id, business_criticality, current_usage_score,
      cloud_readiness_score, migration_priority, consultant_notes, recommended_action, estimated_effort_days, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(engagement_id, application_id) DO UPDATE SET
      business_criticality = excluded.business_criticality,
      current_usage_score = excluded.current_usage_score,
      cloud_readiness_score = excluded.cloud_readiness_score,
      migration_priority = excluded.migration_priority,
      consultant_notes = excluded.consultant_notes,
      recommended_action = excluded.recommended_action,
      estimated_effort_days = excluded.estimated_effort_days,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    id, appId, business_criticality, current_usage_score, cloud_readiness_score,
    migration_priority, consultant_notes, recommended_action, estimated_effort_days,
  );
  res.json({ success: true });
});

// GET migration roadmap summary
app.get("/api/engagements/:id/migration-plan", (req, res) => {
  const { id } = req.params;
  const engagement = db.prepare("SELECT * FROM engagements WHERE id = ?").get(id);
  if (!engagement) return res.status(404).json({ error: "Not found" });

  const apps = db.prepare(`
    SELECT a.*,
           COALESCE(aa.recommended_action, a.migration_path) as final_path,
           COALESCE(aa.business_criticality, CASE WHEN a.is_critical = 1 THEN 'critical' ELSE 'medium' END) as final_criticality,
           COALESCE(aa.migration_priority, 3) as final_priority
    FROM applications a
    LEFT JOIN app_assessments aa ON aa.application_id = a.id AND aa.engagement_id = ?
    ORDER BY a.phase, a.migration_complexity DESC
  `).all(id);

  const phases = [1, 2, 3, 4].map((p) => ({
    phase: p,
    name: ["Foundation & Planning", "Core Migration", "Complex Apps & Automation", "Optimisation & Agentic AI"][p - 1],
    months: ["Months 1-3", "Months 4-6", "Months 7-9", "Months 10-12"][p - 1],
    apps: apps.filter((a) => a.phase === p),
  }));

  const summary = {
    total_apps: apps.length,
    migrate_count: apps.filter((a) => (a.recommended_action || a.migration_path) === "migrate").length,
    replace_count: apps.filter((a) => (a.recommended_action || a.migration_path) === "replace").length,
    retire_count: apps.filter((a) => (a.recommended_action || a.migration_path) === "retire").length,
    not_required_count: apps.filter((a) => (a.recommended_action || a.migration_path) === "not_required").length,
    high_complexity_count: apps.filter((a) => ["high", "very_high"].includes(a.migration_complexity)).length,
    total_annual_cost: apps.reduce((s, a) => s + (a.annual_cost_usd || 0), 0),
    phases,
  };

  res.json(summary);
});

// ── AI Recommendations ────────────────────────────────────────────────────────

app.post("/api/engagements/:id/recommend", async (req, res) => {
  const engId = parseInt(req.params.id);
  const eng = db.prepare("SELECT * FROM engagements WHERE id = ?").get(engId);
  if (!eng) return res.status(404).json({ error: "Not found" });

  const scores = computeScores(engId);

  const apps = db.prepare("SELECT * FROM applications ORDER BY product, phase").all();
  const appAssessments = db.prepare(`
    SELECT a.name, a.product, a.migration_complexity, a.migration_path, a.annual_cost_usd, a.cloud_available,
           a.agentic_opportunity,
           COALESCE(aa.business_criticality, CASE WHEN a.is_critical=1 THEN 'critical' ELSE 'medium' END) as criticality,
           COALESCE(aa.current_usage_score, 3) as usage_score,
           COALESCE(aa.cloud_readiness_score, 3) as readiness_score
    FROM applications a
    LEFT JOIN app_assessments aa ON aa.application_id = a.id AND aa.engagement_id = ?
    ORDER BY a.phase, a.migration_complexity DESC
  `).all(engId);

  const criticalApps = appAssessments.filter((a) => a.criticality === "critical" || a.usage_score >= 4);
  const highComplexityApps = appAssessments.filter((a) => ["high", "very_high"].includes(a.migration_complexity));
  const retireApps = appAssessments.filter((a) => a.migration_path === "not_required" || a.migration_path === "retire");
  const agenticApps = apps.filter((a) => a.agentic_opportunity);

  const prompt = `You are a senior Atlassian Solutions Architect and Cloud Migration Consultant at Valiantys. You are performing a cloud maturity assessment for Siemens Energy Global GmbH & Co. KG.

## SIEMENS ENERGY ENVIRONMENT
- **Jira Software**: 24,000 licensed users across 4 Data Center instances
- **Confluence**: 40,000 licensed users on 1 Data Center instance
- **Jira Service Management**: 3 Data Center instances
- **Marketplace Apps**: 65 apps, total annual spend $1,195,924 USD
- **Migration Target**: Atlassian Cloud (Atlassian Access + Atlassian Guard)
- **Timeline**: 12-month implementation programme

## MATURITY ASSESSMENT RESULTS

**Overall Scores:**
- Current Maturity: ${scores.overall_current?.toFixed(2) ?? "N/A"} / 5.0
- Target Maturity: ${scores.overall_target?.toFixed(2) ?? "N/A"} / 5.0
- Overall Gap: ${scores.overall_gap?.toFixed(2) ?? "N/A"}
- Assessment Progress: ${scores.progress.answered}/${scores.progress.total} questions answered

**Theme Scores:**
${scores.themes.map((t) => `- ${t.theme_name} (weight: ${(t.weight * 100).toFixed(0)}%): Current ${t.avg_current?.toFixed(2) ?? "N/A"} → Target ${t.avg_target?.toFixed(2) ?? "N/A"} | Gap: ${t.gap?.toFixed(2) ?? "N/A"}`).join("\n")}

**Top Priority Gaps:**
${scores.top_gaps.map((g, i) => `${i + 1}. ${g.sub_dim_name} (${g.theme_name}): Gap of ${g.gap?.toFixed(2) ?? "N/A"} | Weighted Impact: ${g.weighted_gap?.toFixed(4) ?? "N/A"}`).join("\n")}

## APPLICATION PORTFOLIO SUMMARY
- Total Apps: ${appAssessments.length} | Migrate: ${appAssessments.filter((a) => a.migration_path === "migrate").length} | Replace: ${appAssessments.filter((a) => a.migration_path === "replace").length} | Retire/Not Required: ${appAssessments.filter((a) => ["retire", "not_required"].includes(a.migration_path)).length}
- High/Very High Complexity Apps: ${highComplexityApps.length}
- Critical Apps: ${criticalApps.map((a) => a.name).join(", ")}
- Complex Apps Requiring Significant Effort: ${highComplexityApps.map((a) => a.name).join(", ")}
- Apps to Retire/Not Required in Cloud: ${retireApps.map((a) => a.name).join(", ")}

## AGENTIC AI OPPORTUNITIES
${agenticApps.map((a) => `- **${a.name}**: ${a.agentic_opportunity}`).join("\n")}

---

Please provide a comprehensive migration and transformation report with the following sections:

## 1. EXECUTIVE SUMMARY
A 3-4 paragraph executive summary covering: current state, migration rationale, key risks, and expected business outcomes from the cloud transformation.

## 2. MATURITY GAP ANALYSIS
For each of the top 5 priority gaps:
- **Current State**: What this means for Siemens Energy today
- **Impact**: Why this gap matters for the cloud migration
- **Quick Wins (0-90 days)**: Immediate actions before migration starts
- **Strategic Initiatives**: Medium-term improvements to enable cloud success
- **Success Metrics**: How to measure progress

## 3. APPLICATION PORTFOLIO ASSESSMENT
Provide detailed analysis of:
- The 3-4 most complex apps and migration approach (ScriptRunner, JMWE, Jira Workflow Toolbox, CMJ)
- The consolidation opportunity: Siemens Energy is paying for BOTH Xray AND Zephyr Essential for test management - recommend rationalisation
- The SAML SSO rationalisation: 4 separate SAML SSO licenses can be replaced by Atlassian Access
- Apps where cloud versions offer ENHANCED functionality vs Data Center
- Total potential cost savings from app rationalisation

## 4. 12-MONTH MIGRATION ROADMAP

### Phase 1: Foundation & Planning (Months 1-3)
- Atlassian Cloud tenant setup and Atlassian Access/Guard configuration
- Identity federation migration (replacing all SAML SSO apps)
- User provisioning and SCIM setup
- Cloud architecture design for consolidated instance strategy
- App inventory and cloud compatibility validation
- Key deliverables and milestones

### Phase 2: Core Platform Migration (Months 4-6)
- Confluence Cloud migration (40,000 users - start here as lower risk)
- Primary Jira Software instance migration
- Core marketplace app migration (draw.io, AURA, Table Filter, etc.)
- Atlassian Intelligence activation
- Key deliverables and milestones

### Phase 3: Complex Apps & Remaining Instances (Months 7-9)
- Remaining 3 Jira Software instances migration
- All 3 JSM instances migration
- ScriptRunner migration to Cloud (script rewriting programme)
- JMWE → native Automation for Jira migration
- BigPicture, Tempo, Structure migration
- Xray vs Zephyr consolidation decision and migration
- Key deliverables and milestones

### Phase 4: Optimisation & Agentic AI (Months 10-12)
- Post-migration optimisation and performance tuning
- Atlassian Rovo activation and configuration
- Agentic workflow implementation (per opportunities identified)
- Cloud operating model finalisation
- Centre of Excellence establishment
- Key deliverables and milestones

## 5. AGENTIC AI & ROVO TRANSFORMATION
Provide specific, actionable recommendations for deploying Atlassian Rovo and agentic AI capabilities in the transformed Siemens Energy Atlassian estate:
- **Rovo Agents** to deploy immediately post-migration
- **Atlassian Intelligence** features to activate
- **Custom Rovo Agents** to build (with specific use cases for Siemens Energy - energy sector, project management, ITSM)
- **Integration** of Rovo with SAP, Salesforce, and Azure DevOps
- Expected productivity gains and ROI

## 6. RISK REGISTER
Top 8 migration risks with: Risk description, Probability (H/M/L), Impact (H/M/L), Mitigation strategy

## 7. INVESTMENT & RESOURCE REQUIREMENTS
- Valiantys professional services effort estimate by phase
- Internal Siemens Energy resource requirements
- Timeline and key dependencies
- Expected TCO comparison (Data Center vs Cloud) highlighting savings from app rationalisation

Provide rich, detailed, consultant-quality output. This will be presented to Siemens Energy senior stakeholders.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.setHeader("Content-Type", "text/plain");
    return res.end("ANTHROPIC_API_KEY not set in .env file.");
  }

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const client = new Anthropic({ apiKey });
    const stream = await client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    for await (const chunk of stream.text_stream) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    res.end(`\n\nError generating recommendations: ${err.message}`);
  }
});

// Serve frontend in production
const frontendDist = join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(frontendDist, "index.html"));
  });
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
