import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BridgeSpec, SteppingStoneSpec } from './terrain';
import { ProceduralTextureSet } from './textures';

export interface PlayerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  scarf: THREE.Mesh;
  shadow: THREE.Mesh;
  walkCycle: number;
  tunicMaterial: THREE.MeshStandardMaterial;
}

export function createPlayerRig(contactShadowTex: THREE.Texture): PlayerRig {
  const root = new THREE.Group();

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.72;
  root.add(bodyGroup);

  // Materials with distinct roughness & metalness contrast
  const tunicMat = new THREE.MeshStandardMaterial({
    color: 0x1d7a6c,
    roughness: 0.78,
    metalness: 0.04,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x6b3e26,
    roughness: 0.65,
    metalness: 0.08,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xf4c142,
    roughness: 0.22,
    metalness: 0.88,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf3c39d,
    roughness: 0.68,
    metalness: 0.02,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x3a4759,
    roughness: 0.84,
    metalness: 0.04,
  });
  const scarfMat = new THREE.MeshStandardMaterial({
    color: 0xe65239,
    roughness: 0.72,
    metalness: 0.02,
  });
  const hatMat = new THREE.MeshStandardMaterial({
    color: 0x9a6b3b,
    roughness: 0.75,
    metalness: 0.05,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x151922,
    roughness: 0.2,
    metalness: 0.1,
  });

  // 1. Torso tunic
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.62, 12),
    tunicMat,
  );
  torso.position.y = 0.28;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // 2. Utility belt & brass buckle
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.285, 0.285, 0.1, 12),
    leatherMat,
  );
  belt.position.y = 0.08;
  belt.castShadow = true;
  bodyGroup.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.06), brassMat);
  buckle.position.set(0, 0.08, 0.28);
  bodyGroup.add(buckle);

  // 3. Explorer Backpack + sleeping roll
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.42, 0.22),
    leatherMat,
  );
  pack.position.set(0, 0.3, -0.26);
  pack.castShadow = true;
  bodyGroup.add(pack);

  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.4, 10),
    new THREE.MeshStandardMaterial({ color: 0xd9b779, roughness: 0.85 }),
  );
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.55, -0.26);
  roll.castShadow = true;
  bodyGroup.add(roll);

  // 4. Flowing scarf
  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.42), scarfMat);
  scarf.position.set(0, 0.58, -0.22);
  scarf.rotation.x = 0.3;
  scarf.castShadow = true;
  bodyGroup.add(scarf);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.055, 8, 16),
    scarfMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.59, 0);
  bodyGroup.add(collar);

  // 5. Head & Explorer Hat
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.64, 0);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
  head.position.y = 0.18;
  head.castShadow = true;
  headGroup.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.075, 0.2, 0.19);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.075, 0.2, 0.19);
  headGroup.add(leftEye, rightEye);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), skinMat);
  nose.position.set(0, 0.16, 0.22);
  headGroup.add(nose);

  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.38, 0.04, 18),
    hatMat,
  );
  hatBrim.position.y = 0.33;
  hatBrim.castShadow = true;
  headGroup.add(hatBrim);

  const hatCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.23, 0.18, 14),
    hatMat,
  );
  hatCrown.position.y = 0.43;
  hatCrown.castShadow = true;
  headGroup.add(hatCrown);

  const hatBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.232, 0.235, 0.045, 14),
    scarfMat,
  );
  hatBand.position.y = 0.365;
  headGroup.add(hatBand);

  // 6. Articulated Arms
  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.31, 0.52, 0);

    const sleeve = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.075, 0.26, 6, 10),
      tunicMat,
    );
    sleeve.position.y = -0.17;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 10, 10),
      skinMat,
    );
    hand.position.y = -0.36;
    hand.castShadow = true;
    armPivot.add(hand);

    bodyGroup.add(armPivot);
    return armPivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // 7. Articulated Legs (grounded so bottom of boots sit at root y = 0)
  const makeLeg = (side: -1 | 1) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.13, 0.72, 0);

    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.32, 6, 10),
      pantsMat,
    );
    leg.position.y = -0.26;
    leg.castShadow = true;
    legPivot.add(leg);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.18, 0.24),
      leatherMat,
    );
    boot.position.set(0, -0.63, 0.04);
    boot.castShadow = true;
    legPivot.add(boot);

    root.add(legPivot);
    return legPivot;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // 8. Soft radial contact shadow grounded beneath player
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    scarf,
    shadow,
    walkCycle: 0,
    tunicMaterial: tunicMat,
  };
}

