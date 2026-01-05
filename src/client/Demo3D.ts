import { GameMapType, GameMapSize } from "../core/game/Game";
import { FetchGameMapLoader } from "../core/game/FetchGameMapLoader";
import { loadTerrainMap, TerrainMapData } from "../core/game/TerrainMapLoader";
import { Scene3D } from "./graphics3d/Scene3D";
import { TerrainMesh } from "./graphics3d/TerrainMesh";

class Demo3D {
  private scene3d: Scene3D | null = null;
  private terrainMesh: TerrainMesh | null = null;
  private mapLoader: FetchGameMapLoader;

  private heightScale = 1.5;
  private waterLevel = 0;

  // UI Elements
  private loadingElement: HTMLElement;
  private fpsElement: HTMLElement;
  private verticesElement: HTMLElement;
  private trianglesElement: HTMLElement;

  constructor() {
    this.mapLoader = new FetchGameMapLoader("/maps");

    // Get UI elements
    this.loadingElement = document.getElementById("loading")!;
    this.fpsElement = document.getElementById("fps")!;
    this.verticesElement = document.getElementById("vertices")!;
    this.trianglesElement = document.getElementById("triangles")!;

    this.setupEventListeners();
    this.init();
  }

  private setupEventListeners(): void {
    // Map selector
    const mapSelect = document.getElementById("map-select") as HTMLSelectElement;
    mapSelect.addEventListener("change", () => {
      this.loadMap(mapSelect.value as keyof typeof GameMapType);
    });

    // Height scale slider
    const heightScaleInput = document.getElementById(
      "height-scale"
    ) as HTMLInputElement;
    const heightScaleValue = document.getElementById("height-scale-value")!;
    heightScaleInput.addEventListener("input", () => {
      this.heightScale = parseFloat(heightScaleInput.value);
      heightScaleValue.textContent = this.heightScale.toFixed(1);
      if (this.terrainMesh) {
        this.terrainMesh.setHeightScale(this.heightScale);
      }
    });

    // Water level slider
    const waterLevelInput = document.getElementById(
      "water-level"
    ) as HTMLInputElement;
    const waterLevelValue = document.getElementById("water-level-value")!;
    waterLevelInput.addEventListener("input", () => {
      this.waterLevel = parseFloat(waterLevelInput.value);
      waterLevelValue.textContent = this.waterLevel.toFixed(1);
      if (this.terrainMesh) {
        this.terrainMesh.setWaterLevel(this.waterLevel);
      }
    });

    // Wireframe toggle
    const wireframeCheckbox = document.getElementById(
      "wireframe"
    ) as HTMLInputElement;
    wireframeCheckbox.addEventListener("change", () => {
      if (this.terrainMesh) {
        this.terrainMesh.setWireframe(wireframeCheckbox.checked);
      }
    });
  }

  private async init(): Promise<void> {
    // Initialize Three.js scene
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.scene3d = new Scene3D({ canvas });

    // Setup stats update callback
    this.scene3d.onFrame(() => {
      this.updateStats();
    });

    // Start render loop
    this.scene3d.start();

    // Load default map
    await this.loadMap("World");
  }

  private async loadMap(mapName: string): Promise<void> {
    this.showLoading(true);

    try {
      // Clear existing terrain
      if (this.terrainMesh) {
        this.scene3d?.scene.remove(this.terrainMesh.group);
        this.terrainMesh.dispose();
        this.terrainMesh = null;
      }

      // Map the UI name to GameMapType
      const mapType = this.getMapType(mapName);

      // Load the map data (using compact/4x version for better performance)
      const mapData: TerrainMapData = await loadTerrainMap(
        mapType,
        GameMapSize.Compact,
        this.mapLoader
      );

      console.log(
        `Loaded map: ${mapName}, size: ${mapData.gameMap.width()}x${mapData.gameMap.height()}`
      );

      // Create terrain mesh
      this.terrainMesh = new TerrainMesh({
        gameMap: mapData.gameMap,
        heightScale: this.heightScale,
        waterLevel: this.waterLevel,
      });

      this.scene3d?.scene.add(this.terrainMesh.group);

      // Position camera to view the terrain
      const width = mapData.gameMap.width();
      const height = mapData.gameMap.height();
      const maxDim = Math.max(width, height);

      this.scene3d?.setCameraPosition(0, maxDim * 0.5, maxDim * 0.6);
      this.scene3d?.setCameraTarget(0, 0, 0);

      // Apply current wireframe setting
      const wireframeCheckbox = document.getElementById(
        "wireframe"
      ) as HTMLInputElement;
      this.terrainMesh.setWireframe(wireframeCheckbox.checked);
    } catch (error) {
      console.error("Failed to load map:", error);
      alert(`Failed to load map: ${error}`);
    } finally {
      this.showLoading(false);
    }
  }

  private getMapType(name: string): GameMapType {
    // Map UI names to GameMapType enum values
    const mapping: Record<string, GameMapType> = {
      World: GameMapType.World,
      Europe: GameMapType.Europe,
      NorthAmerica: GameMapType.NorthAmerica,
      Asia: GameMapType.Asia,
      Africa: GameMapType.Africa,
    };

    return mapping[name] || GameMapType.World;
  }

  private showLoading(show: boolean): void {
    if (show) {
      this.loadingElement.classList.remove("hidden");
    } else {
      this.loadingElement.classList.add("hidden");
    }
  }

  private updateStats(): void {
    if (!this.scene3d) return;

    this.fpsElement.textContent = this.scene3d.getFps().toString();

    const stats = this.scene3d.getStats();
    this.verticesElement.textContent = stats.vertices.toLocaleString();
    this.trianglesElement.textContent = stats.triangles.toLocaleString();
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new Demo3D();
});
