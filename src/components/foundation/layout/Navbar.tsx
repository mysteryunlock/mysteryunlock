import * as React from "react";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavLinkItem {
  label: string;
  href: string;
}

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  logo: React.ReactNode;
  links?: NavLinkItem[];
  /** Rendered on the right side (desktop) — e.g. sign-in / CTA buttons. */
  actions?: React.ReactNode;
  /** Applies a translucent/glass background once the page is scrolled. */
  sticky?: boolean;
}

/**
 * Reusable top navigation bar shell. Presentational only — it does not know
 * about routing or auth state; pass real links/actions in from the page.
 * Includes a built-in responsive mobile menu.
 */
const Navbar = React.forwardRef<HTMLElement, NavbarProps>(
  ({ className, logo, links = [], actions, sticky = true, ...props }, ref) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
      if (!sticky) return;
      const onScroll = () => setScrolled(window.scrollY > 8);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }, [sticky]);

    return (
      <nav
        ref={ref}
        className={cn(
          "w-full z-50 transition-colors duration-200",
          sticky && "sticky top-0",
          sticky && scrolled ? "glass shadow-sm" : "bg-transparent",
          className,
        )}
        {...props}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">{logo}</div>

          {links.length > 0 && (
            <div className="hidden md:flex items-center gap-6">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}

          <div className="hidden md:flex items-center gap-3 shrink-0">{actions}</div>

          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center size-9 rounded-full hover:bg-muted transition-colors"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 sm:px-6 py-4 flex flex-col gap-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
            {actions && <div className="flex flex-col gap-2 pt-2">{actions}</div>}
          </div>
        )}
      </nav>
    );
  },
);
Navbar.displayName = "Navbar";

export { Navbar };