export function animatePlayerRig(
  rig: PlayerRig,
  speedNorm: number,
  isGrounded: boolean,
  velY: number,
  elapsed: number,
  dt: number,
  invulnTimer: number,
) {
  if (isGrounded && speedNorm > 0.06) {
    rig.walkCycle += dt * (7.5 + speedNorm * 5.5);
    const swing = Math.sin(rig.walkCycle) * 0.72 * speedNorm;
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.leftArm.rotation.x = -swing * 0.85;
    rig.rightArm.rotation.x = swing * 0.85;
    rig.bodyGroup.position.y = 0.72 + Math.abs(Math.sin(rig.walkCycle)) * 0.07 * speedNorm;
    rig.bodyGroup.rotation.x = THREE.MathUtils.damp(
      rig.bodyGroup.rotation.x,
      0.14 * speedNorm,
      10,
      dt,
    );
    rig.scarf.rotation.x = 0.5 + Math.sin(elapsed * 14) * 0.18 * speedNorm;
  } else if (!isGrounded) {
    // Expressive jump / fall pose
    const jumpFactor = THREE.MathUtils.clamp(velY / 10, -1, 1);
    rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, -0.45, 10, dt);
    rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0.35, 10, dt);
    rig.leftArm.rotation.x = THREE.MathUtils.damp(
      rig.leftArm.rotation.x,
      -0.9 - jumpFactor * 0.4,
      10,
      dt,
    );
    rig.rightArm.rotation.x = THREE.MathUtils.damp(
      rig.rightArm.rotation.x,
      -0.9 - jumpFactor * 0.4,
      10,
      dt,
    );
    rig.bodyGroup.position.y = THREE.MathUtils.damp(rig.bodyGroup.position.y, 0.72, 10, dt);
    rig.bodyGroup.rotation.x = THREE.MathUtils.damp(
      rig.bodyGroup.rotation.x,
      -jumpFactor * 0.12,
      8,
      dt,
    );
    rig.scarf.rotation.x = 0.8 + Math.sin(elapsed * 16) * 0.22;
  } else {
    // Calm breathing idle
    rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 0, 10, dt);
    rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0, 10, dt);
    rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, 0, 10, dt);
    rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, 0, 10, dt);
    rig.bodyGroup.position.y = 0.72 + Math.sin(elapsed * 2.4) * 0.02;
    rig.bodyGroup.rotation.x = THREE.MathUtils.damp(rig.bodyGroup.rotation.x, 0, 10, dt);
    rig.scarf.rotation.x = 0.25 + Math.sin(elapsed * 2.5) * 0.06;
  }

  // Subtle head curiosity look
  rig.headGroup.rotation.y = Math.sin(elapsed * 1.1) * 0.08 * (1 - speedNorm);

  // Damage invulnerability flash
  if (invulnTimer > 0) {
    const blink = Math.sin(invulnTimer * 28) > 0;
    rig.root.visible = blink;
    rig.tunicMaterial.emissive.setHex(0xff3333);
    rig.tunicMaterial.emissiveIntensity = 0.45;
  } else {
    rig.root.visible = true;
    rig.tunicMaterial.emissive.setHex(0x000000);
    rig.tunicMaterial.emissiveIntensity = 0;
  }
}

// Composite Golden Coin (3-part beveled metallic coin)
export function createCoinModel(): THREE.Group {
  const group = new THREE.Group();

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffcf33,
    metalness: 0.92,
    roughness: 0.16,
    emissive: 0x4a2e00,
    emissiveIntensity: 0.25,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xffe270,
    metalness: 0.95,
    roughness: 0.12,
  });

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20),
    goldMat,
  );
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  group.add(disc);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.41, 0.045, 8, 24),
    rimMat,
  );
  group.add(rim);

  const emblem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    rimMat,
  );
  emblem.scale.set(1, 1, 0.45);
  group.add(emblem);

  return group;
}

