import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Nav from "@/app/components/Nav";
import MobileTabBar from "@/app/components/MobileTabBar";
import { getCurrentUser } from "@/lib/auth";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Dough Spot",
  description: "Dough Spot - multi-site photo capture dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Nav user={user} />
        <main className="flex flex-1 flex-col pb-14 md:pb-0">{children}</main>
        <MobileTabBar user={user} />
      </body>
    </html>
  );
}
