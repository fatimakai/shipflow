const sensitiveKeyPattern =
  /authorization|cookie|password|passphrase|token|secret|api[-_]?key|encryption[-_]?key|manual[-_]?entry[-_]?key|backup[-_]?codes?|provisioning[-_]?uri|signature|raw[-_]?body|email|recipient/i;

export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[TRUNCATED]';
  if (typeof value === 'string') return redactString(value);
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = sensitiveKeyPattern.test(key)
        ? '[REDACTED]'
        : redactLogValue(item, depth + 1);
    }
    return output;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.description ?? '[SYMBOL]';
  if (typeof value === 'function')
    return `[Function ${value.name || 'anonymous'}]`;
  return '[UNSERIALIZABLE]';
}

function redactString(value: string): string {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(
      /([?&](?:token|code|secret|key|signature)=)[^&\s]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s/]+@/gi, '$1[REDACTED]@');
}
