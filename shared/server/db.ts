// Server-only MySQL connection pool.
// Import this only from API routes / server code, never from client components.
import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "e201_fms",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
    });

    // IMPORTANT: with `dateStrings: true`, mysql2's `timezone` config option
    // has NO effect on returned values — it only controls conversion to JS
    // Date objects, which we're bypassing. The only way to control what
    // timezone TIMESTAMP columns come back as is the session's own
    // `time_zone`. Set it explicitly on every new pooled connection so we
    // always get UTC strings back, regardless of the MySQL server's own
    // default (dev is commonly `SYSTEM` = local OS tz; Railway is commonly
    // UTC — they don't have to agree, so we pin both to UTC ourselves).
    pool.on("connection", (connection) => {
      connection.query("SET time_zone = '+00:00'");
    });
  }
  return pool;
}

/** Run a SELECT and get back just the rows, typed as T[]. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params as any[]);
  return rows as T[];
}

/** Run an INSERT/UPDATE/DELETE and get back the result header (affectedRows, etc.). */
export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await getPool().execute(sql, params as any[]);
  return result as ResultSetHeader;
}

/** Run several statements against the same connection inside a transaction. */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
