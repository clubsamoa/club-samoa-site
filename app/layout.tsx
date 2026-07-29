import type { Metadata } from "next";
import { Anton, Inter, Oswald, Teko } from "next/font/google";
import Header from "@/components/site/Header";
import SmokeBackground from "@/components/site/SmokeBackground";
import { clubSamoaJsonLd } from "@/lib/jsonld";
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Club Samoa Escuela de Artes Marciales",
  description:
    "Horarios, disciplinas y contacto de Club Samoa Escuela de Artes Marciales.",
  alternates: { canonical: "/" },
  icons: {
    icon: "/images/logo-black.png",
    apple: "/images/logo-black.png",
  },
  openGraph: {
    type: "website",
    siteName: "Club Samoa",
    locale: "es_MX",
    title: "Club Samoa Escuela de Artes Marciales",
    description:
      "Lima Lama, Kickboxing, Muay Thai, MMA y Jiu Jitsu en Ciudad Madero, Tamaulipas. Desde 1983.",
    images: [{ url: "/images/valeria.jpg", width: 1440, height: 959 }],
  },
  twitter: {
    card: "summary_large_image",
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
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(clubSamoaJsonLd(SITE_URL)),
          }}
        />
        {/* El canvas solo anima en cliente (useEffect); su SSR es un <canvas>
            vacío, así que no necesita dynamic/ssr:false. */}
        <SmokeBackground />
        <div className="page-shell">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
