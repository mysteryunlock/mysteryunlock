import { memo } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Play, RotateCcw } from "lucide-react";

import { HeroButton } from "@/components/foundation/buttons/HeroButton";
import { OutlineButton } from "@/components/foundation/buttons/OutlineButton";
import { FoundationBadge } from "@/components/foundation/feedback/Badge";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";

export interface HeroStat {
  value: string;
  label: string;
}

export interface HeroProps {
  badge: string;
  titleMain: string;
  titleHighlight: string;
  subtitle: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref?: string;
  stats: HeroStat[];
  /** The interactive demo (e.g. the spin wheel) rendered in the right column. */
  visual: ReactNode;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

/**
 * Landing Page 2.0 — Hero section.
 * Built entirely on the Mystery Unlock UI Foundation (HeroButton, OutlineButton,
 * FoundationBadge, SectionContainer) and the global theme tokens in styles.css.
 * Purely presentational: all interactive/business logic (the wheel demo,
 * reduced-motion state) is owned by the parent route and passed in as props.
 */
export const Hero = memo(function Hero({
  badge,
  titleMain,
  titleHighlight,
  subtitle,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  ctaSecondaryHref = "#wheel-demo",
  stats,
  visual,
  reducedMotion,
  onToggleReducedMotion,
}: HeroProps) {
  return (
    <SectionContainer maxWidth="xl" spacing="none" className="pt-10 lg:pt-16 pb-20 lg:pb-28">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        <div className={reducedMotion ? "" : "animate-fade-in"}>
          <FoundationBadge variant="subtle" className="gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" aria-hidden />
            {badge}
          </FoundationBadge>

          <h1 className="font-display mt-6 text-4xl md:text-5xl lg:text-[64px] font-bold leading-[1.04] tracking-tight text-foreground">
            {titleMain} <span className="text-primary">{titleHighlight}</span>
          </h1>

          <p className="mt-5 text-base md:text-lg max-w-lg leading-relaxed text-muted-foreground">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <HeroButton asChild size="default">
              <Link to="/auth">{ctaPrimaryLabel}</Link>
            </HeroButton>
            <OutlineButton asChild>
              <a href={ctaSecondaryHref} className="gap-2.5">
                <span className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground shrink-0">
                  <Play className="size-2.5 fill-current" strokeWidth={0} />
                </span>
                {ctaSecondaryLabel}
              </a>
            </OutlineButton>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-2xl font-bold text-foreground tabular-nums">
                  {s.value}
                </div>
                <div className="text-[11px] uppercase tracking-wider mt-1 text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-8 rounded-[2.5rem] -z-10 bg-gradient-to-br from-muted to-background"
          />
          {visual}
          <button
            type="button"
            onClick={onToggleReducedMotion}
            className="mx-auto mt-6 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-background border border-border text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
            aria-pressed={reducedMotion}
          >
            <RotateCcw className="size-4" aria-hidden />
            <span>{reducedMotion ? "Motion reduced" : "Reduce motion"}</span>
          </button>
        </div>
      </div>
    </SectionContainer>
  );
});
