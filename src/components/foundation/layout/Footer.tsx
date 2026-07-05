import * as React from "react";
import { cn } from "@/lib/utils";

export interface FooterLinkItem {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLinkItem[];
}

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  logo?: React.ReactNode;
  description?: string;
  columns?: FooterColumn[];
  /** Text shown at the bottom-left, e.g. "© 2026 Mystery Unlock." */
  bottomText?: string;
  /** Extra links shown at the bottom-right (e.g. Privacy · Terms). */
  bottomLinks?: FooterLinkItem[];
}

/**
 * Reusable, prop-driven footer for marketing/legal pages. This is a new
 * foundation component and is independent of the existing
 * src/components/Footer.tsx (left untouched and still used by current pages).
 */
const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, logo, description, columns = [], bottomText, bottomLinks = [], ...props }, ref) => (
    <footer
      ref={ref}
      className={cn("w-full border-t border-border bg-muted/40 mt-auto", className)}
      {...props}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          {(logo || description) && (
            <div className="flex flex-col gap-3 max-w-xs">
              {logo}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          )}

          {columns.length > 0 && (
            <div className="flex flex-wrap gap-x-12 gap-y-8">
              {columns.map((column) => (
                <div key={column.title}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-3 text-foreground">
                    {column.title}
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <a href={link.href} className="hover:text-foreground hover:underline transition-colors">
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {(bottomText || bottomLinks.length > 0) && (
          <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3">
            {bottomText && <p className="text-xs text-muted-foreground">{bottomText}</p>}
            {bottomLinks.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {bottomLinks.map((link, i) => (
                  <React.Fragment key={link.href}>
                    {i > 0 && <span aria-hidden>·</span>}
                    <a href={link.href} className="hover:text-foreground hover:underline transition-colors">
                      {link.label}
                    </a>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  ),
);
Footer.displayName = "Footer";

export { Footer };
