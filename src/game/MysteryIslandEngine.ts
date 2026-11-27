import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { soundEngine } from './audio';
import { LEVELS } from './levels';
import {
  animatePlayerRig,
  createCoinModel,
  createCrabEnemy,
  createEnvironmentFoliage,
  createGolemEnemy,
  createPlayerRig,
  createRollingBoulder,
  createShrinePortal,
  createSpinningTotem,
  createSteppingStonesGroup,
  createTreasureChest,
  createWaterfallAssembly,
  createWoodenBridge,
  PlayerRig,
  ShrinePortalRig,
  TreeObstacle,
} from './models';
import {
  BridgeSpec,
  createTerrainMesh,
  getLevelBridges,
  getLevelSteppingStones,
  getRiverCenterX,
  getRiverHalfWidth,
  getTerrainHeight,
  getWalkableHeight,
  ISLAND_RADIUS,
  SteppingStoneSpec,
  WATER_LEVEL,
} from './terrain';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { GameHudState, GameStatus, InputState, LevelConfig } from './types';

// Pre-allocated math helpers (zero GC inside animation loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();

interface CoinEntity {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  phase: number;
}

interface ChestEntity {
  group: THREE.Group;
  lidPivot: THREE.Group;
  gem: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  opened: boolean;
  openProgress: number;
}

interface EnemyEntity {
  kind: 'crab' | 'golem';
  group: THREE.Group;
  legs?: THREE.Mesh[];
  claws?: THREE.Group[];
  leftArm?: THREE.Mesh;
  rightArm?: THREE.Mesh;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  x: number;
  y: number;
  z: number;
  t: number;
  dir: 1 | -1;
  speed: number;
  alive: boolean;
  squashTimer: number;
}

interface TotemEntity {
  group: THREE.Group;
  spinner: THREE.Group;
  x: number;
  y: number;
  z: number;
  rotSpeed: number;
  angle: number;
}

interface BoulderEntity {
  group: THREE.Group;
  rockMesh: THREE.Mesh;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  x: number;
  y: number;
  z: number;
  t: number;
  dir: 1 | -1;
  speed: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

const HIGH_SCORE_KEY = 'mystery_island_high_score_v1';

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class MysteryIslandEngine {
  private container: HTMLElement;
  private onHudUpdate: (state: GameHudState) => void;
  private onContextLostCallback?: (lost: boolean) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;

  // Lighting
  private sunLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Persistent ocean & world groups
  private oceanMesh!: THREE.Mesh;
  private oceanUniforms = { uTime: { value: 0 } };
  private levelGroup: THREE.Group;
  private particlesGroup: THREE.Group;
  private particles: Particle[] = [];
  private particleGeo: THREE.OctahedronGeometry;

  // Player
  private playerRig: PlayerRig;
  private playerPos = new THREE.Vector3(0, 3, 34);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw = Math.PI;
  private lastSafePos = new THREE.Vector3(0, 3, 34);
  private isGrounded = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private invulnTimer = 0;
  private damageFlash = 0;

  // Camera state
  private cameraYaw = 0;
  private cameraPitch = 0.42;
  private cameraDist = 11.5;
  private cameraShake = 0;
  private isDraggingCam = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private activeCamPointerId: number | null = null;

  // Level entities
  private currentLevelIdx = 0;
  private levelConfig: LevelConfig = LEVELS[0];
  private bridges: BridgeSpec[] = [];
  private stones: SteppingStoneSpec[] = [];
  private obstacles: TreeObstacle[] = [];
  private coins: CoinEntity[] = [];
  private chests: ChestEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private totems: TotemEntity[] = [];
  private boulders: BoulderEntity[] = [];
  private shrinePortal!: ShrinePortalRig;
  private waterfallMistRing: THREE.Mesh | null = null;
  private waterfallFoamTex: THREE.Texture | null = null;
  private riverFoamTex: THREE.Texture | null = null;

  // Game state
  private status: GameStatus = 'start';
  private score = 0;
  private highScore = 0;
  private hearts = 3;
  private readonly maxHearts = 3;
  private coinsCollected = 0;
  private chestsCollected = 0;
  private portalUnlocked = false;
  private elapsedTime = 0;
  private totalCoinsAllLevels = 0;
  private totalChestsAllLevels = 0;
  private pickupToast: string | null = null;
  private pickupToastTimer = 0;
  private hudSyncTimer = 0;

  // Input
  public input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jumpPressed: false,
    jumpHeld: false,
    joyX: 0,
    joyY: 0,
    joyActive: false,
  };
  private keyQ = false;
  private keyE = false;