// Composite 6-part Treasure Chest
export function createTreasureChest(
  woodTex: THREE.Texture,
  contactShadowTex: THREE.Texture,
): { group: THREE.Group; lidPivot: THREE.Group; gem: THREE.Mesh } {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0xa46a3e,
    roughness: 0.82,
    metalness: 0.05,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xf0be3c,
    roughness: 0.22,
    metalness: 0.88,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0x22e8a7,
    emissive: 0x0ea572,
    emissiveIntensity: 0.9,
    roughness: 0.1,
    metalness: 0.2,
  });

  // Base box
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.56, 0.78), woodMat);
  base.position.y = 0.28;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Brass corner straps
  for (const sx of [-0.46, 0.46]) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.6, 0.82),
      brassMat,
    );
    band.position.set(sx, 0.3, 0);
    band.castShadow = true;
    group.add(band);
  }

  // Lockplate on front
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.08), brassMat);
  lock.position.set(0, 0.46, 0.4);
  group.add(lock);

  // Hinged arched lid
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.56, -0.39);
  group.add(lidPivot);

  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.39, 1.15, 14, 1, false, 0, Math.PI),
    woodMat,
  );
  lid.rotation.z = Math.PI / 2;
  lid.position.set(0, 0, 0.39);
  lid.castShadow = true;
  lidPivot.add(lid);

  for (const sx of [-0.46, 0.46]) {
    const lidBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.41, 0.41, 0.1, 14, 1, false, 0, Math.PI),
      brassMat,
    );
    lidBand.rotation.z = Math.PI / 2;
    lidBand.position.set(sx, 0, 0.39);
    lidPivot.add(lidBand);
  }

  // Glowing jewel inside chest
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), gemMat);
  gem.position.set(0, 0.62, 0);
  group.add(gem);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 1.35),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  return { group, lidPivot, gem };
}

// Ancient Shrine Portal (Goal of each level)
export interface ShrinePortalRig {
  group: THREE.Group;
  ring: THREE.Mesh;
  core: THREE.Mesh;
  beaconBeam: THREE.Mesh;
  ringMat: THREE.MeshStandardMaterial;
  coreMat: THREE.MeshStandardMaterial;
  beamMat: THREE.MeshBasicMaterial;
}

export function createShrinePortal(stoneTex: THREE.Texture): ShrinePortalRig {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x8f96a3,
    roughness: 0.85,
    metalness: 0.06,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.3,
    metalness: 0.85,
  });

  // Stepped dais
  const step1 = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.4, 0.35, 12), stoneMat);
  step1.position.y = 0.175;
  step1.receiveShadow = true;
  step1.castShadow = true;
  group.add(step1);

  const step2 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.65, 0.3, 12), stoneMat);
  step2.position.y = 0.48;
  step2.receiveShadow = true;
  group.add(step2);

  // Two carved pillars
  for (const sx of [-1.45, 1.45]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 3.3, 0.62), stoneMat);
    pillar.position.set(sx, 2.25, 0);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.24, 0.82), trimMat);
    cap.position.set(sx, 3.95, 0);
    cap.castShadow = true;
    group.add(cap);
  }

  // Lintel arch
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.55, 0.76), stoneMat);
  lintel.position.set(0, 4.25, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), trimMat);
  crown.position.set(0, 4.78, 0);
  group.add(crown);

  // Energy portal ring & floating crystal
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    emissive: 0x1e293b,
    emissiveIntensity: 0.5,
    roughness: 0.25,
    metalness: 0.7,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.11, 12, 32), ringMat);
  ring.position.set(0, 2.25, 0);
  group.add(ring);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.4,
    roughness: 0.12,
    metalness: 0.25,
    transparent: true,
    opacity: 0.55,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 1), coreMat);
  core.position.set(0, 2.25, 0);
  group.add(core);

  // Skyward beacon beam (brightens when portal unlocks!)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beaconBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 1.35, 22, 16, 1, true),
    beamMat,
  );
  beaconBeam.position.set(0, 12, 0);
  group.add(beaconBeam);

  return { group, ring, core, beaconBeam, ringMat, coreMat, beamMat };
}

