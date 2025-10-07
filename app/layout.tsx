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
      <head>
        <script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" async />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
