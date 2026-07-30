// Header de página dentro del main. Reemplaza los data-title/data-subtitle
// que cada HTML declaraba en el <body> (shell.js:70-87), y el slot
// data-slot="main-actions" que el shell movía por JS: ahora es una prop.
export default function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="admin-main-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="admin-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="admin-main-actions">{actions}</div>}
    </header>
  );
}
