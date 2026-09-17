import { describe, expect, it } from 'vitest';
import { FieldCipher } from './FieldCipher';

const cipher = new FieldCipher('clave-de-prueba-suficientemente-larga');

describe('FieldCipher - cifrado de campos sensibles en reposo', () => {
  it('lo cifrado no se parece al original', () => {
    const cifrado = cipher.cifrar('6543210');

    expect(cifrado).not.toContain('6543210');
    expect(cifrado?.startsWith('enc:v1:')).toBe(true);
  });

  it('descifra de vuelta el valor exacto', () => {
    expect(cipher.descifrar(cipher.cifrar('6543210'))).toBe('6543210');
  });

  it('el mismo valor cifrado dos veces da resultados distintos', () => {
    expect(cipher.cifrar('1234567')).not.toBe(cipher.cifrar('1234567'));
  });

  it('detecta que el dato fue manipulado y no devuelve basura', () => {
    const cifrado = cipher.cifrar('1234567')!;
    const alterado = cifrado.slice(0, -6) + 'AAAAAA';

    expect(cipher.descifrar(alterado)).toBeNull();
  });

  it('con otra clave no se puede leer', () => {
    const otro = new FieldCipher('otra-clave-completamente-distinta-aqui');

    expect(otro.descifrar(cipher.cifrar('1234567'))).toBeNull();
  });

  it('la huella es estable y sirve para buscar sin descifrar', () => {
    expect(cipher.huella('1234567')).toBe(cipher.huella('1234567'));
    expect(cipher.huella('1234567')).not.toBe(cipher.huella('7654321'));
    expect(cipher.huella('1234567')).not.toContain('1234567');
  });

  it('deja pasar los datos que todavia estan en claro durante la migracion', () => {
    expect(cipher.descifrar('1234567')).toBe('1234567');
  });

  it('no rompe con valores vacios', () => {
    expect(cipher.cifrar(null)).toBeNull();
    expect(cipher.cifrar('')).toBeNull();
    expect(cipher.descifrar(null)).toBeNull();
  });
});
