import { redirect } from "next/navigation";

// legacy/admin/index.html solo redirigía a eventos.html (meta refresh +
// location.replace). Aquí es un redirect de servidor, sin parpadeo.
export default function AdminIndex() {
  redirect("/admin/eventos");
}
