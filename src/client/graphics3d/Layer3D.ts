import * as THREE from "three";
import { GameView } from "../../core/game/GameView";

/**
 * Base interface for all 3D rendering layers
 */
export interface Layer3D {
  /** One-time initialization */
  init(): void;

  /** Called each game tick when state updates */
  tick(): void;

  /** Called each render frame for animations */
  update(deltaTime: number): void;

  /** Cleanup resources */
  dispose(): void;
}

/**
 * Base class for 3D layers with common functionality
 */
export abstract class BaseLayer3D implements Layer3D {
  protected readonly game: GameView;
  protected readonly scene: THREE.Scene;
  protected readonly group: THREE.Group;

  constructor(game: GameView, scene: THREE.Scene) {
    this.game = game;
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  abstract init(): void;
  abstract tick(): void;

  update(deltaTime: number): void {
    // Override in subclasses for animation
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
