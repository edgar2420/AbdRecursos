import { describe, expect, it } from 'vitest';
import { Movimiento, conSaldoAcumulado, minutosDeSalida, minutosDeTexto, saldoDe } from './banco';

describe('banco de horas', () => {
  it('lee el tiempo solicitado escrito a mano', () => {
    expect(minutosDeTexto('2 horas')).toBe(120);
    expect(minutosDeTexto('1 hora')).toBe(60);
    expect(minutosDeTexto('1 h 30 min')).toBe(90);
    expect(minutosDeTexto('30 minutos')).toBe(30);
    expect(minutosDeTexto('1,5 h')).toBe(90);
    expect(minutosDeTexto('media jornada')).toBe(240);
    expect(minutosDeTexto('2')).toBe(120);
    expect(minutosDeTexto('no se')).toBeNull();
  });

  it('usa la hora de salida y retorno cuando existen', () => {
    expect(minutosDeSalida('10:00', '12:30', '1 hora')).toEqual({ minutos: 150, estimado: false });
  });

  it('sin hora de retorno estima por el texto', () => {
    expect(minutosDeSalida('15:00', null, '1 hora')).toEqual({ minutos: 60, estimado: true });
  });

  it('acumula el saldo en orden cronologico', () => {
    const m = (dia: number, minutos: number): Movimiento => ({
      fecha: new Date(2026, 9, dia),
      tipo: minutos > 0 ? 'HORAS_EXTRAS' : 'SALIDA',
      minutos,
      detalle: '',
      referencia: null,
      estimado: false,
    });
    const lista = conSaldoAcumulado([m(5, -60), m(2, 150), m(9, -120)]);
    expect(lista.map((x) => x.saldo)).toEqual([150, 90, -30]);
    expect(saldoDe(lista)).toBe(-30);
  });
});
