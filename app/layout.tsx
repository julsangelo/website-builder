import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canvas — Website Builder",
  description: "A working drag and drop website builder prototype",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}