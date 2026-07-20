import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlignJustify, Copy, Eye, LayoutGrid, Pencil, Plus,
  Save, Search, Star, Tag, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTemplate, deleteTemplate, duplicateTemplate,
  listTemplates, toggleFavorite, updateTemplate,
} from "@/lib/marketing-template.functions";
import { DashCard, EmptyState, SectionHead, SkeletonBlock } from "./ui";
import { Btn, ConfirmModal } from "@/components/ds";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MktTemplate {
  id:        string;
  shopId:    string;
  name:      string;
  category:  string;
  subject:   string | null;
  body:      string;
  favorite:  boolean;
  createdAt: string;
  updatedAt: string;
}

type SortMode = "newest" | "oldest" | "az";
type ViewMode = "grid" | "list";

// ─── Category config ──────────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES = ["All", "Promotion", "Winner", "Reminder", "Festival", "Custom"] as const;
type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

const CAT_STYLE: Record<string, { bg: string; text: string; accent: string }> = {
  Promotion: { bg: "bg-orange-50",  text: "text-[#FF6B1A]", accent: "#FF6B1A" },
  Winner:    { bg: "bg-emerald-50", text: "text-emerald-700", accent: "#10b981" },
  Reminder:  { bg: "bg-blue-50",    text: "text-blue-700",    accent: "#3b82f6" },
  Festival:  { bg: "bg-purple-50",  text: "text-purple-700",  accent: "#7c3aed" },
  Custom:    { bg: "bg-slate-100",  text: "text-slate-700",   accent: "#64748b" },
};
const catStyle = (c: string) => CAT_STYLE[c] ?? CAT_STYLE.Custom;

// ─── TemplateEditor (drawer) ──────────────────────────────────────────────────

