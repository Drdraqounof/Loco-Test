"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { EarthTourPlan } from "@/lib/earthTour";
import type { CesiumSceneIssue } from "./CesiumMap";

const CesiumMap = dynamic(() => import("./CesiumMap"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[70svh] items-center justify-center rounded-[28px] border border-white/10 bg-slate-950 text-sm uppercase tracking-[0.28em] text-slate-300 shadow-2xl shadow-slate-950/40">
      Loading downtown scene...
    </div>
  ),
});

interface CesiumMapShellProps {
  autoRotate?: boolean;
  onSceneReady?: () => void;
  onSceneError?: (issue: CesiumSceneIssue) => void;
  tourPlan?: EarthTourPlan | null;
}

export default function CesiumMapShell(props: CesiumMapShellProps) {
  useEffect(() => {
    console.info("[Cesium] CesiumMapShell rendered on the client.");
  }, []);

  return <CesiumMap {...props} />;
}