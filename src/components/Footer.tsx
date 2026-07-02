import { Link } from "@tanstack/react-router";

const C = {
  bg: "#F7FBFD",
  light: "#D6E6EF",
  primary: "#7FA6B8",
  dark: "#2A3E4B",
};

export function Footer() {
  return (
    <footer
      className="w-full border-t mt-auto"
      style={{ borderColor: `${C.dark}18`, background: C.bg }}
    >
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="flex flex-col gap-2">
            <div
              className="text-base font-bold tracking-tight"
              style={{ color: C.dark }}
            >
              Mystery Unlock
            </div>
            <p className="text-xs max-w-xs" style={{ color: `${C.dark}99` }}>
              Premium spin-to-win campaigns for modern retail shops.
            </p>
            <a
              href="mailto:support@mysteryunlock.com"
              className="text-xs font-medium mt-1 hover:underline"
              style={{ color: C.primary }}
            >
              support@mysteryunlock.com
            </a>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-6">
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: C.dark }}
              >
                Product
              </div>
              <ul className="space-y-2 text-sm" style={{ color: `${C.dark}b3` }}>
                <li>
                  <a href="/#features" className="hover:underline">Features</a>
                </li>
                <li>
                  <a href="/#pricing" className="hover:underline">Pricing</a>
                </li>
                <li>
                  <a href="/#faq" className="hover:underline">FAQ</a>
                </li>
                <li>
                  <Link to="/auth" className="hover:underline">Sign in</Link>
                </li>
              </ul>
            </div>
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: C.dark }}
              >
                Company
              </div>
              <ul className="space-y-2 text-sm" style={{ color: `${C.dark}b3` }}>
                <li>
                  <Link to="/contact" className="hover:underline">Contact Us</Link>
                </li>
                <li>
                  <Link to="/trust" className="hover:underline">Trust & Security</Link>
                </li>
              </ul>
            </div>
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: C.dark }}
              >
                Legal
              </div>
              <ul className="space-y-2 text-sm" style={{ color: `${C.dark}b3` }}>
                <li>
                  <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:underline">Terms of Service</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div
          className="mt-8 pt-6 border-t flex flex-wrap items-center justify-between gap-3"
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
