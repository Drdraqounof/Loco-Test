export type VoiceKey = "alloy" | "echo" | "fable";

export interface VoiceTheme {
  bgGradient: string;
  orbHighlight: string;
  orbMid1: string;
  orbMid2: string;
  orbDeep: string;
  orbBase: string;
  blobHueBase: number;
  ringColor: string;
  particleColor: string;
  outerGlowActive: string;
  outerGlowIdle: string;
  accentColor: string;
  textColor: string;
  borderColor: string;
  buttonBg: string;
  buttonHover: string;
  label: string;
}

export const VOICE_THEMES: Record<VoiceKey, VoiceTheme> = {
  alloy: {
    bgGradient: "radial-gradient(ellipse at 50% 40%, #0a0f2e 0%, #020410 100%)",
    orbHighlight: "rgba(220,240,255,0.95)",
    orbMid1: "rgba(140,200,255,0.9)",
    orbMid2: "rgba(60,120,255,0.85)",
    orbDeep: "rgba(20,60,200,0.9)",
    orbBase: "rgba(8,20,100,0.95)",
    blobHueBase: 200,
    ringColor: "120,200,255",
    particleColor: "180,230,255",
    outerGlowActive: "rgba(80,160,255,0.14)",
    outerGlowIdle: "rgba(60,120,220,0.07)",
    accentColor: "rgba(100,180,255,0.7)",
    textColor: "rgba(180,220,255,0.9)",
    borderColor: "rgba(100,180,255,0.35)",
    buttonBg: "linear-gradient(135deg, rgba(80,160,255,0.5), rgba(60,120,255,0.5))",
    buttonHover: "linear-gradient(135deg, rgba(100,180,255,0.65), rgba(80,140,255,0.65))",
    label: "ALLOY",
  },
  echo: {
    bgGradient: "radial-gradient(ellipse at 50% 40%, #1a0a2e 0%, #0a0210 100%)",
    orbHighlight: "rgba(240,220,255,0.95)",
    orbMid1: "rgba(200,140,255,0.9)",
    orbMid2: "rgba(140,60,255,0.85)",
    orbDeep: "rgba(80,20,180,0.9)",
    orbBase: "rgba(30,5,80,0.95)",
    blobHueBase: 270,
    ringColor: "180,120,255",
    particleColor: "220,170,255",
    outerGlowActive: "rgba(160,80,255,0.16)",
    outerGlowIdle: "rgba(120,60,200,0.08)",
    accentColor: "rgba(180,100,255,0.75)",
    textColor: "rgba(220,190,255,0.9)",
    borderColor: "rgba(160,100,255,0.35)",
    buttonBg: "linear-gradient(135deg, rgba(140,60,255,0.5), rgba(100,40,200,0.5))",
    buttonHover: "linear-gradient(135deg, rgba(170,90,255,0.65), rgba(130,60,220,0.65))",
    label: "ECHO",
  },
  fable: {
    bgGradient: "radial-gradient(ellipse at 50% 40%, #2e1200 0%, #130800 100%)",
    orbHighlight: "rgba(255,240,200,0.95)",
    orbMid1: "rgba(255,190,80,0.9)",
    orbMid2: "rgba(240,110,30,0.85)",
    orbDeep: "rgba(160,50,10,0.9)",
    orbBase: "rgba(60,15,5,0.95)",
    blobHueBase: 30,
    ringColor: "255,160,60",
    particleColor: "255,200,120",
    outerGlowActive: "rgba(240,130,40,0.16)",
    outerGlowIdle: "rgba(200,100,30,0.08)",
    accentColor: "rgba(255,170,60,0.75)",
    textColor: "rgba(255,220,170,0.9)",
    borderColor: "rgba(240,150,60,0.35)",
    buttonBg: "linear-gradient(135deg, rgba(220,110,30,0.5), rgba(180,80,20,0.5))",
    buttonHover: "linear-gradient(135deg, rgba(255,140,50,0.65), rgba(210,100,30,0.65))",
    label: "FABLE",
  },
};
