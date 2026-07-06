import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft, Plus, Trash2, Copy, MoreVertical,
  Search, LayoutGrid, LayoutList, Archive, Play, Pause,
  Calendar, Zap, Trophy, TrendingUp, QrCode, Gift,
  ExternalLink, Link2, AlertTriangle, X,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { listMyShops } from "@/lib/shops.functions";
import {
  listMyCampaigns,
  duplicateCampaign,
  deleteCampaign,
  updateCampaign,
  getCampaignsStats,
} from "@/lib/campaigns.functions";
import { parseServerValidationError } from "@/lib/utils";
import { CampaignEditor, type Campaign, type CampaignStatus, campaignStatus, type CampaignTheme } from "@/components/dashboard/CampaignEditor";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — Mystery Unlock" }] }),
  component: CampaignsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStats = {
  total_codes: number;
  total_spins: number;
  winners: number;
  conversion: number;
};

type ViewMode = "grid" | "list";
type SortKey = "newest" | "oldest" | "name" | "activity";
type FilterKey = "all" | CampaignStatus;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<CampaignStatus, { label: string; dot: string; badge: string }> = {
  active:   { label: "Active",   dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  paused:   { label: "Paused",   dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border border-amber-200" },
  draft:    { label: "Draft",    dot: "bg-indigo-400",  badge: "bg-indigo-50 text-indigo-700 border border-indigo-200" },
  archived: { label: "Archived", dot: "bg-gray-400",    badge: "bg-gray-50 text-gray-600 border border-gray-200" },
};

function fmtDate(d: string | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function progressPct(stats: CampaignStats | undefined, theme: CampaignTheme | null) {
  if (!stats) return 0;
  const cap = (theme?.max_spins ?? 0) > 0 ? theme!.max_spins! : stats.total_codes;
  if (!cap) return 0;
  return Math.min(100, Math.round((stats.total_spins / cap) * 100));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CampaignsPage() {
  const fetchShop     = useServerFn(listMyShops);
  const fetchList     = useServerFn(listMyCampaigns);
  const fetchStats    = useServerFn(getCampaignsStats);
  const doDuplicate   = useServerFn(duplicateCampaign);
  const doDelete      = useServerFn(deleteCampaign);
  const doUpdate      = useServerFn(updateCampaign);

  // Data
  const [shop, setShop]           = useState<{ id: string; slug: string; name: string } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats]         = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading]     = useState(true);

  // UI controls
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<FilterKey>("all");
  const [sort, setSort]               = useState<SortKey>("newest");
  const [viewMode, setViewMode]       = useState<ViewMode>("grid");

  // Editor
  const [editorOpen, setEditorOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<Campaign | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // Action menus
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const reload = useCallback(async (shopId: string) => {
    const [campRes, statsRes] = await Promise.all([
      fetchList({ data: { shopId } }),
      fetchStats({ data: { shopId } }),
    ]);
    setCampaigns((campRes.campaigns ?? []) as Campaign[]);
    setStats((statsRes.stats ?? {}) as Record<string, CampaignStats>);
  }, [fetchList, fetchStats]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchShop();
        const s = r.shops?.[0];
        if (s) {
          setShop({ id: s.id, slug: s.slug, name: s.name });
          await reload(s.id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchShop, reload]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = campaigns
    .filter((c) => {
      const cs = campaignStatus(c);
      if (filter === "all") return cs !== "archived";
      return cs === filter;
    })
    .filter((c) =>
      !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === "activity") {
        const sa = stats[a.id]?.total_spins ?? 0;
        const sb = stats[b.id]?.total_spins ?? 0;
        return sb - sa;
      }
      // newest (default)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const archivedCount = campaigns.filter((c) => campaignStatus(c) === "archived").length;

  // ── Actions ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setEditorOpen(true);
    setOpenMenu(null);
  };

  const openEdit = (c: Campaign) => {
    setEditTarget(c);
    setEditorOpen(true);
    setOpenMenu(null);
  };

  const handleSaved = async (updated: Campaign) => {
    setEditorOpen(false);
    if (shop) await reload(shop.id);
    toast.success(editTarget ? "Campaign updated" : `"${updated.name}" created`);
  };

  const handleDuplicate = async (c: Campaign) => {
    setOpenMenu(null);
    const tid = toast.loading(`Duplicating "${c.name}"…`);
    try {
      const res = await doDuplicate({ data: { shopId: shop!.id, id: c.id } });
      await reload(shop!.id);
      toast.success(`"${(res as any).campaign.name}" created as draft`, { id: tid });
    } catch (e: any) {
      toast.error(parseServerValidationError(e) ?? e?.message ?? "Duplication failed", { id: tid });
    }
  };

  const handleToggleActive = async (c: Campaign) => {
    setOpenMenu(null);
    const cs = campaignStatus(c);
    const goActive = cs !== "active";
    const newTheme: CampaignTheme = { ...(c.theme ?? {}), is_draft: false, is_archived: false };
    try {
      await doUpdate({ data: { shopId: shop!.id, id: c.id, is_active: goActive, theme: newTheme } });
      await reload(shop!.id);
      toast.success(`"${c.name}" ${goActive ? "activated" : "paused"}`);
    } catch (e: any) {
      toast.error(parseServerValidationError(e) ?? e?.message ?? "Update failed");
    }
  };

  const handleArchive = async (c: Campaign) => {
    setOpenMenu(null);
    const newTheme: CampaignTheme = { ...(c.theme ?? {}), is_archived: true, is_draft: false };
    try {
      await doUpdate({ data: { shopId: shop!.id, id: c.id, is_active: false, theme: newTheme } });
      await reload(shop!.id);
      toast.success(`"${c.name}" archived`);
    } catch (e: any) {
      toast.error(parseServerValidationError(e) ?? e?.message ?? "Archive failed");
    }
  };

  const handleUnarchive = async (c: Campaign) => {
    setOpenMenu(null);
    const newTheme: CampaignTheme = { ...(c.theme ?? {}), is_archived: false, is_draft: false };
    try {
      await doUpdate({ data: { shopId: shop!.id, id: c.id, is_active: false, theme: newTheme } });
      await reload(shop!.id);
      toast.success(`"${c.name}" unarchived (now paused)`);
    } catch (e: any) {
      toast.error(parseServerValidationError(e) ?? e?.message ?? "Unarchive failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !shop) return;
    setDeleting(true);
    try {
      await doDelete({ data: { shopId: shop.id, id: deleteTarget.id } });
      await reload(shop.id);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(parseServerValidationError(e) ?? e?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] pb-16">
        <PageHeader shopName={null} onNew={openCreate} />
        <div className="px-4 sm:px-6 max-w-5xl mx-auto mt-6">
          <SkeletonToolbar />
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#4a5b78] text-sm">
        No shop found. Create one in your dashboard first.
      </div>
    );
  }

  const FILTER_OPTS: { key: FilterKey; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "active",   label: "Active" },
    { key: "paused",   label: "Paused" },
    { key: "draft",    label: "Draft" },
    { key: "archived", label: `Archived${archivedCount > 0 ? ` (${archivedCount})` : ""}` },
  ];

  const SORT_OPTS: { key: SortKey; label: string }[] = [
    { key: "newest",   label: "Newest" },
    { key: "oldest",   label: "Oldest" },
    { key: "name",     label: "Name A–Z" },
    { key: "activity", label: "Most Active" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      <PageHeader shopName={shop.name} onNew={openCreate} />

      <div className="px-4 sm:px-6 max-w-5xl mx-auto">

        {/* ── Toolbar ───────────────────────────────────────────── */}
        <div className="mt-5 space-y-3">
          {/* Search + sort + view */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5b78]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns…"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#0c2340]/10 rounded-xl text-sm text-[#0c2340] placeholder:text-[#4a5b78]/50 focus:outline-none focus:border-[#FF6B00]/40 focus:ring-2 focus:ring-[#FF6B00]/10 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5b78] hover:text-[#0c2340]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="relative shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none bg-white border border-[#0c2340]/10 rounded-xl pl-3 pr-8 py-2.5 text-sm text-[#0c2340] focus:outline-none focus:border-[#FF6B00]/40 cursor-pointer"
              >
                {SORT_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <TrendingUp className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a5b78] pointer-events-none" />
            </div>
            <div className="flex bg-white border border-[#0c2340]/10 rounded-xl p-1 gap-0.5 shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-[#0c2340] text-white" : "text-[#4a5b78] hover:text-[#0c2340]"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-[#0c2340] text-white" : "text-[#4a5b78] hover:text-[#0c2340]"}`}
                title="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {FILTER_OPTS.map((o) => (
              <button
                key={o.key}
                onClick={() => setFilter(o.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                  filter === o.key
                    ? "bg-[#0c2340] text-white"
                    : "bg-white border border-[#0c2340]/10 text-[#4a5b78] hover:border-[#0c2340]/25 hover:text-[#0c2340]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Campaign grid / list ───────────────────────────── */}
        <div className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState
              hasSearch={!!search}
              hasFilter={filter !== "all"}
              isArchiveFilter={filter === "archived"}
              onCreate={openCreate}
              onClear={() => { setSearch(""); setFilter("all"); }}
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => (
                <CampaignGridCard
                  key={c.id}
                  campaign={c}
                  stats={stats[c.id]}
                  shopSlug={shop.slug}
                  origin={origin}
                  menuOpen={openMenu === c.id}
                  onMenuToggle={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                  menuRef={openMenu === c.id ? menuRef : undefined}
                  onEdit={() => openEdit(c)}
                  onDuplicate={() => handleDuplicate(c)}
                  onToggleActive={() => handleToggleActive(c)}
                  onArchive={() => handleArchive(c)}
                  onUnarchive={() => handleUnarchive(c)}
                  onDelete={() => { setDeleteTarget(c); setOpenMenu(null); }}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[20px] border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] overflow-hidden">
              {filtered.map((c, i) => (
                <CampaignListRow
                  key={c.id}
                  campaign={c}
                  stats={stats[c.id]}
                  shopSlug={shop.slug}
                  origin={origin}
                  last={i === filtered.length - 1}
                  menuOpen={openMenu === c.id}
                  onMenuToggle={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                  menuRef={openMenu === c.id ? menuRef : undefined}
                  onEdit={() => openEdit(c)}
                  onDuplicate={() => handleDuplicate(c)}
                  onToggleActive={() => handleToggleActive(c)}
                  onArchive={() => handleArchive(c)}
                  onUnarchive={() => handleUnarchive(c)}
                  onDelete={() => { setDeleteTarget(c); setOpenMenu(null); }}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Campaign Editor Drawer ───────────────────────────── */}
      {editorOpen && (
        <CampaignEditor
          campaign={editTarget}
          shopId={shop.id}
          onSave={handleSaved}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {/* ── Delete Confirmation Modal ────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="bg-white rounded-[24px] shadow-2xl p-6 max-w-sm w-full animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-black text-[#0c2340] text-lg leading-tight">Delete Campaign?</h3>
            </div>
            <p className="text-sm text-[#4a5b78] mb-2">
              Permanently deleting <strong className="text-[#0c2340]">{deleteTarget.name}</strong> will also remove:
            </p>
            <ul className="text-sm text-[#4a5b78] mb-4 space-y-1 pl-1">
              {["All prizes", "All access codes", "All spin records"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-5">
              ⚠ This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl border border-[#0c2340]/15 text-[#0c2340] font-bold text-sm hover:bg-[#F5F7FA] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting
                  ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Deleting…</>
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────

function PageHeader({ shopName, onNew }: { shopName: string | null; onNew: () => void }) {
  return (
    <div className="bg-white border-b border-[#0c2340]/8 px-4 sm:px-6 pt-5 pb-4">
      <div className="max-w-5xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c2340] px-3 py-1.5 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#0c2340]">Campaigns</h1>
            {shopName && <p className="text-sm text-[#4a5b78] mt-0.5">{shopName}</p>}
          </div>
          <button
            onClick={onNew}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e85f00] text-white font-bold text-sm transition-colors shadow-[0_4px_12px_-4px_rgba(255,107,0,0.5)]"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Grid Card ───────────────────────────────────────────────────────

function CampaignGridCard({
  campaign, stats, shopSlug, origin,
  menuOpen, onMenuToggle, menuRef,
  onEdit, onDuplicate, onToggleActive, onArchive, onUnarchive, onDelete,
}: CampaignCardProps) {
  const cs = campaignStatus(campaign);
  const meta = STATUS_META[cs];
  const theme = campaign.theme ?? {};
  const accent = theme.accent ?? "#1f3460";
  const url = `${origin}/s/${shopSlug}?c=${campaign.slug}`;
  const pct = progressPct(stats, theme);
  const startFmt = fmtDate(theme.start_date);
  const endFmt = fmtDate(theme.end_date);

  return (
    <article className="bg-white rounded-[20px] border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] overflow-hidden flex flex-col hover:border-[#0c2340]/15 transition-colors">
      {/* Accent bar */}
      <div className="h-1.5 w-full" style={{ background: accent }} />

      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg shrink-0 border border-white/10" style={{ background: accent }} />
            <div className="min-w-0">
              <h3 className="font-black text-[#0c2340] text-sm leading-tight truncate">{campaign.name}</h3>
              {theme.description && (
                <p className="text-[11px] text-[#4a5b78] truncate mt-0.5">{theme.description}</p>
              )}
            </div>
          </div>
          <div className="relative shrink-0" ref={menuRef as any}>
            <button
              onClick={onMenuToggle}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#4a5b78] hover:bg-[#F5F7FA] hover:text-[#0c2340] transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <ActionMenu
                campaign={campaign}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onToggleActive={onToggleActive}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
                align="right"
              />
            )}
          </div>
        </div>

        {/* Status + badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          {campaign.is_default && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFEDD5] text-[#9A3412] border border-orange-200">
              Default
            </span>
          )}
        </div>

        {/* Date range */}
        {(startFmt || endFmt) && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#4a5b78]">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{startFmt ?? "—"} → {endFmt ?? "—"}</span>
          </div>
        )}

        {/* Analytics row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Zap, label: "Spins", value: stats?.total_spins ?? 0 },
            { icon: Trophy, label: "Winners", value: stats?.winners ?? 0 },
            { icon: TrendingUp, label: "Conv.", value: stats ? `${stats.conversion}%` : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-[#F5F7FA] rounded-xl p-2 text-center">
              <Icon className="w-3.5 h-3.5 text-[#FF6B00] mx-auto" />
              <p className="text-sm font-black text-[#0c2340] mt-0.5">{value}</p>
              <p className="text-[10px] text-[#4a5b78] font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {stats && stats.total_codes > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[#4a5b78]">
              <span>{stats.total_spins.toLocaleString()} spins</span>
              <span>{stats.total_codes.toLocaleString()} codes • {pct}%</span>
            </div>
            <div className="h-1.5 bg-[#F0F2F7] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: accent }}
              />
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex gap-2 pt-1 mt-auto">
          <button
            onClick={onEdit}
            className="flex-1 py-2 rounded-xl bg-[#0c2340] hover:bg-[#1a3a5c] text-white font-bold text-xs transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}
            className="w-8 h-8 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] flex items-center justify-center text-[#4a5b78] hover:text-[#0c2340] transition-colors"
            title="Copy link"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="w-8 h-8 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] flex items-center justify-center text-[#4a5b78] hover:text-[#0c2340] transition-colors"
            title="Open campaign"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

// ─── Campaign List Row ────────────────────────────────────────────────────────

function CampaignListRow({
  campaign, stats, origin, shopSlug,
  last, menuOpen, onMenuToggle, menuRef,
  onEdit, onDuplicate, onToggleActive, onArchive, onUnarchive, onDelete,
}: CampaignCardProps & { last: boolean }) {
  const cs = campaignStatus(campaign);
  const meta = STATUS_META[cs];
  const theme = campaign.theme ?? {};
  const accent = theme.accent ?? "#1f3460";
  const url = `${origin}/s/${shopSlug}?c=${campaign.slug}`;

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 hover:bg-[#F8FAFC] transition-colors ${!last ? "border-b border-[#0c2340]/6" : ""}`}>
      {/* Accent dot */}
      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: accent }} />

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-[#0c2340] truncate">{campaign.name}</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          {campaign.is_default && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFEDD5] text-[#9A3412] border border-orange-200">
              Default
            </span>
          )}
        </div>
        {theme.description && (
          <p className="text-xs text-[#4a5b78] truncate mt-0.5">{theme.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <StatChip icon={Zap} value={stats?.total_spins ?? 0} label="spins" />
        <StatChip icon={Trophy} value={stats?.winners ?? 0} label="won" />
        <StatChip icon={TrendingUp} value={stats ? `${stats.conversion}%` : "—"} label="conv" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="hidden sm:block px-3 py-1.5 rounded-lg bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340] font-semibold text-xs transition-colors"
        >
          Edit
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#4a5b78] hover:bg-[#F5F7FA] hover:text-[#0c2340] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <div className="relative" ref={menuRef as any}>
          <button
            onClick={onMenuToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#4a5b78] hover:bg-[#F5F7FA] hover:text-[#0c2340] transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <ActionMenu
              campaign={campaign}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onToggleActive={onToggleActive}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
              align="right"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, value, label }: { icon: any; value: number | string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-black text-[#0c2340]">{value}</p>
      <p className="text-[10px] text-[#4a5b78]">{label}</p>
    </div>
  );
}

// ─── Shared card props ────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  stats: CampaignStats | undefined;
  shopSlug: string;
  origin: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  menuRef: React.RefObject<HTMLDivElement> | undefined;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

// ─── Action Menu ──────────────────────────────────────────────────────────────

function ActionMenu({
  campaign, onEdit, onDuplicate, onToggleActive, onArchive, onUnarchive, onDelete, align,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  align: "left" | "right";
}) {
  const cs = campaignStatus(campaign);
  const isArchived = cs === "archived";
  const isActive = cs === "active";

  return (
    <div
      className={`absolute top-full mt-1 z-30 bg-white border border-[#0c2340]/10 rounded-xl shadow-[0_8px_32px_-8px_rgba(12,35,64,0.20)] py-1.5 w-44 ${align === "right" ? "right-0" : "left-0"}`}
    >
      <MenuItem icon={<Gift className="w-3.5 h-3.5" />} label="Edit" onClick={onEdit} />
      <MenuItem icon={<Copy className="w-3.5 h-3.5" />} label="Duplicate" onClick={onDuplicate} />
      <div className="my-1 border-t border-[#0c2340]/6" />
      {isArchived ? (
        <MenuItem icon={<Play className="w-3.5 h-3.5" />} label="Unarchive" onClick={onUnarchive} />
      ) : (
        <>
          <MenuItem
            icon={isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            label={isActive ? "Pause" : "Activate"}
            onClick={onToggleActive}
          />
          {!campaign.is_default && (
            <MenuItem icon={<Archive className="w-3.5 h-3.5" />} label="Archive" onClick={onArchive} />
          )}
        </>
      )}
      {!campaign.is_default && (
        <>
          <div className="my-1 border-t border-[#0c2340]/6" />
          <MenuItem
            icon={<Trash2 className="w-3.5 h-3.5" />}
            label="Delete"
            onClick={onDelete}
            danger
          />
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, onClick, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold transition-colors ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-[#0c2340] hover:bg-[#F5F7FA]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch, hasFilter, isArchiveFilter, onCreate, onClear,
}: {
  hasSearch: boolean;
  hasFilter: boolean;
  isArchiveFilter: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  if (hasSearch || (hasFilter && !isArchiveFilter)) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-full bg-[#F5F7FA] flex items-center justify-center mx-auto mb-4">
          <Search className="w-6 h-6 text-[#4a5b78]" />
        </div>
        <h3 className="font-black text-[#0c2340] text-lg">No campaigns found</h3>
        <p className="text-sm text-[#4a5b78] mt-1 mb-5">Try a different search or filter</p>
        <button
          onClick={onClear}
          className="px-5 py-2.5 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340] font-bold text-sm transition-colors"
        >
          Clear filters
        </button>
      </div>
    );
  }

  if (isArchiveFilter) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-full bg-[#F5F7FA] flex items-center justify-center mx-auto mb-4">
          <Archive className="w-6 h-6 text-[#4a5b78]" />
        </div>
        <h3 className="font-black text-[#0c2340] text-lg">No archived campaigns</h3>
        <p className="text-sm text-[#4a5b78] mt-1">Archived campaigns will appear here.</p>
      </div>
    );
  }

  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B00]/10 to-[#0c2340]/5 flex items-center justify-center mx-auto mb-5">
        <QrCode className="w-9 h-9 text-[#FF6B00]" />
      </div>
      <h3 className="font-black text-[#0c2340] text-xl mb-2">No campaigns yet</h3>
      <p className="text-sm text-[#4a5b78] max-w-xs mx-auto mb-7">
        Create your first spin campaign. Each campaign gets its own prizes, QR codes, and analytics.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e85f00] text-white font-bold shadow-[0_8px_24px_-8px_rgba(255,107,0,0.5)] transition-colors"
      >
        <Plus className="w-4 h-4" /> Create First Campaign
      </button>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonToolbar() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="flex-1 h-10 bg-white rounded-xl" />
        <div className="w-28 h-10 bg-white rounded-xl" />
        <div className="w-20 h-10 bg-white rounded-xl" />
      </div>
      <div className="flex gap-2">
        {[60, 52, 52, 48, 80].map((w, i) => (
          <div key={i} className="h-7 rounded-full bg-white" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[20px] border border-[#0c2340]/8 overflow-hidden animate-pulse">
      <div className="h-1.5 w-full bg-[#F0F2F7]" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F0F2F7]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-[#F0F2F7] rounded-full w-3/4" />
            <div className="h-2.5 bg-[#F0F2F7] rounded-full w-1/2" />
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 w-14 bg-[#F0F2F7] rounded-full" />
          <div className="h-5 w-16 bg-[#F0F2F7] rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-14 bg-[#F0F2F7] rounded-xl" />)}
        </div>
        <div className="h-1.5 bg-[#F0F2F7] rounded-full" />
        <div className="flex gap-2">
          <div className="flex-1 h-8 bg-[#F0F2F7] rounded-xl" />
          <div className="w-8 h-8 bg-[#F0F2F7] rounded-xl" />
          <div className="w-8 h-8 bg-[#F0F2F7] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
