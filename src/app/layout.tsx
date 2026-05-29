import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/app/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ПРОМЕБЕЛЬ — Управление закупками ПРОМЕБЕЛЬ",
  description: "Система управления закупками ПРОМЕБЕЛЬ: проекты, поставщики, склад, счета и запросы",
  keywords: ["закупки", "управление", "поставщики", "склад", "счета"],
  authors: [{ name: "ПРОМЕБЕЛЬ" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "ПРОМЕБЕЛЬ",
    description: "Система управления закупками ПРОМЕБЕЛЬ",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {children}
          </QueryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
