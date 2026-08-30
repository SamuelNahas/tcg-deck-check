import type { Metadata } from "next";
import "./globals.css";
import "./deckcheck.css";

export const metadata: Metadata = {
  title: "TCG Deck Check",
  description: "Painel de conferência de decklists para juízes de Pokémon TCG.",
  applicationName: "TCG Deck Check",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Deck Check",
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
