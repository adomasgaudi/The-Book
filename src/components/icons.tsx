import type { SVGProps } from "react";

/** Vienas ikonų rinkinys: 24px tinklelis, 1.75 storio linija, apvalūs galai. */
const PATHS = {
  book: "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  plus: "M12 5v14M5 12h14",
  repeat: "M17 2l4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3",
  bookOpen: "M2 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z",
  shelf: "M3 4h18M3 12h18M3 20h18M6 4v8M12 4v8M17 4v8M8 12v8M15 12v8",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  wrench: "M14.7 6.3a4 4 0 0 0 5 5L15 16l-3-3 4.7-4.7zM3 21l6-6",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  pencil: "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3",
  check: "M5 12.5 10 17 19 7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3",
  upload: "M12 15V3m0 0 4 4m-4-4-4 4M4 17v3h16v-3",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4",
  x: "M6 6l12 12M18 6 6 18",
  chevronLeft: "m15 5-7 7 7 7",
  filter: "M3 5h18l-7 8v6l-4-2v-4z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M16 9h.01",
  clipboard: "M9 4h6v3H9zM7 6H5v15h14V6h-2M9 13l2 2 4-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = "", ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={"shrink-0 " + className} {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
