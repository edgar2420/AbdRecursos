/**
 * Aplica la "NOMINA PARA EL BIOMETRICO" de RRHH (xlsx o csv) sobre las fichas del SGRH.
 *
 * La nomina es la fuente oficial de: C.I. y expedicion, nombre y apellidos, cargo y fecha
 * de ingreso. El sexo solo se completa si la ficha no lo tiene (si difiere se informa).
 * Los empleados se buscan por el codigo del reloj; no se crean ni se dan de baja fichas:
 * los que no cruzan se listan para revisarlos a mano.
 *
 * Uso:  npx tsx prisma/import-nomina-biometrico.ts <nomina.xlsx|nomina.csv>            (solo muestra)
 *       npx tsx prisma/import-nomina-biometrico.ts <nomina.xlsx|nomina.csv> --aplicar  (guarda)
 */
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { FieldCipher } from '../src/shared/infrastructure/security/FieldCipher';
import { NOMBRE_A_CORREGIR } from '../src/modules/integrations/zkbio/domain/nombres';
import {
  FilaNomina,
  claveCargo,
  leerFila,
  mismoNombre,
  nombreCargo,
  separarApellidosNombres,
} from '../src/modules/imports/domain/nominaBiometrico';

const prisma = new PrismaClient();
const cipher = new FieldCipher();

function valorCelda(valor: ExcelJS.CellValue): unknown {
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    if ('result' in valor) return valor.result;
    if ('richText' in valor) return valor.richText.map((t) => t.text).join('');
    if ('text' in valor) return valor.text;
  }
  return valor;
}

/** Filas a partir de la columna CODIGO (la columna N no se usa). */
async function leerArchivo(archivo: string): Promise<unknown[][]> {
  if (archivo.toLowerCase().endsWith('.csv')) {
    return fs
      .readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .map((linea) => linea.split(',').slice(1));
  }
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(archivo);
  const filas: unknown[][] = [];
  for (const hoja of libro.worksheets) {
    let columnaCodigo = 0;
    hoja.eachRow((fila) => {
      const celdas = (fila.values as ExcelJS.CellValue[]).map(valorCelda);
      if (!columnaCodigo) {
        const i = celdas.findIndex((c) => String(c ?? '').trim().toUpperCase() === 'CODIGO');
        if (i > 0) columnaCodigo = i;
        return;
      }
      filas.push(celdas.slice(columnaCodigo, columnaCodigo + 8));
    });
  }
  return filas;
}

