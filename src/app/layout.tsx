import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NOXOMOR Ledger",
    template: "%s | NOXOMOR Ledger",
  },
  description: "Pusat kendali keuangan pribadi yang cerdas dan terintegrasi.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NOXOMOR Ledger",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.variable} font-sans bg-background text-text-primary min-h-screen`}>
        {children}
        <ServiceWorkerRegister />
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#1E293B",
              border: "1px solid #334155",
              color: "#F8FAFC",
            },
          }}
        />
      </body>
    </html>
  );
}
