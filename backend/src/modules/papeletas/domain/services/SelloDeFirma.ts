import { Papeleta } from '../entities/Papeleta';

/**
 * Puerto del sello de integridad de una firma.
 *
 * No es una firma con certificado digital: es un sello que encadena el
 * contenido de la papeleta con quien firmo y cuando, de modo que si alguien
 * altera la papeleta despues, el sello deja de verificar. Sirve como prueba de
 * integridad y queda impreso en el PDF.
 */
export interface SelloDeFirmaPort {
  sellar(papeleta: Papeleta, userId: string, fecha: Date): string;
  verificar(papeleta: Papeleta, userId: string, fecha: Date, sello: string): boolean;
}

/** Contenido que queda comprometido por la firma. */
export function contenidoFirmable(papeleta: Papeleta): string {
  return [
    papeleta.numero,
    papeleta.tipo,
    papeleta.employeeId,
    papeleta.area,
    papeleta.fecha.toISOString(),
    papeleta.trabajoRealizado ?? '',
    papeleta.desde?.toISOString() ?? '',
    papeleta.hasta?.toISOString() ?? '',
    String(papeleta.totalHoras ?? ''),
    papeleta.recargo ?? '',
    papeleta.salidaMotivo ?? '',
    papeleta.motivo ?? '',
    papeleta.tiempoSolicitado ?? '',
    papeleta.horaSalida ?? '',
    papeleta.horaRetorno ?? '',
  ].join('|');
}
