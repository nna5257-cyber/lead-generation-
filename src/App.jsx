import { useState, useCallback, useEffect } from "react";
import {
  Copy, Check, RefreshCw, Plus, Trash2, Search,
  TrendingUp, Users, Send, DollarSign, Zap, Target,
  MessageSquare, Mail, Phone, Building2, MapPin, Briefcase,
  AlertCircle, BarChart3, Sparkles, X, KeyRound, Eye, EyeOff, ListOrdered, Download,
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

// ── API Key ────────────────────────────────────────────────────────────────
let _apiKey = localStorage.getItem("lf_api_key") ?? "";

function saveApiKey(key) {
  _apiKey = key.trim();
  localStorage.setItem("lf_api_key", _apiKey);
}

function getApiKey() { return _apiKey; }

// ── Claude API ─────────────────────────────────────────────────────────────
async function callClaude(prompt) {
  if (!_apiKey) {
    window.dispatchEvent(new CustomEvent("lf:no-api-key"));
    throw new Error("NO_API_KEY");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": _apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("lf:invalid-api-key"));
      throw new Error("INVALID_API_KEY");
    }
    throw new Error(`API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.find(b => b.type === "text")?.text ?? "";
}

function personalizePrompt(lead, icp, type) {
  const leadCtx = `Lead: ${lead.name} at ${lead.company}${lead.contact ? ` (${lead.contact})` : ""}. Source: ${lead.source || "unknown"}. Deal value: £${lead.value || 0}.${lead.notes ? `\nResearch notes: ${lead.notes}` : ""}`;
  const icpCtx = `Your offer: ${icp.offerType || "consulting services"}. Target industry: ${icp.industry || "business"}. Pain point you solve: ${icp.painPoint || "growth challenges"}. Primary platform: ${icp.platform || "email"}.`;
  if (type === "email") {
    return `${leadCtx}\n${icpCtx}\n\nWrite a highly personalized cold outreach email specifically for ${lead.name} at ${lead.company}. Reference their company by name.${lead.notes ? " Weave in the research notes naturally." : ""} Connect your offer to their likely pain. Include a subject line then the body. No explanations.`;
  }
  return `${leadCtx}\n${icpCtx}\n\nWrite a short personalized cold DM for ${icp.platform || "LinkedIn"} specifically for ${lead.name} at ${lead.company}. Max 5 sentences. Use their name.${lead.notes ? " Reference the research notes naturally." : ""} Reference their company. End with a soft CTA. No explanations.`;
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

function downloadFile(filename, content, mime = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function leadsToCSV(leads) {
  const headers = ["Name", "Company", "Contact", "Source", "Value (£)", "Status", "Score", "Score Reason"];
  const rows = leads.map(l => [
    l.name, l.company, l.contact, l.source, l.value ?? "", l.status,
    l.score ?? "", l.scoreReason ?? "",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`));
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
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
    seq1: `${context}\n\nWrite Email 1 of a 5-part cold outreach sequence (Day 1). Initial contact — open with their specific pain, connect it to your offer, one clear CTA. Subject line + body. Under 150 words. No explanations.`,
    seq2: `${context}\n\nWrite Email 2 of a 5-part cold outreach sequence (Day 3). Value-add — share one sharp insight or stat directly relevant to their pain. Briefly reference the first email. Under 120 words. No explanations.`,
    seq3: `${context}\n\nWrite Email 3 of a 5-part cold outreach sequence (Day 6). Social proof — reference a result you achieved for a similar client. Keep it specific and credible. Short CTA. Under 100 words. No explanations.`,
    seq4: `${context}\n\nWrite Email 4 of a 5-part cold outreach sequence (Day 9). Direct ask — offer one low-friction next step (15-min call, quick audit, demo). Under 80 words. No explanations.`,
    seq5: `${context}\n\nWrite Email 5 of a 5-part cold outreach sequence (Day 14). Break-up email — acknowledge they may not be interested, leave the door open, include one final hook. Under 70 words. No explanations.`,
  };
  return prompts[type];
}

