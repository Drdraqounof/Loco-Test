export interface CesiumIntent {
  autoRotate: boolean;
  reason: string;
}

const OPEN_PATTERNS = [
  /\bopen\b.*\b(cesium|globe|planet|earth)\b/i,
  /\bshow\b.*\b(cesium|globe|planet|earth)\b/i,
  /\blaunch\b.*\b(cesium|globe|planet|earth)\b/i,
  /\btake\s+me\s+to\b.*\b(cesium|globe|planet|earth)\b/i,
  /\b(go|navigate)\s+to\b.*\b(cesium|globe|planet|earth)\b/i,
  /\b(planet|globe|earth)\s+view\b/i,
  /\bcesium\s+(environment|viewer|scene)\b/i,
];

const ROTATE_PATTERNS = [
  /\bspin\b.*\b(planet|globe|earth)\b/i,
  /\brotate\b.*\b(planet|globe|earth)\b/i,
  /\borbit\b.*\b(planet|globe|earth)\b/i,
];

export function detectCesiumIntent(input: string): CesiumIntent | null {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return null;
  }

  const matchedRotatePattern = ROTATE_PATTERNS.some((pattern) => pattern.test(trimmedInput));
  const matchedOpenPattern = OPEN_PATTERNS.some((pattern) => pattern.test(trimmedInput));

  if (!matchedRotatePattern && !matchedOpenPattern) {
    return null;
  }

  return {
    autoRotate: matchedRotatePattern,
    reason: matchedRotatePattern ? "spin the planet" : "open the Cesium environment",
  };
}