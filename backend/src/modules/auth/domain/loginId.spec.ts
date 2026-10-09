import { describe, expect, it } from 'vitest';
import { codigosCandidatos, normalizeLoginId } from './loginId';

describe('usuario de ingreso', () => {
  it('ignora tildes, mayusculas y separadores', () => {
    expect(normalizeLoginId(' 1264  Rojas Apaza ')).toBe('1264rojasapaza');
    expect(normalizeLoginId('ADMIN Sistema')).toBe('adminsistema');
    expect(normalizeLoginId('1267 Maciar-Gutiérrez')).toBe('1267maciargutierrez');
  });

  it('propone como codigo cada prefijo, tal cual y en mayusculas', () => {
    const c = codigosCandidatos('adminsistema');
    expect(c).toContain('ADMIN');
    expect(c).toContain('a');
    expect(codigosCandidatos('502rafaelala')).toContain('502');
  });

  it('no propone codigos mas largos de 20 caracteres', () => {
    const largo = 'x'.repeat(60);
    expect(Math.max(...codigosCandidatos(largo).map((c) => c.length))).toBe(20);
  });
});
