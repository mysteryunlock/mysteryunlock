import { useState, useMemo, useCallback, memo } from "react";
import { ChevronDown, MessageCircle, Mail, Search, Zap, CreditCard, Sparkles, ShieldCheck, LayoutGrid } from "lucide-react";

import { SectionContainer } from "@/components/foundation/layout/SectionContainer";
import { FoundationCard } from "@/components/foundation/cards/Card";
import { FoundationBadge } from "@/components/foundation/feedback/Badge";
import { OutlineButton } from "@/components/foundation/buttons/OutlineButton";

import {
  FAQ_ITEMS,
  FAQ_CATEGORIES,
  type FaqCategory,
  type FaqItem,
} from "@/data/faq";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  dark: "#2A3E4B",
  mid: "#7FA6B8",
  light: "#D6E6EF",
  bg: "#F7FBFD",
  accent: "#FF6B1A",
};

// ─── Category icon map ────────────────────────────────────────────────────────
type CategoryIcon = React.FC<{ className?: string; strokeWidth?: number | string }>;
const CATEGORY_ICONS: Record<FaqCategory, CategoryIcon> = {
  Setup: Zap,
  Pricing: CreditCard,
  Features: Sparkles,
  Security: ShieldCheck,
  Support: MessageCircle,
};

// ─── Single accordion item ────────────────────────────────────────────────────
const AccordionItem = memo(function AccordionItem({
  item,
  isOpen,
  onToggle,
  index,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isOpen ? "shadow-md" : "hover:shadow-sm"
      }`}
      style={{
        borderColor: isOpen ? `${B.dark}20` : `${B.light}`,
        background: isOpen ? "white" : `${B.bg}`,
      }}
    >
      <button
        type="button"
        id={`faq-btn-${item.id}`}
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${item.id}`}
        onClick={onToggle}
        className="w-full flex items-start gap-4 px-5 py-4 text-left group"
      >
        {/* Number badge */}
        <span
          className="w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 transition-colors"
          aria-hidden
          style={{
            background: isOpen ? B.dark : `${B.light}`,
            color: isOpen ? "white" : B.mid,
          }}
        >
          {index + 1}
        </span>

        {/* Question text */}
        <span
          className="flex-1 text-sm font-semibold leading-snug transition-colors"
          style={{ color: isOpen ? B.dark : `${B.dark}cc` }}
        >
          {item.question}
        </span>

        {/* Chevron */}
        <ChevronDown
          className="size-4 shrink-0 mt-0.5 transition-transform duration-300"
          style={{
            color: isOpen ? B.accent : B.mid,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden
        />
      </button>

      {/* Answer panel — hidden from AT when collapsed */}
      <div
        id={`faq-panel-${item.id}`}
        role="region"
        aria-labelledby={`faq-btn-${item.id}`}
        aria-hidden={!isOpen}
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 280ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }} tabIndex={-1}>
          <p
            className="px-5 pb-5 pl-10 sm:pl-[3.75rem] text-sm leading-relaxed"
            style={{ color: `${B.dark}b3` }}
          >
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
});

// ─── CMS settings shape (mirrors the `faqs` key in site_settings) ─────────────
export interface FaqCmsSettings {
  items?: { q: string; a: string; category?: string }[];
}

