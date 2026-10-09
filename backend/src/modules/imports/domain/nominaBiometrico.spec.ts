import { describe, expect, it } from 'vitest';
import {
  FichaActual,
  FilaNomina,
  claveCargo,
  fechaNomina,
  leerFila,
  mismoNombre,
  nombreCargo,
  planificarNomina,
  separarApellidosNombres,
} from './nominaBiometrico';

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
    // Excel deja huecos en las celdas vacias: la expedicion vacia no debe leerse como "UNDEFINED"
    const conHueco: unknown[] = ['9002', 'X00001', '7654321'];
    conHueco[4] = 'F';
    conHueco[5] = 'ROJAS ANA';
    conHueco[6] = 'Operario';
    conHueco[7] = '1/5/2020';
    expect(leerFila(conHueco)?.ciExtension).toBeNull();
  });

  describe('plan de cambios', () => {
    const huella = (ci: string) => `h-${ci}`;
    const fila = (cambios: Partial<FilaNomina> = {}): FilaNomina => ({
      codigo: '10',
      ci: '1234567',
      ciExtension: 'SC',
      sexo: 'F',
      nombreCompleto: 'PEREZ GOMEZ ANA MARIA',
      cargo: 'Tec. Electricista',
      ingreso: new Date(2015, 4, 20),
      ...cambios,
    });
    const ficha = (cambios: Partial<FichaActual> = {}): FichaActual => ({
      id: 'e10',
      codigo: '10',
      firstName: 'ANA MARIA',
      lastName: 'PÉREZ GOMEZ',
      ciHuella: 'h-1234567',
      ciExtension: 'SC',
      hireDate: new Date(2015, 4, 20),
      gender: 'F',
      cargo: 'TECNICO ELECTRICO',
      isActive: true,
      ...cambios,
    });

    it('no propone nada si la ficha ya coincide (sin importar tildes ni como se escribe el cargo)', () => {
      const plan = planificarNomina([fila()], [ficha()], ['TECNICO ELECTRICO'], huella);
      expect(plan.cambios).toEqual([]);
      expect(plan.cargosNuevos).toEqual([]);
    });

    it('completa una ficha que vino del reloj sin datos', () => {
      const plan = planificarNomina(
        [fila({ cargo: 'Portero' })],
        [ficha({ firstName: 'Nombre a corregir', lastName: 'Biometrico 10', ciHuella: null, ciExtension: null, hireDate: new Date(2026, 7, 21), gender: null, cargo: null })],
        ['TECNICO ELECTRICO'],
        huella,
      );
      expect(plan.cambios).toHaveLength(1);
      expect(plan.cambios[0].datos).toEqual({
        firstName: 'ANA MARIA',
        lastName: 'PEREZ GOMEZ',
        ci: '1234567',
        ciHuella: 'h-1234567',
        ciExtension: 'SC',
        hireDate: new Date(2015, 4, 20),
        gender: 'F',
        cargo: 'PORTERO',
      });
      expect(plan.cambios[0].campos.find((c) => c.campo === 'ingreso')).toEqual({ campo: 'ingreso', antes: '21/08/2026', despues: '20/05/2015' });
      expect(plan.resumen).toEqual({ nombre: 1, ci: 1, ingreso: 1, cargo: 1, sexo: 1 });
      expect(plan.cargosNuevos).toEqual(['PORTERO']);
    });

    it('no pisa el sexo de la ficha y avisa la diferencia', () => {
      const plan = planificarNomina([fila({ sexo: 'M' })], [ficha()], ['TECNICO ELECTRICO'], huella);
      expect(plan.cambios).toEqual([]);
      expect(plan.avisos[0]).toContain('sexo F en la ficha y M en la nomina');
    });

    it('no repite una C.I. que ya tiene otra ficha', () => {
      const plan = planificarNomina(
        [fila({ codigo: '11', ci: '1234567' })],
        [ficha(), ficha({ id: 'e11', codigo: '11', ciHuella: null, ciExtension: null })],
        ['TECNICO ELECTRICO'],
        huella,
      );
      expect(plan.cambios.flatMap((c) => c.campos.map((x) => x.campo))).not.toContain('ci');
      expect(plan.avisos[0]).toContain('ya pertenece a la ficha 10');
    });

    it('lista los que no cruzan en los dos sentidos y rechaza codigos repetidos', () => {
      const plan = planificarNomina([fila({ codigo: '99' })], [ficha()], [], huella);
      expect(plan.sinFicha).toEqual([{ codigo: '99', nombre: 'PEREZ GOMEZ ANA MARIA', cargo: 'Tec. Electricista' }]);
      expect(plan.fueraDeNomina).toEqual([{ employeeId: 'e10', codigo: '10', nombre: 'ANA MARIA PÉREZ GOMEZ' }]);
      expect(() => planificarNomina([fila(), fila({ ci: '7654321' })], [], [], huella)).toThrow('Codigos repetidos');
    });
  });
});
