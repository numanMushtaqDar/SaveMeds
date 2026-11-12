import { pgTable, serial, text, integer, boolean, date, unique } from "drizzle-orm/pg-core";

/**
 * One row per (salt, brand, manufacturer).
 * A salt such as "Amoxicillin 500 mg" can therefore have many brands, each made by its own manufacturer,
 * plus generic versions (isGeneric = true, e.g. Jan Aushadhi).
 */
export const medicines = pgTable(
  "medicines",
  {
    id: serial("id").primaryKey(),
    salt: text("salt").notNull(),
    category: text("category").notNull(),
    coverage: text("coverage").notNull().default(""),
    brand: text("brand").notNull(),
    manufacturer: text("manufacturer").notNull(),
    mrp: integer("mrp").notNull(),
    isGeneric: boolean("is_generic").notNull().default(false),
    source: text("source").notNull(),
    capturedOn: date("captured_on").notNull(),
  },
  (table) => [unique("medicines_salt_brand_manufacturer_key").on(table.salt, table.brand, table.manufacturer)],
);

export type Medicine = typeof medicines.$inferSelect;
