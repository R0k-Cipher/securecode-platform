import { PrismaClient } from '@prisma/client';

import { seedRbac } from './seeds/rbac.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Démarrage du seed...');

  await seedRbac(prisma);

  console.log('Tous les seeds sont terminés.');
}

main()
  .catch((error: unknown) => {
    console.error('Erreur pendant le seed :', error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
