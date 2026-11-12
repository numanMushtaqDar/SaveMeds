export interface MedicineBrand {
  brand: string;
  manufacturer: string;
  mrp: number;
  isGeneric: boolean;
  source: string;
  capturedOn: string;
}

export interface SaltGroup {
  salt: string;
  category: string;
  coverage: string;
  brands: MedicineBrand[];
}

/** Loads every salt with all of its brands and manufacturers from the medicine database. */
export async function fetchMedicines(): Promise<SaltGroup[]> {
  const response = await fetch('/api/medicines');
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with status ${response.status}`);
  }
  return (await response.json()) as SaltGroup[];
}

/** Market average of branded versions, cheapest generic, and the saving between them. */
export function summariseSalt(group: SaltGroup) {
  const branded = group.brands.filter((b) => !b.isGeneric);
  const generics = group.brands.filter((b) => b.isGeneric);
  const market = branded.length ? branded.reduce((sum, b) => sum + b.mrp, 0) / branded.length : null;
  const cheapestGeneric = generics.length ? Math.min(...generics.map((b) => b.mrp)) : null;
  const savings = market !== null && cheapestGeneric !== null ? Math.round((1 - cheapestGeneric / market) * 100) : null;
  return {
    market,
    cheapestGeneric,
    savings,
    brandCount: group.brands.length,
    manufacturerCount: new Set(group.brands.map((b) => b.manufacturer)).size,
  };
}
