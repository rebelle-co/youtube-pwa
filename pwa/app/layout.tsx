import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./styles/global.css";
import SuspenseWrapper from "./components/SuspenseWrapper";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: 'YouTube Simulator',
  description: 'Adblocker & Offline Playlist PWA',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'YT Simulator' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SuspenseWrapper>
          {children}
        </SuspenseWrapper>
      </body>
    </html>
  )
}