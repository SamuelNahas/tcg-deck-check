import type { Metadata } from "next";
import "./globals.css";
import "./deckcheck.css";

export const metadata: Metadata = {
  title: "TCG Tournament Check",
  description: "Torneios, submissão de decklists e conferência para Pokémon TCG.",
  applicationName: "TCG Tournament Check",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TCG Check",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
