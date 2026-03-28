import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';
import {
  BarChart2, ArrowLeft, AlertTriangle, CheckCircle,
  Star, Filter, Bot, Map, LayoutDashboard,
} from 'lucide-react';
import {
  getEngagement, getScores, getAppAssessments, getMigrationPlan,
  ScoreResult, Engagement, Application, MigrationPlan,
} from '../api/client';

const COMPLEXITY_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  very_high: 'bg-red-100 text-red-800',
};

const PATH_COLORS: Record<string, string> = {
  migrate: 'bg-blue-100 text-blue-800',
  replace: 'bg-purple-100 text-purple-800',
  retire: 'bg-gray-100 text-gray-700',
  consolidate: 'bg-indigo-100 text-indigo-800',
  not_required: 'bg-gray-100 text-gray-500',
};

const CLOUD_COLORS: Record<string, string> = {
  yes: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  no: 'bg-red-100 text-red-800',
  not_required: 'bg-gray-100 text-gray-500',
};

const SCORE_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-emerald-500'];

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300">—</span>;
  const idx = Math.min(Math.floor(score), 5);
  const labels = ['Absent', 'Initial', 'Developing', 'Established', 'Advanced', 'Leading'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${SCORE_COLORS[idx]}`}>
      {score.toFixed(1)} {labels[idx]}
    </span>
  );
}

type TabId = 'overview' | 'apps' | 'roadmap' | 'ai';

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const engId = Number(id);

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [scores, setScores] = useState<ScoreResult | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [migrationPlan, setMigrationPlan] = useState<MigrationPlan | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [productFilter, setProductFilter] = useState('all');
  const [pathFilter, setPathFilter] = useState('all');
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getEngagement(engId).then(setEngagement),
      getScores(engId).then(setScores),
      getAppAssessments(engId).then(setApps),
      getMigrationPlan(engId).then(setMigrationPlan),
    ]);
  }, [engId]);

  useEffect(() => {
    if (aiRef.current) aiRef.current.scrollTop = aiRef.current.scrollHeight;
  }, [aiText]);

  const generateAI = async () => {
    setAiText('');
    setAiLoading(true);
    setActiveTab('ai');
    try {
      const res = await fetch(`/api/engagements/${engId}/recommend`, { method: 'POST' });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiText((prev) => prev + decoder.decode(value));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const filteredApps = apps.filter((a) => {
    if (productFilter !== 'all' && a.product !== productFilter) return false;
    if (pathFilter !== 'all' && a.migration_path !== pathFilter) return false;
    if (complexityFilter !== 'all' && a.migration_complexity !== complexityFilter) return false;
    return true;
  });

  const radarData = scores?.themes.map((t) => ({
    theme: t.theme_name.replace(' & ', '\n& ').replace(' and ', '\n& '),
    Current: t.avg_current ?? 0,
    Target: t.avg_target ?? 0,
  })) ?? [];

  const gapColor = (gap: number | null) => {
    if (gap === null) return 'bg-gray-100';
    if (gap < 0.5) return 'bg-green-100 text-green-900';
    if (gap < 1.5) return 'bg-yellow-100 text-yellow-900';
    if (gap < 2.5) return 'bg-orange-100 text-orange-900';
    return 'bg-red-100 text-red-900';
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'apps', label: `App Portfolio (${apps.length})`, icon: BarChart2 },
    { id: 'roadmap', label: '12-Month Roadmap', icon: Map },
    { id: 'ai', label: 'AI Recommendations', icon: Bot },
  ];

  if (!engagement || !scores) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">{engagement.client_name}</h1>
                <span className="text-sm text-gray-400">Cloud Migration Maturity Assessment</span>
              </div>
              {engagement.consultant_name && (
                <p className="text-sm text-gray-500 mt-0.5">Consultant: {engagement.consultant_name} | Valiantys</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/engagement/${engId}/assess`}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Edit Assessment
            </Link>
            <button
              onClick={generateAI}
              disabled={aiLoading}
              className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              <Bot className="w-4 h-4" />
              {aiLoading ? 'Generating...' : 'Generate AI Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Environment Banner */}
      <div className="bg-blue-900 text-white px-6 py-3">
        <div className="max-w-screen-xl mx-auto flex flex-wrap items-center gap-6 text-sm">
          <span className="font-semibold text-blue-200">Siemens Energy Environment:</span>
          <span>Jira Software: <strong>24,000 users x 4 DC instances</strong></span>
          <span>Confluence: <strong>40,000 users x 1 DC instance</strong></span>
          <span>JSM: <strong>3 DC instances</strong></span>
          <span><strong>65 apps</strong> | <strong>$1,195,924</strong>/yr DC spend</span>
          <span className="ml-auto text-blue-300">Target: Atlassian Cloud</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-screen-xl mx-auto flex gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">

        {/* ═══════════════ TAB: OVERVIEW ═══════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Current Maturity', value: scores.overall_current?.toFixed(2) ?? 'N/A', sub: '/ 5.0', color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Target Maturity', value: scores.overall_target?.toFixed(2) ?? 'N/A', sub: '/ 5.0', color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Overall Gap', value: scores.overall_gap?.toFixed(2) ?? 'N/A', sub: 'weighted delta', color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Assessment Progress', value: `${Math.round((scores.progress.answered / Math.max(scores.progress.total, 1)) * 100)}%`, sub: `${scores.progress.answered}/${scores.progress.total} questions`, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map((c) => (
                <div key={c.label} className={`${c.bg} rounded-xl p-4`}>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Maturity by Theme — Current vs Target</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="theme" tick={{ fontSize: 10 }} />
                    <Radar name="Current" dataKey="Current" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    <Radar name="Target" dataKey="Target" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Top Gaps */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Top 5 Priority Gaps</h2>
                <div className="space-y-3">
                  {scores.top_gaps.length === 0 ? (
                    <p className="text-gray-400 text-sm">Complete the assessment to see priority gaps.</p>
                  ) : (
                    scores.top_gaps.map((g, i) => (
                      <div key={g.sub_dim_id} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500'][i]}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{g.sub_dim_name}</p>
                          <p className="text-xs text-gray-500">{g.theme_name}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-red-600">Delta {g.gap?.toFixed(2)}</span>
                          <p className="text-xs text-gray-400">{g.avg_current?.toFixed(1)} to {g.avg_target?.toFixed(1)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Theme Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-base font-semibold text-gray-900">Theme-Level Maturity Summary</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Theme</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Weight</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Current</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gap</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scores.themes.map((t) => (
                      <tr key={t.theme_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{t.theme_name}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{(t.weight * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={t.avg_current} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={t.avg_target} />
                        </td>
                        <td className={`px-4 py-3 text-center font-semibold ${gapColor(t.gap)}`}>
                          {t.gap != null ? `Delta ${t.gap.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${t.avg_current != null ? (t.avg_current / 5) * 100 : 0}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-dimension Heatmap */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Sub-Dimension Gap Heatmap</h2>
              <div className="flex gap-3 mb-4 text-xs flex-wrap">
                {[['bg-green-200', '< 0.5 Low'], ['bg-yellow-200', '0.5-1.5 Medium'], ['bg-orange-200', '1.5-2.5 High'], ['bg-red-200', '> 2.5 Critical']].map(([c, l]) => (
                  <span key={l} className={`flex items-center gap-1 px-2 py-1 rounded ${c} text-gray-700`}>{l}</span>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {scores.sub_dimensions.map((sd) => {
                  const gap = sd.gap;
                  const bg = gap == null ? 'bg-gray-100 text-gray-400' : gap < 0.5 ? 'bg-green-100 text-green-900' : gap < 1.5 ? 'bg-yellow-100 text-yellow-900' : gap < 2.5 ? 'bg-orange-100 text-orange-900' : 'bg-red-100 text-red-900';
                  return (
                    <div key={sd.sub_dim_id} className={`${bg} rounded-lg p-2 text-xs`}>
                      <p className="font-medium leading-tight mb-1">{sd.sub_dim_name}</p>
                      <p className="font-bold">{gap != null ? `Delta ${gap.toFixed(2)}` : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ TAB: APP PORTFOLIO ═══════════════ */}
        {activeTab === 'apps' && (
          <div className="space-y-4">
            {/* Stats */}
            {migrationPlan && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: 'Total Apps', value: migrationPlan.total_apps, color: 'bg-gray-100 text-gray-800' },
                  { label: 'Migrate to Cloud', value: migrationPlan.migrate_count, color: 'bg-blue-100 text-blue-800' },
                  { label: 'Replace / Re-engineer', value: migrationPlan.replace_count, color: 'bg-purple-100 text-purple-800' },
                  { label: 'Retire / Not Required', value: migrationPlan.retire_count + migrationPlan.not_required_count, color: 'bg-gray-100 text-gray-600' },
                  { label: 'High Complexity', value: migrationPlan.high_complexity_count, color: 'bg-red-100 text-red-800' },
                  { label: 'Annual DC Cost', value: `$${(migrationPlan.total_annual_cost / 1000).toFixed(0)}K`, color: 'bg-orange-100 text-orange-800' },
                ].map((s) => (
                  <div key={s.label} className={`${s.color} rounded-lg p-3 text-center`}>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900">Test Management Duplication</p>
                  <p className="text-amber-700">Both Xray ($13K) and Zephyr Essential ($78K) are in use. Consolidation to Xray Cloud could save ~$78K/year.</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">SSO Rationalisation Opportunity</p>
                  <p className="text-blue-700">4 separate SAML SSO licenses (~$53K) replaced by Atlassian Access/Guard included in Cloud subscription.</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Filter:</span>
              </div>
              <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
                <option value="all">All Products</option>
                <option value="jira_software">Jira Software</option>
                <option value="jira_service_management">Jira Service Management</option>
                <option value="confluence">Confluence</option>
              </select>
              <select value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
                <option value="all">All Migration Paths</option>
                <option value="migrate">Migrate</option>
                <option value="replace">Replace</option>
                <option value="retire">Retire</option>
                <option value="not_required">Not Required in Cloud</option>
              </select>
              <select value={complexityFilter} onChange={(e) => setComplexityFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5">
                <option value="all">All Complexity</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="very_high">Very High</option>
              </select>
              <span className="ml-auto text-sm text-gray-400 self-center">{filteredApps.length} apps shown</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Application</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Users</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Annual Cost</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cloud Available</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Complexity</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Migration Path</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Phase</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agentic Opportunity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredApps.map((app) => (
                      <tr key={app.id} className={`hover:bg-gray-50 ${app.is_critical ? 'border-l-2 border-l-amber-400' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {app.is_critical === 1 && <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" />}
                            <span className="font-medium text-gray-900 text-xs">{app.name}</span>
                          </div>
                          {app.migration_notes && (
                            <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate" title={app.migration_notes}>{app.migration_notes}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 capitalize">{app.product.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600">{app.user_tier?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-gray-900">
                          ${app.annual_cost_usd?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CLOUD_COLORS[app.cloud_available] ?? 'bg-gray-100 text-gray-600'}`}>
                            {app.cloud_available.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${COMPLEXITY_COLORS[app.migration_complexity] ?? 'bg-gray-100'}`}>
                            {app.migration_complexity.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PATH_COLORS[app.migration_path] ?? 'bg-gray-100'}`}>
                            {app.migration_path.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center">
                            {app.phase}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {app.agentic_opportunity && (
                            <div className="flex items-start gap-1">
                              <Bot className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-purple-700">{app.agentic_opportunity}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ TAB: ROADMAP ═══════════════ */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl p-6 text-white">
              <h2 className="text-xl font-bold">12-Month Atlassian Data Center to Cloud Migration Programme</h2>
              <p className="text-blue-200 mt-1">Siemens Energy Global | 24K Jira + 40K Confluence + 3 JSM instances | Delivered by Valiantys</p>
            </div>

            {/* Phase Cards */}
            {migrationPlan && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {migrationPlan.phases.map((phase) => {
                  const borderColors = ['border-t-blue-500', 'border-t-green-500', 'border-t-orange-500', 'border-t-purple-500'];
                  const headColors = ['text-blue-700', 'text-green-700', 'text-orange-700', 'text-purple-700'];
                  const bgColors = ['bg-blue-50', 'bg-green-50', 'bg-orange-50', 'bg-purple-50'];
                  const phaseActivities = [
                    ['Cloud tenant setup & Atlassian Access config', 'Identity federation & SCIM provisioning', 'SSO migration (replacing all SAML apps)', 'Architecture design & app compatibility audit', 'Migration tooling setup & dry-run', 'Governance & security baseline'],
                    ['Confluence Cloud migration (40K users)', 'Primary Jira Software instance migration', 'Core app migration (draw.io, AURA, Table Filter)', 'Atlassian Intelligence activation', 'User acceptance testing & validation', 'Help & support model transition'],
                    ['Remaining 3 Jira instances migration', 'All 3 JSM instances migration', 'ScriptRunner cloud rewrite programme', 'JMWE to native Automation migration', 'BigPicture, Tempo & Structure migration', 'Xray/Zephyr consolidation'],
                    ['Post-migration performance optimisation', 'Rovo activation & agent configuration', 'Custom agentic workflow build', 'Cloud CoE establishment', 'Operating model finalisation', 'Hypercare & knowledge transfer'],
                  ];
                  const pi = phase.phase - 1;
                  return (
                    <div key={phase.phase} className={`bg-white border-2 border-t-4 rounded-xl overflow-hidden ${borderColors[pi]}`}>
                      <div className={`p-4 ${bgColors[pi]}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold uppercase ${headColors[pi]}`}>Phase {phase.phase}</span>
                          <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-600 font-medium">{phase.months}</span>
                        </div>
                        <h3 className={`font-bold text-base ${headColors[pi]}`}>{phase.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{phase.apps.length} apps in scope</p>
                      </div>

                      <div className="px-4 pb-4">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 mt-3">Key Activities</p>
                        <ul className="space-y-1">
                          {phaseActivities[pi].map((act) => (
                            <li key={act} className="flex items-start gap-1.5 text-xs text-gray-700">
                              <CheckCircle className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                              {act}
                            </li>
                          ))}
                        </ul>

                        {phase.apps.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-3 mb-2">Apps in Phase</p>
                            <div className="flex flex-wrap gap-1">
                              {phase.apps.slice(0, 8).map((app) => (
                                <span key={app.id} className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700">
                                  {app.name.split(' ').slice(0, 3).join(' ')}
                                </span>
                              ))}
                              {phase.apps.length > 8 && (
                                <span className="text-xs text-gray-400">+{phase.apps.length - 8} more</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Consolidation opportunities */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Key Consolidation & Cost Saving Opportunities</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: 'SSO Rationalisation',
                    saving: '~$53,644/yr',
                    detail: '4 separate SAML SSO licenses across 4 Jira instances can be retired. Atlassian Access (included in Cloud Enterprise) provides unified SSO via SAML/OIDC + SCIM user provisioning.',
                    icon: 'SSO',
                    color: 'bg-blue-50 border-blue-200',
                    headColor: 'text-blue-900',
                  },
                  {
                    title: 'Test Management Consolidation',
                    saving: '~$78,126/yr',
                    detail: 'Both Xray ($13K) and Zephyr Essential ($78K) are licensed simultaneously. Consolidate to Xray Cloud which offers superior BDD support, CI/CD integration and active cloud development.',
                    icon: 'TM',
                    color: 'bg-amber-50 border-amber-200',
                    headColor: 'text-amber-900',
                  },
                  {
                    title: 'Workflow Automation Replacement',
                    saving: 'Reduced complexity',
                    detail: 'JSU Automation Suite, JMWE, Jira Workflow Toolbox, and Create on Transition can be largely replaced by native Automation for Jira Cloud — significantly reducing app licensing and maintenance overhead.',
                    icon: 'WF',
                    color: 'bg-green-50 border-green-200',
                    headColor: 'text-green-900',
                  },
                ].map((opp) => (
                  <div key={opp.title} className={`border rounded-lg p-4 ${opp.color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-xs font-bold text-gray-600">{opp.icon}</div>
                      <h3 className={`font-semibold text-sm ${opp.headColor}`}>{opp.title}</h3>
                    </div>
                    <p className="text-lg font-bold text-green-700 mb-2">{opp.saving}</p>
                    <p className="text-xs text-gray-600">{opp.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Agentic opportunities */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-600" />
                Agentic AI — Phase 4 Transformation Opportunities
              </h2>
              <p className="text-sm text-gray-500 mb-4">Post-migration Rovo Agents and Atlassian Intelligence use cases for Siemens Energy</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {apps.filter((a) => a.agentic_opportunity).map((app) => (
                  <div key={app.id} className="bg-white rounded-lg p-3 border border-purple-100 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{app.name}</p>
                      <p className="text-xs text-purple-700 mt-0.5">{app.agentic_opportunity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ TAB: AI ═══════════════ */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Bot className="w-5 h-5" /> AI-Generated Migration & Transformation Report
                  </h2>
                  <p className="text-blue-200 text-sm mt-1">
                    Powered by Claude Opus | Valiantys Cloud Advisory | Siemens Energy
                  </p>
                </div>
                <button
                  onClick={generateAI}
                  disabled={aiLoading}
                  className="px-5 py-2.5 bg-white text-blue-900 rounded-lg font-semibold text-sm hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2"
                >
                  <Bot className="w-4 h-4" />
                  {aiLoading ? 'Generating Report...' : aiText ? 'Regenerate Report' : 'Generate Report'}
                </button>
              </div>
            </div>

            {!aiText && !aiLoading && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Generate Your Migration Report</h3>
                <p className="text-gray-500 mb-6 max-w-lg mx-auto">
                  Claude will analyse your maturity assessment responses and all 65 applications to generate a comprehensive
                  Atlassian DC to Cloud migration strategy, 12-month roadmap, and agentic AI recommendations for Siemens Energy.
                </p>
                <button
                  onClick={generateAI}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 flex items-center gap-2 mx-auto"
                >
                  <Bot className="w-5 h-5" />
                  Generate Siemens Energy Migration Report
                </button>
              </div>
            )}

            {aiLoading && !aiText && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Analysing {apps.length} applications and {scores.progress.answered} assessment responses...</p>
                <p className="text-gray-400 text-sm mt-1">This may take 30-60 seconds for a comprehensive report</p>
              </div>
            )}

            {aiText && (
              <div ref={aiRef} className="bg-white rounded-xl border border-gray-200 p-8 prose prose-sm max-w-none overflow-auto max-h-screen">
                <ReactMarkdown>{aiText}</ReactMarkdown>
                {aiLoading && (
                  <span className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
