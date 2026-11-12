# SaveMeds medicine database

The price index reads every salt with all of its brands and manufacturers from one PostgreSQL table, `medicines`.
Each row is one brand from one manufacturer, so one salt can have many brands and makers, plus generic versions.

## 1. Get a PostgreSQL database

- **Free, online:** create a project at https://supabase.com and copy the connection string (Project Settings, Database).
- **Local:** install PostgreSQL 16 and create a database called `savemeds`.

Set the connection string once:

    export DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/savemeds"

## 2. Create the table

    pnpm --filter @workspace/db run push

## 3. Load medicine rows

The repository ships with **sample rows** (`lib/db/data/medicines.seed.json`). They are placeholders copied from the earlier demo and are labelled "SAMPLE" and "NOT YET VERIFIED". Replace them before showing the site to anyone.

    pnpm --filter @workspace/db run seed

To load your own verified rows, copy `lib/db/data/medicines.template.csv`, add one line per brand and manufacturer, and run:

    pnpm --filter @workspace/db run seed -- ./my-medicines.csv

Columns: `salt, category, coverage, brand, manufacturer, mrp, isGeneric, source, capturedOn`

- `mrp` is in rupees, as a whole number.
- `isGeneric` is `true` or `false`.
- `capturedOn` is the date you took the price, as `YYYY-MM-DD`.
- `source` should say where the price came from (for example, the manufacturer's price list, a named pharmacy's listing, or the NPPA ceiling price list), so every figure can be traced.

Running the seed again updates existing rows. A (salt, brand, manufacturer) combination is only stored once, and the whole import is rolled back if any row is invalid.

## 4. Run the app

    npm run dev

The website's price index shows the database contents. If the database is not connected, the page explains what to do, and the rest of the app keeps working.

## Where the data should come from

Use sources you can cite, such as:
- the manufacturer's own price list or website,
- the National Pharmaceutical Pricing Authority (NPPA) ceiling price and MRP lists,
- the Jan Aushadhi (PMBJP) price list for generic rows,
- a pharmacy's published MRP, with the date noted.

Prices change, so re-run the seed with updated rows regularly and keep `capturedOn` current.