// ─── Main export ──────────────────────────────────────────────────────────────
export const FAQ = memo(function FAQ({ settings }: { settings?: FaqCmsSettings }) {
  const resolvedItems = useMemo<FaqItem[]>(() => {
    if (settings?.items?.length) {
      return settings.items.map((item, i) => ({
        id: `cms-${i}`,
        category: ((item.category ?? "Setup") as FaqCategory),
        question: item.q,
        answer: item.a,
      }));
    }
    return FAQ_ITEMS;
  }, [settings]);

  const resolvedCategories = useMemo<FaqCategory[]>(() => {
    if (settings?.items?.length) {
      const seen = new Set<string>();
      const cats: FaqCategory[] = [];
      resolvedItems.forEach((item) => {
        if (!seen.has(item.category)) {
          seen.add(item.category);
          cats.push(item.category as FaqCategory);
        }
      });
      return cats;
    }
    return FAQ_CATEGORIES;
  }, [settings, resolvedItems]);

  const [activeCategory, setActiveCategory] = useState<FaqCategory | "All">("All");
  const [openId, setOpenId] = useState<string | null>("setup-1");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      resolvedItems.filter((item) => {
        const matchesCategory =
          activeCategory === "All" || item.category === activeCategory;
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
      }),
    [resolvedItems, activeCategory, search],
  );

  const handleToggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <SectionContainer
      as="section"
      id="faq"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="faq-heading"
    >
      {/* ── Section header ─────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto text-center mb-14">
        <FoundationBadge
          variant="subtle"
          className="mb-4 uppercase tracking-widest text-[11px]"
        >
          FAQ
        </FoundationBadge>
        <h2
          id="faq-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight mb-4"
          style={{ color: B.dark }}
        >
          Questions, answered.
        </h2>
        <p className="text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          Everything you need to know about Mystery Unlock. Can't find the
          answer?{" "}
          <a
            href="#contact"
            className="font-semibold underline underline-offset-4 transition-colors hover:opacity-80"
            style={{ color: B.dark }}
          >
            Talk to us.
          </a>
        </p>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">

        {/* Left: sticky category sidebar ─────────────────────────────── */}
        <div className="lg:sticky lg:top-8 flex flex-col gap-4">
          <FoundationCard elevation="sm" padding="md" className="flex flex-col gap-2">
            <p
              id="faq-category-label"
              className="text-[10px] font-black uppercase tracking-[0.2em] mb-1"
              style={{ color: B.mid }}
            >
              Browse by topic
            </p>

            {/* Radio group for category filter */}
            <div
              role="radiogroup"
              aria-labelledby="faq-category-label"
              className="flex flex-col gap-1"
            >
              {/* All */}
              <button
                type="button"
                role="radio"
                aria-checked={activeCategory === "All"}
                onClick={() => { setActiveCategory("All"); setOpenId(null); }}
                className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-left transition-all"
                style={
                  activeCategory === "All"
                    ? { background: B.dark, color: "white" }
                    : { color: `${B.dark}99`, background: "transparent" }
                }
              >
                <LayoutGrid aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
                All topics
                <span
                  className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={
                    activeCategory === "All"
                      ? { background: "rgba(255,255,255,0.15)", color: "white" }
                      : { background: B.light, color: B.mid }
                  }
                >
                  {resolvedItems.length}
                </span>
              </button>

              {/* Categories */}
              {resolvedCategories.map((cat) => {
                const count = resolvedItems.filter((f) => f.category === cat).length;
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => { setActiveCategory(cat); setOpenId(null); }}
                    className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-left transition-all"
                    style={
                      isActive
                        ? { background: B.dark, color: "white" }
                        : { color: `${B.dark}99`, background: "transparent" }
                    }
                  >
                    {(() => { const Icon = CATEGORY_ICONS[cat]; return <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />; })()}
                    {cat}
                    <span
                      className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={
                        isActive
                          ? { background: "rgba(255,255,255,0.15)", color: "white" }
                          : { background: B.light, color: B.mid }
                      }
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </FoundationCard>

          {/* Contact card ─────────────────────────────────────────────── */}
          <FoundationCard
            elevation="sm"
            padding="md"
            className="flex flex-col gap-3"
            style={{ background: `linear-gradient(135deg, ${B.dark}, #1a2e38)` }}
          >
            <div
              className="w-9 h-9 rounded-xl grid place-items-center"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <MessageCircle className="size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-snug">
                Still have questions?
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                Our team replies within 24 hours.
              </p>
            </div>
            <a
              href="mailto:hello@mysteryunlock.com"
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-3 rounded-lg transition-all hover:opacity-90 min-h-[44px]"
              style={{ background: B.accent, color: "white" }}
            >
              <Mail className="size-3" />
              Email us
            </a>
          </FoundationCard>
        </div>

        {/* Right: search + accordion list ─────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Search bar */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border"
            style={{ borderColor: B.light, background: "white" }}
          >
            <Search className="size-4 shrink-0" style={{ color: B.mid }} />
            <input
              type="search"
              placeholder="Search questions…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOpenId(null); }}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#9ab5c4]"
              style={{ color: B.dark }}
              aria-label="Search FAQ"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: B.light, color: B.mid }}
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          {/* Results count */}
          {(search || activeCategory !== "All") && (
            <p className="text-xs" style={{ color: B.mid }}>
              {filtered.length === 0
                ? "No questions match your search."
                : `${filtered.length} question${filtered.length !== 1 ? "s" : ""} found`}
            </p>
          )}

          {/* Accordion list */}
          {filtered.length > 0 ? (
            <div
              className="flex flex-col gap-2"
              role="list"
              aria-label="FAQ answers"
            >
              {filtered.map((item, i) => (
                <div key={item.id} role="listitem">
                  <AccordionItem
                    item={item}
                    isOpen={openId === item.id}
                    onToggle={() => handleToggle(item.id)}
                    index={i}
                  />
                </div>
              ))}
            </div>
          ) : (
            <FoundationCard elevation="flat" padding="lg" className="text-center">
              <div className="flex justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, color: B.dark }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: B.dark }}>
                No results found
              </p>
              <p className="text-xs mt-1" style={{ color: `${B.dark}80` }}>
                Try a different search term or browse all topics.
              </p>
              <button
                type="button"
                onClick={() => { setSearch(""); setActiveCategory("All"); }}
                className="mt-3 text-xs font-bold underline underline-offset-4"
                style={{ color: B.accent }}
              >
                Clear filters
              </button>
            </FoundationCard>
          )}
        </div>
      </div>

      {/* ── Bottom CTA strip ───────────────────────────────────────────── */}
      <div
        className="mt-14 rounded-2xl border px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-5"
        style={{ borderColor: B.light, background: "white" }}
      >
        <div>
          <p className="font-display font-bold text-base" style={{ color: B.dark }}>
            Can't find what you're looking for?
          </p>
          <p className="text-sm mt-0.5" style={{ color: `${B.dark}99` }}>
            Our team is happy to walk you through anything before you sign up.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto sm:shrink-0">
          <OutlineButton
            asChild
            size="default"
            className="font-semibold justify-center"
            style={{ borderColor: `${B.dark}25`, color: B.dark }}
          >
            <a href="mailto:hello@mysteryunlock.com" className="flex items-center gap-2">
              <Mail className="size-4" /> Email us
            </a>
          </OutlineButton>
          <OutlineButton
            asChild
            size="default"
            className="font-semibold justify-center"
            style={{ borderColor: `${B.dark}25`, color: B.dark }}
          >
            <a href="#contact" className="flex items-center gap-2">
              <MessageCircle className="size-4" /> Live chat
            </a>
          </OutlineButton>
        </div>
      </div>
    </SectionContainer>
  );
});
