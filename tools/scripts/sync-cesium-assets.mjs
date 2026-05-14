import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const cesiumBuildRoot = path.join(workspaceRoot, "node_modules", "cesium", "Build", "Cesium");
const publicCesiumRoot = path.join(workspaceRoot, "public", "cesium");
const assetDirectories = ["Assets", "ThirdParty", "Widgets", "Workers"];

if (!existsSync(cesiumBuildRoot)) {
  console.warn("[Cesium] node_modules/cesium/Build/Cesium not found. Skipping asset sync.");
  process.exit(0);
}

mkdirSync(publicCesiumRoot, { recursive: true });

for (const directory of assetDirectories) {
  const sourceDirectory = path.join(cesiumBuildRoot, directory);
  const destinationDirectory = path.join(publicCesiumRoot, directory);

  cpSync(sourceDirectory, destinationDirectory, {
    recursive: true,
    force: true,
  });
}

console.info(`[Cesium] Synced static assets to ${publicCesiumRoot}`);