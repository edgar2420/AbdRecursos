import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { FieldCipher } from '../../../../shared/infrastructure/security/FieldCipher';
import { NominaRepository } from '../../domain/NominaRepository';
import { CambioFicha, FichaActual } from '../../domain/nominaBiometrico';

export class PrismaNominaRepository implements NominaRepository {
  constructor(private readonly cipher = new FieldCipher()) {}

  huella(ci: string): string {
    return this.cipher.huella(ci);
  }

  async fichas(): Promise<FichaActual[]> {
    const filas = await prisma.employee.findMany({
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        ciHuella: true,
        ciExtension: true,
        hireDate: true,
        gender: true,
        isActive: true,
        position: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
    return filas
      .filter((f) => /^\d+$/.test(f.employeeCode))
      .map((f) => ({
        id: f.id,
        codigo: f.employeeCode,
        firstName: f.firstName,
        lastName: f.lastName,
        ciHuella: f.ciHuella,
        ciExtension: f.ciExtension,
        hireDate: f.hireDate,
        gender: f.gender,
        cargo: f.position?.name ?? null,
        departamento: f.department?.name ?? null,
        isActive: f.isActive,
      }));
  }

  async cargos(): Promise<string[]> {
    return (await prisma.position.findMany({ select: { name: true } })).map((p) => p.name);
  }

  async aplicar(cambios: CambioFicha[], cargosNuevos: string[]): Promise<void> {
    await prisma.$transaction(
      async (tx) => {
        for (const nombre of cargosNuevos) {
          await tx.position.upsert({ where: { name: nombre }, update: {}, create: { name: nombre } });
        }
        const cargos = new Map((await tx.position.findMany({ select: { id: true, name: true } })).map((p) => [p.name, p.id]));

        for (const { employeeId, datos } of cambios) {
          const data: Prisma.EmployeeUpdateInput = {};
          if (datos.firstName) data.firstName = datos.firstName;
          if (datos.lastName) data.lastName = datos.lastName;
          if (datos.ci) {
            data.ci = this.cipher.cifrar(datos.ci) ?? '';
            data.ciHuella = datos.ciHuella;
            data.ciExtension = datos.ciExtension ?? null;
          }
          if (datos.hireDate) data.hireDate = datos.hireDate;
          if (datos.gender) data.gender = datos.gender;
          if (datos.cargo) data.position = { connect: { id: cargos.get(datos.cargo)! } };
          await tx.employee.update({ where: { id: employeeId }, data });
        }
      },
      { timeout: 120_000 },
    );
  }
}
