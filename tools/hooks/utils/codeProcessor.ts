// utils/codeProcessor.ts

// In plain terms: this file helps format code, find code elements, and work with line numbers in AI answers.

export function formatCodeWithLineNumbers(code: string): string {
  return code
    .split('\n')
    .map((line, idx) => `${idx + 1} | ${line}`)
    .join('\n');
}

export function findElements(code: string, element: string): number[] {
  return code
    .split('\n')
    .map((line, idx) => (line.includes(element) ? idx + 1 : null))
    .filter((n) => n !== null) as number[];
}

export function buildCodeSummary(code: string, language: string): string {
  return `Code summary for ${language}: ${code.substring(0, 100)}...`;
}

export function extractLineNumbersFromResponse(response: string): number[] {
  const matches = response.match(/\b\d{1,4}\b/g);
  return matches ? matches.map(Number) : [];
}

export function validateLineNumbers(code: string, lines: number[]): { valid: number[]; invalid: number[] } {
  const total = code.split('\n').length;
  const valid = lines.filter((n) => n > 0 && n <= total);
  const invalid = lines.filter((n) => n <= 0 || n > total);
  return { valid, invalid };
}
