import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import RouteProgress from "@/components/RouteProgress";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Jobible BizEng | 외국계 AI 영어 면접 코치",
  description: "외국계 이직을 준비하는 시니어 리더를 위한 AI 음성 면접 훈련",
  manifest: "/manifest.json",
  applicationName: "Jobible BizEng",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "BizEng",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.variable} h-full`}>
      {/* min-height는 globals.css가 dvh로 관리 — min-h-screen(정적 100vh)을 두면 동적 뷰포트 보정이 무효화됨 */}
      <body className="bg-slate-950 text-slate-100 font-sans antialiased">
        <RouteProgress />
        {children}
      </body>
    </html>
  );
}
