import * as THREE from 'three';

export interface ProceduralTextureSet {
  terrainDetail: THREE.CanvasTexture;
  woodPlank: THREE.CanvasTexture;
  ancientStone: THREE.CanvasTexture;
  waterFoam: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(
  maxAnisotropy: number,
): ProceduralTextureSet {
  // 1. Subtle organic terrain detail map (multiplied with vertex colors)
  const terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = 256;
  terrainCanvas.height = 256;
  const tCtx = terrainCanvas.getContext('2d')!;
  tCtx.fillStyle = '#efefef';
  tCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1 + Math.random() * 3.5;
    const v = 215 + Math.floor(Math.random() * 40);
    tCtx.fillStyle = `rgb(${v},${v},${v})`;
    tCtx.beginPath();
    tCtx.arc(x, y, r, 0, Math.PI * 2);
    tCtx.fill();
  }
  const terrainDetail = new THREE.CanvasTexture(terrainCanvas);
  terrainDetail.wrapS = THREE.RepeatWrapping;
  terrainDetail.wrapT = THREE.RepeatWrapping;
  terrainDetail.repeat.set(16, 16);
  terrainDetail.colorSpace = THREE.SRGBColorSpace;
  terrainDetail.anisotropy = maxAnisotropy;

  // 2. Wood plank texture for bridges & chests
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const wCtx = woodCanvas.getContext('2d')!;
  wCtx.fillStyle = '#8b5a34';
  wCtx.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 4; p++) {
    const py = p * 64;
    wCtx.fillStyle = p % 2 === 0 ? '#916039' : '#835430';
    wCtx.fillRect(0, py + 2, 256, 60);
    wCtx.fillStyle = '#5a361c';
    wCtx.fillRect(0, py, 256, 3);
    for (let g = 0; g < 22; g++) {
      wCtx.strokeStyle = 'rgba(65, 36, 16, 0.28)';
      wCtx.lineWidth = 1.5;
      wCtx.beginPath();
      const gy = py + 8 + Math.random() * 48;
      wCtx.moveTo(0, gy);
      wCtx.bezierCurveTo(85, gy + (Math.random() - 0.5) * 8, 170, gy + (Math.random() - 0.5) * 8, 256, gy);
      wCtx.stroke();
    }
  }
  const woodPlank = new THREE.CanvasTexture(woodCanvas);
  woodPlank.wrapS = THREE.RepeatWrapping;
  woodPlank.wrapT = THREE.RepeatWrapping;
  woodPlank.colorSpace = THREE.SRGBColorSpace;
  woodPlank.anisotropy = maxAnisotropy;

  // 3. Ancient carved stone texture for shrines, ruins & golems
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 256;
  stoneCanvas.height = 256;
  const sCtx = stoneCanvas.getContext('2d')!;
  sCtx.fillStyle = '#8d9299';
  sCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const s = 1 + Math.random() * 4;
    const c = 110 + Math.floor(Math.random() * 55);
    sCtx.fillStyle = `rgb(${c},${c + 2},${c + 5})`;
    sCtx.fillRect(x, y, s, s);
  }
  sCtx.strokeStyle = 'rgba(48, 55, 64, 0.45)';
  sCtx.lineWidth = 3;
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    sCtx.beginPath();
    sCtx.moveTo(0, y);
    sCtx.lineTo(256, y);
    sCtx.stroke();
    const offset = row % 2 === 0 ? 0 : 64;
    for (let col = 0; col < 3; col++) {
      const x = (col * 128 + offset) % 256;
      sCtx.beginPath();
      sCtx.moveTo(x, y);
      sCtx.lineTo(x, y + 64);
      sCtx.stroke();
    }
  }
  const ancientStone = new THREE.CanvasTexture(stoneCanvas);
  ancientStone.wrapS = THREE.RepeatWrapping;
  ancientStone.wrapT = THREE.RepeatWrapping;
  ancientStone.colorSpace = THREE.SRGBColorSpace;
  ancientStone.anisotropy = maxAnisotropy;

  // 4. Scrolling waterfall & river foam streaks
  const foamCanvas = document.createElement('canvas');
  foamCanvas.width = 256;
  foamCanvas.height = 256;
  const fCtx = foamCanvas.getContext('2d')!;
  const grad = fCtx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#38bdf8');
  grad.addColorStop(0.5, '#7dd3fc');
  grad.addColorStop(1, '#38bdf8');
  fCtx.fillStyle = grad;
  fCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const h = 18 + Math.random() * 44;
    const w = 2 + Math.random() * 5;
    fCtx.fillStyle = `rgba(255, 255, 255, ${0.22 + Math.random() * 0.45})`;
    fCtx.fillRect(x, y, w, h);
  }
  const waterFoam = new THREE.CanvasTexture(foamCanvas);
  waterFoam.wrapS = THREE.RepeatWrapping;
  waterFoam.wrapT = THREE.RepeatWrapping;
  waterFoam.colorSpace = THREE.SRGBColorSpace;
  waterFoam.anisotropy = maxAnisotropy;

  // 5. Soft radial contact shadow (alpha-blended)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const shCtx = shadowCanvas.getContext('2d')!;
  const rad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  rad.addColorStop(0, 'rgba(6, 15, 25, 0.58)');
  rad.addColorStop(0.55, 'rgba(6, 15, 25, 0.24)');
  rad.addColorStop(1, 'rgba(6, 15, 25, 0)');
  shCtx.fillStyle = rad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  return {
    terrainDetail,
    woodPlank,
    ancientStone,
    waterFoam,
    contactShadow,
    dispose: () => {
      terrainDetail.dispose();
      woodPlank.dispose();
      ancientStone.dispose();
      waterFoam.dispose();
      contactShadow.dispose();
    },
  };
}
