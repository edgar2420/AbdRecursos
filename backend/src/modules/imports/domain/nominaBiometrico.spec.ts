import { describe, expect, it } from 'vitest';
import { claveCargo, fechaNomina, leerFila, mismoNombre, nombreCargo, separarApellidosNombres } from './nominaBiometrico';

describe('nomina para el biometrico', () => {
  it('separa apellidos y nombres (la nomina pone los apellidos primero)', () => {
    expect(separarApellidosNombres('LOPEZ TORRICO LUIS ALEJANDRO')).toEqual({ lastName: 'LOPEZ TORRICO', firstName: 'LUIS ALEJANDRO' });
    expect(separarApellidosNombres('CASTRILLO VALDIVIEZO AMILCAR')).toEqual({ lastName: 'CASTRILLO VALDIVIEZO', firstName: 'AMILCAR' });
    expect(separarApellidosNombres('FERNANDEZ PAMELA')).toEqual({ lastName: 'FERNANDEZ', firstName: 'PAMELA' });
    expect(separarApellidosNombres('DE SOUZA PINTO CAMARGO ESTHER')).toEqual({ lastName: 'DE SOUZA PINTO CAMARGO', firstName: 'ESTHER' });
    expect(separarApellidosNombres('SANTA CRUZ LOPEZ VANIA LIZETH')).toEqual({ lastName: 'SANTA CRUZ LOPEZ', firstName: 'VANIA LIZETH' });
    expect(separarApellidosNombres('PACHECO GUEVARA DE ZAMBRANA MARIA LILA')).toEqual({
      lastName: 'PACHECO GUEVARA DE ZAMBRANA',
      firstName: 'MARIA LILA',
    });
  });

  it('usa la cantidad de palabras del nombre que ya tiene la ficha', () => {
    expect(separarApellidosNombres(' PAREDES JOHAN MARIO', 2)).toEqual({ lastName: 'PAREDES', firstName: 'JOHAN MARIO' });
    expect(separarApellidosNombres('MALDONADO CONTRERAS BENITA', 1)).toEqual({ lastName: 'MALDONADO CONTRERAS', firstName: 'BENITA' });
  });

  it('compara nombres sin importar orden ni tildes', () => {
    expect(mismoNombre('LISBETH LLANOS RAMÍREZ', 'LLANOS RAMIREZ LISBETH')).toBe(true);
    expect(mismoNombre('BENITA MALDONADO CONTRERA', 'MALDONADO CONTRERAS BENITA')).toBe(false);
  });

  it('reconoce el mismo cargo escrito de otra forma', () => {
    expect(claveCargo('Tec. Electricista')).toBe(claveCargo('TECNICO ELECTRICO'));
    expect(claveCargo('Jefe de Adm. Y Finanzas')).toBe(claveCargo('JEFE DE ADMINISTRACION Y FINANZAS'));
    expect(claveCargo('Jefe de Dpto.de Comerc.')).toBe(claveCargo('JEFE DE DPTO. DE COMERCIAL'));
    expect(claveCargo('Encargado(a) de Ventas')).toBe(claveCargo('ENCARGADO (A) DE VENTAS'));
    expect(claveCargo('Jefe Acondicionamiento Secundario')).toBe(claveCargo('JEFE DE ACONDICIONAMIENTO SECUNDARIO'));
    expect(claveCargo('Auxiiar de Almacenes')).toBe(claveCargo('AUXILIAR DE ALMACENES'));
    expect(claveCargo('Ejecutivos de ventas')).toBe(claveCargo('EJECUTIVO DE VENTAS'));
    expect(claveCargo('Jefe Recursos Humanos')).toBe(claveCargo('JEFE DE RRHH'));
    expect(nombreCargo('Enc./ de Asuntos Regulatorios')).toBe('ENCARGADO DE ASUNTOS REGULATORIOS');
    expect(nombreCargo('Auxiliar de validación')).toBe('AUXILIAR DE VALIDACION');
  });

  it('lee fechas mes/dia/año y filas completas', () => {
    expect(fechaNomina('3/25/2026')).toEqual(new Date(2026, 2, 25));
    expect(fechaNomina('13/1/2026')).toBeNull();
    expect(fechaNomina(new Date(Date.UTC(2005, 9, 3)))).toEqual(new Date(2005, 9, 3));
    expect(leerFila(['9001', 'X00000', '1234567', 'sc', 'M', 'PEREZ GOMEZ JUAN CARLOS', 'Regente Farmaceutico', '10/3/2005'])).toEqual({
      codigo: '9001',
      ci: '1234567',
      ciExtension: 'SC',
      sexo: 'M',
      nombreCompleto: 'PEREZ GOMEZ JUAN CARLOS',
      cargo: 'Regente Farmaceutico',
      ingreso: new Date(2005, 9, 3),
    });
    expect(leerFila(['Nª', 'CODIGO'])).toBeNull();
  });
});
