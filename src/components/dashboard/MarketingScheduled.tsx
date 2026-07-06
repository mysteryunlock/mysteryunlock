import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle, Calendar, CalendarClock, CheckCircle2, Clock,
  Mail, MessageSquare, Phone, Send, X,
} from "lucide-react";
import {
  cancelScheduledBroadcast, listScheduledBroadcasts, markBroadcastSent,
} from "@/lib/marketing-template.functions";
import { DashCard, EmptyState, SectionHead, SkeletonBlock } from "./ui";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledBroadcast {
  id:             string;
  channel:        string;
  name:           string | null;
  subject:        string | null;
  body:           string;
  segmentFilter:  string;
  recipientCount: number;
  scheduledAt:    string;
  status:         "scheduled";
  createdAt:      string;
}

export type FillComposeData = {
  channel:       string;
  body:          string;
  subject:       string | null;
  segmentFilter: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CH_ICON = {
  email:    Mail,
  whatsapp: MessageSquare,
  sms:      Phone,
};

const CH_COLOR: Record<string, string> = {
  email:    "#FF6B00",
  whatsapp: "#10b981",
  sms:      "#3b82f6",
};

function fmtScheduled(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function groupBroadcasts(broadcasts: ScheduledBroadcast[]) {
  const nowMs   = Date.now();
  const todayStr = new Date().toDateString();
  return {
    today:    broadcasts.filter((b) => new Date(b.scheduledAt).toDateString() === todayStr && new Date(b.scheduledAt).getTime() >= nowMs),
    upcoming: broadcasts.filter((b) => new Date(b.scheduledAt).toDateString() !== todayStr && new Date(b.scheduledAt).getTime() > nowMs),
    past:     broadcasts.filter((b) => new Date(b.scheduledAt).getTime() < nowMs),
  };
}

// ─── ScheduledCard ────────────────────────────────────────────────────────────

function ScheduledCard({
  broadcast,
  onEdit,
  onCancel,
  onSendNow,
  cancelling,
  sending,
}: {
  broadcast:  ScheduledBroadcast;
  onEdit:     () => void;
  onCancel:   () => void;
  onSendNow:  () => void;
  cancelling: boolean;
  sending:    boolean;
}) {
  const ch    = broadcast.channel;
  const Icon  = CH_ICON[ch as keyof typeof CH_ICON] ?? MessageSquare;
  const color = CH_COLOR[ch] ?? "#4a5b78";
  const title = broadcast.name
    ?? (ch === "email" ? broadcast.subject : null)
    ?? broadcast.body.slice(0, 50);

  const isPast = new Date(broadcast.scheduledAt).getTime() < Date.now();

  return (
    <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
          style={{ background: `${color}1a`, color }}
        >
          <Icon className="w-4 h-4" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#0c2340] truncate">{title}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-[#4a5b78]">
            <span
              className="font-semibold px-1.5 py-0.5 rounded-full text-[10px]"
              style={{ background: `${color}1a`, color }}
            >
              {ch}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {fmtScheduled(broadcast.scheduledAt)}
            </span>
            {broadcast.segmentFilter !== "all" && (
              <span className="font-semibold">{broadcast.segmentFilter}</span>
            )}
            <span>{broadcast.recipientCount} recipient{broadcast.recipientCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {isPast && (
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-[#0c2340]/6">
        <button
          onClick={onSendNow}
          disabled={sending || cancelling}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#FF6B00] text-white text-xs font-bold py-2 hover:bg-[#e85f00] disabled:opacity-50 transition"
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? "Preparing…" : "Send Now"}
        </button>
        <button
          onClick={onEdit}
          disabled={sending || cancelling}
          className="px-3 py-2 rounded-xl border border-[#0c2340]/10 text-xs font-semibold text-[#0c2340] hover:bg-[#F5F7FA] disabled:opacity-50 transition"
        >
          Edit
        </button>
        <button
          onClick={onCancel}
          disabled={cancelling || sending}
          aria-label="Cancel broadcast"
          className="p-2 rounded-xl border border-[#0c2340]/10 text-[#4a5b78] hover:bg-red-50 hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition"
        >
          {cancelling ? <Clock className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function ScheduledGroup({
  label,
  icon: Icon,
  iconClass,
  broadcasts,
  onEdit,
  onCancel,
  onSendNow,
  cancelling,
  sending,
}: {
  label:      string;
  icon:       typeof Clock;
  iconClass:  string;
  broadcasts: ScheduledBroadcast[];
  onEdit:     (b: ScheduledBroadcast) => void;
  onCancel:   (id: string) => void;
  onSendNow:  (b: ScheduledBroadcast) => void;
  cancelling: string | null;
  sending:    string | null;
}) {
  if (broadcasts.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span className="text-xs font-bold uppercase tracking-wide text-[#4a5b78]">
          {label} <span className="text-[#0c2340] font-black">({broadcasts.length})</span>
        </span>
      </div>
      {broadcasts.map((b) => (
        <ScheduledCard
          key={b.id}
          broadcast={b}
          onEdit={() => onEdit(b)}
          onCancel={() => onCancel(b.id)}
          onSendNow={() => onSendNow(b)}
          cancelling={cancelling === b.id}
          sending={sending === b.id}
        />
      ))}
    </div>
  );
}

// ─── UpcomingWidget ───────────────────────────────────────────────────────────

export function UpcomingWidget({ broadcasts }: { broadcasts: ScheduledBroadcast[] }) {
  const upcoming = useMemo(
    () =>
      broadcasts
        .filter((b) => new Date(b.scheduledAt).getTime() > Date.now())
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .slice(0, 3),
    [broadcasts],
  );

  if (upcoming.length === 0) {
    return (
      <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
        <SectionHead title="Upcoming Broadcasts" right={<CalendarClock className="w-4 h-4 text-[#FF6B00]" />} />
        <p className="text-xs text-[#4a5b78] mt-3 text-center py-3">No scheduled broadcasts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
      <SectionHead
        title="Upcoming Broadcasts"
        right={<span className="text-[11px] text-[#4a5b78]">next 3</span>}
      />
      {upcoming.map((b) => {
        const ch    = b.channel;
        const color = CH_COLOR[ch] ?? "#4a5b78";
        const Icon  = CH_ICON[ch as keyof typeof CH_ICON] ?? MessageSquare;
        const title = b.name ?? (ch === "email" ? b.subject : null) ?? b.body.slice(0, 40);
        return (
          <div key={b.id} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl grid place-items-center shrink-0"
              style={{ background: `${color}1a`, color }}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0c2340] truncate">{title}</p>
              <p className="text-[10px] text-[#4a5b78]">{fmtScheduled(b.scheduledAt)}</p>
            </div>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          </div>
        );
      })}
    </div>
  );
}

// ─── ScheduledBroadcasts ──────────────────────────────────────────────────────

export function ScheduledBroadcasts({
  shopId,
  onFillCompose,
}: {
  shopId:         string;
  onFillCompose:  (data: FillComposeData) => void;
}) {
  const fetchScheduled = useServerFn(listScheduledBroadcasts);
  const doCancel       = useServerFn(cancelScheduledBroadcast);
  const doMarkSent     = useServerFn(markBroadcastSent);

  const [broadcasts, setBroadcasts] = useState<ScheduledBroadcast[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [sending,    setSending]    = useState<string | null>(null);
  const [sentIds,    setSentIds]    = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchScheduled({ data: { shopId } });
      setBroadcasts((res as { broadcasts: ScheduledBroadcast[] }).broadcasts ?? []);
    } catch { setBroadcasts([]); }
    finally { setLoading(false); }
  }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => groupBroadcasts(broadcasts), [broadcasts]);

  const handleCancel = useCallback(async (id: string) => {
    if (!confirm("Cancel this scheduled broadcast?")) return;
    setCancelling(id);
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    try {
      await doCancel({ data: { shopId, broadcastId: id } });
    } catch { void load(); }
    finally { setCancelling(null); }
  }, [shopId, doCancel, load]);

  const handleSendNow = useCallback(async (broadcast: ScheduledBroadcast) => {
    setSending(broadcast.id);
    try {
      const res = await doMarkSent({ data: { shopId, broadcastId: broadcast.id } });
      setSentIds((prev) => new Set([...prev, broadcast.id]));
      setBroadcasts((prev) => prev.filter((b) => b.id !== broadcast.id));
      const result = res as {
        ok: boolean; channel: string; body: string;
        subject: string | null; segmentFilter: string;
      };
      onFillCompose({
        channel:       result.channel,
        body:          result.body,
        subject:       result.subject,
        segmentFilter: result.segmentFilter,
      });
    } catch { void load(); }
    finally { setSending(null); }
  }, [shopId, doMarkSent, onFillCompose, load]);

  const handleEdit = useCallback((broadcast: ScheduledBroadcast) => {
    onFillCompose({
      channel:       broadcast.channel,
      body:          broadcast.body,
      subject:       broadcast.subject,
      segmentFilter: broadcast.segmentFilter,
    });
  }, [onFillCompose]);

  const noScheduled = !loading && broadcasts.length === 0 && sentIds.size === 0;

  return (
    <div className="space-y-5">

      {/* ── Upcoming widget ──────────────────────────────────────────── */}
      {!loading && broadcasts.length > 0 && (
        <UpcomingWidget broadcasts={broadcasts} />
      )}

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          <SkeletonBlock className="h-[120px]" />
          <SkeletonBlock className="h-[120px]" />
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────── */}
      {noScheduled && (
        <DashCard className="p-0">
          <EmptyState
            icon={Calendar}
            title="No scheduled broadcasts"
            description="Schedule a broadcast from the Broadcast tab using the 'Schedule for later' toggle."
          />
        </DashCard>
      )}

      {/* ── Sent confirmation banner ─────────────────────────────────── */}
      {sentIds.size > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {sentIds.size} broadcast{sentIds.size !== 1 ? "s" : ""} marked as sent — Broadcast tab pre-filled for review.
        </div>
      )}

      {/* ── Grouped sections ─────────────────────────────────────────── */}
      {!loading && (
        <>
          <ScheduledGroup
            label="Today"
            icon={CalendarClock}
            iconClass="text-[#FF6B00]"
            broadcasts={grouped.today}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onSendNow={handleSendNow}
            cancelling={cancelling}
            sending={sending}
          />
          <ScheduledGroup
            label="Upcoming"
            icon={Calendar}
            iconClass="text-blue-500"
            broadcasts={grouped.upcoming}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onSendNow={handleSendNow}
            cancelling={cancelling}
            sending={sending}
          />
          <ScheduledGroup
            label="Past (unsent)"
            icon={AlertCircle}
            iconClass="text-amber-500"
            broadcasts={grouped.past}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onSendNow={handleSendNow}
            cancelling={cancelling}
            sending={sending}
          />
        </>
      )}
    </div>
  );
}
