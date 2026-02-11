import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL || "http://localhost:3000"),
  title: "Red Packets on Base | Coinbase",
  description: "Celebrate Lunar New Year by sharing USDC red packet blessings on Base.",
  openGraph: {
    title: "Red Packets on Base | Coinbase",
    description: "Send and receive USDC red packets on Base. Celebrate with crypto.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Red Packets on Base | Coinbase",
    description: "Send and receive USDC red packets on Base. Celebrate with crypto.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
