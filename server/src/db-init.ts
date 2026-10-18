import { Pool } from "pg";
import { databaseUrlOptions } from "./runtime-config.js";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new Pool({
      ...databaseUrlOptions(connectionString, process.env.DATABASE_SSL === "false"),
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || "postgres",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || "varta_secure_free_db_pass_2026",
    });

async function main() {
  console.log("[db-init] Connecting to database...");
  const client = await pool.connect();
  try {
    const schemaPath = join(__dirname, "../../supabase/migrations/000_schema.sql");
    console.log("[db-init] Reading schema from", schemaPath);
    const sql = readFileSync(schemaPath, "utf-8");
    console.log("[db-init] Executing schema SQL...");
    await client.query(sql);
    console.log("[db-init] Database initialized successfully! All tables ready.");
  } catch (err) {
    console.error("[db-init] Error initializing database:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
