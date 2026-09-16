import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/** Unico punto de acceso al cliente Prisma. Solo la capa de persistencia lo importa. */
export const prisma = new PrismaClient({
  log: env.isProduction ? ['warn', 'error'] : ['warn', 'error'],
});

export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
