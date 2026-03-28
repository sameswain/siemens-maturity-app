const BASE = "/api";

export interface Theme {
  id: number;
  name: string;
  description: string;
  weight: number;
  sub_dimensions: SubDimension[];
}

export interface SubDimension {
  id: number;
  name: string;
  description: string;
  weight: number;
  theme_id: number;
  questions: Question[];
}

export interface Question {
  id: number;
  text: string;
  order: number;
  sub_dimension_id: number;
}

export interface Engagement {
  id: number;
  client_name: string;
  consultant_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ResponseData {
  current_score: number | null;
  target_score: number | null;
  notes: string | null;
}

export interface ThemeScore {
  theme_id: number;
  theme_name: string;
  theme: string; // legacy
  avg_current: number | null;
  avg_target: number | null;
  gap: number | null;
  weight: number;
  weighted_current: number | null;
  weighted_target: number | null;
  weighted_gap: number | null;
}

export interface SubDimScore {
  theme_id: number;
  theme_name: string;
  sub_dim_id: number;
  sub_dim_name: string;
  theme: string; // legacy
  sub_dimension: string; // legacy
  avg_current: number | null;
  avg_target: number | null;
  gap: number | null;
  sub_dim_weight: number;
  theme_weight: number;
  weighted_gap: number | null;
}

export interface ScoreResult {
  overall_current: number;
  overall_target: number;
  overall_gap: number | null;
  themes: ThemeScore[];
  sub_dimensions: SubDimScore[];
  top_gaps: SubDimScore[];
  progress: { answered: number; total: number };
}

export interface Application {
  id: number;
  name: string;
  product: string;
  vendor?: string;
  user_tier?: number;
  annual_cost_usd?: number;
  cloud_available: 'yes' | 'no' | 'partial' | 'not_required';
  cloud_product_name?: string;
  migration_complexity: 'low' | 'medium' | 'high' | 'very_high';
  migration_path: 'migrate' | 'replace' | 'retire' | 'consolidate' | 'not_required';
  migration_notes?: string;
  phase: number;
  is_critical: number;
  agentic_opportunity?: string;
  ord?: number;
  // assessment overlay (from app-assessments join)
  business_criticality?: string;
  current_usage_score?: number;
  cloud_readiness_score?: number;
  migration_priority?: number;
  consultant_notes?: string;
  recommended_action?: string;
  estimated_effort_days?: number;
}

export interface MigrationPhase {
  phase: number;
  name: string;
  months: string;
  apps: Application[];
}

export interface MigrationPlan {
  total_apps: number;
  migrate_count: number;
  replace_count: number;
  retire_count: number;
  not_required_count: number;
  high_complexity_count: number;
  total_annual_cost: number;
  phases: MigrationPhase[];
}

export const api = {
  getThemes: (): Promise<Theme[]> =>
    fetch(`${BASE}/themes`).then((r) => r.json()),

  listEngagements: (): Promise<Engagement[]> =>
    fetch(`${BASE}/engagements`).then((r) => r.json()),

  createEngagement: (data: { client_name: string; consultant_name?: string }): Promise<Engagement> =>
    fetch(`${BASE}/engagements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteEngagement: (id: number): Promise<void> =>
    fetch(`${BASE}/engagements/${id}`, { method: "DELETE" }).then(() => undefined),

  getEngagement: (id: number): Promise<Engagement> =>
    fetch(`${BASE}/engagements/${id}`).then((r) => r.json()),

  getResponses: (engagementId: number): Promise<Record<number, ResponseData>> =>
    fetch(`${BASE}/engagements/${engagementId}/responses`).then((r) => r.json()),

  upsertResponse: (
    engagementId: number,
    data: { question_id: number; current_score?: number | null; target_score?: number | null; notes?: string | null }
  ): Promise<void> =>
    fetch(`${BASE}/engagements/${engagementId}/responses`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(() => undefined),

  getScores: (engagementId: number): Promise<ScoreResult> =>
    fetch(`${BASE}/engagements/${engagementId}/scores`).then((r) => r.json()),
};

// Standalone fetch functions used by Dashboard
export async function getEngagement(engagementId: number): Promise<Engagement> {
  const r = await fetch(`${BASE}/engagements/${engagementId}`);
  return r.json();
}

export async function getScores(engagementId: number): Promise<ScoreResult> {
  const r = await fetch(`${BASE}/engagements/${engagementId}/scores`);
  return r.json();
}

export async function getApplications(): Promise<Application[]> {
  const r = await fetch(`${BASE}/applications`);
  return r.json();
}

export async function getAppAssessments(engagementId: number): Promise<Application[]> {
  const r = await fetch(`${BASE}/engagements/${engagementId}/app-assessments`);
  return r.json();
}

export async function upsertAppAssessment(engagementId: number, appId: number, data: Partial<Application>): Promise<void> {
  await fetch(`${BASE}/engagements/${engagementId}/app-assessments/${appId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getMigrationPlan(engagementId: number): Promise<MigrationPlan> {
  const r = await fetch(`${BASE}/engagements/${engagementId}/migration-plan`);
  return r.json();
}
