// Loads medicine rows into the "medicines" table.
//
//   pnpm --filter @workspace/db run seed                    # sample rows in data/medicines.seed.json
//   pnpm --filter @workspace/db run seed -- ./my-rows.csv   # your verified rows (CSV, see data/medicines.template.csv)
//
// Requires DATABASE_URL. Run the schema push first: pnpm --filter @workspace/db run push
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputArg = process.argv.slice(2).find((arg) => arg !== "--");
const inputPath = inputArg ? path.resolve(process.cwd(), inputArg) : path.resolve(here, "../data/medicines.seed.json");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
  const [headerLine, ...body] = lines;
  const headers = headerLine.split(",").map((h) => h.trim());
  return body.map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    return {
      salt: row.salt,
      category: row.category,
      coverage: row.coverage ?? "",
      brand: row.brand,
      manufacturer: row.manufacturer,
      mrp: Number(row.mrp),
      isGeneric: String(row.isGeneric).toLowerCase() === "true",
      source: row.source,
      capturedOn: row.capturedOn,
    };
  });
}

const raw = readFileSync(inputPath, "utf8");
const rows = inputPath.endsWith(".csv") ? parseCsv(raw) : JSON.parse(raw);

for (const [index, row] of rows.entries()) {
  if (!row.salt || !row.brand || !row.manufacturer || !Number.isFinite(row.mrp) || !row.source || !row.capturedOn) {
    console.error(`Row ${index + 1} is incomplete or has an invalid price:`, row);
    process.exit(1);
  }
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  for (const row of rows) {
    await client.query(
      `insert into medicines (salt, category, coverage, brand, manufacturer, mrp, is_generic, source, captured_on)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict on constraint medicines_salt_brand_manufacturer_key
       do update set category = excluded.category, coverage = excluded.coverage, mrp = excluded.mrp,
                     is_generic = excluded.is_generic, source = excluded.source, captured_on = excluded.captured_on`,
      [row.salt, row.category, row.coverage, row.brand, row.manufacturer, row.mrp, row.isGeneric, row.source, row.capturedOn],
    );
  }
  await client.query("COMMIT");
  console.log(`Loaded ${rows.length} rows from ${path.relative(process.cwd(), inputPath)}.`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Seed failed, nothing was saved:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
