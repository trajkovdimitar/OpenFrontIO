import * as THREE from "three";
import { GameView } from "../../core/game/GameView";
import { Cell } from "../../core/game/Game";
import { TileRef } from "../../core/game/GameMap";

/**
 * Handles coordinate transformations between screen, world, and game coordinates
 */
export class TransformHandler3D {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly game: GameView;
  private readonly raycaster: THREE.Raycaster;
  private readonly groundPlane: THREE.Plane;

  constructor(
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    game: GameView
  ) {
    this.camera = camera;
    this.renderer = renderer;
    this.game = game;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  /**
   * Convert screen coordinates to game tile coordinates
   * Returns a Cell (may be invalid, caller should check with isValidCoord)
   */
  public screenToWorldCoordinates(screenX: number, screenY: number): Cell {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    // Convert to normalized device coordinates (-1 to +1)
    const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;

    // Set up raycaster
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    // Intersect with ground plane (y = 0)
    const intersection = new THREE.Vector3();
    const ray = this.raycaster.ray;

    if (ray.intersectPlane(this.groundPlane, intersection)) {
      // Convert 3D world position to game coordinates
      // The terrain is centered at origin, so we need to offset
      const width = this.game.width();
      const height = this.game.height();

      const gameX = Math.floor(intersection.x + width / 2);
      const gameY = Math.floor(intersection.z + height / 2);

      return new Cell(gameX, gameY);
    }

    // Return invalid coordinates if ray doesn't hit plane
    return new Cell(-1, -1);
  }

  /**
   * Convert game tile coordinates to screen coordinates
   */
  public worldToScreenCoordinates(cell: Cell): { x: number; y: number } | null {
    const width = this.game.width();
    const height = this.game.height();

    // Convert game coords to 3D world position
    const worldX = cell.x - width / 2 + 0.5;
    const worldZ = cell.y - height / 2 + 0.5;

    // Get terrain height at this position (approximate)
    let worldY = 0;
    if (this.game.isValidCoord(cell.x, cell.y)) {
      const ref = this.game.ref(cell.x, cell.y);
      if (this.game.isLand(ref)) {
        worldY = this.game.magnitude(ref) * 0.1; // heightScale
      }
    }

    const worldPos = new THREE.Vector3(worldX, worldY, worldZ);

    // Project to screen
    const screenPos = worldPos.clone().project(this.camera);

    const canvas = this.renderer.domElement;
    const x = ((screenPos.x + 1) / 2) * canvas.clientWidth;
    const y = ((-screenPos.y + 1) / 2) * canvas.clientHeight;

    // Check if on screen
    if (screenPos.z > 1) {
      return null; // Behind camera
    }

    return { x, y };
  }

  /**
   * Get the tile reference at screen coordinates
   */
  public getTileAtScreen(screenX: number, screenY: number): TileRef | null {
    const cell = this.screenToWorldCoordinates(screenX, screenY);
    if (cell && this.game.isValidCoord(cell.x, cell.y)) {
      return this.game.ref(cell.x, cell.y);
    }
    return null;
  }

  /**
   * Convert game coordinates to 3D world position
   */
  public gameToWorld3D(x: number, y: number, includeHeight = true): THREE.Vector3 {
    const width = this.game.width();
    const height = this.game.height();

    const worldX = x - width / 2 + 0.5;
    const worldZ = y - height / 2 + 0.5;

    let worldY = 0;
    if (includeHeight && this.game.isValidCoord(x, y)) {
      const ref = this.game.ref(x, y);
      if (this.game.isLand(ref)) {
        worldY = this.game.magnitude(ref) * 0.1 + 0.1; // Slightly above terrain
      }
    }

    return new THREE.Vector3(worldX, worldY, worldZ);
  }
}
