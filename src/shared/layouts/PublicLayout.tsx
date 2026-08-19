import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { sitePagesService } from "@/services/supabase/sitePagesService";
import faatproLogo from "@/assets/faatpro-logo.png.asset.json";
import { useCart } from "@/modules/commerce/useCart";

const nav = [
  { to: "/courses", label: "Courses" },
  { to: "/instructors", label: "Instructors" },
  { to: "/live-classes", label: "Live Classes" },
  { to: "/certificate/verify", label: "Certificates" },
  { to: "/contact", label: "Contact Us" },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { count: cartCount } = useCart();
  const { data: legalLinks = [] } = useQuery({
    queryKey: ["site-pages-footer"],
    queryFn: () => sitePagesService.listPublishedFooter(),
    staleTime: 5 * 60 * 1000,
  });
  const FOOTER_ORDER = [
    "privacy-policy",
    "terms-and-conditions",
    "return-refund-policy",
    "code-of-conduct",
  ];
  const orderedLegal = FOOTER_ORDER
    .map((s) => legalLinks.find((l) => l.slug === s))
    .filter(Boolean) as { slug: string; title: string }[];
  const next = location.pathname + location.search + location.hash;
  const authSearch = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img src={faatproLogo.url} alt="FAATPRO" className="h-9 w-auto object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) =>
                `px-3 py-2 text-sm rounded-md transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
              }>{n.label}</NavLink>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/cart" className="relative inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-muted" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">{cartCount}</span>
              )}
            </Link>
            {user ? (
              <Button asChild><Link to="/app">Open dashboard</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost"><Link to={`/login${authSearch}`}>Login</Link></Button>
                <Button asChild><Link to={`/register${authSearch}`}>Get started</Link></Button>
              </>
            )}
          </div>
          <div className="md:hidden flex items-center gap-1">
            <Link to="/cart" className="relative inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-muted" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">{cartCount}</span>
              )}
            </Link>
            <button className="p-2" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-3 flex flex-col gap-1">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded-md hover:bg-muted">
                  {n.label}
                </NavLink>
              ))}
              {user ? (
                <Button asChild className="mt-2"><Link to="/app">Open dashboard</Link></Button>
              ) : (
                <div className="flex gap-2 mt-2">
                  <Button asChild variant="outline" className="flex-1"><Link to={`/login${authSearch}`}>Login</Link></Button>
                  <Button asChild className="flex-1"><Link to={`/register${authSearch}`}>Get started</Link></Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="border-t border-border bg-gradient-brand text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 font-semibold text-white">
              <span className="inline-flex items-center bg-white rounded-lg px-2 py-1.5">
                <img src={faatproLogo.url} alt="FAATPRO" className="h-7 w-auto object-contain" />
              </span>
            </Link>
            <p className="text-sm text-white/80 mt-3 max-w-xs">
              Structured, mentor-led learning with live classes, assignments, quizzes, and certificates.
            </p>
            <li className="flex items-center gap-4 pt-4">

  {/* Linkedin */}
  <a
    href="https://www.linkedin.com/company/faatpro/"
    target="_blank"
    rel="noopener noreferrer"
    className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 448 512"
      className="h-5 w-5 fill-blue-600"
    >
      <path d="M100.28 448H7.4V148.9h92.88zm-46.44-340a53.79 53.79 0 1 1 53.79-53.8 53.79 53.79 0 0 1-53.79 53.8zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.3 0-55.7 37.7-55.7 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.7-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" />
    </svg>
  </a>

  {/* Facebook */}
  <a
    href="https://www.facebook.com/admin.faatpro"
    target="_blank"
    rel="noopener noreferrer"
    className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 512"
      className="h-5 w-5 fill-blue-600"
    >
      <path d="M279.14 288l14.22-92.66h-88.91V127.69c0-25.35 12.42-50.06 52.24-50.06H296V6.26S259.43 0 224.36 0c-73.22 0-121.08 44.38-121.08 124.72V195.3H22.89V288h80.39v224h100.17V288z" />
    </svg>
  </a>

  {/* Instagram */}
  <a
    href="https://www.instagram.com/faatpro/"
    target="_blank"
    rel="noopener noreferrer"
    className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 448 512"
      className="h-5 w-5 fill-blue-600"
    >
      <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9S160.5 370.8 224.1 370.8 339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.2 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.5 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.9-26.9 26.9-14.9 0-26.9-12-26.9-26.9 0-14.9 12-26.9 26.9-26.9 14.9 0 26.9 12 26.9 26.9zM398.8 80c-17.8-17.8-41.3-27.8-66.5-27.8H115.7C63.5 52.2 21 94.7 21 146.9v216.5c0 52.2 42.5 94.7 94.7 94.7h216.5c25.2 0 48.7-10 66.5-27.8 17.8-17.8 27.8-41.3 27.8-66.5V146.9c0-25.2-10-48.7-27.8-66.9z" />
    </svg>
  </a>

  {/* Twitter/X */}
  <a
    href="https://x.com/faatpro1"
    target="_blank"
    rel="noopener noreferrer"
    className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className="h-5 w-5 fill-blue-600"
    >
      <path d="M389.2 48h70.6L305.6 224.2 488 464H345.6L233.7 318.6 106.5 464H35.8l164.9-188.5L24 48h145.6l101.2 132.1zm-24.8 373.8h39.1L148.2 88h-42z" />
    </svg>
  </a>

  {/* YouTube */}
  <a
    href="https://www.youtube.com/@faatproeducation"
    target="_blank"
    rel="noopener noreferrer"
    className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 576 512"
      className="h-5 w-5 fill-blue-600"
    >
      <path d="M549.7 124.1c-6.3-23.7-24.8-42.2-48.3-48.6C457.8 64 288 64 288 64s-169.8 0-213.4 11.5c-23.5 6.3-42 24.8-48.3 48.6C16 168.2 16 256 16 256s0 87.8 11.5 131.9c6.3 23.7 24.8 42.2 48.3 48.6C118.2 448 288 448 288 448s169.8 0 213.4-11.5c23.5-6.3 42-24.8 48.3-48.6C560 343.8 560 256 560 256s0-87.8-11.5-131.9zM232 335V177l142 79-142 79z" />
    </svg>
  </a>

</li>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3 text-white">Learn</div>
            <ul className="space-y-2 text-sm text-white/80">
              <li><Link to="/courses" className="hover:text-white">All courses</Link></li>
              <li><Link to="/instructors" className="hover:text-white">Instructors</Link></li>
              <li><Link to="/live-classes" className="hover:text-white">Live classes</Link></li>
              <li><Link to="/certificate/verify" className="hover:text-white">Certificates</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3 text-white">Support</div>
            <ul className="space-y-2 text-sm text-white/80">
              <li><Link to="/contact" className="hover:text-white">Contact Us</Link></li>
              <li><Link to="/about" className="hover:text-white">About Faatpro</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3 text-white">Policies</div>
            <ul className="space-y-2 text-sm text-white/80">
              {orderedLegal.map((l) => (
                <li key={l.slug}>
                  <Link to={`/${l.slug}`} className="hover:text-white">{l.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-white/80 flex justify-between">
            <div>© {new Date().getFullYear()} FAATPRO</div>
            <div>
              Designed with{" "}
              <span className="text-pink-300 inline-block ">
                ♥
              </span>{" "}

              by{" "}

              <a
                href="https://walkdigitally.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white hover:text-pink-200 transition-colors"
              >
                Walk Digitally
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}