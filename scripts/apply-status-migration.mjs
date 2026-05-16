import { readFileSync } from "fs";
import { execSync } from "child_process";
import dns from "dns";
import { resolve6 } from "dns/promises";
import pg from "pg";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

function resolveDbHost(hostname) {
  return resolve6(hostname).then(([ip]) => ip).catch(() => {
    const out = execSync(`nslookup ${hostname} 8.8.8.8`, { encoding: "utf8" });
    const matches = [...out.matchAll(/Address:\s*([0-9a-f:]+)/gi)].map((m) => m[1]);
    const ipv6 = matches.find((a) => a.includes(":"));
    if (!ipv6) throw new Error(`Could not resolve ${hostname}`);
    return ipv6;
  });
}

function loadEnv() {
  const out = {};
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function parsePgUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "postgres",
  };
}

const env = loadEnv();
const url = env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env");
  process.exit(1);
}

const cfg = parsePgUrl(url);
const projectRef = cfg.host.replace(/^db\./, "").replace(/\.supabase\.co$/, "");

const POOLER_REGIONS = [
  "us-east-1",
  "us-west-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
  "ap-south-1",
  "sa-east-1",
];

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["supabase/migrations/20260516120000_status_updates.sql"];

async function connectClient() {
  const attempts = [
    { label: "direct IPv6", host: await resolveDbHost(cfg.host), port: cfg.port, user: cfg.user, servername: cfg.host },
    ...POOLER_REGIONS.map((r) => ({
      label: `pooler ${r}`,
      host: `aws-0-${r}.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${projectRef}`,
      servername: `aws-0-${r}.pooler.supabase.com`,
    })),
  ];

  let lastErr;
  for (const a of attempts) {
    const client = new pg.Client({
      host: a.host,
      port: a.port,
      user: a.user,
      password: cfg.password,
      database: cfg.database,
      ssl: { rejectUnauthorized: false, servername: a.servername },
      connectionTimeoutMillis: 12_000,
    });
    try {
      console.log(`Trying ${a.label} (${a.host})…`);
      await client.connect();
      return client;
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => {});
    }
  }
  throw lastErr ?? new Error("Could not connect to database");
}

const client = await connectClient();

try {
  for (const file of files) {
    const sql = readFileSync(file, "utf8");
    console.log(`Applying ${file}…`);
    await client.query(sql);
    console.log(`  OK`);
  }
  console.log("Migration(s) applied successfully.");
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
