import * as THREE from "three";
import { GameMap } from "../../core/game/GameMap";

// Mock player colors (from the game's pastel theme)
const PLAYER_COLORS = [
  0xff6b6b, // Red
  0x4ecdc4, // Teal
  0xffe66d, // Yellow
  0x95e1d3, // Mint
  0xf38181, // Coral
  0xaa96da, // Lavender
  0xfcbad3, // Pink
  0xa8d8ea, // Sky blue
  0xf9ed69, // Bright yellow
  0x6a0572, // Purple
];

interface Territory {
  playerId: number;
  centerX: number;
  centerY: number;
  color: THREE.Color;
  tiles: Set<number>; // Set of tile refs
}

export class TerritoryOverlay {
  public readonly mesh: THREE.Mesh;
  public readonly group: THREE.Group;

  private readonly gameMap: GameMap;
  private territories: Territory[] = [];
  private visible = true;
  private heightOffset = 1; // Slight offset above terrain

  constructor(gameMap: GameMap, terrainMesh: THREE.Mesh, heightScale: number) {
    this.gameMap = gameMap;
    this.group = new THREE.Group();

    // Generate mock territories
    this.generateMockTerritories();

    // Create the overlay mesh
    this.mesh = this.createOverlayMesh(terrainMesh, heightScale);
    this.group.add(this.mesh);
  }

  private generateMockTerritories(): void {
    const width = this.gameMap.width();
    const height = this.gameMap.height();

    // Create ~10 mock territories based on landmass regions
    // We'll use a simple approach: divide the map into regions and assign players

    const numPlayers = 10;
    const territoryCenters: Array<{ x: number; y: number }> = [];

    // Find good starting points (land tiles spread across the map)
    const candidateTiles: Array<{ x: number; y: number; ref: number }> = [];

    for (let y = 0; y < height; y += 20) {
      for (let x = 0; x < width; x += 20) {
        if (this.gameMap.isValidCoord(x, y)) {
          const ref = this.gameMap.ref(x, y);
          if (this.gameMap.isLand(ref)) {
            candidateTiles.push({ x, y, ref });
          }
        }
      }
    }

    // Pick spread-out starting points
    const usedIndices = new Set<number>();
    for (let i = 0; i < numPlayers && candidateTiles.length > 0; i++) {
      // Pick a random unused candidate that's far from existing centers
      let bestIdx = -1;
      let bestMinDist = -1;

      for (let j = 0; j < candidateTiles.length; j++) {
        if (usedIndices.has(j)) continue;

        const candidate = candidateTiles[j];
        let minDist = Infinity;

        for (const center of territoryCenters) {
          const dx = candidate.x - center.x;
          const dy = candidate.y - center.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          minDist = Math.min(minDist, dist);
        }

        if (territoryCenters.length === 0) {
          minDist = Math.random() * 1000; // Random for first one
        }

        if (minDist > bestMinDist) {
          bestMinDist = minDist;
          bestIdx = j;
        }
      }

      if (bestIdx >= 0) {
        usedIndices.add(bestIdx);
        const chosen = candidateTiles[bestIdx];
        territoryCenters.push({ x: chosen.x, y: chosen.y });

        this.territories.push({
          playerId: i + 1,
          centerX: chosen.x,
          centerY: chosen.y,
          color: new THREE.Color(PLAYER_COLORS[i % PLAYER_COLORS.length]),
          tiles: new Set(),
        });
      }
    }

    // Assign each land tile to the nearest territory center
    this.gameMap.forEachTile((ref) => {
      if (!this.gameMap.isLand(ref)) return;

      const x = this.gameMap.x(ref);
      const y = this.gameMap.y(ref);

      let nearestTerritory: Territory | null = null;
      let nearestDist = Infinity;

      for (const territory of this.territories) {
        const dx = x - territory.centerX;
        const dy = y - territory.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestTerritory = territory;
        }
      }

      if (nearestTerritory) {
        nearestTerritory.tiles.add(ref);
      }
    });
  }

  private createOverlayMesh(
    terrainMesh: THREE.Mesh,
    heightScale: number
  ): THREE.Mesh {
    const width = this.gameMap.width();
    const height = this.gameMap.height();

    // Create geometry matching terrain
    const geometry = new THREE.PlaneGeometry(
      width,
      height,
      width - 1,
      height - 1
    );
    geometry.rotateX(-Math.PI / 2);

    // Get terrain positions to match height
    const terrainPositions = terrainMesh.geometry.attributes.position;
    const overlayPositions = geometry.attributes.position;
    const colors = new Float32Array(overlayPositions.count * 3);
    const alphas = new Float32Array(overlayPositions.count);

    // Copy terrain heights and set colors based on territory
    for (let i = 0; i < overlayPositions.count; i++) {
      const mapX = i % width;
      const mapY = Math.floor(i / width);

      // Match terrain height plus small offset
      const terrainY = terrainPositions.getY(i);
      overlayPositions.setY(i, terrainY + this.heightOffset);

      // Default to transparent
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0;
      colors[i * 3 + 2] = 0;
      alphas[i] = 0;

      if (this.gameMap.isValidCoord(mapX, mapY)) {
        const ref = this.gameMap.ref(mapX, mapY);

        // Only show territories on land tiles
        if (!this.gameMap.isLand(ref)) continue;

        // Find which territory owns this tile
        for (const territory of this.territories) {
          if (territory.tiles.has(ref)) {
            const color = territory.color;
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            alphas[i] = 0.4; // Semi-transparent

            // Make borders brighter
            const neighbors = this.gameMap.neighbors(ref);
            const isBorder = neighbors.some((n) => !territory.tiles.has(n));
            if (isBorder) {
              alphas[i] = 0.7;
            }
            break;
          }
        }
      }
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));

    // Create shader material for per-vertex alpha
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          if (vAlpha < 0.01) discard;
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
      transparent: true,
      vertexColors: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Mesh is already centered like terrain (PlaneGeometry is centered at origin)

    return mesh;
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.mesh.visible = visible;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public updateHeights(terrainMesh: THREE.Mesh): void {
    const terrainPositions = terrainMesh.geometry.attributes.position;
    const overlayPositions = this.mesh.geometry.attributes.position;

    for (let i = 0; i < overlayPositions.count; i++) {
      const terrainY = terrainPositions.getY(i);
      overlayPositions.setY(i, terrainY + this.heightOffset);
    }

    overlayPositions.needsUpdate = true;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
