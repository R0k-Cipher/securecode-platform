export interface ApplicationConfiguration {
  app: {
    environment: string;
    port: number;
    frontendUrl: string;
  };

  database: {
    url: string;
  };

  redis: {
    host: string;
    port: number;
    password?: string;
    database: number;
  };

  security: {
    jwtAccessSecret: string;
    jwtAccessExpiresIn: string;
    jwtRefreshSecret: string;
    jwtRefreshExpiresIn: string;
    tokenEncryptionKey: string;
  };

  scanner: {
    workspaceRoot: string;
    maxRepositorySizeMb: number;
    maxFileSizeMb: number;
    timeoutSeconds: number;
    maxConcurrentJobs: number;
  };
}

export default (): ApplicationConfiguration => ({
  app: {
    environment: process.env['NODE_ENV'] ?? 'development',
    port: Number(process.env['API_PORT'] ?? 3000),
    frontendUrl:
      process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
  },

  database: {
    url: process.env['DATABASE_URL'] ?? '',
  },

  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number(process.env['REDIS_PORT'] ?? 6379),
    password: process.env['REDIS_PASSWORD'] || undefined,
    database: Number(process.env['REDIS_DB'] ?? 0),
  },

  security: {
    jwtAccessSecret: process.env['JWT_ACCESS_SECRET'] ?? '',
    jwtAccessExpiresIn:
      process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
    jwtRefreshSecret:
      process.env['JWT_REFRESH_SECRET'] ?? '',
    jwtRefreshExpiresIn:
      process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
    tokenEncryptionKey:
      process.env['TOKEN_ENCRYPTION_KEY'] ?? '',
  },

  scanner: {
    workspaceRoot:
      process.env['SCANNER_WORKSPACE_ROOT'] ??
      './storage/workspaces',

    maxRepositorySizeMb: Number(
      process.env['SCANNER_MAX_REPOSITORY_SIZE_MB'] ?? 500,
    ),

    maxFileSizeMb: Number(
      process.env['SCANNER_MAX_FILE_SIZE_MB'] ?? 10,
    ),

    timeoutSeconds: Number(
      process.env['SCANNER_TIMEOUT_SECONDS'] ?? 900,
    ),

    maxConcurrentJobs: Number(
      process.env['SCANNER_MAX_CONCURRENT_JOBS'] ?? 2,
    ),
  },
});
