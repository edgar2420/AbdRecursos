import { describe, expect, it } from 'vitest';
import { NOMBRE_A_CORREGIR, esNombreValido, fechaHoraLocal, nombreDesdeZk, separarNombre, tipoDeMarcacion } from './nombres';

describe('nombres de ZKBio Time', () => {
  it('detecta nombres con bytes basura', () => {
    expect(esNombreValido('\u0010çž', null)).toBe(false);
    expect(esNombreValido('Hçž', null)).toBe(false);
    expect(esNombreValido('', null)).toBe(false);
    expect(esNombreValido('MARIA LENY', 'SOLARES RIVERO')).toBe(true);
    expect(esNombreValido('YOSELIN', 'AVENDAÑO ZOTO')).toBe(true);
  });

  it('respeta el apellido cuando viene aparte', () => {
    expect(separarNombre('ALEX GUILLERMO', 'GUACHALLA TARQUINO')).toEqual({
      firstName: 'ALEX GUILLERMO',
      lastName: 'GUACHALLA TARQUINO',
    });
  });

  it('separa el nombre completo tomando los dos ultimos terminos como apellidos', () => {
    expect(separarNombre('MADELYN  ORTIZ VIDAL', null)).toEqual({ firstName: 'MADELYN', lastName: 'ORTIZ VIDAL' });
    expect(separarNombre('MARIA LUZ ROJAS PONCE', null)).toEqual({ firstName: 'MARIA LUZ', lastName: 'ROJAS PONCE' });
    expect(separarNombre('LISBETH', null)).toEqual({ firstName: 'LISBETH', lastName: 'LISBETH' });
  });

  it('marca los nombres danados para corregir sin perder el codigo', () => {
    expect(nombreDesdeZk('1022', '\u0010çž', null)).toEqual({
      firstName: NOMBRE_A_CORREGIR,
      lastName: 'Biometrico 1022',
      aCorregir: true,
    });
  });

  it('traduce el estado de marcacion', () => {
    expect(tipoDeMarcacion('0')).toBe('CHECK_IN');
    expect(tipoDeMarcacion('1')).toBe('CHECK_OUT');
    expect(tipoDeMarcacion('4')).toBe('CHECK_IN');
    expect(tipoDeMarcacion('5')).toBe('CHECK_OUT');
  });

  it('lee la hora del reloj como hora local', () => {
    const fecha = fechaHoraLocal('2026-10-06 08:15:30');
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), fecha.getHours(), fecha.getMinutes()]).toEqual([2026, 9, 6, 8, 15]);
  });
});
