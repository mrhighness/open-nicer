import { readFileSync, readdirSync } from "fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
    console.log(`Applying ${file}...`);
    await client.query(sql);
    console.log(`  OK`);
  }
  console.log("All migrations applied.");
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
