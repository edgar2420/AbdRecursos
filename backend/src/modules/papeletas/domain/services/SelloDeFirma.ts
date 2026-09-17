import { Papeleta } from '../entities/Papeleta';

export interface SelloDeFirmaPort {
  sellar(papeleta: Papeleta, userId: string, fecha: Date): string;
  verificar(papeleta: Papeleta, userId: string, fecha: Date, sello: string): boolean;
}

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
