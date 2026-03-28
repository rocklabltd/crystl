import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crystl V1",
  description: "Multi-workspace request to quote workflow app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
