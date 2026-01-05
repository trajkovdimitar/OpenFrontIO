import * as THREE from "three";
import { BaseLayer3D } from "../Layer3D";
import { GameView } from "../../../core/game/GameView";
import { TileRef } from "../../../core/game/GameMap";

/**
 * Renders territory ownership colors as a layer above terrain
 */
export class TerritoryLayer3D extends BaseLayer3D {
  private territoryMesh: THREE.Mesh | null = null;
  private colors: Float32Array | null = null;
  private alphas: Float32Array | null = null;
  private heightScale = 0.1;
  private heightOffset = 0.05;

  constructor(game: GameView, scene: THREE.Scene) {
    super(game, scene);
  }

  init(): void {
    this.createTerritoryMesh();
  }

  tick(): void {
    // Update territories that changed this tick
    const updatedTiles = this.game.recentlyUpdatedTiles();
    if (updatedTiles.length > 0) {
      this.updateTiles(updatedTiles);
    }
  }

  private createTerritoryMesh(): void {
    const width = this.game.width();
    const height = this.game.height();

    const geometry = new THREE.PlaneGeometry(
      width,
      height,
      width - 1,
      height - 1
    );
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    this.colors = new Float32Array(positions.count * 3);
    this.alphas = new Float32Array(positions.count);

    // Set initial heights and colors
    for (let i = 0; i < positions.count; i++) {
      const mapX = i % width;
      const mapY = Math.floor(i / width);

      if (this.game.isValidCoord(mapX, mapY)) {
        const ref = this.game.ref(mapX, mapY);
        this.updateTileData(i, ref, mapX, mapY);

        // Set height to match terrain
        let y = this.heightOffset;
        if (this.game.isLand(ref)) {
          y = this.game.magnitude(ref) * this.heightScale + this.heightOffset;
        }
        positions.setY(i, y);
      }
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1));

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

    this.territoryMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.territoryMesh);
  }

  private updateTiles(tiles: TileRef[]): void {
    if (!this.territoryMesh || !this.colors || !this.alphas) return;

    const width = this.game.width();

    for (const ref of tiles) {
      const mapX = this.game.x(ref);
      const mapY = this.game.y(ref);
      const i = mapY * width + mapX;

      if (i >= 0 && i < this.colors.length / 3) {
        this.updateTileData(i, ref, mapX, mapY);
      }
    }

    // Mark attributes as needing update
    const geometry = this.territoryMesh.geometry;
    geometry.attributes.color.needsUpdate = true;
    (geometry.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateTileData(
    i: number,
    ref: TileRef,
    _mapX: number,
    _mapY: number
  ): void {
    if (!this.colors || !this.alphas) return;

    // Default to transparent
    this.colors[i * 3] = 0;
    this.colors[i * 3 + 1] = 0;
    this.colors[i * 3 + 2] = 0;
    this.alphas[i] = 0;

    // Only show on land
    if (!this.game.isLand(ref)) return;

    // Check ownership
    if (!this.game.hasOwner(ref)) return;

    const owner = this.game.owner(ref);
    if (!owner || owner.isPlayer() === false) return;

    const player = owner;
    const territoryColor = player.territoryColor(ref);

    // Convert Colord to RGB
    const rgb = territoryColor.toRgb();
    this.colors[i * 3] = rgb.r / 255;
    this.colors[i * 3 + 1] = rgb.g / 255;
    this.colors[i * 3 + 2] = rgb.b / 255;

    // Check if border tile (brighter)
    const isBorder = this.game.isBorder(ref);
    this.alphas[i] = isBorder ? 0.7 : 0.4;
  }

  public fullRedraw(): void {
    if (!this.colors || !this.alphas || !this.territoryMesh) return;

    const width = this.game.width();
    const height = this.game.height();

    for (let mapY = 0; mapY < height; mapY++) {
      for (let mapX = 0; mapX < width; mapX++) {
        const i = mapY * width + mapX;
        if (this.game.isValidCoord(mapX, mapY)) {
          const ref = this.game.ref(mapX, mapY);
          this.updateTileData(i, ref, mapX, mapY);
        }
      }
    }

    const geometry = this.territoryMesh.geometry;
    geometry.attributes.color.needsUpdate = true;
    (geometry.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
  }
}
