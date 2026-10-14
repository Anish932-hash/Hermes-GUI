export const MAX_DICTATION_LIMIT = 50;

export function parseDictationLimit(value: string | null): number | null {
  if (value === null || value.trim() === '') return 15;
  if (!/^[0-9]+$/.test(value)) return null;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= MAX_DICTATION_LIMIT
    ? limit
    : null;
}
