export type StructuredHermesConfigUpdate = Record<string, unknown>;

const REQUIRED_SETTING_PATTERNS: Array<[string, RegExp]> = [
  ['model', /default:\s*['"]?[^'"\n#]+['"]?/],
  ['provider', /provider:\s*['"]?[^'"\n#]+['"]?/],
  ['maxTokens', /max_tokens:\s*[0-9]+/],
  ['streaming', /streaming:\s*(true|false)/i],
  ['reasoning', /reasoning:\s*['"]?[^'"\n#]+['"]?/],
  ['maxSessions', /max_concurrent_sessions:\s*[0-9]+/],
];

/**
 * Check that structured settings can actually be applied before the caller
 * mutates the configuration file. Prevents silent no-op "success" responses.
 */
export function validateStructuredConfigUpdates(
  content: string,
  updates: StructuredHermesConfigUpdate,
): string | null {
  for (const [key, pattern] of REQUIRED_SETTING_PATTERNS) {
    if (Object.prototype.hasOwnProperty.call(updates, key) && !pattern.test(content)) {
      return `Cannot update ${key}: its setting is missing from config.yaml`;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, 'temperature') &&
    !/temperature:\s*[0-9.]+/.test(content) &&
    !/model:\n/.test(content)
  ) {
    return 'Cannot update temperature: no model section exists in config.yaml';
  }

  return null;
}
