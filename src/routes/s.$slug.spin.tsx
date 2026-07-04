import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SpinWheel } from "@/components/SpinWheel";
import type { Prize } from "@/lib/spin-store";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { spinAndRecord } from "@/lib/access-codes.functions";
import { listPublicCampaigns } from "@/lib/campaigns.functions";
import { playClick } from "@/lib/sounds";
import { parseServerValidationError } from "@/lib/utils";
import { codeChars, slugSchema } from "@/lib/validation";

const search = z.object({
  code: codeChars,
  c: slugSchema.optional(),
  name: z.string().min(1).max(40).optional(),
  contact: z.string().min(1).max(30).optional(),
  email: z.string().min(1).max(255).optional(),
});

export const Route = createFileRoute("/s/$slug/spin")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Spin — ${params.slug}` }] }),
  component: SpinPage,
});

function SpinPage() {
  const { slug } = Route.useParams();
  const { code, c: campaignSlug, name, contact, email } = Route.useSearch();
  const navigate = useNavigate();
  const { prizes, isLoading, campaignNotFound } = usePrizesBySlug(slug, campaignSlug);
  const fetchCampaigns = useServerFn(listPublicCampaigns);
  const campaignsQ = useQuery({
    queryKey: ["public-campaigns", slug],
    queryFn: async () => (await fetchCampaigns({ data: { slug } })).campaigns,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const [accent, setAccent] = useState<string | undefined>(undefined);

  useEffect(() => {
    const list = campaignsQ.data ?? [];
    const match = campaignSlug
      ? list.find((c) => c.slug === campaignSlug)
      : list.find((c) => c.is_default) ?? list[0];
    const theme = match?.theme as { accent?: string } | null | undefined;
    if (theme?.accent) setAccent(theme.accent);
  }, [campaignsQ.data, campaignSlug]);

  const spin = useServerFn(spinAndRecord);
  const [spinning, setSpinning] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSpin = () => {
    if (spinning || done || prizes.length === 0) return;
    playClick();
    setError("");
    // Start the wheel animation IMMEDIATELY (no target yet — SpinWheel ramps up)
    setSpinning(true);
    setTarget(null);
    // Fire server call in parallel; when it resolves, target locks in mid-spin
    (async () => {
      try {
        const res = await spin({ data: { slug, code, ...(campaignSlug ? { campaignSlug } : {}), name: name?.trim() || undefined, contact: contact?.trim() || undefined, email: email?.trim() || undefined } });
        if (!res.ok) {
          setSpinning(false);
          setTarget(null);
          setError("This code is invalid or has already been used.");
          return;
        }
        const idx = prizes.findIndex((p) => p.id === res.prize.id);
        setTarget(idx >= 0 ? idx : 0);
      } catch (err) {
        setSpinning(false);
        setTarget(null);
        setError(parseServerValidationError(err) ?? "Could not complete your spin. Please try again.");
      }
    })();
  };

  const handleComplete = (prize: Prize) => {
    setDone(true);
    setTimeout(() => {
      navigate({
        to: "/s/$slug/result",
        params: { slug },
        search: {
          code,
          pid: prize.id,
          ...(campaignSlug ? { c: campaignSlug } : {}),
          ...(contact ? { contact } : {}),
          ...(name ? { name } : {}),
        },
      });
    }, 600);
  };


  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full flex items-center justify-between mb-2">
        <button onClick={() => { playClick(); navigate({ to: "/s/$slug", params: { slug }, search: campaignSlug ? { c: campaignSlug } : {} }); }} className="text-sm text-muted-foreground">← Back</button>
        <p className="text-xs uppercase tracking-widest text-gold">Mystery Unlock Spin</p>
        <span className="w-10" />
      </div>

      <p className="text-center text-muted-foreground text-sm mb-3">
        {name ? <><span className="text-foreground font-semibold">{name}</span> · </> : null}
        Code <span className="text-foreground font-mono font-semibold tracking-widest">{code}</span>
      </p>

      <div className="w-[96vw] max-w-[560px] mt-2">
        {campaignNotFound ? (
          <div className="aspect-square flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-2xl">🔍</p>
            <p className="font-bold text-foreground">Campaign not found</p>
            <p className="text-sm text-muted-foreground">
              The campaign link you used is no longer active or doesn't exist.
              Try the{" "}
              <button
                onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
                className="underline text-foreground"
              >
                main shop page
              </button>{" "}
              instead.
            </p>
          </div>
        ) : isLoading || prizes.length === 0 ? (
          <div className="aspect-square flex items-center justify-center text-muted-foreground">Loading wheel…</div>
        ) : (
          <SpinWheel prizes={prizes} spinning={spinning} targetIndex={target} onComplete={handleComplete} accent={accent} />
        )}
      </div>

      {error && <p className="mt-4 text-destructive text-sm text-center">{error}</p>}

      <button
        onClick={handleSpin}
        disabled={spinning || done || isLoading || prizes.length === 0 || campaignNotFound}
        className="mt-10 w-full max-w-sm gradient-primary text-[#0F1115] font-black text-xl tracking-widest py-5 rounded-2xl glow-orange active:scale-[0.98] transition disabled:opacity-60"
      >
        {spinning ? "SPINNING..." : "SPIN NOW"}
      </button>
    </div>
  );
}
