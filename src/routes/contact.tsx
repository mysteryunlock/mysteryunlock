import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Mystery Unlock" },
      {
        name: "description",
        content:
          "Get in touch with the Mystery Unlock team. We respond within 24 hours.",
      },
    ],
  }),
  component: ContactPage,
});

const C = {
  bg: "#F7FBFD",
  light: "#D6E6EF",
  primary: "#7FA6B8",
  primaryDark: "#5e8a9e",
  dark: "#2A3E4B",
};

function ContactPage() {
  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: C.bg, fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm mb-8 hover:opacity-70 transition-opacity"
            style={{ color: `${C.dark}99` }}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current" aria-hidden>
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </Link>

          <div className="mb-10">
            <div
              className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
              style={{ background: C.light, color: C.primaryDark }}
            >
              Get in touch
            </div>
            <h1
              className="text-4xl font-black tracking-tight mb-3"
              style={{ color: C.dark, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Contact Us
            </h1>
            <p className="text-base" style={{ color: `${C.dark}99` }}>
              Have a question, feedback, or need help getting started? We're here for you.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <a
              href="mailto:support@mysteryunlock.com"
              className="group flex items-start gap-4 rounded-2xl p-5 transition-all hover:shadow-md"
              style={{ background: "white", border: `1px solid ${C.dark}10` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: C.light }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke={C.primaryDark} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: `${C.dark}80` }}>Email</div>
                <div className="text-sm font-semibold group-hover:underline" style={{ color: C.dark }}>
                  support@mysteryunlock.com
                </div>
                <div className="text-xs mt-1" style={{ color: `${C.dark}80` }}>Best for account & billing queries</div>
              </div>
            </a>

            <a
              href="https://mysteryunlock.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-4 rounded-2xl p-5 transition-all hover:shadow-md"
              style={{ background: "white", border: `1px solid ${C.dark}10` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: C.light }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke={C.primaryDark} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: `${C.dark}80` }}>Website</div>
                <div className="text-sm font-semibold group-hover:underline" style={{ color: C.dark }}>
                  mysteryunlock.com
                </div>
                <div className="text-xs mt-1" style={{ color: `${C.dark}80` }}>Visit our main website</div>
              </div>
            </a>
          </div>

          <div
            className="rounded-2xl p-6 flex items-start gap-4"
            style={{ background: C.light }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "white" }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke={C.primaryDark} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold mb-1" style={{ color: C.dark }}>Response time</div>
              <p className="text-sm" style={{ color: `${C.dark}cc` }}>
                We typically respond to all emails <strong>within 24 hours</strong> on business days.
                For urgent issues, include "URGENT" in your subject line.
              </p>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-bold mb-4" style={{ color: C.dark, fontFamily: "'Space Grotesk', sans-serif" }}>
              Frequently asked questions
            </h2>
            <div className="space-y-3">
              {[
                {
                  q: "How do I get started?",
                  a: "Sign up for a free account, create your prize wheel, and share the QR code with your customers — takes under 5 minutes.",
                },
                {
                  q: "Can I change my subscription plan?",
                  a: "Yes, you can upgrade or downgrade your plan at any time from your billing dashboard.",
                },
                {
                  q: "How do I report a security issue?",
                  a: "Email us at support@mysteryunlock.com with the subject line 'Security' and we'll prioritize your report.",
                },
              ].map(({ q, a }) => (
                <div
                  key={q}
                  className="rounded-xl p-4"
                  style={{ background: "white", border: `1px solid ${C.dark}10` }}
                >
                  <div className="text-sm font-semibold mb-1" style={{ color: C.dark }}>{q}</div>
                  <div className="text-sm" style={{ color: `${C.dark}99` }}>{a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
