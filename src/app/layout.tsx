import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "School Admin Desk", template: "%s | School Admin Desk" },
  description: "School personnel records, forms and property inventory",
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en-PH" className="font-sans">
    <body>{children}</body>
  </html>
);

export default RootLayout;