// Composite 7-part Island Crab Enemy
export function createCrabEnemy(contactShadowTex: THREE.Texture): {
  group: THREE.Group;
  legs: THREE.Mesh[];
  claws: THREE.Group[];
} {
  const group = new THREE.Group();

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xd94436,
    roughness: 0.42,
    metalness: 0.18,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x7a1c17,
    roughness: 0.65,
    metalness: 0.1,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });

  // Domed carapace
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 10), shellMat);
  shell.scale.set(1.22, 0.58, 0.96);
  shell.position.y = 0.42;
  shell.castShadow = true;
  group.add(shell);

  // Dorsal crest
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.52), darkMat);
  crest.position.set(0, 0.65, -0.05);
  group.add(crest);

  // Stalked eyes
  for (const sx of [-0.24, 0.24]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), eyeMat);
    eye.position.set(sx, 0.66, 0.52);
    group.add(eye);
  }

  // Articulated pincer claws
  const claws: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const clawPivot = new THREE.Group();
    clawPivot.position.set(sx * 0.76, 0.42, 0.48);
    const pincer = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), shellMat);
    pincer.scale.set(0.85, 0.65, 1.3);
    pincer.castShadow = true;
    clawPivot.add(pincer);
    group.add(clawPivot);
    claws.push(clawPivot);
  }

  // Scuttling legs
  const legs: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-0.28, 0.16]) {
      const leg = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.07, 0.34, 4, 8),
        darkMat,
      );
      leg.position.set(sx * 0.82, 0.24, sz);
      leg.rotation.z = sx * 0.72;
      leg.castShadow = true;
      group.add(leg);
      legs.push(leg);
    }
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.4),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  return { group, legs, claws };
}

// Composite 7-part Stone Golem Guardian
export function createGolemEnemy(
  stoneTex: THREE.Texture,
  contactShadowTex: THREE.Texture,
  accentColor = 0xf43f5e,
): { group: THREE.Group; leftArm: THREE.Mesh; rightArm: THREE.Mesh } {
  const group = new THREE.Group();

  const rockMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x5c6470,
    roughness: 0.9,
    metalness: 0.08,
  });
  const runeMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });

  // Legs/base
  for (const sx of [-0.28, 0.28]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.38), rockMat);
    foot.position.set(sx, 0.24, 0);
    foot.castShadow = true;
    group.add(foot);
  }

  // Chiseled boulder torso
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), rockMat);
  torso.scale.set(1.08, 1.0, 0.88);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  // Glowing chest rune core
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), runeMat);
  core.position.set(0, 1.02, 0.56);
  group.add(core);

  // Head block + glowing eyes
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.5), rockMat);
  head.position.set(0, 1.76, 0.06);
  head.castShadow = true;
  group.add(head);

  for (const sx of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.08), runeMat);
    eye.position.set(sx, 1.78, 0.3);
    group.add(eye);
  }

  // Swinging stone arms
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.78, 0.3), rockMat);
  leftArm.position.set(-0.84, 1.02, 0.08);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.78, 0.3), rockMat);
  rightArm.position.set(0.84, 1.02, 0.08);
  rightArm.castShadow = true;
  group.add(rightArm);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.6),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  return { group, leftArm, rightArm };
}

// Spinning Totem Obstacle
export function createSpinningTotem(woodTex: THREE.Texture): {
  group: THREE.Group;
  spinner: THREE.Group;
} {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x6b4528,
    roughness: 0.85,
  });
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.35,
    metalness: 0.45,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.75,
  });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 2.5, 10), woodMat);
  post.position.y = 1.25;
  post.castShadow = true;
  post.receiveShadow = true;
  group.add(post);

  for (const sx of [-0.15, 0.15]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
    eye.position.set(sx, 2.05, 0.36);
    group.add(eye);
  }

  const spinner = new THREE.Group();
  spinner.position.y = 0.85;
  group.add(spinner);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.26, 0.26), woodMat);
  bar.castShadow = true;
  spinner.add(bar);

  for (const sx of [-2.1, -1.2, 1.2, 2.1]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.46, 8), spikeMat);
    spike.position.set(sx, 0.25, 0);
    spike.castShadow = true;
    spinner.add(spike);
  }

  return { group, spinner };
}

// Rolling Boulder Hazard
export function createRollingBoulder(
  stoneTex: THREE.Texture,
  contactShadowTex: THREE.Texture,
): { group: THREE.Group; rockMesh: THREE.Mesh } {
  const group = new THREE.Group();

  const rockMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x6e6a73,
    roughness: 0.88,
    metalness: 0.08,
  });

  const rockMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.92, 1), rockMat);
  rockMesh.position.y = 0.92;
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.1),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  return { group, rockMesh };
}

