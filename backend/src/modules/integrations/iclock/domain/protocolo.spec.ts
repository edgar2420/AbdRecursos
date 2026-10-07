import { describe, expect, it } from 'vitest';
import { leerAttlog, opcionesParaReloj } from './protocolo';

describe('protocolo iclock', () => {
  it('lee las lineas de ATTLOG que envia el reloj', () => {
    const cuerpo = '114\t2026-10-07 08:47:12\t0\t1\t0\t0\t0\n878\t2026-10-07 17:02:00\t1\t1\t0\t0\t0\n';
    const marcaciones = leerAttlog(cuerpo);
    expect(marcaciones).toHaveLength(2);
    expect(marcaciones[0].codigo).toBe('114');
    expect(marcaciones[0].type).toBe('CHECK_IN');
    expect(marcaciones[0].timestamp.getHours()).toBe(8);
    expect(marcaciones[1].type).toBe('CHECK_OUT');
  });

  it('ignora lineas vacias o mal formadas', () => {
    expect(leerAttlog('\n\nbasura\n114\tno-es-fecha\t0\n')).toHaveLength(0);
  });

  it('acepta saltos de linea de Windows', () => {
    expect(leerAttlog('5\t2026-10-07 07:01:00\t0\t1\r\n')).toHaveLength(1);
  });

  it('arma la configuracion para el reloj', () => {
    const texto = opcionesParaReloj('JYP4250800011', -4);
    expect(texto).toContain('GET OPTION FROM: JYP4250800011');
    expect(texto).toContain('Realtime=1');
    expect(texto).toContain('TimeZone=-4');
  });
});
