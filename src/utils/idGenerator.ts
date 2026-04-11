let nextId = 1;

/**
 * Generates a unique string ID for a new Averia record.
 */
export function generateId(): string {
  const id = `averia-${Date.now()}-${nextId}`;
  nextId += 1;
  return id;
}