  // Loop
  private clock = new THREE.Clock();
  private totalElapsed = 0;
  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    onHudUpdate: (state: GameHudState) => void,
    onContextLost?: (lost: boolean) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onContextLostCallback = onContextLost;

    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      if (saved) this.highScore = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      this.highScore = 0;
    }

    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.25, 260);
    this.renderer.setSize(width, height, false);

    // Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    // 3-Point + Hemisphere Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x9be2ff, 0x4b6b3c, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d0, 2.1);
    this.sunLight.position.set(45, 65, 35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 160;
    const d = 36;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x88ccff, 0.45);
    this.rimLight.position.set(-40, 25, -40);
    this.scene.add(this.rimLight);

    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.particlesGroup = new THREE.Group();
    this.scene.add(this.particlesGroup);
    this.particleGeo = new THREE.OctahedronGeometry(0.16, 0);

    // Build Ocean plane
    this.createOcean();

    // Build Player
    this.playerRig = createPlayerRig(this.textures.contactShadow);
    this.scene.add(this.playerRig.root);

    // Load initial scenic island for Start Screen
    this.loadLevel(0, false);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.emitHudState();
    this.clock.start();
    this.tick();
  }

  private createOcean() {
    const oceanGeo = new THREE.PlaneGeometry(360, 360, 48, 48);
    oceanGeo.rotateX(-Math.PI / 2);

    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x1697b7,
      roughness: 0.18,
      metalness: 0.14,
      transparent: true,
      opacity: 0.92,
    });

    oceanMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.oceanUniforms.uTime;
      shader.vertexShader =
        `uniform float uTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float wave1 = sin(transformed.x * 0.16 + uTime * 1.4) * 0.14;
          float wave2 = cos(transformed.z * 0.14 + uTime * 1.1) * 0.12;
          transformed.y += wave1 + wave2;
          `,
        );
    };

    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.position.y = WATER_LEVEL - 0.08;
    this.oceanMesh.receiveShadow = true;
    this.scene.add(this.oceanMesh);
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.handleResize);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLostCallback?.(true);
  };

  private onContextRestored = () => {
    this.onContextLostCallback?.(false);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (this.status === 'playing') {
        e.preventDefault();
      }
    }
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = true;
        break;
      case 'KeyQ':
        this.keyQ = true;
        break;
      case 'KeyE':
        this.keyE = true;
        break;
      case 'Space':
        if (!this.input.jumpHeld) {
          this.input.jumpPressed = true;
          this.jumpBufferTimer = 0.14;
        }
        this.input.jumpHeld = true;
        break;
      case 'KeyP':
      case 'Escape':
        if (this.status === 'playing') {
          this.pauseGame();
        } else if (this.status === 'paused') {
          this.resumeGame();
        }
        break;
      case 'KeyR':
        if (this.status === 'playing' || this.status === 'paused' || this.status === 'gameover') {
          this.restartLevel();
        }
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = false;
        break;
      case 'KeyQ':
        this.keyQ = false;
        break;
      case 'KeyE':
        this.keyE = false;
        break;
      case 'Space':
        this.input.jumpHeld = false;
        break;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.status !== 'playing') return;
    if (this.activeCamPointerId !== null) return;
    this.activeCamPointerId = e.pointerId;
    this.isDraggingCam = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDraggingCam || e.pointerId !== this.activeCamPointerId) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.cameraYaw -= dx * 0.0055;
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch + dy * 0.004,
      0.16,
      0.92,
    );
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.activeCamPointerId) {
      this.isDraggingCam = false;
      this.activeCamPointerId = null;
    }
  };

  public triggerJumpFromTouch() {
    this.input.jumpPressed = true;
    this.jumpBufferTimer = 0.14;
    this.input.jumpHeld = true;
  }

  public releaseJumpFromTouch() {
    this.input.jumpHeld = false;
  }

  public setJoystick(x: number, y: number, active: boolean) {
    this.input.joyX = x;
    this.input.joyY = y;
    this.input.joyActive = active;
  }

  public startGame(levelIdx = 0) {
    soundEngine.startMusic();
    this.score = 0;
    this.totalCoinsAllLevels = 0;
    this.totalChestsAllLevels = 0;
    this.hearts = this.maxHearts;
    this.loadLevel(levelIdx, true);
    this.status = 'playing';
    this.emitHudState();
  }

  public pauseGame() {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.clearInputs();
      this.emitHudState();
    }
  }

  public resumeGame() {
    if (this.status === 'paused') {
      this.status = 'playing';
      this.clock.getDelta();
      this.emitHudState();
    }
  }

  public restartLevel() {
    soundEngine.startMusic();
    this.hearts = this.maxHearts;
    this.loadLevel(this.currentLevelIdx, true);
    this.status = 'playing';
    this.emitHudState();
  }

  public restartFullAdventure() {
    this.startGame(0);
  }

  public nextLevel() {
    if (this.currentLevelIdx + 1 < LEVELS.length) {
      this.hearts = Math.min(this.maxHearts, this.hearts + 1);
      this.loadLevel(this.currentLevelIdx + 1, true);
      this.status = 'playing';
      this.emitHudState();
    } else {
      this.status = 'victory';
      this.emitHudState();
    }
  }

  public returnToTitle() {
    this.status = 'start';
    this.clearInputs();
    this.loadLevel(0, false);
    this.emitHudState();
  }

  private clearInputs() {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.jumpPressed = false;
    this.input.jumpHeld = false;
    this.input.joyActive = false;
    this.input.joyX = 0;
    this.input.joyY = 0;
    this.keyQ = false;
    this.keyE = false;
  }

  private disposeGroupResources(group: THREE.Group) {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
  }

  private loadLevel(levelIdx: number, resetCollectibles: boolean) {
    this.currentLevelIdx = THREE.MathUtils.clamp(levelIdx, 0, LEVELS.length - 1);
    this.levelConfig = LEVELS[this.currentLevelIdx];

    // Clear previous level objects cleanly
    this.disposeGroupResources(this.levelGroup);
    this.levelGroup.clear();
    this.clearParticles();

    this.obstacles = [];
    this.coins = [];
    this.chests = [];
    this.enemies = [];
    this.totems = [];
    this.boulders = [];

    if (resetCollectibles) {
      this.coinsCollected = 0;
      this.chestsCollected = 0;
      this.portalUnlocked = false;
      this.elapsedTime = 0;
      this.invulnTimer = 0;
      this.damageFlash = 0;
      this.pickupToast = null;
    }

    const cfg = this.levelConfig;

    // Sky, Fog & Lighting mood
    this.scene.background = new THREE.Color(cfg.skyColor);
    this.scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);
    this.hemiLight.color.setHex(cfg.hemiSkyColor);
    this.hemiLight.groundColor.setHex(cfg.hemiGroundColor);
    this.hemiLight.intensity = cfg.hemiIntensity;
    this.sunLight.color.setHex(cfg.sunColor);
    this.sunLight.intensity = cfg.sunIntensity;
    (this.oceanMesh.material as THREE.MeshStandardMaterial).color.setHex(
      cfg.waterColor,
    );

    // 1. Terrain Mesh
    const terrain = createTerrainMesh(cfg, this.textures.terrainDetail);
    this.levelGroup.add(terrain);

    // 2. River Ribbon Mesh (flowing down the carved river valley)
    this.buildRiverSurface(cfg);

    // 3. Waterfall + Mountain Spring Pool
    const wf = createWaterfallAssembly(this.textures, cfg.waterColor);
    this.waterfallMistRing = wf.mistRing;
    this.waterfallFoamTex = wf.foamTex;
    this.levelGroup.add(wf.group);

    // 4. Bridges & Stepping Stones
    this.bridges = getLevelBridges(cfg);
    for (const b of this.bridges) {
      this.levelGroup.add(createWoodenBridge(b, this.textures.woodPlank));
    }
    this.stones = getLevelSteppingStones();
    this.levelGroup.add(
      createSteppingStonesGroup(this.stones, this.textures.ancientStone),
    );

    // 5. Ancient Shrine Portal
    this.shrinePortal = createShrinePortal(this.textures.ancientStone);
    const portalY = getTerrainHeight(cfg.portalPos.x, cfg.portalPos.z, cfg);
    this.shrinePortal.group.position.set(cfg.portalPos.x, portalY, cfg.portalPos.z);
    this.levelGroup.add(this.shrinePortal.group);

    // 6. Forests, Palms & Scenic Boulders (InstancedMesh)
    this.buildFoliageAndRocks(cfg);

    // 7. Coins & Treasure Chests
    this.placeCollectibles(cfg);

    // 8. Enemies & Obstacles
    this.placeEnemiesAndHazards(cfg);

    // 9. Position Player at Spawn
    const spawnY = getWalkableHeight(
      cfg.spawnPos.x,
      cfg.spawnPos.z,
      cfg,
      this.bridges,
      this.stones,
    );
    this.playerPos.set(cfg.spawnPos.x, spawnY, cfg.spawnPos.z);
    this.lastSafePos.copy(this.playerPos);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = Math.PI;
    this.cameraYaw = 0;
    this.isGrounded = true;
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;

    // Snap camera immediately on load
    _camTarget.copy(this.playerPos).add(_vec3A.set(0, 1.5, 0));
    this.camera.position.set(
      this.playerPos.x,
      this.playerPos.y + 5.5,
      this.playerPos.z + 11,
    );
    this.camera.lookAt(_camTarget);
  }

  private buildRiverSurface(cfg: LevelConfig) {
    const zStart = -11.5;
    const zEnd = 52;
    const lenSegs = 44;
    const widSegs = 4;

    const geo = new THREE.PlaneGeometry(1, 1, widSegs, lenSegs);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5; // 0..1 across width
      const v = pos.getY(i) + 0.5; // 0..1 along length
      const z = THREE.MathUtils.lerp(zStart, zEnd, v);
      const rx = getRiverCenterX(z);
      const rw = getRiverHalfWidth(z) * 1.1;
      const x = rx + (u - 0.5) * 2 * rw;
      pos.setXYZ(i, x, WATER_LEVEL + 0.04, z);
    }
    geo.computeVertexNormals();

    this.riverFoamTex = this.textures.waterFoam.clone();
    this.riverFoamTex.needsUpdate = true;
    this.riverFoamTex.wrapS = THREE.RepeatWrapping;
    this.riverFoamTex.wrapT = THREE.RepeatWrapping;
    this.riverFoamTex.repeat.set(1.5, 10);

    const mat = new THREE.MeshStandardMaterial({
      map: this.riverFoamTex,
      color: cfg.waterColor,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.28,
      roughness: 0.16,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
    });
    const river = new THREE.Mesh(geo, mat);
    river.receiveShadow = true;
    this.levelGroup.add(river);
  }

  private seededRandom(seed: number): () => number {
    let s = Math.floor(seed * 10000) + 1337;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  private isClearOfLandmarks(
    x: number,
    z: number,
    cfg: LevelConfig,
    minDist = 4.8,
  ): boolean {
    if (Math.hypot(x - cfg.spawnPos.x, z - cfg.spawnPos.z) < minDist + 1.5)
      return false;
    if (Math.hypot(x - cfg.portalPos.x, z - cfg.portalPos.z) < minDist + 2.2)
      return false;
    if (Math.hypot(x + 8, z + 15) < 7.5) return false; // Waterfall & spring
    const rx = getRiverCenterX(z);
    if (z > -13 && Math.abs(x - rx) < getRiverHalfWidth(z) + 2.2) return false;
    for (const b of this.bridges) {
      if (Math.hypot(x - b.x, z - b.z) < 6.2) return false;
    }
    return true;
  }

  private buildFoliageAndRocks(cfg: LevelConfig) {
    const rand = this.seededRandom(cfg.terrainSeed + 9.1);
    const pines: { x: number; y: number; z: number; scale: number }[] = [];
    const palms: { x: number; y: number; z: number; scale: number }[] = [];
    const rocks: { x: number; y: number; z: number; scale: number }[] = [];

    for (let i = 0; i < 420; i++) {
      const r = 8 + rand() * (ISLAND_RADIUS - 5);
      const theta = rand() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      if (!this.isClearOfLandmarks(x, z, cfg, 4.2)) continue;
      const y = getTerrainHeight(x, z, cfg);
      if (y < 0.35 || y > 10.5) continue;

      // Check slope
      const hx = getTerrainHeight(x + 1.2, z, cfg);
      const hz = getTerrainHeight(x, z + 1.2, cfg);
      const slope = Math.hypot(hx - y, hz - y) / 1.2;
      if (slope > 0.58) continue;

      // Keep minimum spacing between tree trunks
      let tooClose = false;
      for (const obs of this.obstacles) {
        if (Math.hypot(x - obs.x, z - obs.z) < 3.4) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const scale = 0.85 + rand() * 0.3; // ±15% scale variation

      if (y < 1.85 && palms.length < 36) {
        palms.push({ x, y, z, scale });
        this.obstacles.push({ x, z, radius: 0.45 * scale });
      } else if (y >= 1.7 && y < 7.2 && pines.length < 75 && rand() < 0.72) {
        pines.push({ x, y, z, scale });
        this.obstacles.push({ x, z, radius: 0.5 * scale });
      } else if (rocks.length < 48) {
        rocks.push({ x, y, z, scale: 0.75 + rand() * 0.55 });
        this.obstacles.push({ x, z, radius: 0.85 });
      }
    }

    const foliageGroup = createEnvironmentFoliage(
      pines,
      palms,
      rocks,
      cfg.grassTint,
      cfg.rockTint,
    );
    this.levelGroup.add(foliageGroup);
  }

  private isTooCloseToObstacle(x: number, z: number, pad = 1.6): boolean {
    for (const o of this.obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.radius + pad) return true;
    }
    return false;
  }

  private placeCollectibles(cfg: LevelConfig) {
    const rand = this.seededRandom(cfg.terrainSeed + 42.5);

    // Always place 2 guiding coins near the bridges / main path so player gets early joy
    const guideSpots: { x: number; z: number }[] = [
      { x: this.bridges[0].x, z: this.bridges[0].z },
      { x: this.bridges[1].x, z: this.bridges[1].z },
      { x: -8, z: -9.5 }, // Waterfall plunge pool coin!
    ];

    const addCoin = (x: number, z: number, onBridge = false) => {
      const y =
        getWalkableHeight(x, z, cfg, this.bridges, this.stones, 999) + 1.05;
      if (!onBridge && y < WATER_LEVEL + 0.7) return false;
      const mesh = createCoinModel();
      mesh.position.set(x, y, z);
      this.levelGroup.add(mesh);
      this.coins.push({
        mesh,
        x,
        y,
        z,
        collected: false,
        phase: rand() * Math.PI * 2,
      });
      return true;
    };

    for (const g of guideSpots) {
      if (this.coins.length < cfg.coinCount) {
        addCoin(g.x, g.z, true);
      }
    }

    let attempts = 0;
    while (this.coins.length < cfg.coinCount && attempts < 400) {
      attempts++;
      const r = 6 + rand() * 38;
      const theta = rand() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      if (Math.hypot(x - cfg.spawnPos.x, z - cfg.spawnPos.z) < 5.5) continue;
      if (Math.hypot(x - cfg.portalPos.x, z - cfg.portalPos.z) < 4.5) continue;
      if (this.isTooCloseToObstacle(x, z, 1.4)) continue;

      const y = getTerrainHeight(x, z, cfg);
      if (y < 0.7 || y > 8.6) continue;
      const hx = getTerrainHeight(x + 1, z, cfg);
      const hz = getTerrainHeight(x, z + 1, cfg);
      if (Math.hypot(hx - y, hz - y) > 0.55) continue;

      let dup = false;
      for (const c of this.coins) {
        if (Math.hypot(x - c.x, z - c.z) < 5.2) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
      addCoin(x, z);
    }

    // Hidden Treasure Chests
    const chestCandidates = [
      { x: -16, z: -15 }, // Waterfall overlook
      { x: 26, z: 8 }, // Eastern grove
      { x: -26, z: -4 }, // Western ridge
      { x: 6, z: 24 }, // Southern cove nook
      { x: 22, z: -16 }, // Mountain pass
    ];

    for (let i = 0; i < cfg.chestCount; i++) {
      let cx = 0;
      let cz = 0;
      let placed = false;
      const cand = chestCandidates[(i + cfg.id) % chestCandidates.length];
      for (let tryIdx = 0; tryIdx < 30; tryIdx++) {
        const tx = cand.x + (rand() - 0.5) * 10;
        const tz = cand.z + (rand() - 0.5) * 10;
        const ty = getTerrainHeight(tx, tz, cfg);
        const rx = getRiverCenterX(tz);
        if (
          ty > 0.9 &&
          ty < 8.5 &&
          Math.abs(tx - rx) > getRiverHalfWidth(tz) + 2.5 &&
          !this.isTooCloseToObstacle(tx, tz, 1.8)
        ) {
          cx = tx;
          cz = tz;
          placed = true;
          break;
        }
      }
      if (!placed) {
        cx = cfg.spawnPos.x + (i % 2 === 0 ? -9 : 9);
        cz = cfg.spawnPos.z - 8 - i * 4;
      }
      const cy = getTerrainHeight(cx, cz, cfg);
      const chest = createTreasureChest(
        this.textures.woodPlank,
        this.textures.contactShadow,
      );
      chest.group.position.set(cx, cy, cz);
      chest.group.rotation.y = rand() * Math.PI * 2;
      this.levelGroup.add(chest.group);
      this.chests.push({
        group: chest.group,
        lidPivot: chest.lidPivot,
        gem: chest.gem,
        x: cx,
        y: cy,
        z: cz,
        opened: false,
        openProgress: 0,
      });
    }
  }

  private findSafePatrolSpot(
    cfg: LevelConfig,
    rand: () => number,
    minY = 0.7,
    maxY = 7.5,
  ): { x: number; z: number } | null {
    for (let i = 0; i < 80; i++) {
      const r = 8 + rand() * 34;
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!this.isClearOfLandmarks(x, z, cfg, 6.0)) continue;
      if (this.isTooCloseToObstacle(x, z, 1.8)) continue;
      const y = getTerrainHeight(x, z, cfg);
      if (y < minY || y > maxY) continue;
      const hx = getTerrainHeight(x + 1.5, z, cfg);
      const hz = getTerrainHeight(x, z + 1.5, cfg);
      if (Math.hypot(hx - y, hz - y) / 1.5 > 0.45) continue;
      return { x, z };
    }
    return null;
  }

  private placeEnemiesAndHazards(cfg: LevelConfig) {
    const rand = this.seededRandom(cfg.terrainSeed + 99.3);

    // 1. Crabs
    for (let i = 0; i < cfg.crabCount; i++) {
      const spot = this.findSafePatrolSpot(cfg, rand, 0.4, 4.5);
      if (!spot) continue;
      const crab = createCrabEnemy(this.textures.contactShadow);
      const angle = rand() * Math.PI * 2;
      const span = 5.5 + rand() * 3.5;
      const endX = spot.x + Math.cos(angle) * span;
      const endZ = spot.z + Math.sin(angle) * span;
      const y = getTerrainHeight(spot.x, spot.z, cfg);
      crab.group.position.set(spot.x, y, spot.z);
      this.levelGroup.add(crab.group);
      this.enemies.push({
        kind: 'crab',
        group: crab.group,
        legs: crab.legs,
        claws: crab.claws,
        startX: spot.x,
        startZ: spot.z,
        endX,
        endZ,
        x: spot.x,
        y,
        z: spot.z,
        t: rand(),
        dir: 1,
        speed: (0.28 + rand() * 0.1) * cfg.enemySpeedMult,
        alive: true,
        squashTimer: 0,
      });
    }

    // 2. Stone Golems
    const accent = cfg.id === 5 ? 0xa855f7 : 0xf43f5e;
    for (let i = 0; i < cfg.golemCount; i++) {
      const spot = this.findSafePatrolSpot(cfg, rand, 1.5, 7.8);
      if (!spot) continue;
      const golem = createGolemEnemy(
        this.textures.ancientStone,
        this.textures.contactShadow,
        accent,
      );
      const angle = rand() * Math.PI * 2;
      const span = 6.0 + rand() * 3.5;
      const endX = spot.x + Math.cos(angle) * span;
      const endZ = spot.z + Math.sin(angle) * span;
      const y = getTerrainHeight(spot.x, spot.z, cfg);
      golem.group.position.set(spot.x, y, spot.z);
      this.levelGroup.add(golem.group);
      this.enemies.push({
        kind: 'golem',
        group: golem.group,
        leftArm: golem.leftArm,
        rightArm: golem.rightArm,
        startX: spot.x,
        startZ: spot.z,
        endX,
        endZ,
        x: spot.x,
        y,
        z: spot.z,
        t: rand(),
        dir: 1,
        speed: (0.22 + rand() * 0.08) * cfg.enemySpeedMult,
        alive: true,
        squashTimer: 0,
      });
    }

    // 3. Spinning Totems
    for (let i = 0; i < cfg.totemCount; i++) {
      const spot = this.findSafePatrolSpot(cfg, rand, 1.2, 7.2);
      if (!spot) continue;
      const totem = createSpinningTotem(this.textures.woodPlank);
      const y = getTerrainHeight(spot.x, spot.z, cfg);
      totem.group.position.set(spot.x, y, spot.z);
      this.levelGroup.add(totem.group);
      this.totems.push({
        group: totem.group,
        spinner: totem.spinner,
        x: spot.x,
        y,
        z: spot.z,
        rotSpeed: (1.5 + rand() * 0.7) * cfg.enemySpeedMult * (i % 2 === 0 ? 1 : -1),
        angle: rand() * Math.PI * 2,
      });
      this.obstacles.push({ x: spot.x, z: spot.z, radius: 0.45 });
    }

    // 4. Rolling Boulders
    for (let i = 0; i < cfg.boulderCount; i++) {
      const spot = this.findSafePatrolSpot(cfg, rand, 1.6, 8.2);
      if (!spot) continue;
      const boulder = createRollingBoulder(
        this.textures.ancientStone,
        this.textures.contactShadow,
      );
      const angle = rand() * Math.PI * 2;
      const span = 8.0 + rand() * 4.0;
      const endX = spot.x + Math.cos(angle) * span;
      const endZ = spot.z + Math.sin(angle) * span;
      const y = getTerrainHeight(spot.x, spot.z, cfg);
      boulder.group.position.set(spot.x, y, spot.z);
      this.levelGroup.add(boulder.group);
      this.boulders.push({
        group: boulder.group,
        rockMesh: boulder.rockMesh,
        startX: spot.x,
        startZ: spot.z,
        endX,
        endZ,
        x: spot.x,
        y,
        z: spot.z,
        t: rand(),
        dir: 1,
        speed: (0.36 + rand() * 0.12) * cfg.enemySpeedMult,
      });
    }
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count = 14,
    speed = 4.5,
  ) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const up = 2.0 + Math.random() * speed;
      const horiz = (0.4 + Math.random() * 0.8) * speed;
      this.particlesGroup.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(a) * horiz,
        vy: up,
        vz: Math.sin(a) * horiz,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.35,
      });
    }
  }

  private clearParticles() {
    for (const p of this.particles) {
      this.particlesGroup.remove(p.mesh);
    }
    this.particles = [];
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particlesGroup.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const s = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(s);
    }
  }

  private showToast(msg: string) {
    this.pickupToast = msg;
    this.pickupToastTimer = 2.2;
  }

  private addScore(points: number) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      } catch {
        // Ignore storage errors
      }
    }
  }

  private damagePlayer(pushFromX: number, pushFromZ: number) {
    if (this.invulnTimer > 0 || this.status !== 'playing') return;
    this.hearts = Math.max(0, this.hearts - 1);
    this.invulnTimer = 1.65;
    this.damageFlash = 1.0;
    this.cameraShake = 0.42;
    soundEngine.playHurt();

    const dx = this.playerPos.x - pushFromX;
    const dz = this.playerPos.z - pushFromZ;
    const len = Math.hypot(dx, dz) || 1;
    this.playerVel.x = (dx / len) * 7.5;
    this.playerVel.z = (dz / len) * 7.5;
    this.playerVel.y = 6.2;
    this.isGrounded = false;

    if (this.hearts <= 0) {
      this.status = 'gameover';
      soundEngine.playGameOver();
    }
    this.emitHudState();
  }

  private updateGameplay(dt: number) {
    const cfg = this.levelConfig;
    this.elapsedTime += dt;

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);
    if (this.cameraShake > 0) this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
    if (this.pickupToastTimer > 0) {
      this.pickupToastTimer -= dt;
      if (this.pickupToastTimer <= 0) this.pickupToast = null;
    }

    // Q/E keyboard camera orbit
    if (this.keyQ) this.cameraYaw += 1.9 * dt;
    if (this.keyE) this.cameraYaw -= 1.9 * dt;

    // 1. Player Movement Vector (relative to cameraYaw)
    let moveForward = (this.input.forward ? 1 : 0) - (this.input.backward ? 1 : 0);
    let moveRight = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);

    if (this.input.joyActive) {
      moveRight += this.input.joyX;
      moveForward -= this.input.joyY;
    }

    const inputMag = Math.min(1, Math.hypot(moveForward, moveRight));
    const sinY = Math.sin(this.cameraYaw);
    const cosY = Math.cos(this.cameraYaw);

    // Camera forward is (-sinY, -cosY), right is (cosY, -sinY)
    const dirX = -sinY * moveForward + cosY * moveRight;
    const dirZ = -cosY * moveForward - sinY * moveRight;
    const dirLen = Math.hypot(dirX, dirZ);

    const groundUnder = getWalkableHeight(
      this.playerPos.x,
      this.playerPos.z,
      cfg,
      this.bridges,
      this.stones,
      this.playerPos.y,
    );
    const inShallowWater = this.playerPos.y < WATER_LEVEL - 0.1;
    const maxSpeed = inShallowWater ? 6.2 : 9.4;

    if (dirLen > 0.05) {
      const nx = dirX / dirLen;
      const nz = dirZ / dirLen;
      const targetVx = nx * maxSpeed * inputMag;
      const targetVz = nz * maxSpeed * inputMag;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, 11, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, 11, dt);

      const targetYaw = Math.atan2(nx, nz);
      let diff = targetYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * Math.min(1, dt * 12);
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, 12, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, 12, dt);
    }

    // Coyote time & Jump buffering
    if (this.isGrounded) {
      this.coyoteTimer = 0.12;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.playerVel.y = 11.4;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.input.jumpPressed = false;
      soundEngine.playJump();
      this.spawnParticles(this.playerPos.x, this.playerPos.y + 0.1, this.playerPos.z, 0xe2e8f0, 6, 2.2);
    }

    // Gravity
    this.playerVel.y -= 28 * dt;

    // Horizontal step & slope/obstacle collision
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    const nextZ = this.playerPos.z + this.playerVel.z * dt;

    const nextGround = getWalkableHeight(
      nextX,
      nextZ,
      cfg,
      this.bridges,
      this.stones,
      this.playerPos.y,
    );

    // Prevent climbing sheer vertical cliffs from below unless jumping onto them
    if (nextGround - this.playerPos.y > 1.35 && this.playerVel.y <= 0.1) {
      // Slide softly instead of snapping up sheer cliff
      const tryX = getWalkableHeight(
        nextX,
        this.playerPos.z,
        cfg,
        this.bridges,
        this.stones,
        this.playerPos.y,
      );
      if (tryX - this.playerPos.y <= 1.2) {
        this.playerPos.x = nextX;
      }
      const tryZ = getWalkableHeight(
        this.playerPos.x,
        nextZ,
        cfg,
        this.bridges,
        this.stones,
        this.playerPos.y,
      );
      if (tryZ - this.playerPos.y <= 1.2) {
        this.playerPos.z = nextZ;
      }
    } else {
      this.playerPos.x = nextX;
      this.playerPos.z = nextZ;
    }

    // Push out from tree trunks & rocks
    const playerRadius = 0.42;
    for (const obs of this.obstacles) {
      const dx = this.playerPos.x - obs.x;
      const dz = this.playerPos.z - obs.z;
      const dist = Math.hypot(dx, dz);
      const minD = obs.radius + playerRadius;
      if (dist < minD && dist > 0.001) {
        const push = (minD - dist) / dist;
        this.playerPos.x += dx * push;
        this.playerPos.z += dz * push;
      }
    }

    // Keep within outer ocean perimeter
    const distFromCenter = Math.hypot(this.playerPos.x, this.playerPos.z);
    if (distFromCenter > 60) {
      const scale = 60 / distFromCenter;
      this.playerPos.x *= scale;
      this.playerPos.z *= scale;
    }

    // Vertical step & ground snap
    this.playerPos.y += this.playerVel.y * dt;
    const finalGround = getWalkableHeight(
      this.playerPos.x,
      this.playerPos.z,
      cfg,
      this.bridges,
      this.stones,
      this.playerPos.y,
    );

    if (this.playerPos.y <= finalGround) {
      if (!this.isGrounded && this.playerVel.y < -6) {
        soundEngine.playLand();
      }
      this.playerPos.y = finalGround;
      this.playerVel.y = 0;
      this.isGrounded = true;

      // Save safe ground checkpoint
      if (finalGround > WATER_LEVEL + 0.45) {
        this.lastSafePos.copy(this.playerPos);
      }
    } else {
      this.isGrounded = false;
    }

    // Deep water hazard check (off-shore ocean or deep plunge)
    if (this.playerPos.y < WATER_LEVEL - 1.35 || distFromCenter > 56) {
      if (this.hearts > 1) {
        this.hearts--;
        this.invulnTimer = 1.5;
        this.damageFlash = 0.85;
        soundEngine.playHurt();
        this.playerPos.copy(this.lastSafePos);
        this.playerPos.y += 0.6;
        this.playerVel.set(0, 0, 0);
        this.showToast('Swept by deep tide — returned to shore');
      } else {
        this.hearts = 0;
        this.status = 'gameover';
        soundEngine.playGameOver();
      }
      this.emitHudState();
      return;
    }

    // Update Player Rig transform & animation
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    animatePlayerRig(
      this.playerRig,
      Math.min(1, horizSpeed / 9.2),
      this.isGrounded,
      this.playerVel.y,
      this.totalElapsed,
      dt,
      this.invulnTimer,
    );
    // Keep contact shadow anchored to ground height beneath player
    this.playerRig.shadow.position.y = Math.max(0.03, finalGround - this.playerPos.y + 0.03);
    const heightAbove = Math.max(0, this.playerPos.y - finalGround);
    const shadowScale = Math.max(0.4, 1 - heightAbove * 0.12);
    this.playerRig.shadow.scale.setScalar(shadowScale);

    // 2. Collectibles (Coins & Chests)
    for (const c of this.coins) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 2.4;
      c.mesh.position.y = c.y + Math.sin(this.totalElapsed * 3.0 + c.phase) * 0.16;

      const dCoin = Math.hypot(this.playerPos.x - c.x, this.playerPos.z - c.z);
      const dyCoin = Math.abs(this.playerPos.y + 0.9 - c.mesh.position.y);
      if (dCoin < 1.35 && dyCoin < 1.5) {
        c.collected = true;
        c.mesh.visible = false;
        this.coinsCollected++;
        this.totalCoinsAllLevels++;
        this.addScore(25);
        soundEngine.playCoin();
        this.spawnParticles(c.x, c.mesh.position.y, c.z, 0xfacc15, 12, 4.2);

        if (!this.portalUnlocked && this.coinsCollected >= cfg.coinsRequired) {
          this.portalUnlocked = true;
          soundEngine.playPortalUnlock();
          this.showToast('Shrine Portal Awakened! Follow the sky beacon.');
          this.spawnParticles(
            cfg.portalPos.x,
            getTerrainHeight(cfg.portalPos.x, cfg.portalPos.z, cfg) + 2.2,
            cfg.portalPos.z,
            0x38bdf8,
            24,
            6.0,
          );
        } else {
          this.showToast('+25 Gold Coin');
        }
        this.emitHudState();
      }
    }

    for (const ch of this.chests) {
      if (!ch.opened) {
        ch.gem.rotation.y += dt * 1.8;
        const dChest = Math.hypot(this.playerPos.x - ch.x, this.playerPos.z - ch.z);
        if (dChest < 1.75 && Math.abs(this.playerPos.y - ch.y) < 1.8) {
          ch.opened = true;
          this.chestsCollected++;
          this.totalChestsAllLevels++;
          this.addScore(150);
          soundEngine.playChest();
          this.showToast('Treasure Chest Found! +150');
          this.spawnParticles(ch.x, ch.y + 0.9, ch.z, 0x34d399, 20, 5.5);
          this.spawnParticles(ch.x, ch.y + 0.9, ch.z, 0xfacc15, 14, 4.8);
          this.emitHudState();
        }
      } else if (ch.openProgress < 1) {
        ch.openProgress = Math.min(1, ch.openProgress + dt * 3.5);
        ch.lidPivot.rotation.x = -ch.openProgress * 1.65;
        ch.gem.position.y = 0.62 + ch.openProgress * 0.75;
        ch.gem.rotation.y += dt * 5;
      } else {
        ch.gem.visible = false;
      }
    }

    // 3. Enemies
    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.squashTimer > 0) {
          e.squashTimer -= dt;
          e.group.scale.y = Math.max(0.05, e.squashTimer * 3);
          if (e.squashTimer <= 0) e.group.visible = false;
        }
        continue;
      }

      e.t += e.dir * e.speed * dt;
      if (e.t >= 1) {
        e.t = 1;
        e.dir = -1;
      } else if (e.t <= 0) {
        e.t = 0;
        e.dir = 1;
      }

      const prevX = e.x;
      const prevZ = e.z;
      e.x = THREE.MathUtils.lerp(e.startX, e.endX, e.t);
      e.z = THREE.MathUtils.lerp(e.startZ, e.endZ, e.t);
      e.y = getTerrainHeight(e.x, e.z, cfg);
      e.group.position.set(e.x, e.y, e.z);

      const moveDx = e.x - prevX;
      const moveDz = e.z - prevZ;
      if (Math.hypot(moveDx, moveDz) > 0.0001) {
        e.group.rotation.y = Math.atan2(moveDx, moveDz);
      }

      if (e.kind === 'crab' && e.legs && e.claws) {
        e.legs.forEach((leg, idx) => {
          leg.rotation.x = Math.sin(this.totalElapsed * 12 + idx * 1.6) * 0.35;
        });
        e.claws.forEach((claw, idx) => {
          claw.rotation.y = Math.sin(this.totalElapsed * 6 + idx * Math.PI) * 0.25;
        });
      } else if (e.kind === 'golem' && e.leftArm && e.rightArm) {
        const swing = Math.sin(this.totalElapsed * 5.2) * 0.45;
        e.leftArm.rotation.x = swing;
        e.rightArm.rotation.x = -swing;
      }

      // Collision with Player
      const distE = Math.hypot(this.playerPos.x - e.x, this.playerPos.z - e.z);
      const hitRadius = e.kind === 'golem' ? 1.15 : 0.98;
      if (distE < hitRadius) {
        const stompHeight = e.kind === 'golem' ? e.y + 1.15 : e.y + 0.48;
        if (this.playerVel.y < -0.5 && this.playerPos.y >= stompHeight) {
          // Stomp defeat!
          e.alive = false;
          e.squashTimer = 0.28;
          this.playerVel.y = 9.8;
          this.isGrounded = false;
          this.addScore(50);
          soundEngine.playStomp();
          this.showToast('+50 Guardian Defeated');
          this.spawnParticles(e.x, e.y + 0.8, e.z, 0xf97316, 16, 4.5);
          this.emitHudState();
        } else if (Math.abs(this.playerPos.y - e.y) < 1.6) {
          this.damagePlayer(e.x, e.z);
        }
      }
    }

    // 4. Spinning Totem Obstacles
    for (const tot of this.totems) {
      tot.angle += tot.rotSpeed * dt;
      tot.spinner.rotation.y = tot.angle;

      // Check player against crossbar line segment (half-length 2.15)
      const dx = this.playerPos.x - tot.x;
      const dz = this.playerPos.z - tot.z;
      if (Math.hypot(dx, dz) < 2.45 && Math.abs(this.playerPos.y - (tot.y + 0.85)) < 0.72) {
        const cos = Math.cos(-tot.angle);
        const sin = Math.sin(-tot.angle);
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;
        if (Math.abs(localX) < 2.25 && Math.abs(localZ) < 0.48) {
          this.damagePlayer(tot.x, tot.z);
        }
      }
    }

    // 5. Rolling Boulders
    for (const b of this.boulders) {
      b.t += b.dir * b.speed * dt;
      if (b.t >= 1) {
        b.t = 1;
        b.dir = -1;
      } else if (b.t <= 0) {
        b.t = 0;
        b.dir = 1;
      }
      const prevX = b.x;
      const prevZ = b.z;
      b.x = THREE.MathUtils.lerp(b.startX, b.endX, b.t);
      b.z = THREE.MathUtils.lerp(b.startZ, b.endZ, b.t);
      b.y = getTerrainHeight(b.x, b.z, cfg);
      b.group.position.set(b.x, b.y, b.z);

      const stepDist = Math.hypot(b.x - prevX, b.z - prevZ);
      b.rockMesh.rotation.x += (stepDist / 0.92) * b.dir;
      b.group.rotation.y = Math.atan2(b.endX - b.startX, b.endZ - b.startZ);

      if (
        Math.hypot(this.playerPos.x - b.x, this.playerPos.z - b.z) < 1.25 &&
        Math.abs(this.playerPos.y + 0.5 - (b.y + 0.9)) < 1.15
      ) {
        this.damagePlayer(b.x, b.z);
      }
    }

    // 6. Shrine Portal Check
    const portalDist = Math.hypot(
      this.playerPos.x - cfg.portalPos.x,
      this.playerPos.z - cfg.portalPos.z,
    );
    const portalY = getTerrainHeight(cfg.portalPos.x, cfg.portalPos.z, cfg);
    if (
      this.portalUnlocked &&
      portalDist < 2.1 &&
      Math.abs(this.playerPos.y - portalY) < 2.4
    ) {
      const timeBonus = Math.max(0, Math.round(180 - this.elapsedTime)) * 2;
      const healthBonus = this.hearts * 50;
      this.addScore(100 + timeBonus + healthBonus);
      this.clearInputs();

      if (this.currentLevelIdx + 1 >= LEVELS.length) {
        this.status = 'victory';
        soundEngine.playVictory();
        this.spawnParticles(cfg.portalPos.x, portalY + 2.5, cfg.portalPos.z, 0xfacc15, 36, 7.5);
        this.spawnParticles(cfg.portalPos.x, portalY + 2.5, cfg.portalPos.z, 0x38bdf8, 36, 7.5);
      } else {
        this.status = 'levelComplete';
        soundEngine.playLevelWin();
      }
      this.emitHudState();
      return;
    }

    // Periodic HUD timer update (keeps React UI lightweight & smooth)
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.emitHudState();
    }
  }

  private updateEnvironmentAnimations(dt: number) {
    this.oceanUniforms.uTime.value = this.totalElapsed;

    if (this.waterfallFoamTex) {
      this.waterfallFoamTex.offset.y -= dt * 1.45;
    }
    if (this.riverFoamTex) {
      this.riverFoamTex.offset.y -= dt * 0.48;
    }
    if (this.waterfallMistRing) {
      const pulse = 1 + Math.sin(this.totalElapsed * 4.5) * 0.14;
      this.waterfallMistRing.scale.setScalar(pulse);
    }

    // Shrine Portal Visual State
    if (this.shrinePortal) {
      this.shrinePortal.core.rotation.y += dt * (this.portalUnlocked ? 2.4 : 0.6);
      this.shrinePortal.core.position.y =
        2.25 + Math.sin(this.totalElapsed * 2.2) * 0.18;
      this.shrinePortal.ring.rotation.z += dt * (this.portalUnlocked ? 1.2 : 0.25);

      if (this.portalUnlocked) {
        this.shrinePortal.ringMat.color.setHex(0xfacc15);
        this.shrinePortal.ringMat.emissive.setHex(0xf59e0b);
        this.shrinePortal.ringMat.emissiveIntensity = 1.1;
        this.shrinePortal.coreMat.color.setHex(0x67e8f9);
        this.shrinePortal.coreMat.emissive.setHex(0x06b6d4);
        this.shrinePortal.coreMat.emissiveIntensity = 1.6;
        this.shrinePortal.coreMat.opacity = 0.92;
        this.shrinePortal.beamMat.opacity = 0.26 + Math.sin(this.totalElapsed * 3) * 0.06;
      } else {
        this.shrinePortal.ringMat.color.setHex(0x64748b);
        this.shrinePortal.ringMat.emissive.setHex(0x1e293b);
        this.shrinePortal.ringMat.emissiveIntensity = 0.35;
        this.shrinePortal.coreMat.opacity = 0.42;
        this.shrinePortal.coreMat.emissiveIntensity = 0.35;
        this.shrinePortal.beamMat.opacity = 0.05;
      }
    }

    // Keep Directional Light shadow frustum centered near the player
    const sunOff = this.levelConfig.sunPosition;
    this.sunLight.position.set(
      this.playerPos.x + sunOff.x * 0.65,
      this.playerPos.y + sunOff.y * 0.65,
      this.playerPos.z + sunOff.z * 0.65,
    );
    this.sunLight.target.position.copy(this.playerPos);
    this.sunLight.target.updateMatrixWorld();
  }

  private updateCamera(dt: number) {
    if (this.status === 'start') {
      // Scenic cinematic island flyover orbit
      const orbitAngle = this.totalElapsed * 0.16;
      const radius = 44;
      _camDesired.set(
        Math.sin(orbitAngle) * radius,
        18 + Math.sin(this.totalElapsed * 0.35) * 2.5,
        Math.cos(orbitAngle) * radius,
      );
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-3 * dt));
      _camTarget.set(0, 3.5, -4);
      this.camera.lookAt(_camTarget);
      return;
    }

    // Third-person smooth damped chase camera
    _camTarget.set(
      this.playerPos.x,
      this.playerPos.y + 1.55,
      this.playerPos.z,
    );

    const horizDist = Math.cos(this.cameraPitch) * this.cameraDist;
    const vertDist = Math.sin(this.cameraPitch) * this.cameraDist;

    const desiredX = _camTarget.x + Math.sin(this.cameraYaw) * horizDist;
    const desiredZ = _camTarget.z + Math.cos(this.cameraYaw) * horizDist;
    let desiredY = _camTarget.y + vertDist;

    // Prevent camera from dipping below terrain
    const camGround = getTerrainHeight(desiredX, desiredZ, this.levelConfig);
    desiredY = Math.max(desiredY, camGround + 1.6);

    _camDesired.set(desiredX, desiredY, desiredZ);

    const dampFactor = 1 - Math.exp(-10 * dt);
    this.camera.position.lerp(_camDesired, dampFactor);

    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake * 0.7;
    }

    this.camera.lookAt(_camTarget);
  }

  private emitHudState() {
    const cfg = this.levelConfig;
    const dx = cfg.portalPos.x - this.playerPos.x;
    const dz = cfg.portalPos.z - this.playerPos.z;
    const worldAngleToPortal = Math.atan2(dx, -dz); // 0 = North (-Z), +PI/2 = East (+X)
    // Relative to camera view direction (-sin(cameraYaw), -cos(cameraYaw))
    const camForwardAngle = -this.cameraYaw;
    const relAngle = worldAngleToPortal - camForwardAngle;

    this.onHudUpdate({
      status: this.status,
      levelIndex: this.currentLevelIdx,
      levelName: cfg.name,
      levelSubtitle: cfg.subtitle,
      score: this.score,
      highScore: this.highScore,
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      coinsCollected: this.coinsCollected,
      coinsTotal: this.coins.length,
      coinsRequired: cfg.coinsRequired,
      chestsCollected: this.chestsCollected,
      chestsTotal: this.chests.length,
      portalUnlocked: this.portalUnlocked,
      elapsedTime: this.elapsedTime,
      portalRelativeAngle: relAngle,
      portalDistance: Math.round(Math.hypot(dx, dz)),
      totalCoinsAllLevels: this.totalCoinsAllLevels,
      totalChestsAllLevels: this.totalChestsAllLevels,
      damageFlash: this.damageFlash,
      pickupToast: this.pickupToast,
    });
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.status !== 'paused') {
      this.totalElapsed += dt;
      this.updateEnvironmentAnimations(dt);
      this.updateParticles(dt);
    }

    if (this.status === 'playing') {
      this.updateGameplay(dt);
    }

    if (this.status !== 'paused') {
      this.updateCamera(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private handleResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.resizeObserver.disconnect();

    this.disposeGroupResources(this.levelGroup);
    this.disposeGroupResources(this.playerRig.root);
    this.oceanMesh.geometry.dispose();
    (this.oceanMesh.material as THREE.Material).dispose();
    this.particleGeo.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
