import * as THREE from "three";
import { GameMap, TileRef } from "../../core/game/GameMap";
import { TerrainType } from "../../core/game/Game";

export interface TerrainMeshOptions {
  gameMap: GameMap;
  heightScale?: number;
  waterLevel?: number;
}

export interface TerrainColors {
  shore: THREE.Color;
  plains: THREE.Color;
  highland: THREE.Color;
  mountain: THREE.Color;
  water: THREE.Color;
  deepWater: THREE.Color;
}

const DEFAULT_COLORS: TerrainColors = {
  shore: new THREE.Color(0xcccc9e), // Sandy beige
  plains: new THREE.Color(0xbedc8a), // Green
  highland: new THREE.Color(0xdccb9e), // Tan
  mountain: new THREE.Color(0xf0f0f0), // White/gray
  water: new THREE.Color(0x6490ff), // Light blue
  deepWater: new THREE.Color(0x4682b4), // Deeper blue
};

export class TerrainMesh {
  public readonly terrainMesh: THREE.Mesh;
  public readonly waterMesh: THREE.Mesh;
  public readonly group: THREE.Group;

  private readonly gameMap: GameMap;
  private heightScale: number;
  private waterLevel: number;

  constructor(options: TerrainMeshOptions) {
    this.gameMap = options.gameMap;
    this.heightScale = options.heightScale ?? 1.5;
    this.waterLevel = options.waterLevel ?? 0;

    this.group = new THREE.Group();

    // Create terrain mesh
    this.terrainMesh = this.createTerrainMesh();
    this.group.add(this.terrainMesh);

    // Create water mesh
    this.waterMesh = this.createWaterMesh();
    this.group.add(this.waterMesh);

    // Center the terrain
    this.centerTerrain();
  }

  private createTerrainMesh(): THREE.Mesh {
    const width = this.gameMap.width();
    const height = this.gameMap.height();

    // Create a plane geometry with subdivisions matching the map
    const geometry = new THREE.PlaneGeometry(
      width,
      height,
      width - 1,
      height - 1
    );

    // Rotate to be horizontal (XZ plane)
    geometry.rotateX(-Math.PI / 2);

    // Get position and color attributes
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    // Modify vertices based on terrain data
    // PlaneGeometry vertices go row by row matching map layout
    for (let i = 0; i < positions.count; i++) {
      const mapX = i % width;
      const mapY = Math.floor(i / width);

      if (this.gameMap.isValidCoord(mapX, mapY)) {
        const tileRef = this.gameMap.ref(mapX, mapY);

        // Set height based on terrain
        let y: number;
        if (this.gameMap.isLand(tileRef)) {
          const magnitude = this.gameMap.magnitude(tileRef);
          y = magnitude * this.heightScale;
        } else {
          // Water tiles go below the water plane to hide coastline cliffs
          y = -5;
        }

        positions.setY(i, y);

        // Set color based on terrain type
        const color = this.getTerrainColor(tileRef);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
    }

    // Add colors to geometry
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Recompute normals for proper lighting
    geometry.computeVertexNormals();

    // Create material with vertex colors
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  private getTerrainColor(tileRef: TileRef): THREE.Color {
    const terrainType = this.gameMap.terrainType(tileRef);
    const magnitude = this.gameMap.magnitude(tileRef);

    // Check if it's a shore tile (land adjacent to water)
    if (this.gameMap.isLand(tileRef) && this.gameMap.isShore(tileRef)) {
      return DEFAULT_COLORS.shore;
    }

    switch (terrainType) {
      case TerrainType.Plains: {
        // Gradient from bright green to slightly darker
        const t = magnitude / 10;
        const baseColor = DEFAULT_COLORS.plains.clone();
        return baseColor.lerp(new THREE.Color(0xa8c878), t);
      }
      case TerrainType.Highland: {
        // Gradient from tan to lighter
        const t = (magnitude - 10) / 10;
        const baseColor = DEFAULT_COLORS.highland.clone();
        return baseColor.lerp(new THREE.Color(0xeeddb0), t);
      }
      case TerrainType.Mountain: {
        // Gradient from gray to white
        const t = (magnitude - 20) / 10;
        const baseColor = new THREE.Color(0xe6e6e6);
        return baseColor.lerp(new THREE.Color(0xfafafa), Math.min(t, 1));
      }
      case TerrainType.Ocean:
      case TerrainType.Lake: {
        // Deeper water is darker
        const t = Math.min(magnitude / 15, 1);
        const baseColor = DEFAULT_COLORS.water.clone();
        return baseColor.lerp(DEFAULT_COLORS.deepWater, t);
      }
      default:
        return new THREE.Color(0x888888);
    }
  }

  private createWaterMesh(): THREE.Mesh {
    const width = this.gameMap.width();
    const height = this.gameMap.height();

    // Create a simple plane for water
    const geometry = new THREE.PlaneGeometry(width * 1.2, height * 1.2);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshLambertMaterial({
      color: 0x4a90d9,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = this.waterLevel;

    return mesh;
  }

  private centerTerrain(): void {
    // PlaneGeometry is already centered at origin after creation
    // No positioning offset needed - both terrain and water are centered
    // Just ensure water plane is at correct Y level
    this.waterMesh.position.y = this.waterLevel;
  }

  public setHeightScale(scale: number): void {
    this.heightScale = scale;
    this.updateTerrainHeights();
  }

  public setWaterLevel(level: number): void {
    this.waterLevel = level;
    this.waterMesh.position.y = level;
  }

  public setWireframe(enabled: boolean): void {
    const material = this.terrainMesh.material as THREE.MeshLambertMaterial;
    material.wireframe = enabled;
  }

  private updateTerrainHeights(): void {
    const geometry = this.terrainMesh.geometry;
    const positions = geometry.attributes.position;
    const width = this.gameMap.width();

    for (let i = 0; i < positions.count; i++) {
      const mapX = i % width;
      const mapY = Math.floor(i / width);

      if (this.gameMap.isValidCoord(mapX, mapY)) {
        const tileRef = this.gameMap.ref(mapX, mapY);

        // Set height based on terrain
        let y: number;
        if (this.gameMap.isLand(tileRef)) {
          const magnitude = this.gameMap.magnitude(tileRef);
          y = magnitude * this.heightScale;
        } else {
          // Water tiles go below the water plane
          y = -5;
        }

        positions.setY(i, y);
      }
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  public dispose(): void {
    this.terrainMesh.geometry.dispose();
    (this.terrainMesh.material as THREE.Material).dispose();
    this.waterMesh.geometry.dispose();
    (this.waterMesh.material as THREE.Material).dispose();
  }
}
