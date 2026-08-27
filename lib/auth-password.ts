import bcrypt from "bcryptjs";

// Verificación de la contraseña compartida del admin.
//
// En el entorno solo vive el HASH (ADMIN_PASSWORD_HASH), nunca la contraseña.
// El hash lo genera quien administra el club en su propia máquina:
//
//   npx --yes bcrypt-cli hash 'la-contraseña'
//
// Así la contraseña no pasa por el repo, ni por los logs, ni por el chat.

/** Falla cerrado: sin hash configurado, nadie entra. */
export function hayPasswordConfigurada(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD_HASH);
}

export async function verificarPassword(plana: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !plana) return false;
  try {
    return await bcrypt.compare(plana, hash);
  } catch {
    // Un hash mal formado no debe dejar entrar a nadie.
    return false;
  }
}

// ---------------------------------------------------------------
// Límite de intentos
// ---------------------------------------------------------------
// Contador en memoria por IP. Se reinicia cuando la función serverless se
// recicla, así que NO es una defensa fuerte — es un freno contra el intento
// de adivinar la contraseña a fuerza bruta desde un mismo origen. Si algún
// día hace falta algo serio, hay que moverlo a un store compartido.

const MAX_INTENTOS = 8;
const VENTANA_MS = 10 * 60 * 1000; // 10 minutos

type Registro = { intentos: number; desde: number };
const intentosPorIp = new Map<string, Registro>();

export function estaBloqueado(ip: string): boolean {
  const registro = intentosPorIp.get(ip);
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_MS) {
    intentosPorIp.delete(ip);
    return false;
  }
  return registro.intentos >= MAX_INTENTOS;
}

export function registrarFallo(ip: string): void {
  const ahora = Date.now();
  const registro = intentosPorIp.get(ip);
  if (!registro || ahora - registro.desde > VENTANA_MS) {
    intentosPorIp.set(ip, { intentos: 1, desde: ahora });
    return;
  }
  registro.intentos += 1;
}

export function limpiarIntentos(ip: string): void {
  intentosPorIp.delete(ip);
}

/** Solo para tests: vacía el contador. */
export function _resetIntentos(): void {
  intentosPorIp.clear();
}
