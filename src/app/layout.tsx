import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/Layout/BottomNav";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { CurrentUserProvider } from "@/components/Auth/CurrentUserProvider";
import ServiceWorkerRegistration from "@/components/ui/ServiceWorkerRegistration";
import OfflineBanner from "@/components/ui/OfflineBanner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "Aplikacja do planowania posiłków i zakupów",
  applicationName: "Meal Planner",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Meal Planner",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7b61e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script may add the `dark` class before React hydrates
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-28 text-gray-900 dark:text-gray-100`}
      >
        <FeedbackProvider>
          <CurrentUserProvider>
            {children}
          </CurrentUserProvider>
          <OfflineBanner />
          <BottomNav />
          <ServiceWorkerRegistration />
        </FeedbackProvider>
      </body>
    </html>
  );
}
