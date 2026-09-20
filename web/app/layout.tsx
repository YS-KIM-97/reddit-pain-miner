import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimSnap — 영수증에서 경비 한 줄까지",
  description: "영수증 사진에서 상호, 날짜, 금액, 분류를 읽고 경비 한 줄로 확정하세요.",
  manifest: "/manifest.webmanifest",
  other: {
    "codex-preview": "development",
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
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