// ── Onboarding ─────────────────────────────────────────────────────────────
function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: Zap,
      title: "Welcome to LeadForge",
      body: "Your AI-powered lead generation toolkit. Build your ideal client profile, generate outreach assets, score leads, and track your pipeline — all in one place.",
      cta: "Get Started",
    },
    {
      icon: Target,
      title: "Define Your ICP",
      body: "Your Ideal Client Profile is the engine behind every asset LeadForge generates. The more specific you are, the higher-converting your outreach will be.",
      cta: "Build My ICP",
    },
    {
      icon: Sparkles,
      title: "Generate & Close",
      body: "Once your ICP is set, LeadForge generates cold emails, DMs, discovery questions, pitches, and more — tailored precisely to your ideal client.",
      cta: "Let's Go",
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(8,8,16,0.92)", backdropFilter: "blur(12px)" }}>
      <div className="fade-in w-full max-w-sm">
        <div className="bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/20 flex items-center justify-center">
              <Icon size={24} className="text-[#818cf8]" />
            </div>
          </div>
          <div>
            <h2 className="font-display font-700 text-[#e8eaf8] text-lg mb-2">{current.title}</h2>
            <p className="font-body text-[#5a5c78] text-sm leading-relaxed">{current.body}</p>
          </div>
          {/* Step dots */}
          <div className="flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all ${i === step ? "w-6 bg-[#6366f1]" : "w-1.5 bg-[#2a2a40]"}`} />
            ))}
          </div>
          <button
            onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
            className="btn-primary font-display font-600 text-white rounded-xl px-6 py-3 text-sm w-full"
          >
            {current.cta}
          </button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="font-body text-[#3a3c58] hover:text-[#6b7280] text-xs transition-colors">
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── API Key Modal ──────────────────────────────────────────────────────────
function ApiKeyModal({ onSave, isUpdate = false }) {
  const [val, setVal] = useState(isUpdate ? getApiKey() : "");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const handleSave = () => {
    const trimmed = val.trim();
    if (!trimmed.startsWith("sk-ant-")) {
      setError("Key should start with sk-ant-  — check and try again.");
      return;
    }
    saveApiKey(trimmed);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(8,8,16,0.96)", backdropFilter: "blur(12px)" }}>
      <div className="fade-in w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-display font-700 text-[#e8eaf8] text-xl tracking-tight">LeadForge</span>
        </div>

        <div className="bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-7 space-y-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
                <KeyRound size={13} className="text-[#818cf8]" />
              </div>
              <h2 className="font-display font-700 text-[#e8eaf8] text-base">
                {isUpdate ? "Update API Key" : "Enter your Anthropic API Key"}
              </h2>
            </div>
            <p className="font-body text-[#5a5c78] text-sm leading-relaxed">
              {isUpdate
                ? "Your key is stored only in your browser. LeadForge never sees it."
                : "LeadForge uses Claude to generate your lead assets. Your key is stored locally in your browser and never sent to us."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="font-body text-[#6b6d88] text-xs">API Key</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={val}
                onChange={e => { setVal(e.target.value); setError(""); }}
                placeholder="sk-ant-api03-..."
                className="input-field font-body w-full rounded-xl px-4 py-3 text-sm pr-10"
                onKeyDown={e => e.key === "Enter" && handleSave()}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a3c58] hover:text-[#6b7280] transition-colors"
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {error && <p className="font-body text-[#ff6b4a] text-xs">{error}</p>}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSave}
              disabled={!val.trim()}
              className="btn-primary font-display font-600 text-white rounded-xl px-6 py-3 text-sm w-full"
            >
              {isUpdate ? "Update Key" : "Save & Continue"}
            </button>
            <p className="font-body text-[#3a3c58] text-xs text-center">
              Get a key at{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-[#6366f1] hover:underline">
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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
function OutputCard({ title, icon: Icon, content, loading, history = [], onRegenerate, onCopy, onRestoreVersion }) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="output-card bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
            <Icon size={15} className="text-[#818cf8]" />
          </div>
          <span className="font-display font-600 text-[#d4d6f0] text-sm">{title}</span>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className="font-body text-[#3a3c58] hover:text-[#6b7280] text-xs transition-colors flex items-center gap-1"
              title="Version history"
            >
              <RefreshCw size={10} />
              {history.length}
            </button>
          )}
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
      {showHistory && history.length > 0 && (
        <div className="border-t border-[#1a1a2e] pt-4 space-y-3">
          <p className="font-body text-[#3a3c58] text-xs">Previous versions — click to restore</p>
          {history.map((v, i) => (
            <div key={i} className="flex items-start gap-2 group">
              <p className="font-body text-[#3a3c58] text-xs leading-relaxed flex-1 line-clamp-2">{v}</p>
              <button
                onClick={() => { onRestoreVersion(v); setShowHistory(false); }}
                className="opacity-0 group-hover:opacity-100 font-body text-[#6366f1] text-xs transition-all flex-shrink-0"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
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
  const loadProfiles = () => { try { return JSON.parse(localStorage.getItem("lf_icp_profiles") ?? "[]"); } catch { return []; } };
  const [profiles, setProfiles] = useState(loadProfiles);
  const [profileName, setProfileName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const saveProfile = () => {
    if (!profileName.trim()) return;
    const updated = [...profiles.filter(p => p.name !== profileName.trim()), { name: profileName.trim(), icp }];
    setProfiles(updated);
    localStorage.setItem("lf_icp_profiles", JSON.stringify(updated));
    setShowSave(false);
    setProfileName("");
  };

  const deleteProfile = (name) => {
    const updated = profiles.filter(p => p.name !== name);
    setProfiles(updated);
    localStorage.setItem("lf_icp_profiles", JSON.stringify(updated));
  };

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
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-xl font-700 text-[#e8eaf8] mb-1">Ideal Client Profile</h2>
          <p className="font-body text-[#5a5c78] text-sm">Define your target precisely. The sharper your ICP, the higher-converting your assets.</p>
        </div>
        <button
          onClick={() => setShowSave(v => !v)}
          className="font-body text-[#5a5c78] hover:text-[#9ca3b8] border border-[#1e1e30] hover:border-[#2a2a40] rounded-xl px-4 py-2 text-sm flex items-center gap-2 transition-all"
        >
          <Plus size={13} /> Save Profile
        </button>
      </div>

      {/* Saved profiles */}
      {profiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profiles.map(p => (
            <div key={p.name} className="flex items-center gap-1 bg-[#0e0e1a] border border-[#1e1e30] rounded-lg px-3 py-1.5 group">
              <button
                onClick={() => setIcp(p.icp)}
                className="font-body text-xs text-[#6b7280] hover:text-[#a5b4fc] transition-colors"
              >
                {p.name}
              </button>
              <button
                onClick={() => deleteProfile(p.name)}
                className="opacity-0 group-hover:opacity-100 text-[#3a3c58] hover:text-[#ad4a4a] transition-all ml-1"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save form */}
      {showSave && (
        <div className="fade-in flex gap-2">
          <input
            value={profileName}
            onChange={e => setProfileName(e.target.value)}
            placeholder="Profile name (e.g. SaaS Founders)"
            className="input-field font-body flex-1 rounded-xl px-4 py-2.5 text-sm"
            onKeyDown={e => e.key === "Enter" && saveProfile()}
            autoFocus
          />
          <button onClick={saveProfile} disabled={!profileName.trim()} className="btn-primary font-display font-600 text-white rounded-xl px-4 py-2.5 text-sm">Save</button>
          <button onClick={() => setShowSave(false)} className="font-body text-[#5a5c78] text-sm hover:text-[#9ca3b8] transition-colors px-2">Cancel</button>
        </div>
      )}

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
  const [subTab, setSubTab] = useState("assets");
  const [generatingSeq, setGeneratingSeq] = useState(false);

  const outputDefs = [
    { key: "email", title: "Cold Outreach Email", icon: Mail },
    { key: "dm", title: "Cold DM", icon: MessageSquare },
    { key: "questions", title: "Discovery Call Questions", icon: Phone },
    { key: "pitch", title: "One-Line Pitch", icon: Zap },
    { key: "subjects", title: "Email Subject Lines", icon: Mail },
    { key: "objection", title: "Objection Handling Reply", icon: AlertCircle },
    { key: "followup", title: "Follow-Up Message", icon: Send },
  ];

  const seqDefs = [
    { key: "seq1", title: "Email 1 — Day 1: Cold Open", icon: Mail },
    { key: "seq2", title: "Email 2 — Day 3: Value Add", icon: Mail },
    { key: "seq3", title: "Email 3 — Day 6: Social Proof", icon: Mail },
    { key: "seq4", title: "Email 4 — Day 9: Direct Ask", icon: Send },
    { key: "seq5", title: "Email 5 — Day 14: Break-Up", icon: Mail },
  ];

  const regenerateOne = async (key) => {
    setAssets(p => {
      const prev = p[key]?.content;
      const prevHistory = p[key]?.history ?? [];
      const history = prev ? [prev, ...prevHistory].slice(0, 5) : prevHistory;
      return { ...p, [key]: { content: "", loading: true, history } };
    });
    try {
      const text = await callClaude(buildPrompt(icp, key));
      setAssets(p => ({ ...p, [key]: { ...p[key], content: text, loading: false } }));
    } catch {
      setAssets(p => ({ ...p, [key]: { ...p[key], content: "Generation failed. Check your connection and try again.", loading: false } }));
    }
  };

  const restoreVersion = (key, version) => {
    setAssets(p => {
      const cur = p[key]?.content;
      const history = (p[key]?.history ?? []).filter(v => v !== version);
      const newHistory = cur ? [cur, ...history].slice(0, 5) : history;
      return { ...p, [key]: { ...p[key], content: version, history: newHistory } };
    });
    showToast("Version restored");
  };

  const generateSequence = async () => {
    setGeneratingSeq(true);
    const keys = ["seq1", "seq2", "seq3", "seq4", "seq5"];
    setAssets(p => ({ ...p, ...Object.fromEntries(keys.map(k => [k, { content: "", loading: true }])) }));
    await Promise.all(keys.map(async (key) => {
      try {
        const text = await callClaude(buildPrompt(icp, key));
        setAssets(p => ({ ...p, [key]: { content: text, loading: false } }));
      } catch {
        setAssets(p => ({ ...p, [key]: { content: "Generation failed. Try regenerating.", loading: false } }));
      }
    }));
    setGeneratingSeq(false);
    showToast("Email sequence generated");
  };

  const copyContent = (content) => {
    navigator.clipboard.writeText(content);
    showToast("Copied to clipboard");
  };

  const hasAssets = Object.values(assets).some(a => a.content || a.loading);
  const hasSeq = seqDefs.some(d => assets[d.key]?.content || assets[d.key]?.loading);
  const isIcpReady = Object.values(icp).every(v => v.trim().length > 0);

  const EmptyState = ({ label, onGenerate, loading }) => (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/8 border border-[#6366f1]/15 flex items-center justify-center">
        <Sparkles size={22} className="text-[#6366f1]/50" />
      </div>
      {isIcpReady ? (
        <div className="text-center space-y-3">
          <p className="font-body text-[#3a3c58] text-sm max-w-xs">{label}</p>
          <button onClick={onGenerate} disabled={loading} className="btn-primary font-display font-600 text-white rounded-xl px-6 py-2.5 text-sm flex items-center gap-2 mx-auto">
            {loading ? <><RefreshCw size={13} className="animate-spin" /> Generating…</> : <><Sparkles size={13} /> Generate Now</>}
          </button>
        </div>
      ) : (
        <p className="font-body text-[#3a3c58] text-sm text-center max-w-xs">
          Complete your ICP and click <span className="text-[#6366f1]">Generate Lead Assets</span> first.
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-xl font-700 text-[#e8eaf8] mb-1">AI-Generated Outreach Assets</h2>
          <p className="font-body text-[#5a5c78] text-sm">Tailored assets built from your ICP. Copy, regenerate, or iterate each piece.</p>
        </div>
        <div className="flex gap-1 bg-[#0e0e1a] border border-[#1e1e30] rounded-xl p-1">
          <button onClick={() => setSubTab("assets")} className={`font-body text-xs px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${subTab === "assets" ? "bg-[#6366f1]/15 text-[#818cf8]" : "text-[#4a4c6a] hover:text-[#6b7280]"}`}>
            <Sparkles size={11} /> Assets
          </button>
          <button onClick={() => setSubTab("sequence")} className={`font-body text-xs px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${subTab === "sequence" ? "bg-[#6366f1]/15 text-[#818cf8]" : "text-[#4a4c6a] hover:text-[#6b7280]"}`}>
            <ListOrdered size={11} /> Sequence
          </button>
        </div>
      </div>

      {subTab === "assets" && (
        !hasAssets ? (
          <EmptyState label="Generate your outreach asset toolkit from your ICP." onGenerate={() => {}} loading={false} />
        ) : (
          <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                const lines = outputDefs.map(d => `## ${d.title}\n\n${assets[d.key]?.content ?? "(not generated)"}`).join("\n\n---\n\n");
                downloadFile("outreach-assets.txt", lines);
                showToast("Assets exported");
              }}
              className="font-body text-[#5a5c78] hover:text-[#9ca3b8] border border-[#1e1e30] hover:border-[#2a2a40] rounded-xl px-4 py-2 text-xs flex items-center gap-1.5 transition-all"
            >
              <Download size={12} /> Export Assets
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outputDefs.map(({ key, title, icon }) => (
              <div key={key} className={key === "email" || key === "questions" ? "md:col-span-2" : ""}>
                <OutputCard
                  title={title}
                  icon={icon}
                  content={assets[key]?.content ?? ""}
                  loading={assets[key]?.loading ?? false}
                  history={assets[key]?.history ?? []}
                  onRegenerate={() => regenerateOne(key)}
                  onCopy={() => copyContent(assets[key]?.content ?? "")}
                  onRestoreVersion={(v) => restoreVersion(key, v)}
                />
              </div>
            ))}
          </div>
          </div>
        )
      )}

      {subTab === "sequence" && (
        !hasSeq ? (
          <EmptyState label="Generate a 5-email drip sequence — Day 1 through Day 14." onGenerate={generateSequence} loading={generatingSeq} />
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={generateSequence} disabled={generatingSeq} className="btn-primary font-display font-600 text-white rounded-xl px-5 py-2.5 text-sm flex items-center gap-2">
                {generatingSeq ? <><RefreshCw size={13} className="animate-spin" /> Regenerating…</> : <><RefreshCw size={13} /> Regenerate All</>}
              </button>
            </div>
            {seqDefs.map(({ key, title, icon }) => (
              <OutputCard
                key={key}
                title={title}
                icon={icon}
                content={assets[key]?.content ?? ""}
                loading={assets[key]?.loading ?? false}
                history={assets[key]?.history ?? []}
                onRegenerate={() => regenerateOne(key)}
                onCopy={() => copyContent(assets[key]?.content ?? "")}
                onRestoreVersion={(v) => restoreVersion(key, v)}
              />
            ))}
          </div>
        )
      )}
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

const emptyLead = { name: "", company: "", contact: "", source: "", value: "", status: "Cold", score: null, scoreReason: "", scoring: false, notes: "" };

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
        <div className="flex gap-2">
          {leads.length > 0 && (
            <button
              onClick={() => { downloadFile("leads.csv", leadsToCSV(leads), "text/csv"); showToast("Leads exported"); }}
              className="font-body text-[#5a5c78] hover:text-[#9ca3b8] border border-[#1e1e30] hover:border-[#2a2a40] rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 transition-all"
            >
              <Download size={13} /> Export CSV
            </button>
          )}
          <button onClick={() => setShowForm(v => !v)} className="btn-primary font-display font-600 text-white rounded-xl px-5 py-2.5 text-sm flex items-center gap-2">
            <Plus size={15} /> Add Lead
          </button>
        </div>
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
          <textarea
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Research notes — LinkedIn bio, recent activity, company news… (used for personalized outreach)"
            rows={2}
            className="input-field font-body w-full rounded-xl px-3 py-2.5 text-sm resize-none md:col-span-3"
          />
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
            <div key={lead.id} className="fade-in bg-[#0e0e1a] border border-[#1e1e30] rounded-xl overflow-hidden hover:border-[#2a2a40] transition-colors group">
            <div className="px-4 py-3.5 flex items-center gap-3 flex-wrap">
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
            {/* Notes row */}
            <div className="px-4 pb-3">
              <textarea
                value={lead.notes ?? ""}
                onChange={e => updateLead(lead.id, "notes", e.target.value)}
                placeholder="Research notes (used for personalized outreach)…"
                rows={1}
                className="font-body text-[#4a4c6a] text-xs bg-transparent border-none outline-none w-full resize-none placeholder-[#2a2a40] focus:text-[#6b7280]"
              />
            </div>
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
  const avgScore = leads.filter(l => l.score != null).length
    ? Math.round(leads.filter(l => l.score != null).reduce((s, l) => s + l.score, 0) / leads.filter(l => l.score != null).length)
    : null;

  const stats = [
    { label: "Total Leads", value: total, icon: Users, color: "text-[#818cf8]", bg: "bg-[#6366f1]/8", border: "border-[#6366f1]/15" },
    { label: "Warm / Qualified", value: warm, icon: TrendingUp, color: "text-[#60a5fa]", bg: "bg-[#3b82f6]/8", border: "border-[#3b82f6]/15" },
    { label: "Proposals Sent", value: proposals, icon: Send, color: "text-[#c084fc]", bg: "bg-[#a855f7]/8", border: "border-[#a855f7]/15" },
    { label: "Revenue Closed", value: `£${revenue.toLocaleString()}`, icon: DollarSign, color: "text-[#4ade80]", bg: "bg-[#22c55e]/8", border: "border-[#22c55e]/15" },
  ];

  const pipeline = STATUS_ORDER.map(s => ({ status: s, count: leads.filter(l => l.status === s).length }));

  // Conversion rates: leads that reached a status / total leads
  const conversionRates = [
    { label: "Cold → Warm", rate: total > 0 ? Math.round((leads.filter(l => ["Warm","Qualified","Proposal Sent","Closed"].includes(l.status)).length / total) * 100) : 0 },
    { label: "Warm → Qualified", rate: leads.filter(l => ["Warm","Qualified","Proposal Sent","Closed"].includes(l.status)).length > 0 ? Math.round((leads.filter(l => ["Qualified","Proposal Sent","Closed"].includes(l.status)).length / Math.max(1, leads.filter(l => ["Warm","Qualified","Proposal Sent","Closed"].includes(l.status)).length)) * 100) : 0 },
    { label: "Qualified → Proposal", rate: leads.filter(l => ["Qualified","Proposal Sent","Closed"].includes(l.status)).length > 0 ? Math.round((leads.filter(l => ["Proposal Sent","Closed"].includes(l.status)).length / Math.max(1, leads.filter(l => ["Qualified","Proposal Sent","Closed"].includes(l.status)).length)) * 100) : 0 },
    { label: "Proposal → Closed", rate: leads.filter(l => ["Proposal Sent","Closed"].includes(l.status)).length > 0 ? Math.round((leads.filter(l => l.status === "Closed").length / Math.max(1, leads.filter(l => ["Proposal Sent","Closed"].includes(l.status)).length)) * 100) : 0 },
  ];

  // Source breakdown
  const sources = [...new Set(leads.map(l => l.source).filter(Boolean))];
  const sourceStats = sources.map(src => {
    const srcLeads = leads.filter(l => l.source === src);
    const closed = srcLeads.filter(l => l.status === "Closed").length;
    return { src, total: srcLeads.length, closed, rate: Math.round((closed / srcLeads.length) * 100) };
  }).sort((a, b) => b.rate - a.rate);

  // Hot leads (score >= 75, not closed/lost)
  const hotLeads = leads.filter(l => l.score >= 75 && !["Closed","Lost"].includes(l.status)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);

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

      {/* Conversion funnel + source breakdown + hot leads */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-600 text-[#d4d6f0] text-sm flex items-center gap-2">
            <TrendingUp size={15} className="text-[#6366f1]" /> Conversion Funnel
          </h3>
          <div className="space-y-3">
            {conversionRates.map(({ label, rate }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-body text-[#5a5c78] text-xs">{label}</span>
                  <span className="font-display font-600 text-xs text-[#9ca3b8]">{rate}%</span>
                </div>
                <div className="h-1 bg-[#1a1a2e] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
                </div>
              </div>
            ))}
            {total === 0 && <p className="font-body text-[#3a3c58] text-xs text-center py-2">Add leads to see funnel</p>}
          </div>
        </div>

        <div className="bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-600 text-[#d4d6f0] text-sm flex items-center gap-2">
            <Target size={15} className="text-[#6366f1]" /> Top Sources
          </h3>
          <div className="space-y-3">
            {sourceStats.length === 0 && <p className="font-body text-[#3a3c58] text-xs text-center py-2">No source data yet</p>}
            {sourceStats.map(({ src, total: t, closed, rate }) => (
              <div key={src} className="flex items-center justify-between">
                <div>
                  <div className="font-body text-[#9ca3b8] text-xs">{src}</div>
                  <div className="font-body text-[#3a3c58] text-xs">{t} leads · {closed} closed</div>
                </div>
                <span className={`font-display font-700 text-sm ${rate >= 50 ? "text-[#4ade80]" : rate >= 25 ? "text-[#f5a623]" : "text-[#4a4c6a]"}`}>{rate}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0e0e1a] border border-[#1e1e30] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-600 text-[#d4d6f0] text-sm flex items-center gap-2">
              <Zap size={15} className="text-[#6366f1]" /> Hot Leads
            </h3>
            {avgScore != null && (
              <span className="font-body text-[#3a3c58] text-xs">avg score <span className="text-[#818cf8] font-600">{avgScore}</span></span>
            )}
          </div>
          <div className="space-y-3">
            {hotLeads.length === 0 && <p className="font-body text-[#3a3c58] text-xs text-center py-2">No scored leads yet — score leads in the tracker</p>}
            {hotLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between">
                <div>
                  <div className="font-body text-[#9ca3b8] text-xs">{lead.name}</div>
                  <div className="font-body text-[#3a3c58] text-xs">{lead.company} · {lead.status}</div>
                </div>
                <div className={`font-body text-xs rounded-lg px-2 py-1 border flex items-center gap-1 ${getScoreTier(lead.score).cls}`}>
                  <span className="font-display font-700">{lead.score}</span>
                  <span className="opacity-75">{getScoreTier(lead.score).label}</span>
                </div>
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
  const SAMPLE_LEADS = [
    { id: 1, name: "Sarah Mitchell", company: "Venture Co", contact: "s.mitchell@venture.co", source: "LinkedIn", value: 4500, status: "Warm", score: 78, scoreReason: "Good industry fit, strong platform match, mid-range budget alignment.", scoring: false },
    { id: 2, name: "James Okafor", company: "ScaleHQ", contact: "james@scalehq.io", source: "Cold Email", value: 8000, status: "Qualified", score: 91, scoreReason: "Excellent ICP match — right size, high deal value, qualified status signals urgency.", scoring: false },
    { id: 3, name: "Priya Sharma", company: "Bloom Brand", contact: "priya@bloombrand.com", source: "Referral", value: 12000, status: "Closed", score: 95, scoreReason: "Perfect fit — referral source, high value, closed deal confirms ICP accuracy.", scoring: false },
  ];

  const load = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

  const [activeTab, setActiveTab] = useState("dashboard");
  const [icp, setIcp] = useState(() => load("lf_icp", defaultICP));
  const [assets, setAssets] = useState(() => load("lf_assets", {}));
  const [generating, setGenerating] = useState(false);
  const [leads, setLeads] = useState(() => load("lf_leads", SAMPLE_LEADS));
  const [toast, setToast] = useState(null);
  const [apiKeyModal, setApiKeyModal] = useState(!getApiKey());
  const [apiKeyUpdate, setApiKeyUpdate] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("lf_onboarded") && !!getApiKey());

  useEffect(() => { localStorage.setItem("lf_icp", JSON.stringify(icp)); }, [icp]);
  useEffect(() => { localStorage.setItem("lf_assets", JSON.stringify(assets)); }, [assets]);
  useEffect(() => {
    const clean = leads.map(l => ({ ...l, scoring: false }));
    localStorage.setItem("lf_leads", JSON.stringify(clean));
  }, [leads]);

  const showToast = useCallback((msg) => setToast(msg), []);

  useEffect(() => {
    const onMissing = () => setApiKeyModal(true);
    const onInvalid = () => { setApiKeyModal(true); showToast("Invalid API key — please update it"); };
    window.addEventListener("lf:no-api-key", onMissing);
    window.addEventListener("lf:invalid-api-key", onInvalid);
    return () => {
      window.removeEventListener("lf:no-api-key", onMissing);
      window.removeEventListener("lf:invalid-api-key", onInvalid);
    };
  }, [showToast]);

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
            <div className="flex items-center gap-1">
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
              <button
                onClick={() => setApiKeyUpdate(true)}
                title="API Key settings"
                className="ml-2 p-2 rounded-xl text-[#3a3c58] hover:text-[#818cf8] hover:bg-[#6366f1]/10 transition-all"
              >
                <KeyRound size={14} />
              </button>
            </div>
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

        {/* Onboarding */}
        {showOnboarding && !apiKeyModal && (
          <OnboardingModal onComplete={() => { localStorage.setItem("lf_onboarded", "1"); setShowOnboarding(false); }} />
        )}

        {/* API Key modals */}
        {apiKeyModal && (
          <ApiKeyModal onSave={() => {
            setApiKeyModal(false);
            if (!localStorage.getItem("lf_onboarded")) setShowOnboarding(true);
          }} isUpdate={false} />
        )}
        {apiKeyUpdate && (
          <ApiKeyModal onSave={() => { setApiKeyUpdate(false); showToast("API key updated"); }} isUpdate={true} />
        )}
        {apiKeyUpdate && (
          <button
            onClick={() => setApiKeyUpdate(false)}
            className="fixed top-4 right-4 z-[101] p-2 rounded-xl bg-[#1a1a2e] hover:bg-[#22223a] text-[#6b7280] hover:text-[#ad4a4a] transition-all"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </>
  );
}
