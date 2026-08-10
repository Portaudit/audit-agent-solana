import type { Metadata } from "next";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AuditAgent - Trustless AI Settlement Rails",
  description: "Deterministic validation and escrow for autonomous AI agents on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
