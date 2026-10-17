import pg from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('Falta la variable de entorno DATABASE_URL');
  }
  return new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}
