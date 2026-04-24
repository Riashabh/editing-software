import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-ui" });
const mono  = JetBrains_Mono({ subsets: ["latin"], weight: ["400","500"], variable: "--font-mono-next" });

export const metadata: Metadata = {
  title: "Wordcut",
  description: "Edit video with just words.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Anton&family=Oswald:wght@700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Serif+Display&family=Permanent+Marker&family=Righteous&family=Bungee&family=Black+Han+Sans&family=Archivo+Black&family=Barlow+Condensed:wght@700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
