import * as THREE from "three";
import { BaseLayer3D } from "../Layer3D";
import { GameView, UnitView } from "../../../core/game/GameView";
import { UnitType } from "../../../core/game/Game";

interface StructureMesh {
  mesh: THREE.Mesh;
  unitId: number;
}

/**
 * Renders structures (cities, factories, ports, etc.) as 3D objects
 */
export class StructureLayer3D extends BaseLayer3D {
  private structures: Map<number, StructureMesh> = new Map();
  private heightScale = 0.1;

  // Structure type configurations
  private readonly structureConfigs: Record<
    string,
    { color: number; height: number; radius: number }
  > = {
    [UnitType.City]: { color: 0xffd700, height: 8, radius: 4 },
    [UnitType.Factory]: { color: 0x808080, height: 6, radius: 3 },
    [UnitType.Port]: { color: 0x4169e1, height: 4, radius: 3 },
    [UnitType.DefensePost]: { color: 0x8b4513, height: 5, radius: 2 },
    [UnitType.MissileSilo]: { color: 0xff4500, height: 7, radius: 3 },
    [UnitType.SAMLauncher]: { color: 0x32cd32, height: 6, radius: 2 },
  };

  private readonly structureTypes = [
    UnitType.City,
    UnitType.Factory,
    UnitType.Port,
    UnitType.DefensePost,
    UnitType.MissileSilo,
    UnitType.SAMLauncher,
  ];

  constructor(game: GameView, scene: THREE.Scene) {
    super(game, scene);
  }

  init(): void {
    // Initial render of all structures
    this.updateAllStructures();
  }

  tick(): void {
    // Check for unit updates
    this.updateAllStructures();
  }

  private updateAllStructures(): void {
    const currentUnits = this.game.units(...this.structureTypes);
    const currentIds = new Set<number>();

    for (const unit of currentUnits) {
      currentIds.add(unit.id());

      if (this.structures.has(unit.id())) {
        // Update existing
        this.updateStructure(unit);
      } else {
        // Create new
        this.createStructure(unit);
      }
    }

    // Remove structures that no longer exist
    for (const [id, structure] of this.structures) {
      if (!currentIds.has(id)) {
        this.group.remove(structure.mesh);
        structure.mesh.geometry.dispose();
        (structure.mesh.material as THREE.Material).dispose();
        this.structures.delete(id);
      }
    }
  }

  private createStructure(unit: UnitView): void {
    const config = this.structureConfigs[unit.type()];
    if (!config) return;

    const tile = unit.tile();
    const x = this.game.x(tile);
    const y = this.game.y(tile);

    const position = this.getWorldPosition(x, y);

    // Create geometry based on type
    let geometry: THREE.BufferGeometry;
    if (unit.type() === UnitType.City) {
      geometry = new THREE.CylinderGeometry(
        config.radius,
        config.radius * 1.2,
        config.height,
        8
      );
    } else if (unit.type() === UnitType.Factory) {
      geometry = new THREE.BoxGeometry(
        config.radius * 2,
        config.height,
        config.radius * 2
      );
    } else if (unit.type() === UnitType.MissileSilo) {
      geometry = new THREE.ConeGeometry(config.radius, config.height, 6);
    } else {
      geometry = new THREE.CylinderGeometry(
        config.radius * 0.8,
        config.radius,
        config.height,
        6
      );
    }

    // Get owner color
    let color = config.color;
    const owner = unit.owner();
    if (owner) {
      const playerColor = owner.territoryColor();
      const rgb = playerColor.toRgb();
      color = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
    }

    const material = new THREE.MeshLambertMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.2,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + config.height / 2, position.z);

    // Scale down if under construction
    if (unit.isUnderConstruction()) {
      mesh.scale.setScalar(0.5);
    }

    this.group.add(mesh);
    this.structures.set(unit.id(), { mesh, unitId: unit.id() });
  }

  private updateStructure(unit: UnitView): void {
    const structure = this.structures.get(unit.id());
    if (!structure) return;

    const tile = unit.tile();
    const x = this.game.x(tile);
    const y = this.game.y(tile);
    const position = this.getWorldPosition(x, y);

    const config = this.structureConfigs[unit.type()];
    if (!config) return;

    structure.mesh.position.set(
      position.x,
      position.y + config.height / 2,
      position.z
    );

    // Update scale based on construction status
    if (unit.isUnderConstruction()) {
      structure.mesh.scale.setScalar(0.5);
    } else {
      structure.mesh.scale.setScalar(1);
    }

    // Update color based on owner
    const owner = unit.owner();
    if (owner) {
      const playerColor = owner.territoryColor();
      const rgb = playerColor.toRgb();
      const color = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
      (structure.mesh.material as THREE.MeshLambertMaterial).color.setHex(
        color
      );
      (structure.mesh.material as THREE.MeshLambertMaterial).emissive.setHex(
        color
      );
    }
  }

  private getWorldPosition(mapX: number, mapY: number): THREE.Vector3 {
    const width = this.game.width();
    const height = this.game.height();

    const worldX = mapX - width / 2 + 0.5;
    const worldZ = mapY - height / 2 + 0.5;

    let worldY = 0;
    if (this.game.isValidCoord(mapX, mapY)) {
      const ref = this.game.ref(mapX, mapY);
      if (this.game.isLand(ref)) {
        worldY = this.game.magnitude(ref) * this.heightScale;
      }
    }

    return new THREE.Vector3(worldX, worldY, worldZ);
  }
}
