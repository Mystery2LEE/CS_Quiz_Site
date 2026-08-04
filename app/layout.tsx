import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "면접장 — CS 면접 문제 생성기",
  description: "SSAFY 데이터 트랙 스터디를 위한 AI 기반 CS 면접 문제 생성 사이트",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
