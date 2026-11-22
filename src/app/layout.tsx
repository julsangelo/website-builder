import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Forma — Shadcn Website Builder",
  description: "A drag-and-drop website builder made with shadcn/ui.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
