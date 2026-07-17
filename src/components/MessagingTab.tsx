import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquare, Send, Mail, Phone, Users, Eye, Save, Trash2,
  Sparkles, Clock, CheckCircle2, Search,
} from "lucide-react";
import { listSpinRecords } from "@/lib/access-codes.functions";
import { sendBulkEmail, sendBulkWhatsApp } from "@/lib/messaging.functions";
import { Btn, ConfirmModal } from "@/components/ds";

type RecordRow = {
  code: string;
  spun_at: string | null;
  prize_won: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  customer_email: string | null;
};

type Channel = "sms" | "whatsapp" | "email";

type Template = { id: string; name: string; subject?: string; body: string };
type HistoryEntry = {
  id: string;
  at: string;
  channel: Channel;
  count: number;
  preview: string;
  status: "sent" | "opened" | "failed";
};

const DEFAULT_TEMPLATES: Record<Channel, Template[]> = {
  sms: [
    { id: "sms-win", name: "Winner alert", body: "Hi {customer_name}, congrats! You won {prize_name}. Visit us to claim your reward." },
  ],
  whatsapp: [
    { id: "wa-win", name: "Winner alert", body: "🎉 Hi {customer_name}, you won *{prize_name}*! Show this message to claim your prize." },
    { id: "wa-thx", name: "Thank you", body: "Hi {customer_name}, thanks for spinning with us! Your reward: {prize_name}." },
  ],
  email: [
    { id: "em-win", name: "Winner email", subject: "🎁 You won a prize!", body: "Hi {customer_name},\n\nThanks for spinning! You won: {prize_name}.\n\nSee you soon!" },
  ],
};

