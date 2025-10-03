import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "울단지",
  description: "울단지 어드민 페이지 입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
