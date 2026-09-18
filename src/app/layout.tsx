import type { Metadata, Viewport } from "next";
import "@fontsource-variable/literata/wght.css";
import "./globals.css";
import { APP_TITLE } from "@/lib/domain/config";
import { Shell } from "@/components/Shell";
import { Bootstrap } from "@/components/Bootstrap";

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Namų bibliotekos katalogas: knygos, lentynos, judėjimai, skaitymo suvestinė.",
  applicationName: "Biblioteka",
  appleWebApp: { capable: true, title: "Biblioteka", statusBarStyle: "default" },
  manifest: "manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1815" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt" suppressHydrationWarning>
      <body>
        <Bootstrap />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
