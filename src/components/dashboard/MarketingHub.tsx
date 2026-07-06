import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle, CheckCircle2, Clock, Eye, Info, Mail, Megaphone,
  MessageSquare, Phone, Save, Search, Send, Sparkles, Trash2,
  Users, X,
} from "lucide-react";
import { getCrmCustomers } from "@/lib/access-codes.functions";
import { listMyCampaigns } from "@/lib/campaigns.functions";
import { sendBulkEmail, sendBulkWhatsApp } from "@/lib/messaging.functions";
import { saveBroadcast, listBroadcasts } from "@/lib/marketing.functions";
import { KpiCard, SkeletonKpiCard, SkeletonRow } from "./ui";
import type { CustomerRecord, Shop } from "./types";

// ─── Local types ───────────────────────────────────────────────────────────────

type Channel = "sms" | "whatsapp" | "email";
type SegmentKey = "all" | "Winner" | "VIP" | "Multi-Spin" | "New" | "Lapsed";
type Template = { id: string; name: string; subject?: string; body: string };
type HistoryEntry = {
  id: string;
  at: string;
  channel: Channel;
  count: number;       // recipient_count
  sentCount: number;   // sent_count
  failedCount: number; // failed_count
  preview: string;
  status: "sent" | "partial" | "failed" | "opened";
};
type CampaignItem = { id: string; name: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "Winner",     label: "Winners" },
  { key: "VIP",        label: "VIP" },
  { key: "Multi-Spin", label: "Multi-Spin" },
  { key: "New",        label: "New" },
  { key: "Lapsed",     label: "Lapsed" },
];

const CHANNELS: {
  key: Channel;
  label: string;
  icon: typeof MessageSquare;
  color: string;
}[] = [
  { key: "sms",       label: "SMS",       icon: Phone,         color: "#3b82f6" },
  { key: "whatsapp",  label: "WhatsApp",  icon: MessageSquare, color: "#10b981" },
  { key: "email",     label: "Email",     icon: Mail,          color: "#FF6B00" },
];

const DEFAULT_TEMPLATES: Record<Channel, Template[]> = {
  sms: [
    {
      id: "sms-win",
      name: "Winner alert",
      body: "Hi {customer_name}, congrats! You won {prize_name}. Visit us to claim your reward.",
    },
  ],
  whatsapp: [
    {
      id: "wa-win",
      name: "Winner alert",
      body: "🎉 Hi {customer_name}, you won *{prize_name}*! Show this message to claim your prize.",
    },
    {
      id: "wa-thx",
      name: "Thank you",
      body: "Hi {customer_name}, thanks for spinning at {shop_name}! Hope to see you again soon.",
    },
  ],
  email: [
    {
      id: "em-win",
      name: "Winner email",
      subject: "🎁 You won a prize!",
      body: "Hi {customer_name},\n\nThanks for spinning at {shop_name}!\nYou won: {prize_name}.\n\nSee you soon!",
    },
    {
      id: "em-re",
      name: "Re-engagement",
      subject: "We miss you!",
      body: "Hi {customer_name},\n\nIt's been a while since we saw you at {shop_name}.\nCome back and spin for a chance to win again!",
    },
  ],
};

const TOKENS = ["{customer_name}", "{prize_name}", "{shop_name}"];

// ─── DB row → HistoryEntry ─────────────────────────────────────────────────────

function dbRowToEntry(row: Record<string, unknown>): HistoryEntry {
  const ch = row.channel as Channel;
  const preview =
    ch === "email"
      ? String(row.subject ?? row.body ?? "").slice(0, 80)
      : String(row.body ?? "").slice(0, 80);
  return {
    id:          String(row.id),
    at:          String(row.created_at ?? row.sent_at ?? new Date().toISOString()),
    channel:     ch,
    count:       Number(row.recipient_count ?? 0),
    sentCount:   Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    preview,
    status: (row.status ?? "sent") as HistoryEntry["status"],
  };
}

// ─── HistoryView sub-component ─────────────────────────────────────────────────

