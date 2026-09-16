/**
 * Carga la nomina real de LABORATORIOS ABD LTDA a partir del cuadro de
 * vacaciones que lleva el Departamento de RR.HH.
 *
 * Del archivo salen: area, nombre, cargo, fecha de ingreso y los dias que
 * quedaron pendientes en cada gestion. De ahi se deduce cuantos dias tomo el
 * empleado en cada gestion (otorgados - pendientes), que es lo que se carga
 * como historico para que el sistema siga contando desde ahi.
 *
 * El archivo NO trae sueldos: los empleados se crean con haber basico 0 y
 * deben completarse antes de generar boletas.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'node:fs';
import { FieldCipher } from '../src/shared/infrastructure/security/FieldCipher';
import path from 'node:path';

const prisma = new PrismaClient();
const cipher = new FieldCipher();

interface FilaPlanilla {
  area: string;
  nro: number;
  nombre: string;
  cargo: string;
  fechaIngreso: string;
  porGestion: Record<string, number>;
  saldoDeclarado: number;
  saldoCalculado: number;
  cuadra: boolean;
}

/** Mismos tramos que usa el dominio; aqui solo para deducir lo tomado. */
function diasDeGestion(numero: number): number {
  if (numero > 10) return 30;
  if (numero > 5) return 20;
  return 15;
}

function partirNombre(completo: string): { nombres: string; apellidos: string } {
  const partes = completo.trim().split(/\s+/);
  if (partes.length <= 2) return { nombres: partes[0] ?? completo, apellidos: partes.slice(1).join(' ') || '-' };
  // Convencion boliviana: los dos ultimos suelen ser apellidos.
  return {
    nombres: partes.slice(0, partes.length - 2).join(' '),
    apellidos: partes.slice(-2).join(' '),
  };
}

async function main(): Promise<void> {
  const origen = process.argv[2];
  if (!origen) throw new Error('Uso: tsx prisma/import-abd.ts <ruta a vacaciones.json>');

  const filas: FilaPlanilla[] = JSON.parse(fs.readFileSync(path.resolve(origen), 'utf8'));
  console.log(`Filas leidas del cuadro de vacaciones: ${filas.length}`);

  // --- catalogos ---
  const areas = [...new Set(filas.map((f) => f.area))];
  const departamentos = new Map<string, string>();
  for (const area of areas) {
    const row = await prisma.department.upsert({
      where: { name: area },
      update: {},
      create: { name: area, description: 'Area del cuadro de vacaciones de RR.HH.' },
    });
    departamentos.set(area, row.id);
  }

  const cargos = [...new Set(filas.map((f) => f.cargo).filter(Boolean))];
  const posiciones = new Map<string, string>();
  for (const cargo of cargos) {
    const row = await prisma.position.upsert({ where: { name: cargo }, update: {}, create: { name: cargo } });
    posiciones.set(cargo, row.id);
  }
  console.log(`Departamentos: ${departamentos.size}  ·  Cargos: ${posiciones.size}`);

  // --- empleados y su historico de vacaciones ---
  let creados = 0;
  let actualizados = 0;
  let gestionesCargadas = 0;

  for (const [indice, fila] of filas.entries()) {
    const { nombres, apellidos } = partirNombre(fila.nombre);
    const codigo = `ABD-${String(indice + 1).padStart(4, '0')}`;
    const hireDate = new Date(fila.fechaIngreso + 'T00:00:00');

    // Sin C.I. en el archivo: se usa un marcador estable por codigo, que RRHH
    // debe reemplazar con la cedula real antes de emitir boletas.
    const ciProvisional = `SIN-CI-${String(indice + 1).padStart(4, '0')}`;

    const existente = await prisma.employee.findUnique({ where: { employeeCode: codigo } });
    const datos = {
      firstName: nombres,
      lastName: apellidos,
      hireDate,
      contractType: 'INDEFINIDO' as const,
      baseSalary: new Prisma.Decimal(0),
      departmentId: departamentos.get(fila.area) ?? null,
      positionId: fila.cargo ? posiciones.get(fila.cargo) ?? null : null,
    };

    const empleado = existente
      ? await prisma.employee.update({ where: { id: existente.id }, data: datos })
      : await prisma.employee.create({
          data: {
            ...datos,
            employeeCode: codigo,
            ci: cipher.cifrar(ciProvisional) ?? '',
            ciHuella: cipher.huella(ciProvisional),
          },
        });
    existente ? actualizados++ : creados++;

    // Historico por gestion: lo tomado se deduce de lo que quedo pendiente.
    const anioIngreso = hireDate.getFullYear();

    // El cuadro de RR.HH. solo muestra una ventana de gestiones (por ejemplo,
    // Produccion arranca en 2022-2023 aunque haya gente que ingreso en 2009).
    // El SALDO de la hoja es la verdad: por lo tanto todo lo anterior a la
    // primera columna mostrada se da por saldado, o el sistema acumularia
    // gestiones que la empresa ya dio por cerradas.
    const anios = Object.keys(fila.porGestion).map((e) => Number(e.split('-')[0]));
    const primeraGestionEnHoja = anios.length ? Math.min(...anios) : anioIngreso;

    for (let anio = anioIngreso; anio < primeraGestionEnHoja; anio++) {
      const numero = anio - anioIngreso + 1;
      const otorgados = diasDeGestion(numero);
      await prisma.vacationBalance.upsert({
        where: { employeeId_periodYear: { employeeId: empleado.id, periodYear: anio } },
        update: { entitledDays: new Prisma.Decimal(otorgados), takenDays: new Prisma.Decimal(otorgados) },
        create: {
          employeeId: empleado.id,
          periodYear: anio,
          entitledDays: new Prisma.Decimal(otorgados),
          takenDays: new Prisma.Decimal(otorgados),
        },
      });
      gestionesCargadas++;
    }

    for (const [etiqueta, pendientes] of Object.entries(fila.porGestion)) {
      const anioInicio = Number(etiqueta.split('-')[0]);
      const numero = anioInicio - anioIngreso + 1;
      if (numero < 1) continue; // columna anterior al ingreso: dato inconsistente de la hoja

      const otorgados = diasDeGestion(numero);
      const tomados = Math.max(0, otorgados - pendientes);

      await prisma.vacationBalance.upsert({
        where: { employeeId_periodYear: { employeeId: empleado.id, periodYear: anioInicio } },
        update: {
          entitledDays: new Prisma.Decimal(otorgados),
          takenDays: new Prisma.Decimal(tomados),
        },
        create: {
          employeeId: empleado.id,
          periodYear: anioInicio,
          entitledDays: new Prisma.Decimal(otorgados),
          takenDays: new Prisma.Decimal(tomados),
        },
      });
      gestionesCargadas++;
    }
  }

  console.log(`Empleados creados: ${creados}  ·  actualizados: ${actualizados}`);
  console.log(`Gestiones historicas cargadas: ${gestionesCargadas}`);

  const totalSaldoHoja = filas.reduce((acc, f) => acc + f.saldoDeclarado, 0);
  console.log(`Saldo total segun la hoja de RR.HH.: ${totalSaldoHoja} dias`);
  console.log('\nPendiente de completar por RRHH: cedula de identidad y haber basico de cada empleado.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
