import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lantern 执灯系统 — 智能查询助手",
  description: "自然语言操作企业系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
