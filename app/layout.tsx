import type { Metadata } from "next";
import "./globals.css";
import { getAppSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Cureocity — Internal Management",
  description: "Cureocity health & fitness internal management system",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Branding is editable in Templates & Branding — apply the chosen brand colour
  // and font as CSS-variable overrides so it reaches every page and PDF.
  const { brand } = await getAppSettings();
  const color = brand.color || "#e11f34";
  const overrides =
    `:root{--brand:${color};--brand-fill:${color};--brand-text:${color};--brand-tint:${color}1a;}` +
    (brand.font ? `body{font-family:${brand.font};}` : "");
  const favicon = brand.logo?.trim() || "/cureocity-mark.png?v=2";

  return (
    <html lang="en">
      <head>
        <link rel="icon" href={favicon} />
        <link rel="apple-touch-icon" href={favicon} />
        <style dangerouslySetInnerHTML={{ __html: overrides }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