async function main(): Promise<void> {
  const archivo = process.argv[2];
  const aplicar = process.argv.includes('--aplicar');
  if (!archivo) throw new Error('Uso: npx tsx prisma/import-nomina-biometrico.ts <nomina.xlsx|csv> [--aplicar]');

  const filas = (await leerArchivo(path.resolve(archivo))).map(leerFila).filter((f): f is FilaNomina => f !== null);
  const repetidos = filas.map((f) => f.codigo).filter((c, i, todos) => todos.indexOf(c) !== i);
  if (repetidos.length) throw new Error(`Codigos repetidos en la nomina: ${repetidos.join(', ')}`);
  const ciRepetidas = filas.map((f) => f.ci).filter((c, i, todos) => todos.indexOf(c) !== i);
  if (ciRepetidas.length) throw new Error(`C.I. repetidas en la nomina: ${ciRepetidas.join(', ')}`);
  console.log(`Filas validas en la nomina: ${filas.length}`);

  const empleados = await prisma.employee.findMany({ include: { position: true } });
  const porCodigo = new Map(empleados.map((e) => [e.employeeCode, e]));
  const huellas = new Map(empleados.filter((e) => e.ciHuella).map((e) => [e.ciHuella!, e.employeeCode]));

  const cargos = new Map((await prisma.position.findMany()).map((p) => [claveCargo(p.name), p]));
  const cargosNuevos = new Map<string, string>();
  for (const f of filas) {
    const clave = claveCargo(f.cargo);
    if (clave && !cargos.has(clave)) cargosNuevos.set(clave, nombreCargo(f.cargo));
  }

  const cambios = { nombres: 0, ci: 0, ingreso: 0, cargo: 0, sexo: 0 };
  const avisos: string[] = [];
  const operaciones: { id: string; data: Record<string, unknown>; cargoClave?: string }[] = [];

  for (const f of filas) {
    const e = porCodigo.get(f.codigo);
    if (!e) continue;
    const data: Record<string, unknown> = {};

    const completo = `${e.firstName} ${e.lastName}`;
    if (e.firstName === NOMBRE_A_CORREGIR || !mismoNombre(completo, f.nombreCompleto)) {
      const palabras = e.firstName === NOMBRE_A_CORREGIR ? undefined : e.firstName.trim().split(/\s+/).length;
      const { firstName, lastName } = separarApellidosNombres(f.nombreCompleto, palabras);
      data.firstName = firstName;
      data.lastName = lastName;
      cambios.nombres++;
      if (e.firstName !== NOMBRE_A_CORREGIR) avisos.push(`${f.codigo}: nombre "${completo}" -> "${firstName} ${lastName}"`);
    }

    const huella = cipher.huella(f.ci);
    const duenoHuella = huellas.get(huella);
    if (duenoHuella && duenoHuella !== f.codigo) {
      avisos.push(`${f.codigo}: la C.I. ${f.ci} ya la tiene la ficha ${duenoHuella}; no se cambia`);
    } else if (e.ciHuella !== huella || e.ciExtension !== f.ciExtension) {
      data.ci = cipher.cifrar(f.ci);
      data.ciHuella = huella;
      data.ciExtension = f.ciExtension;
      huellas.set(huella, f.codigo);
      cambios.ci++;
    }

    if (e.hireDate.getTime() !== f.ingreso.getTime()) {
      data.hireDate = f.ingreso;
      cambios.ingreso++;
    }

    if (f.sexo && !e.gender) {
      data.gender = f.sexo;
      cambios.sexo++;
    } else if (f.sexo && e.gender !== f.sexo) {
      avisos.push(`${f.codigo} ${f.nombreCompleto}: sexo ${e.gender} en la ficha y ${f.sexo} en la nomina; se deja ${e.gender}`);
    }

    const clave = claveCargo(f.cargo);
    const cargoActual = e.position ? claveCargo(e.position.name) : '';
    if (clave && clave !== cargoActual) cambios.cargo++;

    if (Object.keys(data).length || (clave && clave !== cargoActual)) {
      operaciones.push({ id: e.id, data, cargoClave: clave && clave !== cargoActual ? clave : undefined });
    }
  }

  const sinFicha = filas.filter((f) => !porCodigo.has(f.codigo));
  const enNomina = new Set(filas.map((f) => f.codigo));
  const fueraDeNomina = empleados.filter((e) => e.isActive && !enNomina.has(e.employeeCode));

  console.log(`Fichas que se actualizan: ${operaciones.length}`);
  console.log(`  nombres: ${cambios.nombres} | C.I.: ${cambios.ci} | fecha de ingreso: ${cambios.ingreso} | cargo: ${cambios.cargo} | sexo completado: ${cambios.sexo}`);
  console.log(`Cargos nuevos en el catalogo (${cargosNuevos.size}): ${[...cargosNuevos.values()].join(', ') || 'ninguno'}`);
  console.log(`En la nomina pero sin ficha (no estan en el reloj): ${sinFicha.map((f) => `${f.codigo} ${f.nombreCompleto}`).join('; ') || 'ninguno'}`);
  console.log(`Fichas activas que no estan en la nomina (${fueraDeNomina.length}): ${fueraDeNomina.map((e) => `${e.employeeCode} ${e.firstName} ${e.lastName}`).join('; ')}`);
  avisos.forEach((a) => console.log(`  aviso: ${a}`));

  if (!aplicar) {
    console.log('\nNo se guardo nada. Para aplicar los cambios agregue --aplicar');
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const [clave, nombre] of cargosNuevos) {
        cargos.set(clave, await tx.position.create({ data: { name: nombre } }));
      }
      for (const op of operaciones) {
        const data = { ...op.data } as Record<string, unknown>;
        if (op.cargoClave) data.position = { connect: { id: cargos.get(op.cargoClave)!.id } };
        await tx.employee.update({ where: { id: op.id }, data });
      }
      await tx.auditLog.create({
        data: {
          action: 'IMPORT_NOMINA_BIOMETRICO',
          entity: 'Employee',
          changes: { archivo: path.basename(archivo), fichas: operaciones.length, ...cambios, cargosNuevos: [...cargosNuevos.values()] },
        },
      });
    },
    { timeout: 120_000 },
  );
  console.log('\nCambios guardados.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
