import * as Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  API_PORT: Joi.number().port().default(3000),

  FRONTEND_URL: Joi.string()
    .uri()
    .default('http://localhost:4200'),

  DATABASE_URL: Joi.string()
    .required(),

  REDIS_HOST: Joi.string()
    .default('localhost'),

  REDIS_PORT: Joi.number()
    .port()
    .default(6379),

  REDIS_PASSWORD: Joi.string()
    .allow('')
    .optional(),

  REDIS_DB: Joi.number()
    .integer()
    .min(0)
    .default(0),

  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .required(),

  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .default('15m'),

  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required(),

  JWT_ACCESS_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(900),

  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .default('7d'),

  JWT_REFRESH_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(2592000),

  TOKEN_ENCRYPTION_KEY: Joi.string()
    .min(32)
    .required(),

  SCANNER_WORKSPACE_ROOT: Joi.string()
    .default('./storage/workspaces'),

  SCANNER_MAX_REPOSITORY_SIZE_MB: Joi.number()
    .positive()
    .default(500),

  SCANNER_MAX_FILE_SIZE_MB: Joi.number()
    .positive()
    .default(10),

  SCANNER_TIMEOUT_SECONDS: Joi.number()
    .positive()
    .default(900),

  SCANNER_MAX_CONCURRENT_JOBS: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(2),

  GITHUB_APP_ID: Joi.string()
    .allow('')
    .optional(),

  GITHUB_CLIENT_ID: Joi.string()
    .allow('')
    .optional(),

  GITHUB_CLIENT_SECRET: Joi.string()
    .allow('')
    .optional(),

  GITHUB_APP_PRIVATE_KEY_BASE64: Joi.string()
    .allow('')
    .optional(),

  GITHUB_WEBHOOK_SECRET: Joi.string()
    .allow('')
    .optional(),

  GITLAB_CLIENT_ID: Joi.string()
    .allow('')
    .optional(),

  GITLAB_CLIENT_SECRET: Joi.string()
    .allow('')
    .optional(),

  GITLAB_REDIRECT_URI: Joi.string()
    .uri()
    .allow('')
    .optional(),

  GITLAB_WEBHOOK_SECRET: Joi.string()
    .allow('')
    .optional(),
});
