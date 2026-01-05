import * as THREE from "three";
import { BaseLayer3D } from "../Layer3D";
import { GameView } from "../../../core/game/GameView";
import { TerrainType } from "../../../core/game/Game";

/**
 * Renders the 3D terrain mesh from GameView data
 */
export class TerrainLayer3D extends BaseLayer3D {
  private terrainMesh: THREE.Mesh | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private heightScale = 0.1;

  constructor(game: GameView, scene: THREE.Scene) {
    super(game, scene);
  }

  init(): void {
    console.log("TerrainLayer3D: init starting");
    console.log(`TerrainLayer3D: Map size ${this.game.width()}x${this.game.height()}`);
    this.createTerrainMesh();
    console.log("TerrainLayer3D: terrain mesh created");
    this.createWaterMesh();
    console.log("TerrainLayer3D: water mesh created");
  }

  tick(): void {
    // Terrain is static, no updates needed
  }

  private createTerrainMesh(): void {
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
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const mapX = i % width;
      const mapY = Math.floor(i / width);

      if (this.game.isValidCoord(mapX, mapY)) {
        const tileRef = this.game.ref(mapX, mapY);

        let y: number;
        if (this.game.isLand(tileRef)) {
          const magnitude = this.game.magnitude(tileRef);
          y = magnitude * this.heightScale;
        } else {
          y = 0; // At water level
        }

        positions.setY(i, y);

        const color = this.getTerrainColor(tileRef);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.terrainMesh);
  }

  private getTerrainColor(tileRef: number): THREE.Color {
    const terrainType = this.game.terrainType(tileRef);
    const magnitude = this.game.magnitude(tileRef);

    if (this.game.isLand(tileRef) && this.game.isShore(tileRef)) {
      return new THREE.Color(0xcccc9e);
    }

    switch (terrainType) {
      case TerrainType.Plains: {
        const t = magnitude / 10;
        return new THREE.Color(0xbedc8a).lerp(new THREE.Color(0xa8c878), t);
      }
      case TerrainType.Highland: {
        const t = (magnitude - 10) / 10;
        return new THREE.Color(0xdccb9e).lerp(new THREE.Color(0xeeddb0), t);
      }
      case TerrainType.Mountain: {
        const t = (magnitude - 20) / 10;
        return new THREE.Color(0xe6e6e6).lerp(
          new THREE.Color(0xfafafa),
          Math.min(t, 1)
        );
      }
      case TerrainType.Ocean:
      case TerrainType.Lake: {
        const t = Math.min(magnitude / 15, 1);
        return new THREE.Color(0x6490ff).lerp(new THREE.Color(0x4682b4), t);
      }
      default:
        return new THREE.Color(0x888888);
    }
  }

  private createWaterMesh(): void {
    const width = this.game.width();
    const height = this.game.height();

    const geometry = new THREE.PlaneGeometry(width * 1.5, height * 1.5);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshLambertMaterial({
      color: 0x4a90d9,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    this.waterMesh = new THREE.Mesh(geometry, material);
    this.waterMesh.position.y = 0;
    this.group.add(this.waterMesh);
  }
}