// Composite Wooden Bridge
export function createWoodenBridge(
  spec: BridgeSpec,
  woodTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(spec.x, spec.deckY, spec.z);
  group.rotation.y = spec.rotationY;

  const plankMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0xa67042,
    roughness: 0.85,
    metalness: 0.04,
  });
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.9,
  });

  // Side stringer beams
  for (const sz of [-spec.width * 0.44, spec.width * 0.44]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(spec.length, 0.22, 0.22),
      postMat,
    );
    beam.position.set(0, -0.14, sz);
    beam.castShadow = true;
    beam.receiveShadow = true;
    group.add(beam);
  }

  // Individual wooden planks
  const plankCount = 12;
  const step = spec.length / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const px = -spec.length / 2 + step * (i + 0.5);
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(step * 0.84, 0.14, spec.width),
      plankMat,
    );
    plank.position.set(px, -0.07, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }

  // Posts & handrails
  for (const sx of [-spec.length * 0.46, 0, spec.length * 0.46]) {
    for (const sz of [-spec.width * 0.48, spec.width * 0.48]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 1.35, 8),
        postMat,
      );
      post.position.set(sx, 0.28, sz);
      post.castShadow = true;
      group.add(post);
    }
  }

  for (const sz of [-spec.width * 0.48, spec.width * 0.48]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, spec.length * 0.96, 8),
      plankMat,
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.85, sz);
    rail.castShadow = true;
    group.add(rail);
  }

  return group;
}

