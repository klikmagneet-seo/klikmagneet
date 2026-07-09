import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ClientContextProvider } from "@/components/ClientContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Klikmagneet - AI Content Platform",
  description: "Genereer SEO-geoptimaliseerde content met AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={inter.className}>
        <ClientContextProvider>
          <div className="flex h-screen overflow-hidden bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </ClientContextProvider>
      </body>
    </html>
  );
}
