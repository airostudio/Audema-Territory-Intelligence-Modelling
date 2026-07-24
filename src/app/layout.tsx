import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audema Territory Intelligence Modelling",
  description: "Local Account-Based Marketing: map a sector across a territory, find the businesses with a measurable marketing problem, and launch a campaign built for that local market.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
