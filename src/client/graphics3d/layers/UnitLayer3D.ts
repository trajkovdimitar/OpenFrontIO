import * as THREE from "three";
import { BaseLayer3D } from "../Layer3D";
import { GameView, UnitView } from "../../../core/game/GameView";
import { UnitType } from "../../../core/game/Game";

interface UnitMesh {
  mesh: THREE.Mesh | THREE.Group;
  unitId: number;
  lastPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  lerpProgress: number;
}

/**
 * Renders mobile units (troops, ships, missiles, etc.) as 3D objects
 */
export class UnitLayer3D extends BaseLayer3D {
  private units: Map<number, UnitMesh> = new Map();
  private heightScale = 0.1;

  // Unit types to render (mobile units only, not structures)
  private readonly mobileUnitTypes = [
    UnitType.TransportShip,
    UnitType.Warship,
    UnitType.TradeShip,
    UnitType.AtomBomb,
    UnitType.HydrogenBomb,
    UnitType.MIRV,
    UnitType.MIRVWarhead,
    UnitType.SAMMissile,
    UnitType.Train,
  ];

  private readonly unitConfigs: Record<
    string,
    { color: number; size: number; shape: string }
  > = {
    [UnitType.TransportShip]: { color: 0x888888, size: 3, shape: "boat" },
    [UnitType.Warship]: { color: 0x444444, size: 4, shape: "boat" },
    [UnitType.TradeShip]: { color: 0xddaa00, size: 3, shape: "boat" },
    [UnitType.AtomBomb]: { color: 0xff0000, size: 2, shape: "missile" },
    [UnitType.HydrogenBomb]: { color: 0xff4400, size: 3, shape: "missile" },
    [UnitType.MIRV]: { color: 0xff0088, size: 4, shape: "missile" },
    [UnitType.MIRVWarhead]: { color: 0xff0044, size: 1.5, shape: "missile" },
    [UnitType.SAMMissile]: { color: 0x00ff00, size: 1.5, shape: "missile" },
    [UnitType.Train]: { color: 0x8b4513, size: 3, shape: "train" },
  };

  constructor(game: GameView, scene: THREE.Scene) {
    super(game, scene);
  }

  init(): void {
    this.updateAllUnits();
  }

  tick(): void {
    this.updateAllUnits();
  }

  update(deltaTime: number): void {
    // Interpolate unit positions for smooth movement
    for (const [, unit] of this.units) {
      if (unit.lerpProgress < 1) {
        unit.lerpProgress = Math.min(unit.lerpProgress + deltaTime * 5, 1);
        unit.mesh.position.lerpVectors(
          unit.lastPosition,
          unit.targetPosition,
          unit.lerpProgress
        );
      }
    }
  }

  private updateAllUnits(): void {
    const currentUnits = this.game.units(...this.mobileUnitTypes);
    const currentIds = new Set<number>();

    for (const unit of currentUnits) {
      if (!unit.isActive()) continue;

      currentIds.add(unit.id());

      if (this.units.has(unit.id())) {
        this.updateUnit(unit);
      } else {
        this.createUnit(unit);
      }
    }

    // Remove units that no longer exist
    for (const [id, unitMesh] of this.units) {
      if (!currentIds.has(id)) {
        this.group.remove(unitMesh.mesh);
        if (unitMesh.mesh instanceof THREE.Mesh) {
          unitMesh.mesh.geometry.dispose();
          (unitMesh.mesh.material as THREE.Material).dispose();
        }
        this.units.delete(id);
      }
    }
  }

  private createUnit(unit: UnitView): void {
    const config = this.unitConfigs[unit.type()];
    if (!config) return;

    const position = this.getUnitPosition(unit);

    let mesh: THREE.Mesh;

    if (config.shape === "boat") {
      mesh = this.createBoatMesh(config.size, config.color);
    } else if (config.shape === "missile") {
      mesh = this.createMissileMesh(config.size, config.color);
    } else {
      const geometry = new THREE.SphereGeometry(config.size / 2, 8, 8);
      const material = new THREE.MeshLambertMaterial({ color: config.color });
      mesh = new THREE.Mesh(geometry, material);
    }

    // Color by owner
    const owner = unit.owner();
    if (owner) {
      const playerColor = owner.territoryColor();
      const rgb = playerColor.toRgb();
      const color = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
      (mesh.material as THREE.MeshLambertMaterial).color.setHex(color);
    }

    mesh.position.copy(position);
    this.group.add(mesh);

    this.units.set(unit.id(), {
      mesh,
      unitId: unit.id(),
      lastPosition: position.clone(),
      targetPosition: position.clone(),
      lerpProgress: 1,
    });
  }

  private updateUnit(unit: UnitView): void {
    const unitMesh = this.units.get(unit.id());
    if (!unitMesh) return;

    const newPosition = this.getUnitPosition(unit);

    // Check if position changed significantly
    if (newPosition.distanceTo(unitMesh.targetPosition) > 0.1) {
      unitMesh.lastPosition.copy(unitMesh.mesh.position);
      unitMesh.targetPosition.copy(newPosition);
      unitMesh.lerpProgress = 0;
    }

    // Update color based on owner
    const owner = unit.owner();
    if (owner && unitMesh.mesh instanceof THREE.Mesh) {
      const playerColor = owner.territoryColor();
      const rgb = playerColor.toRgb();
      const color = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
      (unitMesh.mesh.material as THREE.MeshLambertMaterial).color.setHex(color);
    }
  }

  private getUnitPosition(unit: UnitView): THREE.Vector3 {
    const tile = unit.tile();
    const mapX = this.game.x(tile);
    const mapY = this.game.y(tile);

    const width = this.game.width();
    const height = this.game.height();

    const worldX = mapX - width / 2 + 0.5;
    const worldZ = mapY - height / 2 + 0.5;

    // Height depends on unit type
    let worldY: number;
    const config = this.unitConfigs[unit.type()];

    if (config?.shape === "boat") {
      worldY = 1; // On water surface
    } else if (config?.shape === "missile") {
      worldY = 30; // High in the air
    } else {
      worldY = 5;
    }

    // Add terrain height for land units
    if (
      this.game.isValidCoord(mapX, mapY) &&
      this.game.isLand(this.game.ref(mapX, mapY))
    ) {
      const terrainHeight =
        this.game.magnitude(this.game.ref(mapX, mapY)) * this.heightScale;
      worldY = Math.max(worldY, terrainHeight + 2);
    }

    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  private createBoatMesh(size: number, color: number): THREE.Mesh {
    // Simple boat shape
    const geometry = new THREE.ConeGeometry(size / 2, size * 1.5, 4);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshLambertMaterial({ color });
    return new THREE.Mesh(geometry, material);
  }

  private createMissileMesh(size: number, color: number): THREE.Mesh {
    // Missile shape
    const geometry = new THREE.ConeGeometry(size / 3, size * 2, 8);
    geometry.rotateX(Math.PI); // Point downward
    const material = new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
    });
    return new THREE.Mesh(geometry, material);
  }
}
