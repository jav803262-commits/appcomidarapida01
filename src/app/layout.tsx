import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toritos Burger | Menú",
  description: "Menú digital y pedidos por WhatsApp.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}