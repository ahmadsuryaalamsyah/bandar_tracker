import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TopBar } from "@/components/TopBar";
import { THEME_INIT_SCRIPT } from "@/lib/utils/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDX Stock Analysis — Dashboard Lokal",
  description:
    "Dashboard analisis saham Indonesia (BEI/IDX) dengan indikator Liquidity Pressure, Intensity, dan Volume Rotation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <TopBar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