function TemplateEditor({
  template,
  shopId,
  onSave,
  onClose,
}: {
  template: MktTemplate | "new";
  shopId:   string;
  onSave:   (saved: MktTemplate) => void;
  onClose:  () => void;
}) {
  const doCreate = useServerFn(createTemplate);
  const doUpdate = useServerFn(updateTemplate);

  const isNew = template === "new";
  const init  = isNew
    ? { name: "", category: "Promotion" as string, subject: "", body: "", favorite: false }
    : { name: template.name, category: template.category, subject: template.subject ?? "", body: template.body, favorite: template.favorite };

  const [name,     setName]     = useState(init.name);
  const [category, setCategory] = useState<string>(init.category);
  const [subject,  setSubject]  = useState(init.subject);
  const [body,     setBody]     = useState(init.body);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleSave = async () => {
    if (!name.trim())  { setErr("Template name is required."); return; }
    if (!body.trim())  { setErr("Message body is required."); return; }
    setSaving(true);
    setErr(null);
    try {
      if (isNew) {
        const res = await doCreate({
          data: { shopId, name: name.trim(), category, subject: subject.trim() || null, body, favorite: false },
        });
        onSave((res as { template: MktTemplate }).template);
      } else {
        const res = await doUpdate({
          data: {
            shopId,
            templateId: template.id,
            name:       name.trim(),
            category,
            subject:    subject.trim() || null,
            body,
            favorite:   template.favorite,
          },
        });
        onSave((res as { template: MktTemplate }).template);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const preview = name
    ? body.replace("{customer_name}", "Alex").replace("{shop_name}", "Your Shop").replace("{prize_name}", "10% Off")
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "New template" : `Edit: ${template.name}`}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#0c2340]">
            {isNew ? "New Template" : "Edit Template"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[#F5F7FA] grid place-items-center text-[#4a5b78] hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#4a5b78] uppercase tracking-wide">
            Template Name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Flash Sale — 24h Only"
            maxLength={120}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSave(); }}
            className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B1A] transition"
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#4a5b78] uppercase tracking-wide">
            Category
          </label>
          <div className="flex gap-2 flex-wrap">
            {(["Promotion","Winner","Reminder","Festival","Custom"] as const).map((c) => {
              const active = category === c;
              const s = catStyle(c);
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? `${s.bg} ${s.text} border-transparent ring-2`
                      : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-[#0c2340]/20"
                  }`}
                  style={active ? { "--tw-ring-color": s.accent } as React.CSSProperties : {}}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#4a5b78] uppercase tracking-wide">
            Subject <span className="normal-case font-normal">(optional — for email)</span>
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line for email…"
            maxLength={200}
            className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B1A] transition"
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#4a5b78] uppercase tracking-wide">
            Message Body *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="Hi {customer_name}, thanks for visiting {shop_name}! You won {prize_name}…"
            className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B1A] resize-none transition"
          />
          <p className="text-[10px] text-[#4a5b78] text-right">{body.length}/4000</p>
        </div>

        {/* Live preview */}
        {preview && (
          <div className="rounded-2xl bg-[#F5F7FA] border border-[#0c2340]/8 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4a5b78]">
              <Eye className="w-3 h-3" /> Preview
            </div>
            <p className="text-xs text-[#0c2340] whitespace-pre-wrap leading-relaxed">{preview}</p>
          </div>
        )}

        {/* Error */}
        {err && (
          <p className="text-sm text-red-600 font-semibold bg-red-50 rounded-xl px-3 py-2">{err}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#0c2340]/10 text-sm font-bold text-[#4a5b78] py-2.5 hover:bg-[#F5F7FA] transition"
          >
            Cancel
          </button>
          <Btn
            variant="primary"
            className="flex-1 py-2.5 text-sm"
            onClick={handleSave}
            disabled={saving}
            loading={saving}
            leftIcon={saving ? undefined : <Save className="w-4 h-4" />}
          >
            {saving ? "Saving…" : "Save Template"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  viewMode,
  onUse,
  onEdit,
  onDuplicate,
  onDelete,
  onFavorite,
}: {
  template:    MktTemplate;
  viewMode:    ViewMode;
  onUse:       () => void;
  onEdit:      () => void;
  onDuplicate: () => void;
  onDelete:    () => void;
  onFavorite:  () => void;
}) {
  const s = catStyle(template.category);

  if (viewMode === "list") {
    return (
      <div className="rounded-2xl bg-white border border-[#0c2340]/8 shadow-[0_2px_12px_-4px_rgba(12,35,64,0.08)] px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-[#0c2340] truncate">{template.name}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
              {template.category}
            </span>
          </div>
          <p className="text-xs text-[#4a5b78] truncate">{template.body.slice(0, 80)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onFavorite}
            aria-label={template.favorite ? "Remove favourite" : "Mark favourite"}
            className={`p-1.5 rounded-lg transition-colors ${template.favorite ? "text-amber-400 hover:text-amber-500" : "text-[#4a5b78]/40 hover:text-amber-400"}`}
          >
            <Star className="w-4 h-4" fill={template.favorite ? "currentColor" : "none"} />
          </button>
          <Btn variant="primary" size="xs" className="rounded-lg px-2.5 py-1.5" onClick={onUse}>Use</Btn>
          <button onClick={onEdit}      aria-label="Edit" className="p-1.5 rounded-lg hover:bg-[#F5F7FA] text-[#4a5b78] transition"><Pencil   className="w-3.5 h-3.5" /></button>
          <button onClick={onDuplicate} aria-label="Duplicate" className="p-1.5 rounded-lg hover:bg-[#F5F7FA] text-[#4a5b78] transition"><Copy     className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete}    aria-label="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-[#4a5b78] hover:text-red-500 transition"><Trash2  className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-[#0c2340]/8 shadow-[0_4px_16px_-8px_rgba(12,35,64,0.10)] p-4 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#0c2340] leading-snug truncate">{template.name}</p>
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${s.bg} ${s.text}`}>
            {template.category}
          </span>
        </div>
        <button
          onClick={onFavorite}
          aria-label={template.favorite ? "Remove favourite" : "Mark favourite"}
          className={`shrink-0 p-1.5 rounded-lg transition-colors ${template.favorite ? "text-amber-400 hover:text-amber-500" : "text-[#4a5b78]/30 hover:text-amber-400"}`}
        >
          <Star className="w-4 h-4" fill={template.favorite ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Body preview */}
      <p className="text-xs text-[#4a5b78] leading-relaxed line-clamp-2">{template.body}</p>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-[#0c2340]/6">
        <Btn variant="primary" size="xs" className="flex-1 rounded-xl py-1.5" onClick={onUse}>Use</Btn>
        <button onClick={onEdit}      aria-label="Edit"      className="p-2 rounded-xl hover:bg-[#F5F7FA] text-[#4a5b78] transition"><Pencil  className="w-3.5 h-3.5" /></button>
        <button onClick={onDuplicate} aria-label="Duplicate" className="p-2 rounded-xl hover:bg-[#F5F7FA] text-[#4a5b78] transition"><Copy    className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete}    aria-label="Delete"    className="p-2 rounded-xl hover:bg-red-50 text-[#4a5b78] hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

// ─── TemplateManager ──────────────────────────────────────────────────────────

export function TemplateManager({
  shopId,
  onUseTemplate,
}: {
  shopId:          string;
  onUseTemplate:   (data: { body: string; subject?: string | null }) => void;
}) {
  const fetchList  = useServerFn(listTemplates);
  const doDupe     = useServerFn(duplicateTemplate);
  const doDelete   = useServerFn(deleteTemplate);
  const doFav      = useServerFn(toggleFavorite);

  const [templates, setTemplates] = useState<MktTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [category,  setCategory]  = useState<string>("All");
  const [sortBy,    setSortBy]    = useState<SortMode>("newest");
  const [viewMode,  setViewMode]  = useState<ViewMode>("grid");
  const [favOnly,   setFavOnly]   = useState(false);
  const [editing,   setEditing]   = useState<MktTemplate | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchList({ data: { shopId } });
      setTemplates((res as { templates: MktTemplate[] }).templates ?? []);
    } catch (e) {
      setTemplates([]);
      toast.error(e instanceof Error ? e.message : "Failed to load templates.");
    }
    finally { setLoading(false); }
  }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    let list = templates;
    if (favOnly) list = list.filter((t) => t.favorite);
    if (category !== "All") list = list.filter((t) => t.category === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q));
    }
    if (sortBy === "oldest") list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (sortBy === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [templates, favOnly, category, search, sortBy]);

  const handleSave = useCallback((saved: MktTemplate) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) return prev.map((t, i) => (i === idx ? saved : t));
      return [saved, ...prev];
    });
    setEditing(null);
  }, []);

  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const handleDelete = useCallback((id: string) => {
    setDeleteTemplateId(id);
  }, []);

  const doDelete_ = useCallback(async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    try {
      await doDelete({ data: { shopId, templateId: id } });
      toast.success("Template deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete template.");
      void load();
    }
  }, [shopId, doDelete, load]);

  const handleDuplicate = useCallback(async (id: string) => {
    try {
      const res = await doDupe({ data: { shopId, templateId: id } });
      const duped = (res as { template: MktTemplate }).template;
      setTemplates((prev) => [duped, ...prev]);
      toast.success("Template duplicated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to duplicate template.");
    }
  }, [shopId, doDupe]);

  const handleToggleFav = useCallback(async (id: string) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)));
    try {
      await doFav({ data: { shopId, templateId: id } });
    } catch (e) {
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)));
      toast.error(e instanceof Error ? e.message : "Failed to update favourite.");
    }
  }, [shopId, doFav]);

  const favCount = useMemo(() => templates.filter((t) => t.favorite).length, [templates]);

  return (
    <div className="space-y-4">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">

        {/* Search + New */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7a93] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              aria-label="Search templates"
              className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-[#FF6B1A]/40 transition"
            />
          </div>
          <Btn
            variant="primary"
            size="sm"
            className="rounded-xl shrink-0"
            onClick={() => setEditing("new")}
            aria-label="Create new template"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New
          </Btn>
        </div>

        {/* Category pills + sort + view toggle */}
        <div className="flex items-center gap-2 overflow-x-auto -mx-0.5 px-0.5 pb-0.5">
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                category === c
                  ? "bg-[#0c2340] text-white border-[#0c2340]"
                  : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-[#0c2340]/20"
              }`}
            >
              {c}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {/* Favourite toggle */}
            <button
              onClick={() => setFavOnly((v) => !v)}
              aria-pressed={favOnly}
              title="Favourites only"
              className={`p-1.5 rounded-lg transition-colors ${favOnly ? "text-amber-400 bg-amber-50" : "text-[#4a5b78]/40 hover:text-amber-400"}`}
            >
              <Star className="w-4 h-4" fill={favOnly ? "currentColor" : "none"} />
            </button>
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              aria-label="Sort templates"
              className="bg-[#F5F7FA] border border-[#0c2340]/10 rounded-lg px-2 py-1 text-xs font-semibold text-[#0c2340] outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">A–Z</option>
            </select>
            {/* View toggle */}
            <div className="flex rounded-lg bg-[#F5F7FA] p-0.5">
              <button onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"} title="Grid view"
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-[#0c2340]" : "text-[#4a5b78]"}`}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"} title="List view"
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-[#0c2340]" : "text-[#4a5b78]"}`}>
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[11px] text-[#4a5b78]">
          <Tag className="w-3 h-3" />
          <span>{templates.length} template{templates.length !== 1 ? "s" : ""}</span>
          {favCount > 0 && <span>· {favCount} favourited</span>}
          {filtered.length !== templates.length && <span>· {filtered.length} shown</span>}
        </div>
      </div>

      {/* ── Loading skeletons ─────────────────────────────────────────── */}
      {loading && (
        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className={viewMode === "grid" ? "h-[140px]" : "h-[64px]"} />
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!loading && templates.length === 0 && (
        <DashCard className="p-0">
          <EmptyState
            icon={Tag}
            title="No templates yet"
            description="Create reusable message templates to speed up your broadcasts."
            action={{ label: "Create First Template", onClick: () => setEditing("new") }}
          />
        </DashCard>
      )}

      {/* ── No match ─────────────────────────────────────────────────── */}
      {!loading && templates.length > 0 && filtered.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-sm text-[#4a5b78]">No templates match your filters.</p>
          <button onClick={() => { setSearch(""); setCategory("All"); setFavOnly(false); }} className="mt-2 text-xs text-[#FF6B1A] font-semibold hover:underline">
            Clear filters
          </button>
        </div>
      )}

      {/* ── Template grid/list ────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"}>
          {filtered.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              viewMode={viewMode}
              onUse={() => { onUseTemplate({ body: tpl.body, subject: tpl.subject }); }}
              onEdit={() => setEditing(tpl)}
              onDuplicate={() => void handleDuplicate(tpl.id)}
              onDelete={() => void handleDelete(tpl.id)}
              onFavorite={() => void handleToggleFav(tpl.id)}
            />
          ))}
        </div>
      )}

      {/* ── Editor drawer ─────────────────────────────────────────────── */}
      {editing !== null && (
        <TemplateEditor
          template={editing}
          shopId={shopId}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmModal
        open={deleteTemplateId !== null}
        onClose={() => setDeleteTemplateId(null)}
        onConfirm={() => { const id = deleteTemplateId!; setDeleteTemplateId(null); doDelete_(id); }}
        title="Delete this template?"
        description="This template will be permanently deleted and cannot be recovered."
        confirmLabel="Delete template"
        variant="danger"
      />
    </div>
  );
}
