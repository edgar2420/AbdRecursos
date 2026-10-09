import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { AccesoEmpleadoPort } from '../../domain/ports/AccesoEmpleadoPort';

export class PrismaAccesoEmpleado implements AccesoEmpleadoPort {
  async bloquear(employeeId: string): Promise<boolean> {
    const usuario = await prisma.user.findUnique({ where: { employeeId }, select: { id: true } });
    if (!usuario) return false;
    await prisma.$transaction([
      prisma.user.update({ where: { id: usuario.id }, data: { isActive: false } }),
      prisma.refreshToken.updateMany({ where: { userId: usuario.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return true;
  }

  async habilitar(employeeId: string): Promise<boolean> {
    const usuario = await prisma.user.findUnique({ where: { employeeId }, select: { id: true } });
    if (!usuario) return false;
    await prisma.user.update({ where: { id: usuario.id }, data: { isActive: true } });
    return true;
  }
}
