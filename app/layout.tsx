import type { Metadata } from "next";
import "./globals.css";

// Las fuentes de marca (Anton, Oswald, Inter, Teko) se configuran en N02
// con next/font. Este layout es el mínimo del scaffold (tarea N01).

export const metadata: Metadata = {
  title: "Club Samoa Escuela de Artes Marciales",
  description:
    "Horarios, disciplinas y contacto de Club Samoa Escuela de Artes Marciales.",
  icons: {
    icon: "/images/logo-black.png",
    apple: "/images/logo-black.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
