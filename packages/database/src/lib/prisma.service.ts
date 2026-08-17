import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this['$connect']();

      this.logger.log('Connexion PostgreSQL établie');
    } catch (error: unknown) {
      this.logger.error(
        'Impossible de se connecter à PostgreSQL',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this['$disconnect']();

      this.logger.log('Connexion PostgreSQL fermée');
    } catch (error: unknown) {
      this.logger.error(
        'Erreur pendant la déconnexion de PostgreSQL',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this['$queryRaw']`SELECT 1`;

      return true;
    } catch (error: unknown) {
      this.logger.error(
        'La vérification PostgreSQL a échoué',
        error instanceof Error ? error.stack : String(error),
      );

      return false;
    }
  }
}
