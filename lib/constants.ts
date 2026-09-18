// Datos de contacto y redes del club, usados en header, hero y contacto.
export const WHATSAPP_URL = "https://wa.me/528333110858";
export const INSTAGRAM_URL = "https://www.instagram.com/club.samoa/";
export const FACEBOOK_URL =
  "https://www.facebook.com/profile.php?id=100064137453524&locale=es_LA";
export const MAPS_URL = "https://maps.app.goo.gl/XJic3zwHiYcTWni7A";

// Imagen que acompaña a cualquier link del sitio compartido por WhatsApp o
// Facebook. Vive aquí porque Next NO fusiona el openGraph de una página con
// el del layout: lo reemplaza entero. Toda página que declare su propio
// openGraph tiene que volver a incluir esta imagen o se comparte sin ella.
export const OG_IMAGE = {
  url: "/images/valeria.jpg",
  width: 1440,
  height: 959,
} as const;
