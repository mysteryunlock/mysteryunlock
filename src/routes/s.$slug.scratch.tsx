/**
 * /s/$slug/scratch — Scratch Card interaction route.
 *
 * Flow:
 *   1. Validates search params (code, c, name, contact, email, portal)
 *   2. User taps "REVEAL NOW" → spinAndRecord fires server-side
 *   3. Server picks the winner via the unchanged probability engine
 *   4. ScratchCard reveals the pre-determined prize cosmetically
 *   5. Navigates to /s/$slug/result (identical result/claim page)
 *
 * The scratch animation is purely cosmetic. The prize is already selected
 * before the first foil pixel is scratched.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ScratchCard } from "@/components/ScratchCard";
import type { Prize } from "@/lib/spin-store";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { spinAndRecord } from "@/lib/access-codes.functions";
import { listPublicCampaigns } from "@/lib/campaigns.functions";
import { playClick } from "@/lib/sounds";
import { trackGameStarted, trackGameCompleted } from "@/lib/analytics";
import { parseServerValidationError } from "@/lib/utils";
import { codeChars, slugSchema } from "@/lib/validation";

// ─── Route ────────────────────────────────────────────────────────────────────

const search = z.object({
  code:    codeChars,
  c:       slugSchema.optional(),
  name:    z.string().min(1).max(40).optional(),
  contact: z.string().min(1).max(30).optional(),
  email:   z.string().min(1).max(255).optional(),
  portal:  z.string().optional(),
});

export const Route = createFileRoute("/s/$slug/scratch")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Scratch — ${params.slug}` }] }),
  component: ScratchPage,
});

// ─── Phase ────────────────────────────────────────────────────────────────────

type Phase = "ready" | "resolving" | "scratching" | "done";

// ─── Premium loading skeleton ──────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="w-full aspect-square rounded-2xl overflow-hidden relative"
      style={{ background: "linear-gradient(135deg, #1a2744 0%, #0f1a2e 100%)" }}
    >
      {/* Shimmer sweep */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-y-0 w-1/2 animate-skeleton-shimmer"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
          }}
        />
      </div>

      {/* Content skeleton */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div className="text-5xl" style={{ filter: "grayscale(0.4) opacity(0.7)" }}>🎟</div>
        <div className="flex flex-col items-center gap-2 mt-1">
          <div className="h-3 w-36 rounded-full bg-white/10" />
          <div className="h-2.5 w-24 rounded-full bg-white/7" />
        </div>
        <p className="text-white/35 text-xs tracking-wide mt-1">Getting your card ready…</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ScratchPage() {
  const { slug } = Route.useParams();
  const { code, c: campaignSlug, name, contact, email, portal } = Route.useSearch();
  const navigate = useNavigate();

  const { prizes, isLoading, campaignNotFound } = usePrizesBySlug(slug, campaignSlug);

  // Keep campaign cache warm (same pattern as spin route)
  const fetchCampaigns = useServerFn(listPublicCampaigns);
  useQuery({
    queryKey: ["public-campaigns", slug],
    queryFn:  async () => (await fetchCampaigns({ data: { slug } })).campaigns,
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
    refetchOnMount:        false,
    refetchOnWindowFocus:  false,
  });

  const doSpin = useServerFn(spinAndRecord);

  const [phase, setPhase] = useState<Phase>("ready");
  const [prize, setPrize] = useState<Prize | null>(null);
  const [error, setError] = useState("");

  // ── Initiate: call spinAndRecord, then show scratch card ─────────────────

  const handleReveal = () => {
    if (phase !== "ready" || prizes.length === 0) return;
    playClick();
    setError("");
    setPhase("resolving");
    trackGameStarted("scratch", slug, code);

    (async () => {
      try {
        const res = await doSpin({
          data: {
            slug,
            code,
            ...(campaignSlug ? { campaignSlug } : {}),
            name:    name?.trim()    || undefined,
            contact: contact?.trim() || undefined,
            email:   email?.trim()   || undefined,
          },
        });

        if (!res.ok) {
          setPhase("ready");
          setError("This code is invalid or has already been used.");
          return;
        }

        const matched = prizes.find((p) => p.id === res.prize.id);
        if (!matched) {
          setPhase("ready");
          setError("Could not load prize data. Please refresh and try again.");
          return;
        }

        setPrize(matched);
        setPhase("scratching");
      } catch (err) {
        setPhase("ready");
        setError(parseServerValidationError(err) ?? "Could not process your code. Please try again.");
      }
    })();
  };

  // ── After scratch completes: track analytics then navigate ────────────────

  const handleComplete = (p: Prize) => {
    trackGameCompleted("scratch", slug, code, p.isWin);
    setPhase("done");
    setTimeout(() => {
      navigate({
        to:     "/s/$slug/result",
        params: { slug },
        search: {
          code,
          pid: p.id,
          ...(campaignSlug ? { c:       campaignSlug } : {}),
          ...(contact      ? { contact               } : {}),
          ...(name         ? { name                  } : {}),
          ...(portal       ? { portal                } : {}),
        },
      });
    }, 600);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col items-center px-4 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ minHeight: "100dvh" }}
    >
      {/* Header row */}
      <div className="w-full flex items-center justify-between mb-2">
        <button
          onClick={() => {
            playClick();
            navigate({ to: "/s/$slug", params: { slug }, search: campaignSlug ? { c: campaignSlug } : {} });
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground px-2 py-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/5 active:scale-95 transition-all duration-150"
          aria-label="Back"
        >
          ← Back
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/20">
          <span className="text-base leading-none">🎟</span>
          <span className="text-xs font-bold text-purple-300 tracking-wide uppercase">Scratch Card</span>
        </div>

        <span className="w-[68px]" />
      </div>

      {/* Code / name subtitle */}
      <p className="text-center text-muted-foreground text-sm mb-4">
        {name ? <><span className="text-foreground font-semibold">{name}</span> · </> : null}
        Code <span className="text-foreground font-mono font-semibold tracking-widest">{code}</span>
      </p>

      {/* Main card area */}
      <div className="w-[min(90vw,420px)]">
        {campaignNotFound ? (
          <div className="aspect-square flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-2xl">🔍</p>
            <p className="font-bold text-foreground">Campaign not found</p>
            <p className="text-sm text-muted-foreground">
              The campaign link you used is no longer active or doesn't exist.{" "}
              <button
                onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
                className="underline text-foreground"
              >
                Try the main shop page
              </button>
            </p>
          </div>

        ) : isLoading || prizes.length === 0 ? (
          <CardSkeleton />

        ) : (phase === "scratching" || phase === "done") && prize ? (
          <ScratchCard
            prize={prize}
            onComplete={handleComplete}
            disabled={phase === "done"}
          />

        ) : phase === "resolving" ? (
          /* Resolving: foil-styled placeholder with spinner */
          <div
            className="w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-4"
            style={{
              background: "linear-gradient(135deg,#8A9BB0 0%,#C8D4E0 18%,#5A6D84 32%,#DCE8F4 46%,#8A9BB0 60%,#F0F5FA 73%,#8A9BB0 100%)",
            }}
          >
            <div className="w-11 h-11 rounded-full border-[3px] border-white/40 border-t-white animate-spin" />
            <p className="text-white/85 font-semibold text-sm tracking-wide">Preparing your card…</p>
          </div>

        ) : (
          /* Ready state: static foil preview */
          <div
            className="w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-4 shadow-lg overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg,#8A9BB0 0%,#C8D4E0 18%,#5A6D84 32%,#DCE8F4 46%,#8A9BB0 60%,#F0F5FA 73%,#8A9BB0 100%)",
            }}
          >
            {/* Shimmer on ready state foil preview */}
            <div
              className="absolute inset-0 pointer-events-none animate-foil-shimmer"
              style={{ borderRadius: "inherit" }}
            />
            <span className="text-6xl drop-shadow relative z-10">🎟</span>
            <div className="text-center relative z-10">
              <p className="text-base font-bold text-white drop-shadow">Your scratch card is ready</p>
              <p className="text-sm text-white/70 mt-1 px-8">
                Tap the button below to reveal your prize
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-4 text-destructive text-sm text-center max-w-sm">{error}</p>
      )}

      {/* CTA button — visible only before scratching begins */}
      {(phase === "ready" || phase === "resolving") && (
        <button
          onClick={handleReveal}
          disabled={
            phase === "resolving" ||
            isLoading              ||
            prizes.length === 0   ||
            campaignNotFound
          }
          className="mt-8 w-full max-w-sm gradient-primary text-[#0F1115] font-black text-xl tracking-widest py-5 rounded-2xl transition-all duration-150 hover:brightness-110 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.96] disabled:opacity-60 disabled:pointer-events-none"
        >
          {phase === "resolving" ? "LOADING…" : "REVEAL NOW"}
        </button>
      )}

      {/* Scratch hint once card is active */}
      {phase === "scratching" && (
        <p className="mt-5 text-sm text-muted-foreground text-center animate-pulse">
          Scratch the card above to reveal your prize ☝
        </p>
      )}
    </div>
  );
}
