import { Link } from "@tanstack/react-router";
import { DEFAULT_LOGO } from "@/lib/spin-store";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#F7FBFD",
  light: "#D6E6EF",
  primary: "#7FA6B8",
  dark: "#2A3E4B",
};

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl bg-white overflow-hidden flex items-center justify-center ring-1 ring-[#2A3E4B]/10 shadow-sm"
      style={{ width: size, height: size }}
    >
      <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="w-full h-full object-contain" />
    </div>
  );
}

interface LandingFooterProps {
  whatsappNumber: string;
}

export function LandingFooter({ whatsappNumber }: LandingFooterProps) {
  return (
    <footer id="contact" className="border-t" style={{ borderColor: `${C.dark}14` }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-14">
        <div className="grid md:grid-cols-[2fr_1fr_1fr_1.5fr] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark size={36} />
              <span className="font-display font-bold text-lg" style={{ color: C.dark }}>Mystery Unlock</span>
            </div>
            <p className="mt-4 text-sm max-w-xs" style={{ color: `${C.dark}99` }}>
              Premium spin-to-win SaaS for boutique shops, salons, and cafes.
            </p>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.dark }}>Product</div>
            <ul className="space-y-2.5 text-sm" style={{ color: `${C.dark}b3` }}>
              <li><a href="#features" className="hover:underline">Features</a></li>
              <li><a href="#pricing" className="hover:underline">Pricing</a></li>
              <li><a href="#faq" className="hover:underline">FAQ</a></li>
              <li><Link to="/auth" className="hover:underline">Sign in</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.dark }}>Company</div>
            <ul className="space-y-2.5 text-sm" style={{ color: `${C.dark}b3` }}>
              <li><Link to="/contact" className="hover:underline">Contact Us</Link></li>
              <li><Link to="/trust" className="hover:underline">Trust &amp; security</Link></li>
              <li><Link to="/privacy" className="hover:underline">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:underline">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.dark }}>Get in touch</div>
            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: C.dark }}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: C.light }}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
                    <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zM17.472 14.382c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                </span>
                9769402069
              </a>
              <a
                href="mailto:support@mysteryunlock.com"
                className="inline-flex items-center gap-2.5 text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: C.dark }}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: C.light }}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
                    <path d="M12 12.713L.015 3h23.97L12 12.713zM12 14.713L0 5v15h24V5l-12 9.713z" />
                  </svg>
                </span>
                support@mysteryunlock.com
              </a>
            </div>
          </div>
        </div>

        <div
          className="mt-12 pt-6 border-t flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: `${C.dark}14` }}
        >
          <p className="text-xs" style={{ color: `${C.dark}80` }}>
            © {new Date().getFullYear()} Mystery Unlock. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs" style={{ color: `${C.dark}80` }}>
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
            <span>·</span>
            <Link to="/terms" className="hover:underline">Terms of Service</Link>
            <span>·</span>
            <Link to="/contact" className="hover:underline">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
