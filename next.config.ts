import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // 301 de las URLs .html del sitio estático (indexadas y compartidas por
  // WhatsApp). Las 4 del admin con query params (?id=, ?pelea=, ?evento=)
  // no mapean a un path limpio: redirigen al listado (son URLs internas).
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/students.html", destination: "/alumnos", permanent: true },
      {
        source: "/community.html",
        destination: "/comunidad",
        permanent: true,
      },
      { source: "/admin/index.html", destination: "/admin", permanent: true },
      {
        source: "/admin/eventos.html",
        destination: "/admin/eventos",
        permanent: true,
      },
      {
        source: "/admin/atletas.html",
        destination: "/admin/atletas",
        permanent: true,
      },
      {
        source: "/admin/evento.html",
        destination: "/admin/eventos",
        permanent: true,
      },
      {
        source: "/admin/bracket.html",
        destination: "/admin/eventos",
        permanent: true,
      },
      {
        source: "/admin/scoreboard.html",
        destination: "/admin/eventos",
        permanent: true,
      },
      {
        source: "/admin/scoreboard-public.html",
        destination: "/admin/eventos",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
