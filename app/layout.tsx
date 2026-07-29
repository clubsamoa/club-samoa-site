import type { Metadata } from "next";
import { Anton, Inter, Oswald, Teko } from "next/font/google";
import "./globals.css";

// Mismas familias y pesos que cargaba el sitio estático desde Google Fonts
// (ver legacy/index.html). Self-hosted vía next/font: sin requests a
// fonts.googleapis.com y sin FOUT.
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-anton",
});

const oswald = Oswald({
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-oswald",
});

const inter = Inter({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const teko = Teko({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-teko",
});

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
    <html
      lang="es"
      className={`${anton.variable} ${oswald.variable} ${inter.variable} ${teko.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
