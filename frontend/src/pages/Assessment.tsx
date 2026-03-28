import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, Theme, ResponseData, ScoreResult, Engagement } from "../api/client";
import { ChevronLeft, ChevronRight, BarChart2, Home, CheckCircle } from "lucide-react";

const MATURITY_LABELS: Record<number, string> = {
  0: "Absent",
  1: "Initial",
  2: "Developing",
  3: "Established",
  4: "Advanced",
  5: "Leading",
};

function ScoreSlider({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number | null;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex-1">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-bold ${color}`}>
          {value !== null ? `${value} — ${MATURITY_LABELS[Math.round(value)]}` : "—"}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={0.5}
        value={value ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}

export default function Assessment() {
  const { id } = useParams<{ id: string }>();
  const engId = parseInt(id!);
  const navigate = useNavigate();

  const [themes, setThemes] = useState<Theme[]>([]);
  const [responses, setResponses] = useState<Record<number, ResponseData>>({});
  const [scores, setScores] = useState<ScoreResult | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [activeThemeIdx, setActiveThemeIdx] = useState(0);
  const [activeSubDimIdx, setActiveSubDimIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getThemes(),
      api.getResponses(engId),
      api.getEngagement(engId),
      api.getScores(engId),
    ]).then(([t, r, e, s]) => {
      setThemes(t);
      setResponses(r);
      setEngagement(e);
      setScores(s);
    });
  }, [engId]);

  const refreshScores = useCallback(() => {
    api.getScores(engId).then(setScores);
  }, [engId]);

  const activeTheme = themes[activeThemeIdx];
  const activeSubDim = activeTheme?.sub_dimensions[activeSubDimIdx];

  const updateResponse = async (
    questionId: number,
    field: "current_score" | "target_score" | "notes",
    value: number | string | null
  ) => {
    const current = responses[questionId] || { current_score: null, target_score: null, notes: null };
    const updated = { ...current, [field]: value };
    setResponses((prev) => ({ ...prev, [questionId]: updated }));

    setSaving(true);
    await api.upsertResponse(engId, {
      question_id: questionId,
      current_score: updated.current_score,
      target_score: updated.target_score,
      notes: updated.notes,
    });
    setSaving(false);
    refreshScores();
  };

  const answeredInSubDim = (subDimId: number) => {
    const theme = themes.find((t) => t.sub_dimensions.some((s) => s.id === subDimId));
    const sd = theme?.sub_dimensions.find((s) => s.id === subDimId);
    if (!sd) return 0;
    return sd.questions.filter((q) => responses[q.id]?.current_score != null).length;
  };

  const goNext = () => {
    if (!activeTheme) return;
    if (activeSubDimIdx < activeTheme.sub_dimensions.length - 1) {
      setActiveSubDimIdx(activeSubDimIdx + 1);
    } else if (activeThemeIdx < themes.length - 1) {
      setActiveThemeIdx(activeThemeIdx + 1);
      setActiveSubDimIdx(0);
    }
  };

  const goPrev = () => {
    if (activeSubDimIdx > 0) {
      setActiveSubDimIdx(activeSubDimIdx - 1);
    } else if (activeThemeIdx > 0) {
      const prevTheme = themes[activeThemeIdx - 1];
      setActiveThemeIdx(activeThemeIdx - 1);
      setActiveSubDimIdx(prevTheme.sub_dimensions.length - 1);
    }
  };

  const isFirst = activeThemeIdx === 0 && activeSubDimIdx === 0;
  const isLast =
    activeThemeIdx === themes.length - 1 &&
    activeSubDimIdx === (themes[activeThemeIdx]?.sub_dimensions.length ?? 1) - 1;

  if (!themes.length) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  const progress = scores?.progress;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
            <Home size={18} />
          </button>
          <div>
            <h1 className="font-semibold">{engagement?.client_name}</h1>
            <p className="text-xs text-slate-400">Cloud Maturity Assessment</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {saving && <span className="text-xs text-slate-400">Saving...</span>}
          {progress && (
            <div className="text-right">
              <div className="text-xs text-slate-400">{progress.answered}/{progress.total} answered</div>
              <div className="w-32 bg-slate-700 rounded-full h-1.5 mt-1">
                <div
                  className="bg-blue-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${(progress.answered / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          {scores && (
            <div className="text-center bg-slate-700 rounded-lg px-3 py-1.5">
              <div className="text-xs text-slate-400">Maturity</div>
              <div className="text-lg font-bold text-blue-400">{scores.overall_current.toFixed(1)}</div>
            </div>
          )}
          <button
            onClick={() => navigate(`/engagement/${engId}/dashboard`)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <BarChart2 size={15} /> Dashboard
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
          {themes.map((theme, ti) => (
            <div key={theme.id}>
              <button
                onClick={() => { setActiveThemeIdx(ti); setActiveSubDimIdx(0); }}
                className={`w-full text-left px-4 py-3 text-sm font-semibold border-b border-gray-100 flex items-center justify-between ${
                  ti === activeThemeIdx ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{theme.name}</span>
                <span className="text-xs font-normal text-gray-400">
                  {theme.sub_dimensions.reduce((acc, sd) => acc + answeredInSubDim(sd.id), 0)}/
                  {theme.sub_dimensions.length * 5}
                </span>
              </button>
              {ti === activeThemeIdx &&
                theme.sub_dimensions.map((sd, si) => {
                  const answered = answeredInSubDim(sd.id);
                  const total = sd.questions.length;
                  return (
                    <button
                      key={sd.id}
                      onClick={() => setActiveSubDimIdx(si)}
                      className={`w-full text-left px-6 py-2.5 text-xs border-b border-gray-50 flex items-center justify-between ${
                        si === activeSubDimIdx ? "bg-blue-100 text-blue-800 font-semibold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span>{sd.name}</span>
                      {answered === total ? (
                        <CheckCircle size={12} className="text-green-500" />
                      ) : (
                        <span className="text-gray-400">{answered}/{total}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeSubDim && (
            <>
              <div className="mb-6">
                <div className="text-sm text-blue-600 font-medium mb-1">{activeTheme.name}</div>
                <h2 className="text-2xl font-bold text-gray-900">{activeSubDim.name}</h2>
                <p className="text-gray-500 mt-1">{activeSubDim.description}</p>
                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                  <span>Theme weight: {(activeTheme.weight * 100).toFixed(0)}%</span>
                  <span>Sub-dim weight: {(activeSubDim.weight * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="space-y-6">
                {activeSubDim.questions.map((q, qi) => {
                  const resp = responses[q.id];
                  return (
                    <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <div className="flex items-start gap-3 mb-5">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">
                          {qi + 1}
                        </span>
                        <p className="text-gray-800 leading-relaxed">{q.text}</p>
                      </div>

                      <div className="flex gap-8 mb-4">
                        <ScoreSlider
                          label="Current Maturity"
                          value={resp?.current_score ?? null}
                          color="text-blue-600"
                          onChange={(v) => updateResponse(q.id, "current_score", v)}
                        />
                        <ScoreSlider
                          label="Target Maturity"
                          value={resp?.target_score ?? null}
                          color="text-green-600"
                          onChange={(v) => updateResponse(q.id, "target_score", v)}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500">Evidence / Notes</label>
                        <textarea
                          className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                          rows={2}
                          placeholder="Document evidence, observations, or context..."
                          value={resp?.notes ?? ""}
                          onChange={(e) => updateResponse(q.id, "notes", e.target.value || null)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between mt-8">
                <button
                  onClick={goPrev}
                  disabled={isFirst}
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={18} /> Previous
                </button>
                {isLast ? (
                  <button
                    onClick={() => navigate(`/engagement/${engId}/dashboard`)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <BarChart2 size={18} /> View Results
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Next <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
