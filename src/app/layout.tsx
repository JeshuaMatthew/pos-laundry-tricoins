import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Laundry Tricoins — Operational POS & Management",
  description: "Sistem Point of Sales, Manajemen Mesin, dan Stok Sachet Laundry Tricoins",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F4F7FB] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={3500}
          toastOptions={{
            style: {
              borderRadius: "0.375rem",
              fontFamily: "var(--font-jakarta)",
            },
            className: "text-xs font-medium shadow-md border",
          }}
        />
      </body>
    </html>
  );
}
