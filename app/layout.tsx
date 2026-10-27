import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import "./compact.css";
import "./product-cards.css";
import "./reviews-and-catalog.css";
import "./socials.css";
import "./boutique-design.css";
import "./shop-browser.css";
import "./shop-pagination.css";
import "./shop-editorial.css";
import "./shop-sidebar.css";
import "./about.css";
import "./ceo-photos.css";
import "./contact.css";
import "./banner-photo-layout.css";
import "./account.css";
import "./search-overlay.css";
import "./error-toast.css";
import "./cart-checkout.css";
import "./wishlist.css";
import "./skeleton.css";

import { ErrorToastProvider } from "./components/ErrorToast";
import FormValidation from "./components/FormValidation";
import PWARegister from "./components/PWARegister";
import NavigationScroll from "./components/NavigationScroll";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ElizKloset - Corporate Fashion",
  description: "Elegant corporate wear for women in Ghana.",
  applicationName: "ElizKloset",
};

export const viewport: Viewport = {
  themeColor: "#750D27",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PWARegister />
        <FormValidation />
        <Suspense fallback={null}><NavigationScroll /></Suspense>
        <ErrorToastProvider>{children}</ErrorToastProvider>
      </body>
    </html>
  );
}
















