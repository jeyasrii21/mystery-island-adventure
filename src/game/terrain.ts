import * as THREE from 'three';
import { LevelConfig } from './types';

export const WATER_LEVEL = 0.0;
export const ISLAND_RADIUS = 52;

export interface BridgeSpec {
  x: number;
  z: number;
  rotationY: number;
  length: number;
  width: number;
  deckY: number;
}

export interface SteppingStoneSpec {
  x: number;
  z: number;
  radius: number;
  topY: number;
}

// Smooth deterministic noise helpers
function hash2(x: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number, seed: number): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    val += amp * (valueNoise(x * freq, z * freq, seed + i * 11.3) * 2 - 1);
    freq *= 2.05;
    amp *= 0.48;
  }
  return val;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// River path centerline X as a function of Z (runs from waterfall cliff z=-10 down to z=52)
export function getRiverCenterX(z: number): number {
  return -8 + Math.sin(z * 0.085 + 0.4) * 5.2 + (z + 10) * 0.19;
}

export function getRiverHalfWidth(z: number): number {
  // Wider at the waterfall plunge pool (z around -10) and near the bay mouth (z > 38)
  const plunge = Math.exp(-Math.pow((z + 10) / 4.8, 2)) * 2.2;
  const mouth = smoothstep(32, 48, z) * 2.8;
  return 2.7 + plunge + mouth;
}

export function isInRiverChannel(x: number, z: number): boolean {
  if (z < -12 || z > 52) return false;
  const rx = getRiverCenterX(z);
  const rw = getRiverHalfWidth(z);
  return Math.abs(x - rx) < rw * 0.88;
}

export function getTerrainHeight(
  x: number,
  z: number,
  level: LevelConfig,
): number {
  const dist = Math.hypot(x, z);
  const angle = Math.atan2(z, x);

  // Organic coastline radius modulation
  const coastWarp =
    Math.sin(angle * 3 + level.terrainSeed) * 3.8 +
    Math.cos(angle * 5 - level.terrainSeed * 0.7) * 2.4;
  const effectiveR = ISLAND_RADIUS + coastWarp;

  // Base island dome & beach shelf
  const normDist = dist / effectiveR;
  let height = 0;

  if (normDist < 1.18) {
    // Rising gently from seabed (-3.2) through beach (0..1.4) to meadow (~2.2)
    const islandMask = 1 - smoothstep(0.76, 1.06, normDist);
    const shelf = smoothstep(0.68, 0.94, 1 - normDist + 0.32);
    height = -3.4 + islandMask * 5.4 + shelf * 0.4;
  } else {
    height = -3.4;
  }

  // Rolling interior hills
  const n = fbm(x * 0.042, z * 0.042, level.terrainSeed);
  const interiorMask = 1 - smoothstep(0.55, 0.92, normDist);
  height += n * 2.6 * interiorMask;

  // Northern/North-Western Mountain Ridge & Waterfall Cliff
  // High cliff ledge north of z = -12, especially around x = -12..-4, z = -28..-12
  const northFactor = smoothstep(-6, -24, z) * (1 - smoothstep(0.62, 0.94, normDist));
  const peakNoise = 0.7 + 0.45 * valueNoise(x * 0.08, z * 0.08, level.terrainSeed + 5);
  height += northFactor * 7.2 * level.mountainScale * peakNoise;

  // Secondary scenic Eastern peak around (24, -10)
  const eastPeakDist = Math.hypot(x - 28, z + 6);
  height +=
    Math.exp(-Math.pow(eastPeakDist / 12, 2)) * 6.5 * level.mountainScale;

  // Western overlook ridge around (-30, 8)
  const westPeakDist = Math.hypot(x + 30, z - 8);
  height +=
    Math.exp(-Math.pow(westPeakDist / 11, 2)) * 4.8 * level.mountainScale;

  // Carve the Waterfall Spring Basin at (-8, -20)
  const springDist = Math.hypot(x + 8, z + 19);
  if (springDist < 6.5) {
    const basin = 1 - smoothstep(2.2, 6.5, springDist);
    height = THREE.MathUtils.lerp(height, 6.8, basin * 0.85);
  }

  // Carve the Winding River Valley from z = -11 south to the sea
  if (z >= -12.5 && z <= 55) {
    const rx = getRiverCenterX(z);
    const rw = getRiverHalfWidth(z);
    const dRiver = Math.abs(x - rx);
    if (dRiver < rw + 3.2) {
      const riverCarve = 1 - smoothstep(rw * 0.55, rw + 3.0, dRiver);
      const riverFadeStart = smoothstep(-12.5, -9.2, z);
      const bedDepth = -1.25;
      height = THREE.MathUtils.lerp(
        height,
        Math.min(height, bedDepth),
        riverCarve * riverFadeStart,
      );
    }
  }

  // Flatten Spawn clearing smoothly so starting point is clean & comfortable
  const spawnDist = Math.hypot(x - level.spawnPos.x, z - level.spawnPos.z);
  if (spawnDist < 7.5) {
    const flatMask = 1 - smoothstep(3.2, 7.5, spawnDist);
    const targetSpawnH = 2.4;
    height = THREE.MathUtils.lerp(height, targetSpawnH, flatMask);
  }

  // Flatten Portal Shrine plateau smoothly so the Ancient Shrine sits level
  const portalDist = Math.hypot(x - level.portalPos.x, z - level.portalPos.z);
  if (portalDist < 8.5) {
    const flatMask = 1 - smoothstep(3.6, 8.5, portalDist);
    const targetPortalH =
      level.portalPos.z < -20 ? 5.8 + (level.id - 1) * 0.45 : 3.2;
    height = THREE.MathUtils.lerp(height, targetPortalH, flatMask);
  }

  return height;
}

