import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liar Game",
  description: "패스앤플레이 로컬 라이어 게임",
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
