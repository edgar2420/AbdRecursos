import { Movimiento, minutosDeSalida } from './banco';
import { AjusteBanco, PapeletaParaBanco } from './BancoHorasRepository';

const RECARGO: Record<string, string> = { DIURNA: 'Diurna', NOCTURNA: 'Nocturna', FERIADO: 'Feriado' };

export function movimientosDe(papeletas: PapeletaParaBanco[], ajustes: AjusteBanco[]): Movimiento[] {
  const deP = papeletas.map((p): Movimiento => {
    if (p.tipo === 'HORAS_EXTRAS') {
      return {
        fecha: p.fecha,
        tipo: 'HORAS_EXTRAS',
        minutos: Math.round((p.totalHoras ?? 0) * 60),
        detalle: [RECARGO[p.recargo ?? ''] ?? null, p.trabajoRealizado].filter(Boolean).join(' · '),
        referencia: p.numero,
        estimado: false,
      };
    }
    const salida = minutosDeSalida(p.horaSalida, p.horaRetorno, p.tiempoSolicitado);
    return {
      fecha: p.fecha,
      tipo: 'SALIDA',
      minutos: -salida.minutos,
      detalle: [p.motivo, p.horaSalida && p.horaRetorno ? `${p.horaSalida} a ${p.horaRetorno}` : p.tiempoSolicitado]
        .filter(Boolean)
        .join(' · '),
      referencia: p.numero,
      estimado: salida.estimado,
    };
  });

  const deA = ajustes.map(
    (a): Movimiento => ({
      fecha: a.fecha,
      tipo: 'AJUSTE',
      minutos: a.minutos,
      detalle: a.motivo,
      referencia: null,
      estimado: false,
    }),
  );
  return [...deP, ...deA];
}
