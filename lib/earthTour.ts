export type EarthTourStepType = "narrate" | "flyTo" | "orbit" | "pause";

export interface EarthTourStep {
  type: EarthTourStepType;
  title?: string;
  text?: string;
  locationQuery?: string;
  latitude?: number;
  longitude?: number;
  height?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  durationMs?: number;
}

export interface EarthTourPlan {
  mode: "planet";
  title?: string;
  fullscreen?: boolean;
  autoRotate?: boolean;
  steps: EarthTourStep[];
}

const EARTH_TOUR_BLOCK_REGEX = /<loco-tour>\s*([\s\S]*?)<\/loco-tour>/i;

function normalizeStep(step: unknown): EarthTourStep | null {
  if (!step || typeof step !== "object") {
    return null;
  }

  const candidate = step as Record<string, unknown>;
  const type = typeof candidate.type === "string" ? candidate.type : "";

  if (type !== "narrate" && type !== "flyTo" && type !== "orbit" && type !== "pause") {
    return null;
  }

  return {
    type,
    title: typeof candidate.title === "string" ? candidate.title : undefined,
    text: typeof candidate.text === "string" ? candidate.text : undefined,
    locationQuery: typeof candidate.locationQuery === "string" ? candidate.locationQuery : undefined,
    latitude: typeof candidate.latitude === "number" ? candidate.latitude : undefined,
    longitude: typeof candidate.longitude === "number" ? candidate.longitude : undefined,
    height: typeof candidate.height === "number" ? candidate.height : undefined,
    heading: typeof candidate.heading === "number" ? candidate.heading : undefined,
    pitch: typeof candidate.pitch === "number" ? candidate.pitch : undefined,
    roll: typeof candidate.roll === "number" ? candidate.roll : undefined,
    durationMs: typeof candidate.durationMs === "number" ? candidate.durationMs : undefined,
  };
}

export function stripEarthTourBlock(text: string): string {
  return text.replace(EARTH_TOUR_BLOCK_REGEX, "").trim();
}

export function extractEarthTourPlan(text: string): EarthTourPlan | null {
  const match = EARTH_TOUR_BLOCK_REGEX.exec(text);

  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;

    if (parsed.mode !== "planet" || !Array.isArray(parsed.steps)) {
      return null;
    }

    const steps = parsed.steps
      .map(normalizeStep)
      .filter((step): step is EarthTourStep => step !== null);

    if (steps.length === 0) {
      return null;
    }

    return {
      mode: "planet",
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      fullscreen: typeof parsed.fullscreen === "boolean" ? parsed.fullscreen : undefined,
      autoRotate: typeof parsed.autoRotate === "boolean" ? parsed.autoRotate : undefined,
      steps,
    };
  } catch {
    return null;
  }
}

export function looksLikePlanetTourRequest(text: string): boolean {
  return /\b(planet|earth|globe|world|map|tour|walk me around|take me to|fly to|orbit|navigate to)\b/i.test(text);
}