export function createSteppingStonesGroup(
  stones: SteppingStoneSpec[],
  stoneTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x7c858e,
    roughness: 0.85,
  });
  for (const s of stones) {
    const rock = new THREE.Mesh(
      new THREE.CylinderGeometry(s.radius * 0.88, s.radius * 1.08, 1.6, 8),
      mat,
    );
    rock.position.set(s.x, s.topY - 0.8, s.z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}

export function createWaterfallAssembly(
  textures: ProceduralTextureSet,
  waterColor: number,
): { group: THREE.Group; foamTex: THREE.Texture; mistRing: THREE.Mesh } {
  const group = new THREE.Group();

  // Mountain Spring Pool at (-8, 6.65, -18.5)
  const springMat = new THREE.MeshStandardMaterial({
    color: waterColor,
    roughness: 0.14,
    metalness: 0.15,
    transparent: true,
    opacity: 0.86,
  });
  const springPool = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24), springMat);
  springPool.rotation.x = -Math.PI / 2;
  springPool.position.set(-8, 6.25, -18.2);
  group.add(springPool);

  // Waterfall vertical cascading curtain from (-8, 6.25, -14.2) down to (-8, 0.0, -10.8)
  const fallMat = new THREE.MeshStandardMaterial({
    map: textures.waterFoam,
    color: 0x99ebff,
    emissive: 0x1e6b8a,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });
  const fallMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 7.6, 8, 16),
    fallMat,
  );
  // Slight forward slant from upper cliff to plunge pool
  fallMesh.position.set(-8, 3.15, -12.8);
  fallMesh.rotation.x = -0.34;
  group.add(fallMesh);

  // Plunge pool foam ring
  const mistRing = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 3.2, 24),
    new THREE.MeshBasicMaterial({
      color: 0xe0f7ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mistRing.rotation.x = -Math.PI / 2;
  mistRing.position.set(-8, 0.12, -10.9);
  group.add(mistRing);

  return { group, foamTex: textures.waterFoam, mistRing };
}

export interface TreeObstacle {
  x: number;
  z: number;
  radius: number;
}

export function createEnvironmentFoliage(
  pinePositions: { x: number; y: number; z: number; scale: number }[],
  palmPositions: { x: number; y: number; z: number; scale: number }[],
  rockPositions: { x: number; y: number; z: number; scale: number }[],
  grassTint: number,
  rockTint: number,
): THREE.Group {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // 1. Pine Trees (Instanced trunks + 2 foliage cones)
  if (pinePositions.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 2.4, 8);
    trunkGeo.translate(0, 1.2, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6b4426,
      roughness: 0.9,
    });
    const trunks = new THREE.InstancedMesh(
      trunkGeo,
      trunkMat,
      pinePositions.length,
    );
    trunks.castShadow = true;
    trunks.receiveShadow = true;

    const crownLowerGeo = new THREE.ConeGeometry(1.65, 2.6, 9);
    crownLowerGeo.translate(0, 3.1, 0);
    const crownUpperGeo = new THREE.ConeGeometry(1.22, 2.2, 9);
    crownUpperGeo.translate(0, 4.5, 0);

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02,
    });
    const crownsLower = new THREE.InstancedMesh(
      crownLowerGeo,
      leafMat,
      pinePositions.length,
    );
    crownsLower.castShadow = true;
    crownsLower.receiveShadow = true;

    const crownsUpper = new THREE.InstancedMesh(
      crownUpperGeo,
      leafMat,
      pinePositions.length,
    );
    crownsUpper.castShadow = true;
    crownsUpper.receiveShadow = true;

    const baseGreen = new THREE.Color(grassTint).lerp(new THREE.Color(0x1e6b3b), 0.55);

    pinePositions.forEach((p, i) => {
      dummy.position.set(p.x, p.y - 0.15, p.z);
      dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      crownsLower.setMatrixAt(i, dummy.matrix);
      crownsUpper.setMatrixAt(i, dummy.matrix);

      const tint = 0.85 + ((i * 37) % 30) / 100;
      color.copy(baseGreen).multiplyScalar(tint);
      crownsLower.setColorAt(i, color);
      crownsUpper.setColorAt(i, color.clone().multiplyScalar(1.1));
    });
    trunks.computeBoundingSphere();
    crownsLower.computeBoundingSphere();
    crownsUpper.computeBoundingSphere();
    group.add(trunks, crownsLower, crownsUpper);
  }

  // 2. Tropical Palm Trees (Instanced curved trunks + crowns)
  if (palmPositions.length > 0) {
    const palmTrunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 3.8, 8);
    palmTrunkGeo.translate(0, 1.9, 0);
    const palmTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x8c6239,
      roughness: 0.88,
    });
    const palmTrunks = new THREE.InstancedMesh(
      palmTrunkGeo,
      palmTrunkMat,
      palmPositions.length,
    );
    palmTrunks.castShadow = true;
    palmTrunks.receiveShadow = true;

    // 5-frond palm crown merged into one crisp geometry
    const frondGeo = new THREE.ConeGeometry(1.5, 0.65, 6);
    frondGeo.scale(1, 0.65, 1);
    frondGeo.translate(0, 3.9, 0);
    const palmLeafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
    });
    const palmCrowns = new THREE.InstancedMesh(
      frondGeo,
      palmLeafMat,
      palmPositions.length,
    );
    palmCrowns.castShadow = true;

    const palmBase = new THREE.Color(0x46b849);
    palmPositions.forEach((p, i) => {
      dummy.position.set(p.x, p.y - 0.15, p.z);
      dummy.rotation.set(
        Math.sin(i * 1.3) * 0.08,
        (i * 2.1) % (Math.PI * 2),
        Math.cos(i * 1.9) * 0.08,
      );
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      palmTrunks.setMatrixAt(i, dummy.matrix);
      palmCrowns.setMatrixAt(i, dummy.matrix);

      color.copy(palmBase).multiplyScalar(0.88 + ((i * 29) % 24) / 100);
      palmCrowns.setColorAt(i, color);
    });
    palmTrunks.computeBoundingSphere();
    palmCrowns.computeBoundingSphere();
    group.add(palmTrunks, palmCrowns);
  }

  // 3. Scenic Island Rocks & Boulders
  if (rockPositions.length > 0) {
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    rockGeo.translate(0, 0.35, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
    });
    const rocks = new THREE.InstancedMesh(
      rockGeo,
      rockMat,
      rockPositions.length,
    );
    rocks.castShadow = true;
    rocks.receiveShadow = true;

    const rockBase = new THREE.Color(rockTint);
    rockPositions.forEach((p, i) => {
      dummy.position.set(p.x, p.y - 0.1, p.z);
      dummy.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      dummy.scale.set(p.scale * 1.2, p.scale * 0.85, p.scale * 1.1);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);

      color.copy(rockBase).multiplyScalar(0.82 + ((i * 19) % 35) / 100);
      rocks.setColorAt(i, color);
    });
    rocks.computeBoundingSphere();
    group.add(rocks);
  }

  return group;
}
