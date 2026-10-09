/**
 * Avisos en tiempo real a las pantallas abiertas. Solo dicen QUE cambio (no traen datos
 * personales): cada pantalla vuelve a pedir lo suyo por la API, con sus permisos.
 */
export type TipoEvento = 'marcaciones' | 'empleados' | 'papeletas' | 'vacaciones';

export interface PublicadorEventos {
  publicar(tipo: TipoEvento): void;
}

/** Para pruebas o cuando no hay base disponible. */
export const sinEventos: PublicadorEventos = { publicar: () => undefined };