export function getLevelBridges(level: LevelConfig): BridgeSpec[] {
  // Bridge 1: Southern crossing
  const z1 = 16;
  const x1 = getRiverCenterX(z1);
  const dx1 = getRiverCenterX(z1 + 1) - getRiverCenterX(z1 - 1);
  const angle1 = -Math.atan2(dx1, 2);

  // Bridge 2: Northern/mid crossing
  const z2 = -2;
  const x2 = getRiverCenterX(z2);
  const dx2 = getRiverCenterX(z2 + 1) - getRiverCenterX(z2 - 1);
  const angle2 = -Math.atan2(dx2, 2);

  const bank1 = Math.max(
    1.55,
    getTerrainHeight(x1 - 4.2, z1, level),
    getTerrainHeight(x1 + 4.2, z1, level),
  );
  const bank2 = Math.max(
    1.75,
    getTerrainHeight(x2 - 4.2, z2, level),
    getTerrainHeight(x2 + 4.2, z2, level),
  );

  return [
    {
      x: x1,
      z: z1,
      rotationY: angle1,
      length: 9.2,
      width: 3.1,
      deckY: bank1 + 0.35,
    },
    {
      x: x2,
      z: z2,
      rotationY: angle2,
      length: 9.4,
      width: 3.1,
      deckY: bank2 + 0.35,
    },
  ];
}

export function getLevelSteppingStones(): SteppingStoneSpec[] {
  const zList = [5.2, 7.6, 10.0, 24.5, 27.0];
  return zList.map((z, idx) => {
    const rx = getRiverCenterX(z);
    const offset = idx % 2 === 0 ? -0.9 : 0.9;
    return {
      x: rx + offset,
      z,
      radius: 1.25,
      topY: WATER_LEVEL + 0.48,
    };
  });
}

export function getWalkableHeight(
  x: number,
  z: number,
  level: LevelConfig,
  bridges: BridgeSpec[],
  stones: SteppingStoneSpec[],
  currentPlayerY = 999,
): number {
  let h = getTerrainHeight(x, z, level);

  // Check bridges (walkable if player is near or above bridge deck)
  for (const b of bridges) {
    const dx = x - b.x;
    const dz = z - b.z;
    const cos = Math.cos(-b.rotationY);
    const sin = Math.sin(-b.rotationY);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    if (
      Math.abs(localX) <= b.length * 0.52 &&
      Math.abs(localZ) <= b.width * 0.54
    ) {
      if (currentPlayerY >= b.deckY - 1.1) {
        h = Math.max(h, b.deckY);
      }
    }
  }

  // Check stepping stones
  for (const s of stones) {
    if (Math.hypot(x - s.x, z - s.z) <= s.radius * 0.95) {
      h = Math.max(h, s.topY);
    }
  }

  return h;
}

export function createTerrainMesh(
  level: LevelConfig,
  detailTexture: THREE.Texture,
): THREE.Mesh {
  const size = 148;
  const segments = 128;
  const geom = new THREE.PlaneGeometry(size, size, segments, segments);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const grassColor = new THREE.Color(level.grassTint);
  const darkGrass = grassColor.clone().multiplyScalar(0.72);
  const sandColor = new THREE.Color(0xe6cf9a);
  const wetSand = new THREE.Color(0xc2a974);
  const rockColor = new THREE.Color(level.rockTint);
  const peakColor =
    level.id === 5 ? new THREE.Color(0x3a3242) : new THREE.Color(0xc5cdd6);
  const riverBedColor = new THREE.Color(0x4b5c58);
  const tempColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z, level);
    pos.setY(i, y);
  }
  geom.computeVertexNormals();
  const normals = geom.attributes.normal;

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = normals.getY(i); // 1 = flat, < 0.72 = steep cliff

    if (y < WATER_LEVEL - 0.15) {
      if (isInRiverChannel(x, z)) {
        tempColor.copy(riverBedColor);
      } else {
        tempColor.copy(wetSand).lerp(new THREE.Color(0x2d5e6b), smoothstep(-0.2, -3.0, y));
      }
    } else if (y < 1.15) {
      const t = smoothstep(0.0, 1.15, y);
      tempColor.copy(sandColor).lerp(grassColor, t * 0.45);
    } else if (ny < 0.72 || y > 7.8) {
      const cliffBlend = smoothstep(0.76, 0.55, ny);
      const heightBlend = smoothstep(6.8, 10.5, y);
      tempColor.copy(grassColor).lerp(rockColor, Math.max(cliffBlend, heightBlend));
      if (y > 10.8) {
        tempColor.lerp(peakColor, smoothstep(10.8, 13.5, y));
      }
    } else {
      const patch = valueNoise(x * 0.14, z * 0.14, level.terrainSeed + 3);
      tempColor.copy(grassColor).lerp(darkGrass, patch * 0.65);
    }

    colors[i * 3] = tempColor.r;
    colors[i * 3 + 1] = tempColor.g;
    colors[i * 3 + 2] = tempColor.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTexture,
    roughness: 0.9,
    metalness: 0.02,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}