function MessagingTabBase({ shop }: { shop: { id: string; name: string } }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const doEmail = useServerFn(sendBulkEmail);
  const doWa = useServerFn(sendBulkWhatsApp);

  const tplKey = `spinnopal-tpl-${shop.id}`;
  const histKey = `spinnopal-msg-history-${shop.id}`;

  const [rows, setRows] = useState<RecordRow[]>([]);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [outcome, setOutcome] = useState<"all" | "won" | "lost">("won");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(null);
  const [templates, setTemplates] = useState<Record<Channel, Template[]>>(DEFAULT_TEMPLATES);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tplName, setTplName] = useState("");
  const [view, setView] = useState<"compose" | "history">("compose");
  const [smsConfirmOpen, setSmsConfirmOpen] = useState(false);
  const [waConfirmOpen, setWaConfirmOpen] = useState(false);

  // load templates + history (migrate from legacy `tls-*` keys if present)
  useEffect(() => {
    try {
      const legacyTplKey = `tls-tpl-${shop.id}`;
      const legacyHistKey = `tls-msg-history-${shop.id}`;
      let t = localStorage.getItem(tplKey);
      if (!t) {
        const legacyT = localStorage.getItem(legacyTplKey);
        if (legacyT) {
          localStorage.setItem(tplKey, legacyT);
          localStorage.removeItem(legacyTplKey);
          t = legacyT;
        }
      }
      if (t) setTemplates({ ...DEFAULT_TEMPLATES, ...JSON.parse(t) });
      let h = localStorage.getItem(histKey);
      if (!h) {
        const legacyH = localStorage.getItem(legacyHistKey);
        if (legacyH) {
          localStorage.setItem(histKey, legacyH);
          localStorage.removeItem(legacyHistKey);
          h = legacyH;
        }
      }
      if (h) setHistory(JSON.parse(h));
    } catch { /* ignore */ }
  }, [tplKey, histKey, shop.id]);


  const persistTemplates = (next: Record<Channel, Template[]>) => {
    setTemplates(next);
    try { localStorage.setItem(tplKey, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const pushHistory = (entry: HistoryEntry) => {
    const next = [entry, ...history].slice(0, 30);
    setHistory(next);
    try { localStorage.setItem(histKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  // set initial template body when channel changes
  useEffect(() => {
    const first = templates[channel]?.[0];
    if (first) {
      setBody(first.body);
      setSubject(first.subject || "");
    } else {
      setBody("");
      setSubject("");
    }
  }, [channel, templates]);

  const load = useCallback(async () => {
    try {
      const r = await fetchRecords({ data: { shopId: shop.id } });
      setRows((r.rows as RecordRow[]) ?? []);
    } catch {
      setRows([]);
    }
  }, [fetchRecords, shop.id]);
  useEffect(() => { load(); }, [load]);

  const isWin = (r: RecordRow) =>
    !!r.prize_won && !/try\s*again|better\s*luck/i.test(r.prize_won);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (outcome === "won" && !isWin(r)) return false;
      if (outcome === "lost" && isWin(r)) return false;
      if (channel === "email" && !r.customer_email) return false;
      if ((channel === "whatsapp" || channel === "sms") && !r.customer_contact) return false;
      if (q) {
        const hay = `${r.customer_name || ""} ${r.customer_contact || ""} ${r.customer_email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, outcome, channel, search]);

  useEffect(() => {
    setSelected(new Set(filtered.map((r) => r.code)));
  }, [filtered]);

  const toggle = (code: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code); else n.add(code);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.code)));
  };

  const chosen = filtered.filter((r) => selected.has(r.code));

  const personalize = (text: string, r: Partial<RecordRow>) =>
    text
      .replaceAll("{customer_name}", r.customer_name || "")
      .replaceAll("{prize_name}", r.prize_won || "")
      .replaceAll("{shop_name}", shop.name)
      // backwards-compatible aliases
      .replaceAll("{{name}}", r.customer_name || "")
      .replaceAll("{{prize}}", r.prize_won || "");

  const previewSample: Partial<RecordRow> = chosen[0] || filtered[0] || {
    customer_name: "Alex",
    prize_won: "10% Off",
    customer_contact: "+1 555 0100",
    customer_email: "alex@example.com",
  };
  const previewBody = personalize(body, previewSample);
  const previewSubject = personalize(subject, previewSample);

  const insertToken = (token: string) => {
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}${token}`);
  };

  const saveTemplate = () => {
    const name = tplName.trim();
    if (!name) { setStatus({ kind: "err", msg: "Give the template a name." }); return; }
    const id = `${channel}-${Date.now()}`;
    const next = { ...templates, [channel]: [...templates[channel], { id, name, body, subject: channel === "email" ? subject : undefined }] };
    persistTemplates(next);
    setTplName("");
    setStatus({ kind: "ok", msg: `Saved "${name}" template.` });
  };
  const deleteTemplate = (id: string) => {
    const next = { ...templates, [channel]: templates[channel].filter((t) => t.id !== id) };
    persistTemplates(next);
  };
  const loadTemplate = (t: Template) => {
    setBody(t.body);
    if (channel === "email" && t.subject !== undefined) setSubject(t.subject);
  };

  const doOpenSmsLinks = () => {
    setStatus({ kind: "info", msg: `Opening ${chosen.length} SMS drafts…` });
    chosen.forEach((r, i) => {
      const phone = (r.customer_contact || "").replace(/[^\d+]/g, "");
      if (!phone) return;
      const text = encodeURIComponent(personalize(body, r));
      const url = `sms:${phone}?body=${text}`;
      setTimeout(() => window.open(url, "_blank", "noopener"), i * 250);
    });
    pushHistory({
      id: `h-${Date.now()}`, at: new Date().toISOString(), channel: "sms",
      count: chosen.length, preview: body.slice(0, 80), status: "opened",
    });
    setTimeout(() => setStatus({ kind: "ok", msg: "SMS drafts opened." }), 600);
  };

  const openSmsLinks = () => {
    if (chosen.length === 0) return;
    if (chosen.length > 5) { setSmsConfirmOpen(true); return; }
    doOpenSmsLinks();
  };

  const doSendWhatsApp = () => {
    setStatus({ kind: "info", msg: `Opening ${chosen.length} chats…` });
    chosen.forEach((r, i) => {
      const phone = (r.customer_contact || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
      if (!phone) return;
      const text = encodeURIComponent(personalize(body, r));
      const url = `https://wa.me/${phone}?text=${text}`;
      setTimeout(() => window.open(url, "_blank", "noopener"), i * 250);
    });
    // Also try server API in background; if not configured the user still has the link flow
    doWa({
      data: {
        shopId: shop.id, body,
        recipients: chosen.map((r) => ({ name: r.customer_name, contact: r.customer_contact!, prize: r.prize_won })),
      },
    }).catch(() => { /* link flow already opened */ });
    pushHistory({
      id: `h-${Date.now()}`, at: new Date().toISOString(), channel: "whatsapp",
      count: chosen.length, preview: body.slice(0, 80), status: "opened",
    });
    setTimeout(() => setStatus({ kind: "ok", msg: "WhatsApp chats opened." }), 600);
  };

  const sendWhatsApp = () => {
    if (chosen.length === 0) return;
    if (chosen.length > 5) { setWaConfirmOpen(true); return; }
    doSendWhatsApp();
  };

  const sendEmail = async () => {
    if (chosen.length === 0) return;
    if (!subject.trim()) { setStatus({ kind: "err", msg: "Subject is required." }); return; }
    setBusy(true); setStatus(null);
    try {
      const res = await doEmail({
        data: {
          shopId: shop.id, subject, body,
          recipients: chosen.map((r) => ({ name: r.customer_name, email: r.customer_email!, prize: r.prize_won })),
        },
      });
      if (!res.ok) {
        setStatus({ kind: "err", msg: res.message || "Email not configured." });
        pushHistory({
          id: `h-${Date.now()}`, at: new Date().toISOString(), channel: "email",
          count: chosen.length, preview: subject, status: "failed",
        });
      } else {
        setStatus({ kind: "ok", msg: `Queued ${res.sent} of ${res.total}.` });
        pushHistory({
          id: `h-${Date.now()}`, at: new Date().toISOString(), channel: "email",
          count: res.sent, preview: subject, status: "sent",
        });
      }
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally { setBusy(false); }
  };

  const onSend = () => {
    if (channel === "sms") openSmsLinks();
    else if (channel === "whatsapp") sendWhatsApp();
    else sendEmail();
  };

  const channelTabs: { key: Channel; label: string; icon: typeof MessageSquare; color: string }[] = [
    { key: "sms", label: "SMS", icon: Phone, color: "#3b82f6" },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "#10b981" },
    { key: "email", label: "Email", icon: Mail, color: "#FF6B1A" },
  ];

  const sendLabel = channel === "email"
    ? (busy ? "Sending…" : `Email ${chosen.length} customer${chosen.length === 1 ? "" : "s"}`)
    : channel === "sms"
    ? `Send SMS to ${chosen.length}`
    : `Send WhatsApp to ${chosen.length}`;

  return (
    <div className="space-y-4 pb-28 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-[#0c2340]">Messaging</h2>
          <p className="text-xs text-[#4a5b78]">Send personalized messages to your customers</p>
        </div>
        <div className="inline-flex rounded-xl bg-[#F5F7FA] p-1 text-xs font-bold">
          <button
            onClick={() => setView("compose")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${view === "compose" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >Compose</button>
          <button
            onClick={() => setView("history")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${view === "history" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >History</button>
        </div>
      </div>

      {/* Channel tabs */}
      <div className="grid grid-cols-3 gap-2">
        {channelTabs.map(({ key, label, icon: Icon, color }) => {
          const active = channel === key;
          return (
            <button
              key={key}
              onClick={() => setChannel(key)}
              className={`rounded-2xl border p-3 flex flex-col items-center gap-1.5 transition-all ${
                active
                  ? "bg-white border-[#FF6B1A] shadow-[0_8px_24px_-12px_rgba(255,107,0,0.45)]"
                  : "bg-white border-[#0c2340]/10 hover:border-[#0c2340]/20"
              }`}
            >
              <div
                className="w-8 h-8 rounded-xl grid place-items-center"
                style={{ background: active ? color : `${color}1a`, color: active ? "#fff" : color }}
              >
                <Icon className="w-4 h-4" strokeWidth={2.2} />
              </div>
              <span className={`text-xs font-bold ${active ? "text-[#0c2340]" : "text-[#4a5b78]"}`}>{label}</span>
            </button>
          );
        })}
      </div>

      {view === "history" ? (
        <HistoryView history={history} onClear={() => { setHistory([]); try { localStorage.removeItem(histKey); } catch { /* ignore */ } }} />
      ) : (
        <>
          {/* Templates */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6B1A]" /> Templates
              </h3>
              <span className="text-[11px] text-[#4a5b78]">{templates[channel].length} saved</span>
            </div>
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {templates[channel].map((t) => (
                <div key={t.id} className="shrink-0 group inline-flex items-center gap-1 rounded-full bg-[#F5F7FA] border border-[#0c2340]/8 pl-3 pr-1 py-1">
                  <button onClick={() => loadTemplate(t)} className="text-xs font-semibold text-[#0c2340]">{t.name}</button>
                  {!t.id.match(/^(sms|wa|em)-(win|thx)$/) && (
                    <button onClick={() => deleteTemplate(t.id)} className="p-1 rounded-full hover:bg-red-50 text-[#4a5b78] hover:text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {templates[channel].length === 0 && (
                <p className="text-xs text-[#4a5b78]">No templates yet.</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Template name"
                maxLength={40}
                className="flex-1 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF6B1A]"
              />
              <button
                onClick={saveTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0c2340] text-white px-3 py-2 text-xs font-bold hover:bg-[#1a3a63]"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </section>

          {/* Compose */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#0c2340]">Message</h3>
            {channel === "email" && (
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
                maxLength={200}
                className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B1A]"
              />
            )}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Type your message…"
              className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B1A] resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-[#4a5b78] mr-1 self-center">Insert:</span>
              {["{customer_name}", "{prize_name}", "{shop_name}"].map((tok) => (
                <button
                  key={tok}
                  onClick={() => insertToken(tok)}
                  className="inline-flex items-center text-[11px] font-mono font-semibold text-[#FF6B1A] bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-md transition-colors"
                >
                  {tok}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-[#4a5b78]">{body.length}/4000</span>
            </div>
          </section>

          {/* Live preview */}
          <section className="rounded-[20px] p-4 bg-gradient-to-br from-[#F5F7FA] to-white border border-[#0c2340]/8">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-[#0c2340]" />
              <h3 className="text-sm font-bold text-[#0c2340]">Live preview</h3>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-[#4a5b78]">
                As {previewSample.customer_name || "sample"}
              </span>
            </div>
            <div className="rounded-2xl bg-white border border-[#0c2340]/8 p-3 shadow-sm">
              {channel === "email" && previewSubject && (
                <p className="text-sm font-bold text-[#0c2340] mb-1">{previewSubject}</p>
              )}
              <p className="text-sm text-[#0c2340] whitespace-pre-wrap leading-relaxed">
                {previewBody || <span className="text-[#4a5b78] italic">Your message will appear here…</span>}
              </p>
            </div>
          </section>

          {/* Recipients */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF6B1A]" /> Recipients
                <span className="text-[11px] font-semibold text-[#4a5b78]">({chosen.length}/{filtered.length})</span>
              </h3>
              <button onClick={toggleAll} className="text-xs font-bold text-[#FF6B1A] hover:underline">
                {selected.size === filtered.length && filtered.length > 0 ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5b78]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or contact"
                  className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#FF6B1A]"
                />
              </div>
              <div className="inline-flex rounded-xl bg-[#F5F7FA] p-1 text-[11px] font-bold">
                {(["all", "won", "lost"] as const).map((o) => (
                  <button key={o} onClick={() => setOutcome(o)}
                    className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${outcome === o ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <ul className="space-y-1.5 max-h-[36vh] overflow-y-auto -mx-1 px-1">
              {filtered.map((r) => {
                const checked = selected.has(r.code);
                const contact = channel === "email" ? r.customer_email : r.customer_contact;
                return (
                  <li key={r.code}>
                    <label className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${checked ? "bg-orange-50 border border-[#FF6B1A]/30" : "bg-[#F5F7FA] border border-transparent hover:bg-[#eef1f6]"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(r.code)}
                        className="w-4 h-4 accent-[#FF6B1A]"
                      />
                      <div className="w-8 h-8 shrink-0 rounded-lg bg-white border border-[#0c2340]/10 grid place-items-center text-xs font-black text-[#0c2340]">
                        {(r.customer_name || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0c2340] truncate">{r.customer_name || "Anonymous"}</p>
                        <p className="text-[11px] text-[#4a5b78] truncate">{contact || "—"}</p>
                      </div>
                      {r.prize_won && (
                        <span className="text-[10px] font-bold text-[#FF6B1A] bg-white px-2 py-0.5 rounded-full truncate max-w-[40%]">{r.prize_won}</span>
                      )}
                    </label>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="py-8 text-center text-sm text-[#4a5b78]">
                  No customers match. Adjust filters or ensure they have a {channel === "email" ? "email" : "contact number"}.
                </li>
              )}
            </ul>
          </section>

          {status && (
            <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              status.kind === "ok" ? "bg-emerald-50 text-emerald-700" :
              status.kind === "err" ? "bg-red-50 text-red-700" :
              "bg-blue-50 text-blue-700"
            }`}>
              {status.msg}
            </div>
          )}
        </>
      )}

      {/* Sticky Send button (compose only) */}
      {view === "compose" && (
        <div className="fixed bottom-20 left-0 right-0 z-30 px-4">
          <div className="max-w-md mx-auto">
            <Btn
              variant="primary"
              size="lg"
              className="w-full rounded-2xl shadow-[0_10px_30px_-10px_rgba(255,107,26,0.55)]"
              onClick={onSend}
              disabled={chosen.length === 0 || busy || !body.trim()}
              leftIcon={<Send className="w-4 h-4" />}
            >
              {sendLabel}
            </Btn>
          </div>
        </div>
      )}

      {/* SMS bulk-send confirm */}
      <ConfirmModal
        open={smsConfirmOpen}
        onClose={() => setSmsConfirmOpen(false)}
        onConfirm={() => { setSmsConfirmOpen(false); doOpenSmsLinks(); }}
        title={`Open ${chosen.length} SMS drafts?`}
        description={`This will open ${chosen.length} SMS draft windows one after another. Continue?`}
        confirmLabel="Open all"
        variant="primary"
      />

      {/* WhatsApp bulk-send confirm */}
      <ConfirmModal
        open={waConfirmOpen}
        onClose={() => setWaConfirmOpen(false)}
        onConfirm={() => { setWaConfirmOpen(false); doSendWhatsApp(); }}
        title={`Open ${chosen.length} WhatsApp chats?`}
        description={`This will open ${chosen.length} WhatsApp chat windows one after another. Continue?`}
        confirmLabel="Open all"
        variant="primary"
      />
    </div>
  );
}

function HistoryView({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) {
  const channelMeta: Record<Channel, { label: string; icon: typeof MessageSquare; color: string }> = {
    sms: { label: "SMS", icon: Phone, color: "#3b82f6" },
    whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "#10b981" },
    email: { label: "Email", icon: Mail, color: "#FF6B1A" },
  };
  return (
    <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#FF6B1A]" /> Message history
        </h3>
        {history.length > 0 && (
          <button onClick={onClear} className="text-xs font-bold text-[#4a5b78] hover:text-red-600">Clear</button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="py-10 text-center">
          <Clock className="w-8 h-8 text-[#0c2340]/20 mx-auto mb-2" />
          <p className="text-sm text-[#4a5b78]">No messages sent yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#0c2340]/8">
          {history.map((h) => {
            const meta = channelMeta[h.channel];
            const Icon = meta.icon;
            return (
              <li key={h.id} className="py-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${meta.color}1a`, color: meta.color }}>
                  <Icon className="w-4 h-4" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#0c2340]">{meta.label}</p>
                    <span className="text-[11px] text-[#4a5b78]">·</span>
                    <p className="text-[11px] text-[#4a5b78]">{h.count} recipient{h.count === 1 ? "" : "s"}</p>
                    <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      h.status === "sent" ? "bg-emerald-50 text-emerald-700" :
                      h.status === "opened" ? "bg-blue-50 text-blue-700" :
                      "bg-red-50 text-red-700"
                    }`}>
                      <CheckCircle2 className="w-3 h-3" /> {h.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#4a5b78] mt-0.5 truncate">{h.preview || "—"}</p>
                  <p className="text-[10px] text-[#4a5b78]/80 mt-0.5">{new Date(h.at).toLocaleString()}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export const MessagingTab = memo(MessagingTabBase);
