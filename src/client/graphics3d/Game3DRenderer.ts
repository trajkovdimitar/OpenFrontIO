import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GameView } from "../../core/game/GameView";
import { EventBus } from "../../core/EventBus";
import { Layer3D } from "./Layer3D";
import { TerrainLayer3D } from "./layers/TerrainLayer3D";
import { TerritoryLayer3D } from "./layers/TerritoryLayer3D";
import { UnitLayer3D } from "./layers/UnitLayer3D";
import { StructureLayer3D } from "./layers/StructureLayer3D";
import { TransformHandler3D } from "./TransformHandler3D";
import { UIState } from "../graphics/UIState";
import { Layer } from "../graphics/layers/Layer";

export interface Game3DRendererConfig {
  canvas: HTMLCanvasElement;
  gameView: GameView;
  eventBus: EventBus;
}

export class Game3DRenderer {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly controls: OrbitControls;
  public readonly transformHandler: TransformHandler3D;
  public readonly uiState: UIState;

  private readonly gameView: GameView;
  private readonly eventBus: EventBus;
  private readonly layers: Layer3D[] = [];
  private uiLayers: Layer[] = [];

  private animationId: number | null = null;
  private lastTime = 0;

  constructor(config: Game3DRendererConfig) {
    this.gameView = config.gameView;
    this.eventBus = config.eventBus;

    // Initialize UI state (shared with UI components)
    this.uiState = {
      attackRatio: 20,
      ghostStructure: null,
      rocketDirectionUp: true,
    };

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      10000
    );

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 2000;
    this.controls.maxPolarAngle = Math.PI / 2.1;

    // Create transform handler for coordinate conversions
    this.transformHandler = new TransformHandler3D(
      this.camera,
      this.renderer,
      this.gameView
    );

    // Setup lighting
    this.setupLighting();

    // Handle window resize
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 500, 300);
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);
    this.scene.add(hemisphereLight);
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Set UI layers (2D overlay components like leaderboard, build menu, etc.)
   */
  public setUILayers(layers: Layer[]): void {
    this.uiLayers = layers;
  }

  public initialize(): void {
    try {
      console.log("Game3DRenderer: Starting initialization");

      // Append canvas to document if not already there
      const canvas = this.renderer.domElement;
      if (!document.body.contains(canvas)) {
        document.body.appendChild(canvas);
      }
      console.log("Game3DRenderer: Canvas appended");

      // Create and initialize all 3D layers
      console.log("Game3DRenderer: Creating layers");
      const terrainLayer = new TerrainLayer3D(this.gameView, this.scene);
      const territoryLayer = new TerritoryLayer3D(this.gameView, this.scene);
      const structureLayer = new StructureLayer3D(this.gameView, this.scene);
      const unitLayer = new UnitLayer3D(this.gameView, this.scene);

      this.layers.push(terrainLayer, territoryLayer, structureLayer, unitLayer);

      // Initialize all 3D layers
      console.log("Game3DRenderer: Initializing 3D layers");
      for (const layer of this.layers) {
        layer.init();
      }
      console.log("Game3DRenderer: 3D layers initialized");

      // Initialize all UI layers
      console.log("Game3DRenderer: Initializing UI layers");
      for (const layer of this.uiLayers) {
        layer.init?.();
      }
      console.log("Game3DRenderer: UI layers initialized");

      // Position camera to view the map
      this.centerCamera();
      console.log("Game3DRenderer: Camera centered");

      // Start render loop
      this.startRenderLoop();
      console.log("Game3DRenderer: Render loop started");
    } catch (error) {
      console.error("Game3DRenderer initialization failed:", error);
      throw error;
    }
  }

  private centerCamera(): void {
    const width = this.gameView.width();
    const height = this.gameView.height();
    const maxDim = Math.max(width, height);

    this.camera.position.set(0, maxDim * 0.6, maxDim * 0.5);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  public tick(): void {
    // Called when game state updates
    // Tick 3D layers
    for (const layer of this.layers) {
      layer.tick();
    }
    // Tick UI layers
    for (const layer of this.uiLayers) {
      layer.tick?.();
    }
  }

  private startRenderLoop(): void {
    const animate = (currentTime: number) => {
      this.animationId = requestAnimationFrame(animate);

      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // Update controls
      this.controls.update();

      // Update layers
      for (const layer of this.layers) {
        layer.update(deltaTime);
      }

      // Render
      this.renderer.render(this.scene, this.camera);
    };

    this.lastTime = performance.now();
    animate(this.lastTime);
  }

  public dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    window.removeEventListener("resize", this.handleResize.bind(this));

    for (const layer of this.layers) {
      layer.dispose();
    }

    this.controls.dispose();
    this.renderer.dispose();
  }
}
