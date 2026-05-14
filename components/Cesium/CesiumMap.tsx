"use client";

import { useEffect, useRef, useState } from "react";
import type { EarthTourPlan, EarthTourStep } from "@/lib/earthTour";

const CESIUM_VERSION = "1.127";
const CESIUM_SCRIPT_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Cesium.js`;
const CESIUM_WIDGETS_CSS_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css`;
const FALLBACK_DOWNTOWN_ASSET_ID = 96188;

type SceneState = "idle" | "loading" | "ready" | "error";

interface CesiumGlobalWindow extends Window {
  Cesium?: any;
}

type CesiumLoaderGlobal = typeof globalThis & {
  __locoCesiumLoader?: Promise<any>;
};

export interface CesiumSceneIssue {
  message: string;
  source: string;
}

interface CesiumMapProps {
  autoRotate?: boolean;
  onSceneReady?: () => void;
  onSceneError?: (issue: CesiumSceneIssue) => void;
  tourPlan?: EarthTourPlan | null;
}

interface ResolvedTourDestination {
  latitude: number;
  longitude: number;
  height: number;
  heading?: number;
  pitch?: number;
  roll?: number;
}

function waitForDuration(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

async function geocodeLocation(locationQuery: string): Promise<{ latitude: number; longitude: number }> {
  const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");

  geocodeUrl.searchParams.set("format", "jsonv2");
  geocodeUrl.searchParams.set("limit", "1");
  geocodeUrl.searchParams.set("q", locationQuery);

  const response = await fetch(geocodeUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to geocode ${locationQuery}.`);
  }

  const results = await response.json() as Array<{ lat: string; lon: string }>;
  const firstResult = results[0];

  if (!firstResult) {
    throw new Error(`No map result found for ${locationQuery}.`);
  }

  return {
    latitude: Number(firstResult.lat),
    longitude: Number(firstResult.lon),
  };
}

async function resolveTourDestination(step: EarthTourStep): Promise<ResolvedTourDestination> {
  if (typeof step.latitude === "number" && typeof step.longitude === "number") {
    return {
      latitude: step.latitude,
      longitude: step.longitude,
      height: step.height ?? 1_500_000,
      heading: step.heading,
      pitch: step.pitch,
      roll: step.roll,
    };
  }

  if (step.locationQuery) {
    const location = await geocodeLocation(step.locationQuery);

    return {
      ...location,
      height: step.height ?? 1_500_000,
      heading: step.heading,
      pitch: step.pitch,
      roll: step.roll,
    };
  }

  throw new Error("Tour step is missing location coordinates or locationQuery.");
}

function flyViewerTo(viewer: any, Cesium: any, destination: ResolvedTourDestination, durationMs: number) {
  return new Promise<void>((resolve) => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(destination.longitude, destination.latitude, destination.height),
      duration: Math.max(durationMs / 1000, 0.5),
      orientation: {
        heading: Cesium.Math.toRadians(destination.heading ?? 0),
        pitch: Cesium.Math.toRadians(destination.pitch ?? -35),
        roll: Cesium.Math.toRadians(destination.roll ?? 0),
      },
      complete: () => resolve(),
      cancel: () => resolve(),
    });
  });
}

function orbitViewer(viewer: any, Cesium: any, durationMs: number) {
  return new Promise<void>((resolve) => {
    const startedAt = performance.now();
    const rotationPerTick = Cesium.Math.toRadians(0.25);

    const rotateCamera = () => {
      const elapsed = performance.now() - startedAt;

      if (!viewer || viewer.isDestroyed?.() || !viewer.clock || !viewer.camera || !viewer.scene || elapsed >= durationMs) {
        if (viewer && !viewer.isDestroyed?.() && viewer.clock) {
          viewer.clock.onTick.removeEventListener(rotateCamera);
        }
        resolve();
        return;
      }

      viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, -rotationPerTick);
      viewer.scene.requestRender();
    };

    viewer.clock.onTick.addEventListener(rotateCamera);
  });
}

function ensureCesiumWidgetStyles() {
  if (typeof document === "undefined") {
    return;
  }

  const existingLink = document.querySelector('link[data-cesium-widgets="true"]');

  if (existingLink) {
    return;
  }

  const link = document.createElement("link");

  link.rel = "stylesheet";
  link.href = CESIUM_WIDGETS_CSS_URL;
  link.dataset.cesiumWidgets = "true";
  document.head.appendChild(link);
}

function loadCesiumRuntime() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cesium can only load in the browser."));
  }

  const runtimeWindow = window as CesiumGlobalWindow;
  const runtimeGlobal = globalThis as CesiumLoaderGlobal;

  if (runtimeWindow.Cesium) {
    return Promise.resolve(runtimeWindow.Cesium);
  }

  if (runtimeGlobal.__locoCesiumLoader) {
    return runtimeGlobal.__locoCesiumLoader;
  }

  runtimeGlobal.__locoCesiumLoader = new Promise((resolve, reject) => {
    ensureCesiumWidgetStyles();

    const existingScript = document.querySelector('script[data-cesium-runtime="true"]') as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (runtimeWindow.Cesium) {
          resolve(runtimeWindow.Cesium);
          return;
        }

        reject(new Error("Cesium runtime loaded, but window.Cesium is unavailable."));
      }, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Cesium runtime script failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");

    script.src = CESIUM_SCRIPT_URL;
    script.async = true;
    script.dataset.cesiumRuntime = "true";
    script.onload = () => {
      if (runtimeWindow.Cesium) {
        resolve(runtimeWindow.Cesium);
        return;
      }

      reject(new Error("Cesium runtime loaded, but window.Cesium is unavailable."));
    };
    script.onerror = () => reject(new Error("Cesium runtime script failed to load."));
    document.head.appendChild(script);
  }).catch((error) => {
    runtimeGlobal.__locoCesiumLoader = undefined;
    throw error;
  });

  return runtimeGlobal.__locoCesiumLoader;
}

export default function CesiumMap({
  autoRotate = false,
  onSceneReady,
  onSceneError,
  tourPlan = null,
}: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<any>(null);
  const onSceneReadyRef = useRef(onSceneReady);
  const onSceneErrorRef = useRef(onSceneError);
  const lastReportedIssueRef = useRef<string | null>(null);
  const [sceneState, setSceneState] = useState<SceneState>("idle");
  const [sceneError, setSceneError] = useState<string | null>(null);

  const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim() ?? "";
  const tilesetUrl = process.env.NEXT_PUBLIC_3DTILES_URL?.trim() ?? "";
  const downtownAssetId = Number(
    process.env.NEXT_PUBLIC_DOWNTOWN_ASSET_ID ?? FALLBACK_DOWNTOWN_ASSET_ID,
  );

  const reportSceneIssue = (message: string, source: string, error?: unknown) => {
    const signature = `${source}:${message}`;

    if (lastReportedIssueRef.current === signature) {
      return;
    }

    lastReportedIssueRef.current = signature;

    if (error) {
      console.error(`[Cesium] ${source} failed.`, error);
    } else {
      console.warn(`[Cesium] ${source}: ${message}`);
    }

    setSceneState("error");
    setSceneError(message);
    onSceneErrorRef.current?.({ message, source });
  };

  useEffect(() => {
    onSceneReadyRef.current = onSceneReady;
    onSceneErrorRef.current = onSceneError;
  }, [onSceneError, onSceneReady]);

  useEffect(() => {
    let isActive = true;

    if (!containerRef.current) {
      return;
    }

    const initializeViewer = async () => {
      setSceneState("loading");
      setSceneError(null);
      lastReportedIssueRef.current = null;

      try {
        const Cesium = await loadCesiumRuntime();

        if (!isActive || !containerRef.current) {
          return;
        }

        console.info("[Cesium] Runtime loaded from CDN.");
        cesiumRef.current = Cesium;

        if (viewerRef.current && !viewerRef.current.isDestroyed?.()) {
          viewerRef.current.destroy();
        }

        if (ionToken) {
          Cesium.Ion.defaultAccessToken = ionToken;
        }

        let terrainProvider: unknown;

        if (ionToken) {
          try {
            terrainProvider = await Cesium.createWorldTerrainAsync();
          } catch (error) {
            console.warn("[Cesium] Terrain provider failed to load. Falling back to default globe.", error);
          }
        }

        const viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          shouldAnimate: true,
          terrainProvider,
          timeline: false,
        });

        viewerRef.current = viewer;
        viewer.scene.globe.depthTestAgainstTerrain = Boolean(terrainProvider);

        if (tilesetUrl) {
          try {
            const tileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl);

            if (!isActive) {
              return;
            }

            viewer.scene.primitives.add(tileset);
            void viewer.flyTo(tileset, { duration: 2.2 });
          } catch (error) {
            reportSceneIssue("Unable to load the configured 3D tileset.", "tileset", error);
          }
        } else if (ionToken) {
          try {
            const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(downtownAssetId);

            if (!isActive) {
              return;
            }

            viewer.scene.primitives.add(tileset);
            void viewer.flyTo(tileset, { duration: 2.2 });
          } catch (error) {
            console.warn("[Cesium] Downtown asset failed to load. Keeping the base globe available.", error);
          }
        }

        if (!tilesetUrl && !ionToken) {
          console.info("[Cesium] No token or tileset configured. Rendering default globe only.");
        }

        viewer.scene.requestRender();
        setSceneState("ready");
        onSceneReadyRef.current?.();
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Cesium runtime could not be initialized.";

        reportSceneIssue(message, "runtime", error);
      }
    };

    void initializeViewer();

    return () => {
      isActive = false;

      if (viewerRef.current && !viewerRef.current.isDestroyed?.()) {
        viewerRef.current.destroy();
      }

      viewerRef.current = null;
    };
  }, [downtownAssetId, ionToken, tilesetUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;

    if (!viewer || !Cesium || sceneState !== "ready" || !autoRotate) {
      return;
    }

    const spinRate = Cesium.Math.toRadians(0.12);

    const rotateCamera = () => {
      try {
        if (!viewer || viewer.isDestroyed?.() || !viewer.clock || !viewer.camera || !viewer.scene) {
          return;
        }

        viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, -spinRate);
        viewer.scene.requestRender();
      } catch (error) {
        reportSceneIssue("Cesium auto-rotation failed.", "auto-rotate", error);
      }
    };

    console.info("[Cesium] Auto-rotation enabled.");
    viewer.clock.onTick.addEventListener(rotateCamera);

    return () => {
      console.info("[Cesium] Auto-rotation disabled.");

      if (!viewer || viewer.isDestroyed?.() || !viewer.clock) {
        return;
      }

      viewer.clock.onTick.removeEventListener(rotateCamera);
    };
  }, [autoRotate, sceneState]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    const activeTourRunId = (tourPlan as (EarthTourPlan & { runId?: string }) | null)?.runId;

    if (!tourPlan || !activeTourRunId || !viewer || !Cesium || sceneState !== "ready") {
      return;
    }

    let cancelled = false;

    const executeTour = async () => {
      console.info("[Cesium] Executing earth tour.", tourPlan.title ?? activeTourRunId);

      for (const step of tourPlan.steps) {
        if (cancelled) {
          return;
        }

        switch (step.type) {
          case "narrate": {
            if (step.text) {
              console.info("[Cesium Tour]", step.text);
            }
            await waitForDuration(step.durationMs ?? 1200);
            break;
          }
          case "pause": {
            await waitForDuration(step.durationMs ?? 1000);
            break;
          }
          case "flyTo": {
            const destination = await resolveTourDestination(step);

            if (cancelled) {
              return;
            }

            await flyViewerTo(viewer, Cesium, destination, step.durationMs ?? 4500);
            break;
          }
          case "orbit": {
            if (step.locationQuery || (typeof step.latitude === "number" && typeof step.longitude === "number")) {
              const destination = await resolveTourDestination(step);

              if (cancelled) {
                return;
              }

              await flyViewerTo(viewer, Cesium, destination, Math.min(step.durationMs ?? 4000, 4000));
            }

            await orbitViewer(viewer, Cesium, step.durationMs ?? 4000);
            break;
          }
        }
      }
    };

    void executeTour().catch((error) => {
      const message = error instanceof Error ? error.message : "Earth tour execution failed.";

      reportSceneIssue(message, "tour", error);
    });

    return () => {
      cancelled = true;
    };
  }, [sceneState, tourPlan]);

  return (
    <section className="relative min-h-[70svh] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl shadow-slate-950/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 bg-gradient-to-b from-slate-950 via-slate-950/70 to-transparent px-6 py-5 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Cesium Planet View</p>
          <h2 className="mt-2 text-2xl font-semibold">Interactive globe environment</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
            Cesium runs on the client and opens a globe-first environment. When an Ion token is available, terrain and the downtown tileset can also load.
          </p>
        </div>
        <div className="rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-200 backdrop-blur">
          {sceneState}
        </div>
      </div>

      {sceneError ? (
        <div className="pointer-events-none absolute inset-x-6 bottom-6 z-10 rounded-2xl border border-red-400/30 bg-red-950/70 px-4 py-3 text-sm text-red-100 backdrop-blur">
          {sceneError}
        </div>
      ) : null}

      <div ref={containerRef} className="h-[78svh] min-h-[620px] w-full" />

      {sceneState === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/55 text-sm uppercase tracking-[0.24em] text-slate-200 backdrop-blur-sm">
          Loading planet view...
        </div>
      ) : null}
    </section>
  );
}
