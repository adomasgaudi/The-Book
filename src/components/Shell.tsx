"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TITLE } from "@/lib/domain/config";
import { ToastHost } from "./Toast";
import { useMoves, useRemoteStatus } from "@/lib/repo/hooks";
import { Icon, type IconName } from "./icons";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Katalogas", icon: "book" },
  { href: "/quick/", label: "Greitai", icon: "bolt" },
  { href: "/add/", label: "Pridėti", icon: "plus" },
  { href: "/moves/", label: "Judėjimai", icon: "repeat" },
  { href: "/reading/", label: "Skaitymas", icon: "bookOpen" },
  { href: "/wishes/", label: "Noriu", icon: "star" },
  { href: "/shelves/", label: "Lentynos", icon: "shelf" },
  { href: "/stats/", label: "Statistika", icon: "chart" },
  { href: "/tools/", label: "Įrankiai", icon: "wrench" },
];
const MOBILE = ["/", "/quick/", "/moves/", "/wishes/", "/tools/"];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/book");
  return path.startsWith(href.replace(/\/$/, ""));
}

/** Vėluojančių grąžinimų skaičius — atstoja originalo el. pašto priminimus (siustiPriminimus). */
function LateBadge() {
  const late = useMoves("late");
  if (!late?.length) return null;
  return <span className="ml-auto rounded-full bg-bad px-1.5 text-[11px] font-semibold text-white" title="Vėluoja grąžinti">{late.length}</span>;
}

/** Kur gyvena duomenys: bendras serveris (visi mato tą patį) ar tik šis įrenginys. */
function DataStatus() {
  const st = useRemoteStatus();
  if (!st) return null;
  if (st.url) return (
    <Link href="/tools/" className="mt-auto block px-2 text-xs text-muted hover:text-ink">
      <span className={"mr-1 inline-block h-2 w-2 rounded-full " + (st.error ? "bg-bad" : "bg-ok")} />
      Bendri duomenys{st.lastSync && <> · {st.lastSync.slice(11)}</>}{st.error && <> · klaida</>}
    </Link>
  );
  return <Link href="/tools/" className="mt-auto block px-2 text-xs text-muted hover:text-ink">Tik šis įrenginys. Bendras serveris — „Įrankiai“.</Link>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line px-3 py-5 md:flex">
        <Link href="/" className="serif px-2 text-lg leading-tight">{APP_TITLE}</Link>
        <span className="tnum mt-1 px-2 text-[11px] text-muted" title="Versija">v{VERSION}</span>
        <nav className="mt-5 flex flex-col gap-0.5" aria-label="Pagrindinis meniu">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={"flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[15px] " +
                (isActive(path, n.href) ? "bg-accent-soft font-medium" : "hover:bg-accent-soft/60")}>
              <Icon name={n.icon} className="text-muted" />{n.label}{n.href === "/moves/" && <LateBadge />}
            </Link>
          ))}
        </nav>
        <DataStatus />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" className="serif text-base leading-tight">{APP_TITLE} <span className="tnum ml-1 text-[11px] text-muted" title="Versija">v{VERSION}</span></Link>
        </header>
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card/95 backdrop-blur md:hidden" aria-label="Pagrindinis meniu"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href}
              className={"flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] " + (isActive(path, n.href) ? "text-accent font-semibold" : "text-muted")}>
              <span className="relative"><Icon name={n.icon} size={22} />{n.href === "/moves/" && <span className="absolute -right-3 -top-1"><LateBadge /></span>}</span>{n.label}
            </Link>
          ))}
        </nav>
      </div>
      <ToastHost />
    </div>
  );
}
