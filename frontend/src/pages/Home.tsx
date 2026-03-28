import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Engagement } from "../api/client";
import { Plus, Trash2, BarChart2, ClipboardList, Calendar, User } from "lucide-react";

export default function Home() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = () => api.listEngagements().then(setEngagements);

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!clientName.trim()) return;
    setLoading(true);
    const eng = await api.createEngagement({ client_name: clientName.trim(), consultant_name: consultantName.trim() || undefined });
    setLoading(false);
    setShowForm(false);
    setClientName("");
    setConsultantName("");
    navigate(`/engagement/${eng.id}/assess`);
  };

  const del = async (id: number) => {
    if (!confirm("Delete this engagement?")) return;
    await api.deleteEngagement(id);
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Cloud Maturity Assessment</h1>
          <p className="text-blue-200 text-lg">Valiantys Consulting — Enterprise Cloud Readiness</p>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Engagements</h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> New Engagement
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl p-6 mb-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">New Engagement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultant Name</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Jane Smith"
                  value={consultantName}
                  onChange={(e) => setConsultantName(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={create}
                  disabled={loading || !clientName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? "Creating..." : "Start Assessment"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setClientName(""); setConsultantName(""); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {engagements.length === 0 ? (
            <div className="text-center py-16 text-blue-200">
              <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">No engagements yet. Create one to get started.</p>
            </div>
          ) : (
            engagements.map((eng) => (
              <div key={eng.id} className="bg-white rounded-xl p-5 shadow flex items-center justify-between group">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{eng.client_name}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    {eng.consultant_name && (
                      <span className="flex items-center gap-1">
                        <User size={13} /> {eng.consultant_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar size={13} /> {new Date(eng.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/engagement/${eng.id}/assess`)}
                    className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <ClipboardList size={15} /> Assess
                  </button>
                  <button
                    onClick={() => navigate(`/engagement/${eng.id}/dashboard`)}
                    className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <BarChart2 size={15} /> Results
                  </button>
                  <button
                    onClick={() => del(eng.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
