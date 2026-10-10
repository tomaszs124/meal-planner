import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/Layout/BottomNav";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { CurrentUserProvider } from "@/components/Auth/CurrentUserProvider";
import ServiceWorkerRegistration from "@/components/ui/ServiceWorkerRegistration";
import OfflineBanner from "@/components/ui/OfflineBanner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// Body face: a humanist sans with some character (not Inter / system)
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for headings and the kcal numbers (see globals.css): a high-contrast editorial serif
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
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
        className={`${instrumentSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased pb-28 text-gray-900 dark:text-gray-100`}
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
