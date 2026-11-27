export type GameStatus =
  | 'start'
  | 'playing'
  | 'paused'
  | 'levelComplete'
  | 'gameover'
  | 'victory';

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: Vec3Tuple;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  waterColor: number;
  deepWaterColor: number;
  grassTint: number;
  rockTint: number;
  terrainSeed: number;
  mountainScale: number;
  coinCount: number;
  coinsRequired: number;
  chestCount: number;
  crabCount: number;
  golemCount: number;
  totemCount: number;
  boulderCount: number;
  enemySpeedMult: number;
  spawnPos: { x: number; z: number };
  portalPos: { x: number; z: number };
}

export interface GameHudState {
  status: GameStatus;
  levelIndex: number;
  levelName: string;
  levelSubtitle: string;
  score: number;
  highScore: number;
  hearts: number;
  maxHearts: number;
  coinsCollected: number;
  coinsTotal: number;
  coinsRequired: number;
  chestsCollected: number;
  chestsTotal: number;
  portalUnlocked: boolean;
  elapsedTime: number;
  portalRelativeAngle: number;
  portalDistance: number;
  totalCoinsAllLevels: number;
  totalChestsAllLevels: number;
  damageFlash: number;
  pickupToast: string | null;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  joyX: number;
  joyY: number;
  joyActive: boolean;
}
