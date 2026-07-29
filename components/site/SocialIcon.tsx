import Image from "next/image";

// Icono social de 18px (CSS .social-icon fija el tamaño renderizado).
// Decorativos: alt vacío + aria-hidden, como en legacy.

const ICONS = {
  whatsapp: "/icon-whatsapp.png",
  instagram: "/icon-instagram.png",
  facebook: "/icon-facebook.png",
} as const;

export default function SocialIcon({ type }: { type: keyof typeof ICONS }) {
  return (
    <Image
      className="social-icon"
      src={ICONS[type]}
      alt=""
      aria-hidden="true"
      width={36}
      height={45}
    />
  );
}
