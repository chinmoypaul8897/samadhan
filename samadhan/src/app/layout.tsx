import type { Metadata, Viewport } from "next";
import { display, sans, mono } from "@/lib/fonts";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { FcmForeground } from "@/components/FcmForeground";
import "./globals.css";

export const metadata: Metadata = {
  title: "Samadhan — from report to resolution",
  description:
    "An AI civic resolution agent: report a civic issue and an autonomous agent gets it actually fixed — and proves it.",
  applicationName: "Samadhan",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Samadhan" },
};

export const viewport: Viewport = {
  themeColor: "#003c33",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-canvas font-sans text-ink">
        <AuthProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
            <FcmForeground />
          </ToastProvider>
        </AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
