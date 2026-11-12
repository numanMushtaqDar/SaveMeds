import { Router, type IRouter } from "express";
import sampleRows from "../data/medicines.sample.json";

const router: IRouter = Router();

interface MedicineRow {
  salt: string;
  category: string;
  coverage: string;
  brand: string;
  manufacturer: string;
  mrp: number;
  isGeneric: boolean;
  source: string;
  capturedOn: string;
}

interface BrandRow {
  brand: string;
  manufacturer: string;
  mrp: number;
  isGeneric: boolean;
  source: string;
  capturedOn: string;
}

interface SaltGroup {
  salt: string;
  category: string;
  coverage: string;
  brands: BrandRow[];
}

/**
 * GET /api/medicines?query=&category=&salt=
 * Returns every salt with all of its brands and manufacturers.
 *  - query:    matches salt, brand, manufacturer, category or coverage (case-insensitive)
 *  - category: exact category name
 *  - salt:     exact salt name, e.g. "Amoxicillin 500 mg"
 *
 * Without DATABASE_URL the bundled sample rows are used, and each row's source starts with "SAMPLE".
 */
router.get("/medicines", async (req, res): Promise<void> => {
  let rows: MedicineRow[];
  if (!process.env["DATABASE_URL"]) {
    rows = sampleRows as MedicineRow[];
  } else {
    try {
      const database = await import("@workspace/db");
      rows = await database.db.select().from(database.medicines);
    } catch (error) {
      req.log.error({ err: error }, "Medicine database query failed");
      res.status(503).json({ error: "Medicine database is unavailable. Check DATABASE_URL and that the database is running." });
      return;
    }
  }

  const query = String(req.query["query"] ?? "").trim().toLowerCase();
  const category = String(req.query["category"] ?? "").trim();
  const salt = String(req.query["salt"] ?? "").trim();

  const groups = new Map<string, SaltGroup>();
  for (const row of rows) {
    if (salt && row.salt !== salt) continue;
    if (category && row.category !== category) continue;
    const haystack = `${row.salt} ${row.brand} ${row.manufacturer} ${row.category} ${row.coverage}`.toLowerCase();
    if (query && !haystack.includes(query)) continue;

    let group = groups.get(row.salt);
    if (!group) {
      group = { salt: row.salt, category: row.category, coverage: row.coverage, brands: [] };
      groups.set(row.salt, group);
    }
    group.brands.push({
      brand: row.brand,
      manufacturer: row.manufacturer,
      mrp: row.mrp,
      isGeneric: row.isGeneric,
      source: row.source,
      capturedOn: String(row.capturedOn),
    });
  }

  const result = [...groups.values()]
    .map((group) => ({ ...group, brands: group.brands.sort((a, b) => a.mrp - b.mrp) }))
    .sort((a, b) => a.salt.localeCompare(b.salt));
  res.json(result);
});

export default router;
