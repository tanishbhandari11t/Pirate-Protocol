export interface AppEnv {
  DATABASE_URL: string;
  APP_SECRET: string;
  PORT: number;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || !databaseUrl.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a postgresql:// connection string');
  }

  const secret = config.APP_SECRET;
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('APP_SECRET must be at least 16 characters');
  }

  const port = config.PORT === undefined || config.PORT === '' ? 3000 : Number(config.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return { DATABASE_URL: databaseUrl, APP_SECRET: secret, PORT: port };
}
