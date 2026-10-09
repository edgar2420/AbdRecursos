/**
 * Aplica la "NOMINA PARA EL BIOMETRICO" de RRHH (xlsx o csv) desde la consola.
 * Es lo mismo que hace la pantalla Importaciones > Nomina del biometrico; sirve
 * para cargas iniciales o cuando el sistema no esta levantado.
 *
 * Uso:  npx tsx prisma/import-nomina-biometrico.ts <nomina.xlsx|nomina.csv>            (solo muestra)
 *       npx tsx prisma/import-nomina-biometrico.ts <nomina.xlsx|nomina.csv> --aplicar  (guarda)
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/shared/infrastructure/database/prisma';
import { planificarNomina } from '../src/modules/imports/domain/nominaBiometrico';
import { leerNomina } from '../src/modules/imports/infrastructure/nomina/leerNomina';
import { PrismaNominaRepository } from '../src/modules/imports/infrastructure/nomina/PrismaNominaRepository';

async function main(): Promise<void> {
  const archivo = process.argv[2];
  const aplicar = process.argv.includes('--aplicar');
  if (!archivo) throw new Error('Uso: npx tsx prisma/import-nomina-biometrico.ts <nomina.xlsx|csv> [--aplicar]');

  const repo = new PrismaNominaRepository();
  const filas = await leerNomina(fs.readFileSync(path.resolve(archivo)), archivo);
  const [fichas, cargos] = await Promise.all([repo.fichas(), repo.cargos()]);
  const plan = planificarNomina(filas, fichas, cargos, (ci) => repo.huella(ci));
  const { resumen } = plan;

  console.log(`Filas validas en la nomina: ${plan.filas}`);
  console.log(`Fichas que se actualizan: ${plan.cambios.length}`);
  console.log(`  nombres: ${resumen.nombre} | C.I.: ${resumen.ci} | fecha de ingreso: ${resumen.ingreso} | cargo: ${resumen.cargo} | sexo completado: ${resumen.sexo}`);
  console.log(`Cargos nuevos (${plan.cargosNuevos.length}): ${plan.cargosNuevos.join(', ') || 'ninguno'}`);
  console.log(`En la nomina sin ficha: ${plan.sinFicha.map((f) => `${f.codigo} ${f.nombre}`).join('; ') || 'ninguno'}`);
  console.log(`Fichas activas fuera de la nomina (${plan.fueraDeNomina.length}): ${plan.fueraDeNomina.map((f) => `${f.codigo} ${f.nombre}`).join('; ')}`);
  plan.avisos.forEach((a) => console.log(`  aviso: ${a}`));

  if (!aplicar) {
    console.log('\nNo se guardo nada. Para aplicar los cambios agregue --aplicar');
    return;
  }
  await repo.aplicar(plan.cambios, plan.cargosNuevos);
  await prisma.auditLog.create({
    data: {
      action: 'IMPORT_NOMINA_BIOMETRICO',
      entity: 'Employee',
      changes: { archivo: path.basename(archivo), fichas: plan.cambios.length, ...resumen, cargosNuevos: plan.cargosNuevos },
    },
  });
  console.log('\nCambios guardados.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
