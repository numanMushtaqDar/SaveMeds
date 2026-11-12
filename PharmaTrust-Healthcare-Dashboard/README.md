# SaveMeds (PharmaTrust Healthcare Dashboard)

SaveMeds is a patient-facing healthcare dashboard. It reads a prescription, shows the price of each salt across brands and manufacturers, flags duplicate salts and safety points, and shows verified doctor reviews.

## Project layout

- `artifacts/pharmatrust` - the website (React, Vite, Tailwind)
- `artifacts/api-server` - the API (Express): `/api/healthz`, `/api/audit` (Groq AI), `/api/medicines` (medicine database)
- `lib/db` - PostgreSQL schema (Drizzle), seed and CSV import scripts
- `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` - API contract and generated types
- `DATABASE_SETUP.md` - how to connect and load the medicine database

## Requirements

- Node.js 24 (Node 22 also works for development)
- pnpm (`npm install -g pnpm`)
- Optional: a PostgreSQL database for the price index (see `DATABASE_SETUP.md`)
- Optional: a Groq API key for the live AI audit

## Run it

    pnpm install
    npm run dev

Then open **http://localhost:5173**.

- The website and the API start together. The website forwards `/api` requests to the API on port 8080.
- Without `DATABASE_URL`, the price index shows a "database not connected" message and everything else still works.
- Without `GROQ_API_KEY`, the audit shows its built-in explanation.

To enable the AI audit, create `artifacts/api-server/.env` with `GROQ_API_KEY=your_key`, then restart `npm run dev`. Never commit that file.

## Check the build

    pnpm run typecheck
    PORT=5000 BASE_PATH=/ pnpm run build

## Medicine database

    export DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/savemeds"
    pnpm --filter @workspace/db run push
    pnpm --filter @workspace/db run seed

The seed file contains sample rows marked "NOT YET VERIFIED". Load verified brand and manufacturer rows from a CSV before you publish the site.
