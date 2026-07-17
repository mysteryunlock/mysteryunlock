/**
 * /s/$slug/scratch — Scratch Card interaction route.
 *
 * Mirrors /s/$slug/spin structurally:
 *   1. Validates the same search params (code, c, name, contact, email, portal)
 *   2. User taps "REVEAL NOW" → spinAndRecord fires server-side
 *   3. Server picks the winner using the identical probability engine
 *   4. ScratchCard component reveals the pre-determined prize cosmetically
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
import { parseServerValidationError } from "@/lib/utils";
import { codeChars, slugSchema } from "@/lib/validation";

// ─── Route ────────────────────────────────────────────────────────────────────

const search = z.object({
  code:    codeChars,
  c:       slugSchema.optional(),
  name:    z.string().min(1).max(40).optional(),
  contact: z.string().min(1).max(30).optional(),
  email:   z.string().min(1).max(255).optional(),
  // portal="1" signals an authenticated customer — forwarded to result page
  portal:  z.string().optional(),
});

export const Route = createFileRoute("/s/$slug/scratch")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Scratch — ${params.slug}` }] }),
  component: ScratchPage,
});

// ─── Phase ────────────────────────────────────────────────────────────────────

type Phase = "ready" | "resolving" | "scratching" | "done";

// ─── Page ─────────────────────────────────────────────────────────────────────

function ScratchPage() {
  const { slug } = Route.useParams();
  const { code, c: campaignSlug, name, contact, email, portal } = Route.useSearch();
  const navigate = useNavigate();

  const { prizes, isLoading, campaignNotFound } = usePrizesBySlug(slug, campaignSlug);

  // Fetch campaigns to keep the shared cache warm (same pattern as spin route)
  const fetchCampaigns = useServerFn(listPublicCampaigns);
  useQuery({
    queryKey: ["public-campaigns", slug],
    queryFn:  async () => (await fetchCampaigns({ data: { slug } })).campaigns,
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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

        // Match returned prize id to the loaded prize list for full prize data
        const matched = prizes.find((p) => p.id === res.prize.id) ?? prizes[0];
        setPrize(matched);
        setPhase("scratching");
      } catch (err) {
        setPhase("ready");
        setError(parseServerValidationError(err) ?? "Could not process your code. Please try again.");
      }
    })();
  };

  // ── After scratch completes: navigate to result page ─────────────────────

  const handleComplete = (p: Prize) => {
    setPhase("done");
    setTimeout(() => {
      navigate({
        to:     "/s/$slug/result",
        params: { slug },
        search: {
          code,
          pid: p.id,
          ...(campaignSlug ? { c:       campaignSlug } : {}),
          ...(contact      ? { contact: contact      } : {}),
          ...(name         ? { name:    name         } : {}),
          ...(portal       ? { portal:  portal       } : {}),
        },
      });
    }, 600);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">

      {/* Header */}
      <div className="w-full flex items-center justify-between mb-2">
        <button
          onClick={() => {
            playClick();
            navigate({
              to:     "/s/$slug",
              params: { slug },
              search: campaignSlug ? { c: campaignSlug } : {},
            });
          }}
          className="text-sm text-muted-foreground"
        >
          ← Back
        </button>
        <p className="text-xs uppercase tracking-widest text-gold">Mystery Unlock Scratch</p>
        <span className="w-10" />
      </div>

      {/* Code / name subtitle */}
      <p className="text-center text-muted-foreground text-sm mb-6">
        {name ? <><span className="text-foreground font-semibold">{name}</span> · </> : null}
        Code <span className="text-foreground font-mono font-semibold tracking-widest">{code}</span>
      </p>

      {/* Main content */}
      <div className="w-full max-w-[360px]">
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
          <div className="aspect-square flex items-center justify-center text-muted-foreground">
            Loading card…
          </div>

        ) : (phase === "scratching" || phase === "done") && prize ? (
          <ScratchCard
            prize={prize}
            onComplete={handleComplete}
            disabled={phase === "done"}
          />

        ) : (
          /* Placeholder shown before the user taps REVEAL NOW */
          <div className="aspect-square flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#1a1f2e] gap-3">
            <span className="text-7xl">🎟</span>
            <p className="text-base font-bold text-foreground">Your scratch card is ready</p>
            <p className="text-sm text-muted-foreground px-8 text-center">
              Tap the button below to reveal your prize
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-4 text-destructive text-sm text-center">{error}</p>
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
          className="mt-10 w-full max-w-sm gradient-primary text-[#0F1115] font-black text-xl tracking-widest py-5 rounded-2xl glow-orange active:scale-[0.98] transition disabled:opacity-60"
        >
          {phase === "resolving" ? "LOADING…" : "REVEAL NOW"}
        </button>
      )}

      {/* Scratch hint once card is active */}
      {phase === "scratching" && (
        <p className="mt-6 text-sm text-muted-foreground text-center">
          Scratch the card above to reveal your prize
        </p>
      )}

    </div>
  );
}
