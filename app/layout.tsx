import type { Metadata } from "next";
import { Anton, Inter, Oswald, Teko } from "next/font/google";
import "./globals.css";

// Layout raíz: solo <html>/<body>, fuentes y metadata base. El "chrome" de
// cada superficie vive en su grupo de rutas:
//   (site)    → header público, nav, fondo WebGL, JSON-LD
//   (admin)   → shell del admin (header + sidebar), tras el gate de auth
//   (publico) → vistas de proyección, sin chrome
//   /login    → pantalla mínima

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
