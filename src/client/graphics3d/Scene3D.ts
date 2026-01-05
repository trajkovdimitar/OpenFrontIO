import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface Scene3DOptions {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
}

export class Scene3D {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly controls: OrbitControls;

  private animationId: number | null = null;
  private lastTime = 0;
  private frameCount = 0;
  private fpsUpdateTime = 0;
  private currentFps = 0;

  private onFrameCallbacks: Array<(deltaTime: number) => void> = [];

  constructor(options: Scene3DOptions) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.camera.position.set(0, 300, 400);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: options.antialias ?? true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 2000;
    this.controls.maxPolarAngle = Math.PI / 2.1; // Prevent going below ground

    // Setup lighting
    this.setupLighting();

    // Handle window resize
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  private setupLighting(): void {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light for shadows and depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 500, 300);
    directionalLight.castShadow = false; // Disable for performance
    this.scene.add(directionalLight);

    // Hemisphere light for natural outdoor lighting
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

  public onFrame(callback: (deltaTime: number) => void): void {
    this.onFrameCallbacks.push(callback);
  }

  public start(): void {
    if (this.animationId !== null) return;

    this.lastTime = performance.now();
    this.fpsUpdateTime = this.lastTime;

    const animate = (currentTime: number) => {
      this.animationId = requestAnimationFrame(animate);

      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // Calculate FPS
      this.frameCount++;
      if (currentTime - this.fpsUpdateTime >= 1000) {
        this.currentFps = this.frameCount;
        this.frameCount = 0;
        this.fpsUpdateTime = currentTime;
      }

      // Update controls
      this.controls.update();

      // Call frame callbacks
      for (const callback of this.onFrameCallbacks) {
        callback(deltaTime);
      }

      // Render
      this.renderer.render(this.scene, this.camera);
    };

    animate(performance.now());
  }

  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public getFps(): number {
    return this.currentFps;
  }

  public getStats(): { vertices: number; triangles: number } {
    let vertices = 0;
    let triangles = 0;

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const geometry = object.geometry;
        if (geometry.attributes.position) {
          vertices += geometry.attributes.position.count;
        }
        if (geometry.index) {
          triangles += geometry.index.count / 3;
        } else if (geometry.attributes.position) {
          triangles += geometry.attributes.position.count / 3;
        }
      }
    });

    return { vertices, triangles };
  }

  public setCameraTarget(x: number, y: number, z: number): void {
    this.controls.target.set(x, y, z);
    this.controls.update();
  }

  public setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
    this.controls.update();
  }

  public dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize.bind(this));
    this.controls.dispose();
    this.renderer.dispose();

    // Dispose all geometries and materials in the scene
    this.scene.traverse((object) => {
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
