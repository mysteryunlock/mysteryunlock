import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Plus, Trash2, Copy as CopyIcon, ExternalLink, Save } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { parseServerValidationError } from "@/lib/utils";
import { listMyShops } from "@/lib/shops.functions";
import {
  listMyCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "@/lib/campaigns.functions";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — Mystery Unlock" }] }),
  component: CampaignsPage,
});

type Campaign = {
  id: string;
  name: string;
  slug: string;
  theme: { accent?: string } | null;
  is_active: boolean;
  is_default: boolean;
};

const PRESET_ACCENTS = ["#1f3460", "#FF6B00", "#16a34a", "#a21caf", "#dc2626", "#0891b2", "#ca8a04", "#0f172a"];

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function CampaignsPage() {
  const fetchShop = useServerFn(listMyShops);
  const fetchList = useServerFn(listMyCampaigns);
  const doCreate = useServerFn(createCampaign);
  const doUpdate = useServerFn(updateCampaign);
  const doDelete = useServerFn(deleteCampaign);

  const [shop, setShop] = useState<{ id: string; slug: string; name: string } | null>(null);
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newAccent, setNewAccent] = useState("#1f3460");

  const reload = useCallback(async (shopId: string) => {
    const r = await fetchList({ data: { shopId } });
    setList(r.campaigns as Campaign[]);
  }, [fetchList]);

  useEffect(() => {
    (async () => {
      const r = await fetchShop();
      const s = r.shops?.[0];
      if (s) {
        setShop({ id: s.id, slug: s.slug, name: s.name });
        await reload(s.id);
      }
      setLoading(false);
    })();

  }, [fetchShop, reload]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!shop) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">No shop found. Create one in your dashboard first.</div>;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error("Name is required");
    const finalSlug = newSlug.trim() || slugify(newName);
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(finalSlug)) {
      return toast.error("Slug must be lowercase letters, numbers, dashes");
    }
    try {
      await doCreate({ data: { shopId: shop.id, name: newName.trim(), slug: finalSlug, theme: { accent: newAccent }, is_active: true } });
      setNewName(""); setNewSlug(""); setNewAccent("#1f3460"); setCreating(false);
      await reload(shop.id);
      toast.success("Campaign created");
    } catch (e: any) {
      toast.error(parseServerValidationError(e) ?? e?.message ?? "Could not create campaign");
    }
  };

  const updateField = async (id: string, patch: Partial<{ name: string; is_active: boolean; theme: { accent: string } }>) => {
    try {
      await doUpdate({ data: { shopId: shop.id, id, ...patch } });
      await reload(shop.id);
    } catch (e: any) {
      toast.error(parseServerValidationError(e) ?? e?.message ?? "Could not update");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this campaign? All its access codes and prizes will be removed too.")) return;
    try {
      await doDelete({ data: { shopId: shop.id, id } });
      await reload(shop.id);
      toast.success("Campaign deleted");
    } catch (e: any) {
      toast.error(e?.message || "Could not delete");
    }
  };

  return (
    <div className="min-h-screen bg-white pb-16">
      <div className="px-4 sm:px-6 pt-5 max-w-5xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c2340] px-3 py-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5]">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-black text-[#0c2340] mt-4">Campaigns</h1>
        <p className="text-sm text-[#4a5b78] mt-1">Create multiple spin campaigns. Each has its own prizes, access codes, QR, and wheel color.</p>

        {/* Create */}
        <section className="mt-6 rounded-2xl bg-[#F5F7FA] border border-[#0c2340]/10 p-4">
          {!creating ? (
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B00] text-white font-bold hover:bg-[#e85e00]">
              <Plus className="w-4 h-4" /> New Campaign
            </button>
          ) : (
            <div className="space-y-3">
              <h3 className="font-bold text-[#0c2340]">New Campaign</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[#4a5b78] font-semibold">Name</span>
                  <input
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); if (!newSlug) setNewSlug(slugify(e.target.value)); }}
                    placeholder="Diwali Spin"
                    className="mt-1 w-full bg-white border border-[#0c2340]/15 rounded-lg px-3 py-2 text-[#0c2340]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[#4a5b78] font-semibold">URL slug</span>
                  <input
                    value={newSlug}
                    onChange={(e) => setNewSlug(slugify(e.target.value))}
                    placeholder="diwali"
                    className="mt-1 w-full bg-white border border-[#0c2340]/15 rounded-lg px-3 py-2 font-mono text-[#0c2340]"
                  />
                </label>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-[#4a5b78] font-semibold">Wheel accent color</span>
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  {PRESET_ACCENTS.map((c) => (
                    <button key={c} onClick={() => setNewAccent(c)} className={`w-8 h-8 rounded-full border-2 ${newAccent === c ? "border-[#0c2340]" : "border-transparent"}`} style={{ background: c }} aria-label={c} />
                  ))}
                  <input type="color" value={newAccent} onChange={(e) => setNewAccent(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                  <span className="font-mono text-sm text-[#0c2340]">{newAccent}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-[#0c2340] text-white font-bold inline-flex items-center gap-2"><Save className="w-4 h-4" /> Create</button>
                <button onClick={() => { setCreating(false); setNewName(""); setNewSlug(""); }} className="px-4 py-2 rounded-lg bg-white border border-[#0c2340]/15 text-[#0c2340] font-semibold">Cancel</button>
              </div>
            </div>
          )}
        </section>

        {/* List */}
        <section className="mt-6 space-y-4">
          {list.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              shopSlug={shop.slug}
              origin={origin}
              onToggle={(active) => updateField(c.id, { is_active: active })}
              onAccentChange={(accent) => updateField(c.id, { theme: { accent } })}
              onRename={(name) => updateField(c.id, { name })}
              onDelete={() => remove(c.id)}
            />
          ))}
          {list.length === 0 && (
            <p className="text-center text-[#4a5b78] py-6">No campaigns yet. Create your first one above.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function CampaignCard({
  campaign, shopSlug, origin, onToggle, onAccentChange, onRename, onDelete,
}: {
  campaign: Campaign;
  shopSlug: string;
  origin: string;
  onToggle: (active: boolean) => void;
  onAccentChange: (accent: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const accent = campaign.theme?.accent || "#1f3460";
  const url = `${origin}/s/${shopSlug}?c=${campaign.slug}`;

  return (
    <article className="rounded-2xl bg-white border border-[#0c2340]/10 shadow-sm p-4">
      <div className="grid sm:grid-cols-[1fr_auto] gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full shrink-0" style={{ background: accent }} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { if (name.trim() && name !== campaign.name) onRename(name.trim()); }}
              className="font-black text-lg text-[#0c2340] bg-transparent border-b border-transparent focus:border-[#0c2340]/30 outline-none"
            />
            {campaign.is_default && <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#FFEDD5] text-[#9A3412] rounded-full">Default</span>}
          </div>

          <p className="text-xs text-[#4a5b78] font-mono break-all">{url}</p>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F7FA] text-[#0c2340] text-sm font-semibold hover:bg-[#ECEFF5]">
              <CopyIcon className="w-3.5 h-3.5" /> Copy link
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F7FA] text-[#0c2340] text-sm font-semibold hover:bg-[#ECEFF5]">
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F7FA] text-[#0c2340] text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={campaign.is_active} onChange={(e) => onToggle(e.target.checked)} />
              {campaign.is_active ? "Active" : "Paused"}
            </label>
            {!campaign.is_default && (
              <button onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-[#4a5b78] font-semibold mb-1.5">Wheel accent color</p>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_ACCENTS.map((c) => (
                <button key={c} onClick={() => onAccentChange(c)} className={`w-7 h-7 rounded-full border-2 ${accent === c ? "border-[#0c2340]" : "border-transparent"}`} style={{ background: c }} />
              ))}
              <input type="color" value={accent} onChange={(e) => onAccentChange(e.target.value)} className="w-9 h-9 rounded cursor-pointer" />
              <span className="font-mono text-xs text-[#0c2340]">{accent}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="p-2 bg-white border border-[#0c2340]/10 rounded-lg">
            <QRCodeSVG value={url} size={140} level="M" includeMargin={false} />
          </div>
          <p className="text-[10px] text-[#4a5b78]">Scan to spin</p>
        </div>
      </div>
    </article>
  );
}
