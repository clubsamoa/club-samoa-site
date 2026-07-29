// Puerto del footer de legacy/community.html:314-325. Solo la página de
// comunidad lo mostraba; se monta por página (N06), no en el layout.
export default function Footer() {
  return (
    <footer className="site-footer">
      <p className="site-footer-copy">
        &copy; {new Date().getFullYear()} Club Samoa · Escuela de Artes
        Marciales
      </p>
      <a
        className="site-footer-admin"
        href="/admin"
        title="Acceso para staff"
        aria-label="Panel de administración"
      >
        Staff
      </a>
    </footer>
  );
}
