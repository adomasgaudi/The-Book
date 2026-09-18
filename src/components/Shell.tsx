"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TITLE } from "@/lib/domain/config";
import { ToastHost } from "./Toast";

const NAV = [
  { href: "/", label: "Katalogas", icon: "📚" },
  { href: "/add/", label: "Pridėti", icon: "＋" },
  { href: "/moves/", label: "Judėjimai", icon: "🔁" },
  { href: "/reading/", label: "Skaitymas", icon: "📖" },
  { href: "/wishes/", label: "Noriu", icon: "⭐" },
  { href: "/shelves/", label: "Lentynos", icon: "🗄️" },
  { href: "/stats/", label: "Statistika", icon: "📊" },
  { href: "/tools/", label: "Įrankiai", icon: "🛠️" },
];
const MOBILE = ["/", "/add/", "/moves/", "/wishes/", "/tools/"];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/book");
  return path.startsWith(href.replace(/\/$/, ""));
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line px-3 py-5 md:flex">
        <Link href="/" className="serif px-2 text-lg leading-tight">{APP_TITLE}</Link>
        <nav className="mt-6 flex flex-col gap-0.5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={"flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[15px] " +
                (isActive(path, n.href) ? "bg-accent-soft font-medium" : "hover:bg-accent-soft/60")}>
              <span className="w-5 text-center">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-muted">Duomenys saugomi šiame įrenginyje. Atsarginė kopija — „Įrankiai“.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" className="serif text-base leading-tight">{APP_TITLE}</Link>
        </header>
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card/95 backdrop-blur md:hidden"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href}
              className={"flex flex-col items-center gap-0.5 py-2 text-[11px] " + (isActive(path, n.href) ? "text-accent font-semibold" : "text-muted")}>
              <span className="text-lg leading-none">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
      </div>
      <ToastHost />
    </div>
  );
}
