import type { Metadata } from "next";
import Header from "@/components/site/Header";
import SmokeBackground from "@/components/site/SmokeBackground";
import { clubSamoaJsonLd } from "@/lib/jsonld";

// Chrome del sitio público: fondo WebGL, header con nav y JSON-LD. No se
// aplica al admin ni a las vistas de proyección.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Club Samoa",
    locale: "es_MX",
    title: "Club Samoa Escuela de Artes Marciales",
    description:
      "Lima Lama, Kickboxing, Muay Thai, MMA y Jiu Jitsu en Ciudad Madero, Tamaulipas. Desde 1983.",
    images: [{ url: "/images/valeria.jpg", width: 1440, height: 959 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
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
    </>
  );
}
