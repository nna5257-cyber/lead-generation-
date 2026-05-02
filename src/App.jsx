import { useState, useCallback, useEffect } from "react";
import {
  Copy, Check, RefreshCw, Plus, Trash2, Search,
  TrendingUp, Users, Send, DollarSign, Zap, Target,
  MessageSquare, Mail, Phone, Building2, MapPin, Briefcase,
  AlertCircle, BarChart3, Sparkles, X,
} from "lucide-react";

// ── Fonts ──────────────────────────────────────────────────────────────────
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; background: #080810; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #0e0e1a; }
    ::-webkit-scrollbar-thumb { background: #2a2a40; border-radius: 2px; }
    .font-display { font-family: 'Syne', sans-serif; }
    .font-body { font-family: 'DM Sans', sans-serif; }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
      100% { transform: scale(0.95); }
    }
    .skeleton {
      background: linear-gradient(90deg, #1a1a2e 25%, #22223a 50%, #1a1a2e 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 6px;
    }
    .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
    .fade-in { animation: fadeIn 0.35s ease forwards; }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      transition: all 0.2s ease;
    }
    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #5457e8, #7c4ee0);
      box-shadow: 0 0 20px rgba(99,102,241,0.35);
      transform: translateY(-1px);
    }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .status-badge { transition: all 0.15s ease; cursor: pointer; }
    .status-badge:hover { filter: brightness(1.2); transform: scale(1.05); }
    .input-field {
      background: #0e0e1a;
      border: 1px solid #1e1e30;
      color: #e2e4f0;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .input-field:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
    }
    .nav-tab { transition: all 0.2s ease; }
    .nav-tab.active { color: #a5b4fc; }
    .output-card { animation: fadeIn 0.4s ease forwards; }
    .toast {
      animation: fadeIn 0.3s ease forwards;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
    }
  `}</style>
);

// ── Claude API ─────────────────────────────────────────────────────────────
async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content?.find(b => b.type === "text")?.text ?? "";
}

function personalizePrompt(lead, icp, type) {
  const leadCtx = `Lead: ${lead.name} at ${lead.company}${lead.contact ? ` (${lead.contact})` : ""}. Source: ${lead.source || "unknown"}. Deal value: £${lead.value || 0}.`;
  const icpCtx = `Your offer: ${icp.offerType || "consulting services"}. Target industry: ${icp.industry || "business"}. Pain point you solve: ${icp.painPoint || "growth challenges"}. Primary platform: ${icp.platform || "email"}.`;
  if (type === "email") {
    return `${leadCtx}\n${icpCtx}\n\nWrite a highly personalized cold outreach email specifically for ${lead.name} at ${lead.company}. Reference their company by name. Connect your offer to their likely pain. Include a subject line then the body. No explanations.`;
  }
  return `${leadCtx}\n${icpCtx}\n\nWrite a short personalized cold DM for ${icp.platform || "LinkedIn"} specifically for ${lead.name} at ${lead.company}. Max 5 sentences. Use their name. Reference their company. End with a soft CTA. No explanations.`;
}

function scorePrompt(lead, icp) {
  return `You are a lead scoring expert. Score this lead's fit against the ICP on a 0–100 scale.

ICP:
- Industry: ${icp.industry || "not specified"}
- Company Size: ${icp.companySize || "not specified"}
- Budget: ${icp.budget || "not specified"}
- Location: ${icp.location || "not specified"}
- Pain Point: ${icp.painPoint || "not specified"}
- Offer Type: ${icp.offerType || "not specified"}

Lead:
- Name: ${lead.name}
- Company: ${lead.company}
- Source: ${lead.source || "unknown"}
- Deal Value: £${lead.value || 0}
- Status: ${lead.status}

Score based on: industry match, company size fit, budget alignment, source quality, and urgency from their pipeline status.

Return ONLY valid JSON, no markdown: {"score": 82, "reason": "Strong industry match and budget alignment"}`;
}

function getScoreTier(score) {
  if (score >= 90) return { label: "Hot",  cls: "bg-[#2a1510] text-[#ff6b4a] border-[#3d1f15]" };
  if (score >= 75) return { label: "Warm", cls: "bg-[#251f10] text-[#f5a623] border-[#3a2e15]" };
  if (score >= 60) return { label: "Mid",  cls: "bg-[#101825] text-[#60a5fa] border-[#152030]" };
  return                  { label: "Cold", cls: "bg-[#1a1a2e] text-[#4a4c6a] border-[#2a2a40]" };
}

function buildPrompt(icp, type) {
  const context = `Ideal Client Profile:
- Industry/Niche: ${icp.industry}
- Company Size: ${icp.companySize}
- Budget Range: ${icp.budget}
- Location: ${icp.location}
- Primary Platform/Channel: ${icp.platform}
- Pain Point: ${icp.painPoint}
- Offer Type: ${icp.offerType}`;

  const prompts = {
    email: `${context}\n\nWrite a high-converting cold outreach email targeting this client profile. Make it personal, pain-focused, and include a clear CTA. Use a conversational yet professional tone. Subject line + body only. No explanations.`,
    dm: `${context}\n\nWrite a short, punchy cold DM for ${icp.platform} targeting this client. Max 5 sentences. Open with a pattern-interrupt observation, connect their pain to your offer, end with a soft CTA. No explanations.`,
    questions: `${context}\n\nWrite exactly 5 sharp discovery/qualifying call questions for this prospect. Focus on uncovering budget, urgency, authority, and pain depth. Number them 1-5. Make them conversational but strategic. No explanations.`,
    pitch: `${context}\n\nWrite ONE powerful one-line pitch (max 20 words) for this offer targeting this client. Must be specific, outcome-focused, and immediately clear. No fluff. No explanations.`,
    subjects: `${context}\n\nWrite exactly 3 cold email subject lines for this client. Make them curiosity-driven, specific, and under 8 words each. Number them 1-3. No explanations.`,
    objection: `${context}\n\nWrite a professional objection-handling reply for when this prospect says "We don't have budget right now." Make it non-pushy, reframe the ROI, and keep the door open. 3-5 sentences. No explanations.`,
    followup: `${context}\n\nWrite a short follow-up message (email or DM) for when this prospect hasn't replied in 5 days. Reference the original outreach, add new value/insight, keep it brief (3-4 sentences), end with a soft question. No explanations.`,
  };
  return prompts[type];
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="toast font-body flex items-center gap-3 bg-[#1a1a2e] border border-[#6366f1]/40 rounded-xl px-4 py-3 shadow-2xl">
      <Check size={16} className="text-[#6366f1]" />
      <span className="text-[#c4c6e0] text-sm">{message}</span>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ lines = 4 }) {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${[100, 85, 92, 70][i % 4]}%` }} />
      ))}
    </div>
  );
}

// ── Output Card ────────────────────────────────────────────────────────────
function OutputCard({ title, icon: Icon, content, loading, onRegenerate, onCopy }) {
  return (
    <div className="output-card bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
            <Icon size={15} className="text-[#818cf8]" />
          </div>
          <span className="font-display font-600 text-[#d4d6f0] text-sm">{title}</span>
        </div>
        {!loading && content && (
          <div className="flex gap-2">
            <button onClick={onRegenerate} className="p-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#22223a] text-[#6b7280] hover:text-[#818cf8] transition-all" title="Regenerate">
              <RefreshCw size={13} />
            </button>
            <button onClick={onCopy} className="p-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#22223a] text-[#6b7280] hover:text-[#818cf8] transition-all" title="Copy">
              <Copy size={13} />
            </button>
          </div>
        )}
      </div>
      <div className="min-h-[80px]">
        {loading ? (
          <Skeleton lines={4} />
        ) : content ? (
          <p className="font-body text-[#9ca3b8] text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <p className="font-body text-[#3a3a50] text-sm italic">Generate assets to see output…</p>
        )}
      </div>
    </div>
  );
}

// ── ICP Builder ────────────────────────────────────────────────────────────
const defaultICP = {
  industry: "",
  companySize: "",
  budget: "",
  location: "",
  platform: "",
  painPoint: "",
  offerType: "",
};

function ICPBuilder({ icp, setIcp, onGenerate, generating }) {
  const fields = [
    { key: "industry", label: "Industry / Niche", placeholder: "e.g. SaaS, E-commerce, Finance", icon: Building2 },
    { key: "companySize", label: "Company Size", placeholder: "e.g. 10–50 employees, SME, Enterprise", icon: Users },
    { key: "budget", label: "Budget Range", placeholder: "e.g. £2k–£10k/month", icon: DollarSign },
    { key: "location", label: "Location", placeholder: "e.g. London, UK, US West Coast", icon: MapPin },
    { key: "platform", label: "Primary Platform / Channel", placeholder: "e.g. LinkedIn, Email, Instagram", icon: Target },
    { key: "painPoint", label: "Core Pain Point", placeholder: "e.g. Can't generate consistent leads", icon: AlertCircle },
    { key: "offerType", label: "Your Offer Type", placeholder: "e.g. Done-for-you lead gen, Brand strategy", icon: Briefcase },
  ];

  const isReady = Object.values(icp).every(v => v.trim().length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-700 text-[#e8eaf8] mb-1">Ideal Client Profile</h2>
        <p className="font-body text-[#5a5c78] text-sm">Define your target precisely. The sharper your ICP, the higher-converting your assets.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ key, label, placeholder, icon: Icon }) => (
          <div key={key} className={key === "painPoint" || key === "offerType" ? "md:col-span-2" : ""}>
            <label className="font-body text-[#6b6d88] text-xs font-500 mb-2 flex items-center gap-1.5">
              <Icon size={12} className="text-[#4a4c6a]" />
              {label}
            </label>
            {key === "painPoint" || key === "offerType" ? (
              <textarea
                value={icp[key]}
                onChange={e => setIcp(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={2}
                className="input-field font-body w-full rounded-xl px-4 py-3 text-sm resize-none"
              />
            ) : (
              <input
                value={icp[key]}
                onChange={e => setIcp(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="input-field font-body w-full rounded-xl px-4 py-3 text-sm"
              />
            )}
          </div>
        ))}
      </div>
      <button
        onClick={onGenerate}
        disabled={!isReady || generating}
        className="btn-primary font-display font-600 text-white rounded-xl px-8 py-3.5 text-sm flex items-center gap-2.5 w-full justify-center"
      >
        {generating ? (
          <><RefreshCw size={15} className="animate-spin" /> Generating Assets…</>
        ) : (
          <><Sparkles size={15} /> Generate Lead Assets</>
        )}
      </button>
      {!isReady && (
        <p className="font-body text-[#3a3c58] text-xs text-center">Fill all fields to unlock asset generation</p>
      )}
    </div>
  );
}

// ── AI Content Generator ───────────────────────────────────────────────────
function ContentGenerator({ icp, assets, setAssets, setGenerating, showToast }) {
  const outputDefs = [
    { key: "email", title: "Cold Outreach Email", icon: Mail },
    { key: "dm", title: "Cold DM", icon: MessageSquare },
    { key: "questions", title: "Discovery Call Questions", icon: Phone },
    { key: "pitch", title: "One-Line Pitch", icon: Zap },
    { key: "subjects", title: "Email Subject Lines", icon: Mail },
    { key: "objection", title: "Objection Handling Reply", icon: AlertCircle },
    { key: "followup", title: "Follow-Up Message", icon: Send },
  ];

  const regenerateOne = async (key) => {
    setAssets(p => ({ ...p, [key]: { content: "", loading: true } }));
    try {
      const text = await callClaude(buildPrompt(icp, key));
      setAssets(p => ({ ...p, [key]: { content: text, loading: false } }));
    } catch {
      setAssets(p => ({ ...p, [key]: { content: "Generation failed. Check your connection and try again.", loading: false } }));
    }
  };

  const copyContent = (content) => {
    navigator.clipboard.writeText(content);
    showToast("Copied to clipboard");
  };

  const hasAssets = Object.values(assets).some(a => a.content || a.loading);

  if (!hasAssets) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/8 border border-[#6366f1]/15 flex items-center justify-center">
          <Sparkles size={22} className="text-[#6366f1]/50" />
        </div>
        <p className="font-body text-[#3a3c58] text-sm text-center max-w-xs">
          Complete your ICP and click <span className="text-[#6366f1]">Generate Lead Assets</span> to create your outreach toolkit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-700 text-[#e8eaf8] mb-1">AI-Generated Outreach Assets</h2>
        <p className="font-body text-[#5a5c78] text-sm">Tailored assets built from your ICP. Copy, regenerate, or iterate each piece.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {outputDefs.map(({ key, title, icon }) => (
          <div key={key} className={key === "email" || key === "questions" ? "md:col-span-2" : ""}>
            <OutputCard
              title={title}
              icon={icon}
              content={assets[key]?.content ?? ""}
              loading={assets[key]?.loading ?? false}
              onRegenerate={() => regenerateOne(key)}
              onCopy={() => copyContent(assets[key]?.content ?? "")}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lead Outreach Modal ────────────────────────────────────────────────────
function LeadOutreachModal({ lead, icp, onClose }) {
  const [email, setEmail] = useState({ content: "", loading: true });
  const [dm, setDm] = useState({ content: "", loading: true });

  const generate = useCallback(async () => {
    setEmail({ content: "", loading: true });
    setDm({ content: "", loading: true });
    const [emailText, dmText] = await Promise.all([
      callClaude(personalizePrompt(lead, icp, "email")).catch(() => "Generation failed. Try again."),
      callClaude(personalizePrompt(lead, icp, "dm")).catch(() => "Generation failed. Try again."),
    ]);
    setEmail({ content: emailText, loading: false });
    setDm({ content: dmText, loading: false });
  }, [lead, icp]);

  useEffect(() => { generate(); }, [generate]);

  const copy = (text) => navigator.clipboard.writeText(text);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(8,8,16,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="fade-in bg-[#0c0c18] border border-[#1e1e30] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0c0c18] border-b border-[#1e1e30] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
                <Sparkles size={13} className="text-[#818cf8]" />
              </div>
              <span className="font-display font-700 text-[#e8eaf8] text-sm">Personalized Outreach</span>
            </div>
            <p className="font-body text-[#4a4c6a] text-xs mt-0.5 ml-9">{lead.name} · {lead.company}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={email.loading || dm.loading}
              className="p-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#22223a] text-[#6b7280] hover:text-[#818cf8] transition-all disabled:opacity-40"
              title="Regenerate"
            >
              <RefreshCw size={13} className={(email.loading || dm.loading) ? "animate-spin" : ""} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#22223a] text-[#6b7280] hover:text-[#ad4a4a] transition-all">
              <X size={13} />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <OutputCard
            title="Personalized Cold Email"
            icon={Mail}
            content={email.content}
            loading={email.loading}
            onRegenerate={() => {
              setEmail({ content: "", loading: true });
              callClaude(personalizePrompt(lead, icp, "email"))
                .then(t => setEmail({ content: t, loading: false }))
                .catch(() => setEmail({ content: "Generation failed. Try again.", loading: false }));
            }}
            onCopy={() => copy(email.content)}
          />
          <OutputCard
            title="Personalized Cold DM"
            icon={MessageSquare}
            content={dm.content}
            loading={dm.loading}
            onRegenerate={() => {
              setDm({ content: "", loading: true });
              callClaude(personalizePrompt(lead, icp, "dm"))
                .then(t => setDm({ content: t, loading: false }))
                .catch(() => setDm({ content: "Generation failed. Try again.", loading: false }));
            }}
            onCopy={() => copy(dm.content)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Lead Tracker ───────────────────────────────────────────────────────────
const STATUS_ORDER = ["Cold", "Warm", "Qualified", "Proposal Sent", "Closed", "Lost"];
const STATUS_COLORS = {
  Cold: "bg-[#1a1a2e] text-[#4a4c6a] border-[#2a2a40]",
  Warm: "bg-[#1a1f2e] text-[#6b8aad] border-[#1e2a3a]",
  Qualified: "bg-[#1a2220] text-[#4a9e7e] border-[#1e3028]",
  "Proposal Sent": "bg-[#221a2e] text-[#8b6aad] border-[#2a1e40]",
  Closed: "bg-[#1a2518] text-[#4aad64] border-[#1e3020]",
  Lost: "bg-[#251818] text-[#ad4a4a] border-[#3a1e1e]",
};

const emptyLead = { name: "", company: "", contact: "", source: "", value: "", status: "Cold", score: null, scoreReason: "", scoring: false };

function LeadTracker({ leads, setLeads, icp, showToast }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [form, setForm] = useState(emptyLead);
  const [showForm, setShowForm] = useState(false);
  const [personalizeTarget, setPersonalizeTarget] = useState(null);

  const addLead = () => {
    if (!form.name.trim()) return;
    setLeads(p => [...p, { ...form, id: Date.now(), value: parseFloat(form.value) || 0 }]);
    setForm(emptyLead);
    setShowForm(false);
    showToast("Lead added");
  };

  const deleteLead = (id) => {
    setLeads(p => p.filter(l => l.id !== id));
    showToast("Lead removed");
  };

  const cycleStatus = (id) => {
    setLeads(p => p.map(l => {
      if (l.id !== id) return l;
      const idx = STATUS_ORDER.indexOf(l.status);
      return { ...l, status: STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] };
    }));
  };

  const updateLead = (id, field, value) => {
    setLeads(p => p.map(l =>
      l.id !== id ? l : { ...l, [field]: field === "value" ? parseFloat(value) || 0 : value }
    ));
  };

  const scoreLead = async (id) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    setLeads(p => p.map(l => l.id === id ? { ...l, scoring: true } : l));
    try {
      const text = await callClaude(scorePrompt(lead, icp));
      const parsed = JSON.parse(text.trim());
      setLeads(p => p.map(l => l.id === id ? { ...l, score: parsed.score, scoreReason: parsed.reason, scoring: false } : l));
    } catch {
      setLeads(p => p.map(l => l.id === id ? { ...l, scoring: false } : l));
      showToast("Scoring failed — try again");
    }
  };

  const filtered = leads
    .filter(l => filterStatus === "All" || l.status === filterStatus)
    .filter(l => [l.name, l.company, l.contact, l.source].some(f => f?.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-xl font-700 text-[#e8eaf8] mb-1">Lead Tracker</h2>
          <p className="font-body text-[#5a5c78] text-sm">
            {leads.length} leads tracked · £{leads.filter(l => l.status === "Closed").reduce((s, l) => s + (l.value || 0), 0).toLocaleString()} closed
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary font-display font-600 text-white rounded-xl px-5 py-2.5 text-sm flex items-center gap-2">
          <Plus size={15} /> Add Lead
        </button>
      </div>

      {showForm && (
        <div className="fade-in bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: "name", placeholder: "Full name" },
              { key: "company", placeholder: "Company" },
              { key: "contact", placeholder: "Email / LinkedIn" },
              { key: "source", placeholder: "Source (e.g. LinkedIn)" },
              { key: "value", placeholder: "Deal value (£)" },
            ].map(({ key, placeholder }) => (
              <input
                key={key}
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="input-field font-body rounded-xl px-3 py-2.5 text-sm"
              />
            ))}
            <select
              value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="input-field font-body rounded-xl px-3 py-2.5 text-sm"
            >
              {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={addLead} disabled={!form.name.trim()} className="btn-primary font-display font-600 text-white rounded-xl px-5 py-2.5 text-sm">Save Lead</button>
            <button onClick={() => setShowForm(false)} className="font-body text-[#5a5c78] hover:text-[#9ca3b8] text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3a3c58]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="input-field font-body w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", ...STATUS_ORDER].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`font-body text-xs rounded-lg px-3 py-2 border transition-all ${filterStatus === s ? "bg-[#6366f1]/15 border-[#6366f1]/40 text-[#818cf8]" : "bg-[#0e0e1a] border-[#1e1e30] text-[#4a4c6a] hover:border-[#2a2a40]"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users size={32} className="text-[#2a2a40] mx-auto mb-3" />
          <p className="font-body text-[#3a3c58] text-sm">
            {leads.length === 0 ? "No leads yet. Add your first one above." : "No leads match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <div key={lead.id} className="fade-in bg-[#0e0e1a] border border-[#1e1e30] rounded-xl px-4 py-3.5 flex items-center gap-3 flex-wrap hover:border-[#2a2a40] transition-colors group">
              <div className="flex-1 min-w-[140px]">
                <input
                  value={lead.name}
                  onChange={e => updateLead(lead.id, "name", e.target.value)}
                  className="font-display font-600 text-[#d4d6f0] text-sm bg-transparent border-none outline-none w-full"
                />
                <input
                  value={lead.company}
                  onChange={e => updateLead(lead.id, "company", e.target.value)}
                  placeholder="Company"
                  className="font-body text-[#5a5c78] text-xs bg-transparent border-none outline-none w-full mt-0.5"
                />
              </div>
              <input
                value={lead.contact}
                onChange={e => updateLead(lead.id, "contact", e.target.value)}
                placeholder="Contact"
                className="font-body text-[#5a5c78] text-xs bg-transparent border-none outline-none flex-1 min-w-[120px]"
              />
              <input
                value={lead.source}
                onChange={e => updateLead(lead.id, "source", e.target.value)}
                placeholder="Source"
                className="font-body text-[#5a5c78] text-xs bg-transparent border-none outline-none w-24 hidden md:block"
              />
              <div className="flex items-center gap-1.5">
                <span className="font-body text-[#4a4c6a] text-xs">£</span>
                <input
                  type="number"
                  value={lead.value || ""}
                  onChange={e => updateLead(lead.id, "value", e.target.value)}
                  placeholder="0"
                  className="font-body text-[#9ca3b8] text-xs bg-transparent border-none outline-none w-16 text-right"
                />
              </div>
              {/* Score badge */}
              {lead.scoring ? (
                <div className="flex items-center gap-1.5 w-20 justify-center">
                  <RefreshCw size={11} className="animate-spin text-[#4a4c6a]" />
                  <span className="font-body text-[#3a3c58] text-xs">Scoring…</span>
                </div>
              ) : lead.score != null ? (
                <div
                  title={lead.scoreReason}
                  className={`font-body text-xs rounded-lg px-2.5 py-1.5 border flex items-center gap-1.5 cursor-default ${getScoreTier(lead.score).cls}`}
                >
                  <span className="font-display font-700">{lead.score}</span>
                  <span className="opacity-75">{getScoreTier(lead.score).label}</span>
                </div>
              ) : (
                <button
                  onClick={() => scoreLead(lead.id)}
                  className="opacity-0 group-hover:opacity-100 font-body text-[#3a3c58] hover:text-[#818cf8] text-xs transition-all flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[#6366f1]/10"
                  title="Score this lead with AI"
                >
                  <BarChart3 size={11} /> Score
                </button>
              )}
              <button
                onClick={() => cycleStatus(lead.id)}
                className={`status-badge font-body text-xs rounded-lg px-3 py-1.5 border ${STATUS_COLORS[lead.status]}`}
              >
                {lead.status}
              </button>
              <button
                onClick={() => setPersonalizeTarget(lead)}
                className="opacity-0 group-hover:opacity-100 text-[#3a3c58] hover:text-[#818cf8] transition-all p-1.5 rounded-lg hover:bg-[#6366f1]/10"
                title="Generate personalized outreach"
              >
                <Sparkles size={13} />
              </button>
              <button
                onClick={() => deleteLead(lead.id)}
                className="opacity-0 group-hover:opacity-100 text-[#3a3c58] hover:text-[#ad4a4a] transition-all p-1.5 rounded-lg hover:bg-[#251818]"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {personalizeTarget && (
        <LeadOutreachModal
          lead={personalizeTarget}
          icp={icp}
          onClose={() => setPersonalizeTarget(null)}
        />
      )}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard({ leads, assets }) {
  const total = leads.length;
  const warm = leads.filter(l => l.status === "Warm" || l.status === "Qualified").length;
  const proposals = leads.filter(l => l.status === "Proposal Sent").length;
  const revenue = leads.filter(l => l.status === "Closed").reduce((s, l) => s + (l.value || 0), 0);

  const stats = [
    { label: "Total Leads", value: total, icon: Users, color: "text-[#818cf8]", bg: "bg-[#6366f1]/8", border: "border-[#6366f1]/15" },
    { label: "Warm / Qualified", value: warm, icon: TrendingUp, color: "text-[#60a5fa]", bg: "bg-[#3b82f6]/8", border: "border-[#3b82f6]/15" },
    { label: "Proposals Sent", value: proposals, icon: Send, color: "text-[#c084fc]", bg: "bg-[#a855f7]/8", border: "border-[#a855f7]/15" },
    { label: "Revenue Closed", value: `£${revenue.toLocaleString()}`, icon: DollarSign, color: "text-[#4ade80]", bg: "bg-[#22c55e]/8", border: "border-[#22c55e]/15" },
  ];

  const pipeline = STATUS_ORDER.map(s => ({ status: s, count: leads.filter(l => l.status === s).length }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-700 text-[#e8eaf8] mb-1">Dashboard</h2>
        <p className="font-body text-[#5a5c78] text-sm">Your pipeline at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`card-hover bg-[#0e0e1a] border ${border} rounded-2xl p-5 space-y-4`}>
            <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <div className={`font-display font-700 text-2xl ${color}`}>{value}</div>
              <div className="font-body text-[#4a4c6a] text-xs mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-600 text-[#d4d6f0] text-sm flex items-center gap-2">
            <BarChart3 size={15} className="text-[#6366f1]" /> Pipeline Breakdown
          </h3>
          <div className="space-y-3">
            {pipeline.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <div className="w-24 font-body text-[#5a5c78] text-xs">{status}</div>
                <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-full transition-all duration-500"
                    style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
                  />
                </div>
                <div className="font-display font-600 text-[#9ca3b8] text-sm w-6 text-right">{count}</div>
              </div>
            ))}
            {total === 0 && (
              <p className="font-body text-[#3a3c58] text-xs text-center py-4">Add leads to see your pipeline</p>
            )}
          </div>
        </div>

        <div className="bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-600 text-[#d4d6f0] text-sm flex items-center gap-2">
            <Sparkles size={15} className="text-[#6366f1]" /> Asset Status
          </h3>
          <div className="space-y-3">
            {[
              { label: "Cold Email", key: "email" },
              { label: "Cold DM", key: "dm" },
              { label: "Discovery Questions", key: "questions" },
              { label: "One-Line Pitch", key: "pitch" },
              { label: "Subject Lines", key: "subjects" },
              { label: "Objection Handler", key: "objection" },
              { label: "Follow-Up", key: "followup" },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="font-body text-[#5a5c78] text-xs">{label}</span>
                <span className={`font-body text-xs px-2 py-0.5 rounded-md ${assets[key]?.content ? "bg-[#22c55e]/10 text-[#4ade80]" : "bg-[#1a1a2e] text-[#3a3c58]"}`}>
                  {assets[key]?.loading ? "Generating…" : assets[key]?.content ? "Ready" : "Not generated"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [icp, setIcp] = useState(defaultICP);
  const [assets, setAssets] = useState({});
  const [generating, setGenerating] = useState(false);
  const [leads, setLeads] = useState([
    { id: 1, name: "Sarah Mitchell", company: "Venture Co", contact: "s.mitchell@venture.co", source: "LinkedIn", value: 4500, status: "Warm", score: 78, scoreReason: "Good industry fit, strong platform match, mid-range budget alignment.", scoring: false },
    { id: 2, name: "James Okafor", company: "ScaleHQ", contact: "james@scalehq.io", source: "Cold Email", value: 8000, status: "Qualified", score: 91, scoreReason: "Excellent ICP match — right size, high deal value, qualified status signals urgency.", scoring: false },
    { id: 3, name: "Priya Sharma", company: "Bloom Brand", contact: "priya@bloombrand.com", source: "Referral", value: 12000, status: "Closed", score: 95, scoreReason: "Perfect fit — referral source, high value, closed deal confirms ICP accuracy.", scoring: false },
  ]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => setToast(msg), []);

  const generateAll = async () => {
    setGenerating(true);
    const keys = ["email", "dm", "questions", "pitch", "subjects", "objection", "followup"];
    setAssets(Object.fromEntries(keys.map(k => [k, { content: "", loading: true }])));
    setActiveTab("assets");

    await Promise.all(keys.map(async (key) => {
      try {
        const text = await callClaude(buildPrompt(icp, key));
        setAssets(p => ({ ...p, [key]: { content: text, loading: false } }));
      } catch {
        setAssets(p => ({ ...p, [key]: { content: "Generation failed. Please try regenerating this asset.", loading: false } }));
      }
    }));
    setGenerating(false);
    showToast("All assets generated");
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "icp", label: "ICP Builder", icon: Target },
    { id: "assets", label: "Assets", icon: Sparkles },
    { id: "leads", label: "Lead Tracker", icon: Users },
  ];

  return (
    <>
      <FontLoader />
      <div className="font-body min-h-screen" style={{ background: "#080810", color: "#e2e4f0" }}>

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-[#1a1a2a]" style={{ background: "rgba(8,8,16,0.92)", backdropFilter: "blur(16px)" }}>
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg">
                <Zap size={15} className="text-white" />
              </div>
              <span className="font-display font-700 text-[#e8eaf8] text-base tracking-tight">LeadForge</span>
              <span className="hidden md:block font-body text-[#2a2a40] text-xs border border-[#1e1e30] px-2 py-0.5 rounded-md">AI-Powered</span>
            </div>
            <nav className="flex gap-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`nav-tab font-body text-sm px-3 md:px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${activeTab === id ? "active bg-[#6366f1]/10 text-[#a5b4fc]" : "text-[#4a4c6a] hover:text-[#8a8ca8]"}`}
                >
                  <Icon size={13} />
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          {activeTab === "dashboard" && <Dashboard leads={leads} assets={assets} />}
          {activeTab === "icp" && (
            <div className="max-w-2xl">
              <ICPBuilder icp={icp} setIcp={setIcp} onGenerate={generateAll} generating={generating} />
            </div>
          )}
          {activeTab === "assets" && (
            <ContentGenerator
              icp={icp}
              assets={assets}
              setAssets={setAssets}
              generating={generating}
              setGenerating={setGenerating}
              showToast={showToast}
            />
          )}
          {activeTab === "leads" && <LeadTracker leads={leads} setLeads={setLeads} icp={icp} showToast={showToast} />}
        </main>

        {/* Toast */}
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </>
  );
}
