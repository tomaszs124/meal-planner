import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/Layout/BottomNav";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { CurrentUserProvider } from "@/components/Auth/CurrentUserProvider";
import ServiceWorkerRegistration from "@/components/ui/ServiceWorkerRegistration";
import OfflineBanner from "@/components/ui/OfflineBanner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for headings (see globals.css): a soft, slightly wonky serif that gives the app its own voice
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  // variable font: weights come from the file; extra axes are opted in explicitly
  axes: ["SOFT", "WONK", "opsz"],
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
  themeColor: "#a7337a",
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
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased pb-28 text-gray-900 dark:text-gray-100`}
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