function HistoryView({
  history,
  onClear,
}: {
  history: HistoryEntry[];
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/8 grid place-items-center mb-4">
          <Clock className="w-7 h-7 text-[#FF6B00]" strokeWidth={1.5} />
        </div>
        <p className="text-[#0c2340] font-bold">No broadcast history</p>
        <p className="text-sm text-[#4a5b78] mt-1.5 max-w-xs leading-relaxed">
          Once you send your first broadcast, it will appear here.
        </p>
      </div>
    );
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const statusClass = (s: HistoryEntry["status"]) => {
    if (s === "sent")    return "bg-emerald-50 text-emerald-700";
    if (s === "failed")  return "bg-red-50 text-red-600";
    if (s === "partial") return "bg-amber-50 text-amber-700";
    return "bg-blue-50 text-blue-700"; // opened
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#0c2340]">
          {history.length} broadcast{history.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={onClear}
          className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
        >
          Clear view
        </button>
      </div>

      {history.map((h) => {
        const ch = CHANNELS.find((c) => c.key === h.channel)!;
        const Icon = ch.icon;
        return (
          <div
            key={h.id}
            className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                style={{ background: `${ch.color}1a`, color: ch.color }}
              >
                <Icon className="w-4 h-4" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#0c2340]">
                    {ch.label} broadcast
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusClass(h.status)}`}>
                    {h.status}
                  </span>
                </div>
                <p className="text-xs text-[#4a5b78] mt-0.5 truncate">{h.preview}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#4a5b78] flex-wrap">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {h.count} recipient{h.count !== 1 ? "s" : ""}
                  </span>
                  {(h.sentCount > 0 || h.failedCount > 0) && (
                    <>
                      <span className="text-emerald-600 font-semibold">
                        {h.sentCount} sent
                      </span>
                      {h.failedCount > 0 && (
                        <span className="text-red-500 font-semibold">
                          {h.failedCount} failed
                        </span>
                      )}
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fmtDate(h.at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MarketingHub ──────────────────────────────────────────────────────────────

export function MarketingHub({ shop }: { shop: Shop }) {
  const fetchCustomers    = useServerFn(getCrmCustomers);
  const fetchCampaigns    = useServerFn(listMyCampaigns);
  const fetchBroadcasts   = useServerFn(listBroadcasts);
  const doEmail           = useServerFn(sendBulkEmail);
  const doWa              = useServerFn(sendBulkWhatsApp);
  const doSaveBroadcast   = useServerFn(saveBroadcast);

  const TPL_KEY = `mu-marketing-tpl-${shop.id}`;

  // ── State ────────────────────────────────────────────────────────────────────
  const [customers,  setCustomers]  = useState<CustomerRecord[]>([]);
  const [campaigns,  setCampaigns]  = useState<CampaignItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [channel,    setChannel]    = useState<Channel>("whatsapp");
  const [segment,    setSegment]    = useState<SegmentKey>("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [search,     setSearch]     = useState("");
  const [subject,    setSubject]    = useState("");
  const [body,       setBody]       = useState("");
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [busy,       setBusy]       = useState(false);
  const [sendStatus, setSendStatus] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(null);
  const [templates,  setTemplates]  = useState<Record<Channel, Template[]>>(DEFAULT_TEMPLATES);
  const [history,    setHistory]    = useState<HistoryEntry[]>([]);
  const [tplName,    setTplName]    = useState("");
  const [view,       setView]       = useState<"compose" | "history">("compose");

  // ── Load customers, campaigns, and broadcast history ─────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [custRes, campRes, bcRes] = await Promise.all([
          fetchCustomers({ data: { shopId: shop.id } }),
          fetchCampaigns({ data: { shopId: shop.id } }),
          fetchBroadcasts({ data: { shopId: shop.id } }).catch(() => ({ broadcasts: [] })),
        ]);
        if (!alive) return;

        setCustomers((custRes.customers as CustomerRecord[]) ?? []);

        const campData = campRes as { campaigns?: { id: string; name: string }[] } | undefined;
        setCampaigns((campData?.campaigns ?? []).map((c) => ({ id: c.id, name: c.name })));

        const bcData = bcRes as { broadcasts?: Record<string, unknown>[] } | undefined;
        setHistory((bcData?.broadcasts ?? []).map(dbRowToEntry));
      } catch {
        if (!alive) return;
        setCustomers([]);
        setCampaigns([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [shop.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore templates from localStorage (templates stay local) ───────────────
  useEffect(() => {
    try {
      const t = localStorage.getItem(TPL_KEY);
      if (t) setTemplates({ ...DEFAULT_TEMPLATES, ...JSON.parse(t) });
    } catch { /* ignore */ }
  }, [TPL_KEY]);

  const persistTemplates = useCallback(
    (next: Record<Channel, Template[]>) => {
      setTemplates(next);
      try { localStorage.setItem(TPL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    },
    [TPL_KEY],
  );

  // ── Persist broadcast to DB (optimistic update → DB save → reload) ───────────
  const persistBroadcast = useCallback(
    async (params: {
      channel:        Channel;
      body:           string;
      subject:        string | null;
      segmentFilter:  string;
      campaignId:     string | null;
      recipientCount: number;
      sentCount:      number;
      failedCount:    number;
      status:         HistoryEntry["status"];
    }) => {
      const preview =
        params.channel === "email"
          ? (params.subject ?? params.body).slice(0, 80)
          : params.body.slice(0, 80);

      // Optimistic: add to local state immediately
      const optimistic: HistoryEntry = {
        id:          `opt-${Date.now()}`,
        at:          new Date().toISOString(),
        channel:     params.channel,
        count:       params.recipientCount,
        sentCount:   params.sentCount,
        failedCount: params.failedCount,
        preview,
        status:      params.status,
      };
      setHistory((prev) => [optimistic, ...prev].slice(0, 50));

      // Save to DB then reload real records
      try {
        await doSaveBroadcast({
          data: {
            shopId:         shop.id,
            channel:        params.channel,
            body:           params.body,
            subject:        params.subject,
            segmentFilter:  params.segmentFilter,
            campaignId:     params.campaignId,
            recipientCount: params.recipientCount,
            sentCount:      params.sentCount,
            failedCount:    params.failedCount,
            status:         params.status,
          },
        });
        // Reload from DB to replace optimistic entry with the real record
        const bcRes = await fetchBroadcasts({ data: { shopId: shop.id } });
        const bcData = bcRes as { broadcasts?: Record<string, unknown>[] } | undefined;
        setHistory((bcData?.broadcasts ?? []).map(dbRowToEntry));
      } catch {
        // Keep the optimistic entry — history still shows in UI
      }
    },
    [shop.id, doSaveBroadcast, fetchBroadcasts],
  );

  // ── Sync default template body when channel changes ──────────────────────────
  // Intentionally omits `templates` dep: only reset body on channel switch,
  // not whenever the user adds/removes a template.
  useEffect(() => {
    const first = templates[channel]?.[0];
    if (first) { setBody(first.body); setSubject(first.subject ?? ""); }
    else        { setBody("");         setSubject(""); }
  }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──────────────────────────────────────────────────────────────────
  const reachable = useMemo(
    () => customers.filter((c) => channel === "email" ? !!c.email : !!c.contact),
    [customers, channel],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (channel === "email" && !c.email) return false;
      if ((channel === "whatsapp" || channel === "sms") && !c.contact) return false;
      if (segment !== "all" && !c.segments.includes(segment)) return false;
      if (campaignId !== "all" && !c.campaignIds.includes(campaignId)) return false;
      if (q) {
        const hay = `${c.name ?? ""} ${c.contact ?? ""} ${c.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customers, channel, segment, campaignId, search]);

  const chosen = useMemo(
    () => filtered.filter((c) => selected.has(c.key)),
    [filtered, selected],
  );

  // Auto-select all when filters change
  useEffect(() => {
    setSelected(new Set(filtered.map((c) => c.key)));
  }, [filtered]);

  // ── Selection helpers ─────────────────────────────────────────────────────────
  const toggleCustomer = useCallback((key: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((s) =>
      s.size === filtered.length && filtered.length > 0
        ? new Set()
        : new Set(filtered.map((c) => c.key)),
    );
  }, [filtered]);

  // ── Personalisation ───────────────────────────────────────────────────────────
  const personalize = useCallback(
    (text: string, c: CustomerRecord) =>
      text
        .replaceAll("{customer_name}", c.name ?? "")
        .replaceAll("{prize_name}",    c.prizes[0] ?? "")
        .replaceAll("{shop_name}",     shop.name)
        .replaceAll("{{name}}",        c.name ?? "")
        .replaceAll("{{prize}}",       c.prizes[0] ?? "")
        .replaceAll("{{shop}}",        shop.name),
    [shop.name],
  );

  // Live-preview sample
  const previewCustomer: CustomerRecord = chosen[0] ?? filtered[0] ?? {
    key:         "sample",
    name:        "Alex",
    contact:     "+977 98XXXXXXXX",
    email:       "alex@example.com",
    totalSpins:  3,
    totalWins:   1,
    prizes:      ["10% Off Coupon"],
    firstSeen:   new Date().toISOString(),
    lastSeen:    new Date().toISOString(),
    campaignIds: [],
    segments:    ["Winner"],
  };
  const previewBody    = personalize(body, previewCustomer);
  const previewSubject = channel === "email" ? personalize(subject, previewCustomer) : "";

  // ── Template management ───────────────────────────────────────────────────────
  const saveTemplate = useCallback(() => {
    const name = tplName.trim();
    if (!name) {
      setSendStatus({ kind: "err", msg: "Enter a template name first." });
      return;
    }
    const newTpl: Template = {
      id: `${channel}-${Date.now()}`,
      name,
      body,
      ...(channel === "email" ? { subject } : {}),
    };
    persistTemplates({ ...templates, [channel]: [...templates[channel], newTpl] });
    setTplName("");
    setSendStatus({ kind: "ok", msg: `Template "${name}" saved.` });
  }, [tplName, channel, body, subject, templates, persistTemplates]);

  const deleteTemplate = useCallback(
    (id: string) => {
      persistTemplates({
        ...templates,
        [channel]: templates[channel].filter((t) => t.id !== id),
      });
    },
    [templates, channel, persistTemplates],
  );

  const loadTemplate = useCallback(
    (t: Template) => {
      setBody(t.body);
      if (channel === "email" && t.subject !== undefined) setSubject(t.subject);
    },
    [channel],
  );

  const insertToken = useCallback((token: string) => {
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}${token}`);
  }, []);

  // ── Send flows ────────────────────────────────────────────────────────────────
  const sendSms = useCallback(() => {
    if (chosen.length === 0) return;
    if (chosen.length > 5 && !confirm(`Open ${chosen.length} SMS drafts one after another?`)) return;
    setSendStatus({ kind: "info", msg: `Opening ${chosen.length} SMS draft${chosen.length !== 1 ? "s" : ""}…` });
    chosen.forEach((c, i) => {
      const phone = (c.contact ?? "").replace(/[^\d+]/g, "");
      if (!phone) return;
      setTimeout(
        () => window.open(`sms:${phone}?body=${encodeURIComponent(personalize(body, c))}`, "_blank", "noopener"),
        i * 250,
      );
    });
    void persistBroadcast({
      channel:        "sms",
      body,
      subject:        null,
      segmentFilter:  segment,
      campaignId:     campaignId === "all" ? null : campaignId,
      recipientCount: chosen.length,
      sentCount:      chosen.length,
      failedCount:    0,
      status:         "opened",
    });
    setTimeout(() => setSendStatus({ kind: "ok", msg: `${chosen.length} SMS draft${chosen.length !== 1 ? "s" : ""} opened.` }), 700);
  }, [chosen, body, segment, campaignId, personalize, persistBroadcast]);

  const sendWhatsApp = useCallback(() => {
    if (chosen.length === 0) return;
    if (chosen.length > 5 && !confirm(`Open ${chosen.length} WhatsApp chats one after another?`)) return;
    setSendStatus({ kind: "info", msg: `Opening ${chosen.length} chat${chosen.length !== 1 ? "s" : ""}…` });
    chosen.forEach((c, i) => {
      const phone = (c.contact ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
      if (!phone) return;
      setTimeout(
        () => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(personalize(body, c))}`, "_blank", "noopener"),
        i * 250,
      );
    });
    // Fire Cloud API in background — works when WHATSAPP_ACCESS_TOKEN is configured
    doWa({
      data: {
        shopId:     shop.id,
        body,
        recipients: chosen.map((c) => ({ name: c.name, contact: c.contact!, prize: c.prizes[0] ?? null })),
      },
    }).catch(() => {});
    void persistBroadcast({
      channel:        "whatsapp",
      body,
      subject:        null,
      segmentFilter:  segment,
      campaignId:     campaignId === "all" ? null : campaignId,
      recipientCount: chosen.length,
      sentCount:      chosen.length,
      failedCount:    0,
      status:         "sent",
    });
    setTimeout(() => setSendStatus({ kind: "ok", msg: `WhatsApp opened for ${chosen.length} customer${chosen.length !== 1 ? "s" : ""}.` }), 700);
  }, [chosen, body, segment, campaignId, shop.id, personalize, doWa, persistBroadcast]);

  const sendEmail = useCallback(async () => {
    if (chosen.length === 0) return;
    if (!subject.trim()) {
      setSendStatus({ kind: "err", msg: "Subject line is required for email." });
      return;
    }
    setBusy(true);
    setSendStatus(null);
    try {
      const res = await doEmail({
        data: {
          shopId:     shop.id,
          subject,
          body,
          recipients: chosen.map((c) => ({ name: c.name, email: c.email!, prize: c.prizes[0] ?? null })),
        },
      });
      if (!res.ok) {
        const msg = (res as { ok: false; message?: string }).message ?? "Email not configured.";
        setSendStatus({ kind: "err", msg });
        void persistBroadcast({
          channel:        "email",
          body,
          subject,
          segmentFilter:  segment,
          campaignId:     campaignId === "all" ? null : campaignId,
          recipientCount: chosen.length,
          sentCount:      0,
          failedCount:    chosen.length,
          status:         "failed",
        });
      } else {
        const failed = res.total - res.sent;
        setSendStatus({ kind: "ok", msg: `Sent ${res.sent} of ${res.total} emails.` });
        void persistBroadcast({
          channel:        "email",
          body,
          subject,
          segmentFilter:  segment,
          campaignId:     campaignId === "all" ? null : campaignId,
          recipientCount: res.total,
          sentCount:      res.sent,
          failedCount:    failed,
          status:         failed === 0 ? "sent" : res.sent === 0 ? "failed" : "partial",
        });
      }
    } catch (e) {
      setSendStatus({ kind: "err", msg: e instanceof Error ? e.message : "Send failed." });
    } finally {
      setBusy(false);
    }
  }, [chosen, subject, body, segment, campaignId, shop.id, doEmail, persistBroadcast]);

  const onSend = useCallback(() => {
    setSendStatus(null);
    if (channel === "sms")          sendSms();
    else if (channel === "whatsapp") sendWhatsApp();
    else                             sendEmail();
  }, [channel, sendSms, sendWhatsApp, sendEmail]);

  // ── Send button label ─────────────────────────────────────────────────────────
  const sendLabel =
    channel === "email"
      ? busy
        ? "Sending…"
        : `Email ${chosen.length} customer${chosen.length !== 1 ? "s" : ""}`
      : channel === "sms"
        ? `Open SMS for ${chosen.length}`
        : `WhatsApp ${chosen.length} customer${chosen.length !== 1 ? "s" : ""}`;

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-28 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-[#0c2340]">Marketing</h2>
          <p className="text-xs text-[#4a5b78]">Broadcast to your customers</p>
        </div>
        <div className="inline-flex rounded-xl bg-[#F5F7FA] p-1 text-xs font-bold shrink-0">
          <button
            onClick={() => setView("compose")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${view === "compose" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >
            Broadcast
          </button>
          <button
            onClick={() => setView("history")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${view === "history" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >
            History{history.length > 0 ? ` (${history.length})` : ""}
          </button>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          <>
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </>
        ) : (
          <>
            <KpiCard
              label="Customers"
              value={customers.length}
              icon={Users}
              accentClass="bg-[#0c2340]/8 text-[#0c2340]"
            />
            <KpiCard
              label="Reachable"
              value={reachable.length}
              icon={channel === "email" ? Mail : MessageSquare}
              accentClass="bg-emerald-50 text-emerald-600"
            />
            <KpiCard
              label="Audience"
              value={filtered.length}
              icon={Megaphone}
              accentClass="bg-[#FF6B00]/12 text-[#FF6B00]"
            />
          </>
        )}
      </div>

      {/* ── History view ────────────────────────────────────────────────────── */}
      {view === "history" && (
        <HistoryView
          history={history}
          onClear={() => setHistory([])}
        />
      )}

      {/* ── Compose view ────────────────────────────────────────────────────── */}
      {view === "compose" && (
        <>
          {/* Channel selector */}
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map(({ key, label, icon: Icon, color }) => {
              const active = channel === key;
              return (
                <button
                  key={key}
                  onClick={() => setChannel(key)}
                  aria-pressed={active}
                  className={`rounded-2xl border p-3 flex flex-col items-center gap-1.5 transition-all ${
                    active
                      ? "bg-white border-[#FF6B00] shadow-[0_8px_24px_-12px_rgba(255,107,0,0.45)]"
                      : "bg-white border-[#0c2340]/10 hover:border-[#0c2340]/20"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-xl grid place-items-center"
                    style={{
                      background: active ? color : `${color}1a`,
                      color:      active ? "#fff" : color,
                    }}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2.2} />
                  </div>
                  <span className={`text-xs font-bold ${active ? "text-[#0c2340]" : "text-[#4a5b78]"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Sticky: Segment chips + campaign filter + search ──────────── */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3 space-y-2.5 shadow-[0_4px_12px_-4px_rgba(12,35,64,0.06)]">

            {/* Segment chips */}
            <div
              className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5"
              role="group"
              aria-label="Filter by segment"
            >
              {SEGMENTS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSegment(key)}
                  aria-pressed={segment === key}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    segment === key
                      ? "bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm"
                      : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-[#FF6B00]/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Campaign filter + search */}
            <div className="flex gap-2">
              {campaigns.length > 1 && (
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  aria-label="Filter by campaign"
                  className="bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3 py-2 text-xs font-semibold text-[#0c2340] outline-none focus:border-[#FF6B00]/40 shrink-0 max-w-[140px] transition"
                >
                  <option value="all">All campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7a93] pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers…"
                  aria-label="Search customers"
                  className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl pl-8 pr-8 py-2 text-sm outline-none focus:border-[#FF6B00]/40 transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b7a93] hover:text-[#0c2340] transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Templates ────────────────────────────────────────────────── */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6B00]" /> Templates
              </h3>
              <span className="text-[11px] text-[#4a5b78]">
                {templates[channel].length} saved
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {templates[channel].map((t) => (
                <div
                  key={t.id}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#F5F7FA] border border-[#0c2340]/8 pl-3 pr-1 py-1"
                >
                  <button
                    onClick={() => loadTemplate(t)}
                    className="text-xs font-semibold text-[#0c2340]"
                  >
                    {t.name}
                  </button>
                  {!t.id.match(/^(sms|wa|em)-(win|thx|re)$/) && (
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      aria-label={`Delete template "${t.name}"`}
                      className="p-1 rounded-full hover:bg-red-50 text-[#4a5b78] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {templates[channel].length === 0 && (
                <p className="text-xs text-[#4a5b78] py-1">No templates yet.</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTemplate(); }}
                placeholder="Save current message as…"
                maxLength={40}
                className="flex-1 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#FF6B00] transition"
              />
              <button
                onClick={saveTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0c2340] text-white px-3 py-2 text-xs font-bold hover:bg-[#1a3a63] transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </section>

          {/* ── Composer ─────────────────────────────────────────────────── */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#0c2340]">Message</h3>

            {channel === "email" && (
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line…"
                maxLength={200}
                aria-label="Email subject"
                className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B00] transition"
              />
            )}

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder={
                channel === "email"
                  ? "Email body…"
                  : channel === "whatsapp"
                    ? "WhatsApp message…"
                    : "SMS text…"
              }
              aria-label="Message body"
              className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B00] resize-none transition"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#4a5b78] font-medium">Insert:</span>
              {TOKENS.map((tok) => (
                <button
                  key={tok}
                  onClick={() => insertToken(tok)}
                  className="text-[11px] font-mono font-semibold text-[#FF6B00] bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-md transition-colors"
                >
                  {tok}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-[#4a5b78]">{body.length}/4000</span>
            </div>
          </section>

          {/* ── Live preview ──────────────────────────────────────────────── */}
          <section className="rounded-[20px] p-4 bg-gradient-to-br from-[#F5F7FA] to-white border border-[#0c2340]/8">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-[#0c2340]" strokeWidth={2} />
              <h3 className="text-sm font-bold text-[#0c2340]">Live preview</h3>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-[#4a5b78]">
                As {previewCustomer.name ?? "sample"}
              </span>
            </div>
            <div className="rounded-2xl bg-white border border-[#0c2340]/8 p-3 shadow-sm">
              {channel === "email" && previewSubject && (
                <p className="text-sm font-bold text-[#0c2340] mb-1">{previewSubject}</p>
              )}
              {previewBody ? (
                <p className="text-sm text-[#0c2340] whitespace-pre-wrap leading-relaxed">
                  {previewBody}
                </p>
              ) : (
                <p className="text-sm text-[#4a5b78] italic">Your message will appear here…</p>
              )}
            </div>
          </section>

          {/* ── Audience list ─────────────────────────────────────────────── */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF6B00]" />
                Audience
                <span className="text-[11px] font-semibold text-[#4a5b78]">
                  ({chosen.length}/{filtered.length})
                </span>
              </h3>
              <button
                onClick={toggleAll}
                className="text-xs font-bold text-[#FF6B00] hover:underline"
              >
                {selected.size === filtered.length && filtered.length > 0
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[#4a5b78]">
                  No customers match — or none have{" "}
                  {channel === "email" ? "an email address" : "a phone number"} on record.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto -mx-1 px-1">
                {filtered.map((c) => {
                  const checked  = selected.has(c.key);
                  const contact  = channel === "email" ? c.email : c.contact;
                  const isWinner = c.totalWins > 0;
                  const init     = (c.name ?? c.email ?? c.contact ?? "?").slice(0, 1).toUpperCase();
                  return (
                    <li key={c.key}>
                      <label
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                          checked
                            ? "bg-orange-50 border border-[#FF6B00]/30"
                            : "bg-[#F5F7FA] border border-transparent hover:bg-[#eef1f6]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCustomer(c.key)}
                          className="w-4 h-4 accent-[#FF6B00] shrink-0"
                        />
                        <div
                          className={`w-9 h-9 shrink-0 rounded-xl grid place-items-center text-xs font-black ${
                            isWinner
                              ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                              : "bg-[#0c2340]/8 text-[#0c2340]"
                          }`}
                        >
                          {init}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#0c2340] truncate">
                            {c.name ?? "Anonymous"}
                          </p>
                          <p className="text-[11px] text-[#4a5b78] truncate">
                            {contact ?? "—"}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          {isWinner && (
                            <span className="text-[9px] font-bold text-[#FF6B00] bg-orange-50 px-1.5 py-0.5 rounded-full leading-tight">
                              Winner
                            </span>
                          )}
                          <span className="text-[10px] text-[#4a5b78]">
                            {c.totalSpins}× spin
                          </span>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Status banner ─────────────────────────────────────────────── */}
          {sendStatus && (
            <div
              className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold ${
                sendStatus.kind === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : sendStatus.kind === "err"
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              {sendStatus.kind === "ok"   && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
              {sendStatus.kind === "err"  && <AlertCircle  className="w-4 h-4 shrink-0 mt-0.5" />}
              {sendStatus.kind === "info" && <Info         className="w-4 h-4 shrink-0 mt-0.5" />}
              {sendStatus.msg}
            </div>
          )}
        </>
      )}

      {/* ── Sticky send button (compose only) ───────────────────────────────── */}
      {view === "compose" && (
        <div className="fixed bottom-20 left-0 right-0 z-30 px-4">
          <div className="max-w-md mx-auto sm:max-w-2xl">
            <button
              onClick={onSend}
              disabled={chosen.length === 0 || busy || !body.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] text-white font-bold py-3.5 shadow-[0_10px_30px_-10px_rgba(255,107,0,0.6)] hover:bg-[#e85f00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              {sendLabel}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
