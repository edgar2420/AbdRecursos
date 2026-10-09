import os from 'node:os';
import { prisma } from '../database/prisma';

/**
 * Candado en la base para tareas en segundo plano (sincronizacion con ZKBio, limpiezas).
 * Con varios servidores levantados, solo el que toma el candado ejecuta la tarea; si ese
 * servidor se cae, el candado vence solo y otro la retoma.
 */
export class CandadoTareas {
  readonly duenio = `${os.hostname()}:${process.pid}`;

  async tomar(nombre: string, duracionMs: number): Promise<boolean> {
    const filas = await prisma.$queryRaw<{ nombre: string }[]>`
      INSERT INTO candados_tareas (nombre, duenio, hasta)
      VALUES (${nombre}, ${this.duenio}, now() + (${duracionMs} * interval '1 millisecond'))
      ON CONFLICT (nombre) DO UPDATE
        SET duenio = EXCLUDED.duenio, hasta = EXCLUDED.hasta
        WHERE candados_tareas.hasta < now() OR candados_tareas.duenio = EXCLUDED.duenio
      RETURNING nombre`;
    return filas.length > 0;
  }

  async soltar(nombre: string): Promise<void> {
    await prisma.$executeRaw`UPDATE candados_tareas SET hasta = now() WHERE nombre = ${nombre} AND duenio = ${this.duenio}`;
  }

  /** Ejecuta la tarea solo si este servidor obtiene el candado. Devuelve null si otro la esta corriendo. */
  async ejecutar<T>(nombre: string, duracionMs: number, tarea: () => Promise<T>): Promise<T | null> {
    if (!(await this.tomar(nombre, duracionMs))) return null;
    try {
      return await tarea();
    } finally {
      await this.soltar(nombre).catch(() => undefined);
    }
  }
}
