/** Reglas para convertir los nombres que vienen de ZKBio Time en nombre/apellidos del SGRH. */

export const NOMBRE_A_CORREGIR = 'Nombre a corregir';

const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]+$/;

function limpiar(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim();
}

/** El reloj a veces guarda nombres con bytes basura (p. ej. "\u0010çž"). */
export function esNombreValido(nombre: string | null | undefined, apellido: string | null | undefined): boolean {
  const completo = limpiar(`${nombre ?? ''} ${apellido ?? ''}`);
  return completo.length >= 3 && SOLO_LETRAS.test(completo) && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2}/.test(completo);
}

/**
 * Separa nombres y apellidos. Si ZKBio Time trae el apellido aparte se respeta;
 * si viene todo junto se toma la costumbre boliviana: los dos ultimos terminos son los apellidos.
 */
export function separarNombre(
  nombre: string | null | undefined,
  apellido: string | null | undefined,
): { firstName: string; lastName: string } {
  const n = limpiar(nombre);
  const a = limpiar(apellido);
  if (a) return { firstName: n || a, lastName: a };

  const partes = n.split(' ').filter(Boolean);
  if (partes.length >= 3) return { firstName: partes.slice(0, -2).join(' '), lastName: partes.slice(-2).join(' ') };
  if (partes.length === 2) return { firstName: partes[0], lastName: partes[1] };
  return { firstName: n, lastName: n };
}

export function nombreDesdeZk(
  codigo: string,
  nombre: string | null | undefined,
  apellido: string | null | undefined,
): { firstName: string; lastName: string; aCorregir: boolean } {
  if (!esNombreValido(nombre, apellido)) {
    return { firstName: NOMBRE_A_CORREGIR, lastName: `Biometrico ${codigo}`, aCorregir: true };
  }
  return { ...separarNombre(nombre, apellido), aCorregir: false };
}

/** Estado de marcacion de ZKBio Time -> tipo del SGRH. 0 entrada, 1 salida, 2/3 descanso, 4/5 horas extra. */
export function tipoDeMarcacion(punchState: string | number | null | undefined): 'CHECK_IN' | 'CHECK_OUT' {
  const estado = String(punchState ?? '0');
  return ['1', '2', '5'].includes(estado) ? 'CHECK_OUT' : 'CHECK_IN';
}

/** "2026-10-06 08:15:30" en hora local del servidor (la hora del reloj). */
export function fechaHoraLocal(texto: string): Date {
  const [fecha, hora = '00:00:00'] = texto.trim().split(/[ T]/);
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm, ss] = hora.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
}
