import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EventBus } from "../../core/EventBus";
import { TransformHandler3D } from "./TransformHandler3D";
import { GameView } from "../../core/game/GameView";
import { TileRef } from "../../core/game/GameMap";
import {
  MouseUpEvent,
  MouseMoveEvent,
  ContextMenuEvent,
  ZoomEvent,
} from "../InputHandler";

export interface InputHandler3DConfig {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  transformHandler: TransformHandler3D;
  gameView: GameView;
  eventBus: EventBus;
}

/**
 * Handles user input for the 3D game view
 * Emits standard game events compatible with ClientGameRunner
 */
export class InputHandler3D {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly transformHandler: TransformHandler3D;
  private readonly game: GameView;
  private readonly eventBus: EventBus;

  private isPointerDown = false;
  private pointerDownPos = { x: 0, y: 0 };
  private lastHoveredTile: TileRef | null = null;

  constructor(config: InputHandler3DConfig) {
    this.canvas = config.canvas;
    this.camera = config.camera;
    this.controls = config.controls;
    this.transformHandler = config.transformHandler;
    this.game = config.gameView;
    this.eventBus = config.eventBus;
  }

  public initialize(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown.bind(this));
    this.canvas.addEventListener("pointerup", this.onPointerUp.bind(this));
    this.canvas.addEventListener("pointermove", this.onPointerMove.bind(this));
    this.canvas.addEventListener("contextmenu", this.onContextMenu.bind(this));
    this.canvas.addEventListener("wheel", this.onWheel.bind(this));

    // Keyboard
    window.addEventListener("keydown", this.onKeyDown.bind(this));
  }

  private onPointerDown(event: PointerEvent): void {
    this.isPointerDown = true;
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    // Check if it was a click (small movement)
    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) {
      // It's a click - emit standard events with screen coordinates
      if (event.button === 2) {
        // Right click
        this.eventBus.emit(new ContextMenuEvent(event.clientX, event.clientY));
      } else {
        // Left click
        this.eventBus.emit(new MouseUpEvent(event.clientX, event.clientY));
      }
    }
  }

  private onPointerMove(event: PointerEvent): void {
    const cell = this.transformHandler.screenToWorldCoordinates(
      event.clientX,
      event.clientY
    );

    if (this.game.isValidCoord(cell.x, cell.y)) {
      const tileRef = this.game.ref(cell.x, cell.y);

      if (tileRef !== this.lastHoveredTile) {
        this.lastHoveredTile = tileRef;
        // Emit standard MouseMoveEvent with screen coordinates
        this.eventBus.emit(new MouseMoveEvent(event.clientX, event.clientY));
      }
    }
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private onWheel(event: WheelEvent): void {
    // OrbitControls handles zoom, but we can emit events for UI
    this.eventBus.emit(new ZoomEvent(event.clientX, event.clientY, event.deltaY));
  }

  private onKeyDown(_event: KeyboardEvent): void {
    // Handle keyboard shortcuts
    // Most are handled by the existing game code
    // We just need to make sure they still work

    // Camera movement with WASD is handled by OrbitControls
    // But we can add additional shortcuts here if needed
  }

  public dispose(): void {
    this.canvas.removeEventListener(
      "pointerdown",
      this.onPointerDown.bind(this)
    );
    this.canvas.removeEventListener("pointerup", this.onPointerUp.bind(this));
    this.canvas.removeEventListener(
      "pointermove",
      this.onPointerMove.bind(this)
    );
    this.canvas.removeEventListener(
      "contextmenu",
      this.onContextMenu.bind(this)
    );
    this.canvas.removeEventListener("wheel", this.onWheel.bind(this));
    window.removeEventListener("keydown", this.onKeyDown.bind(this));
  }
}
