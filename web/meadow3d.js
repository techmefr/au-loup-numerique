import * as THREE from 'three';
import { GROUND, paintGround, riverPoints } from './ground.js';

const TOP = 0;
const ACTION_MS = { jump: 600, dance: 1200, bleat: 900, sleep: 3500, graze: 2200, run: 1400 };
const PEN = { x0: -5, x1: 6, z0: -7.2, z1: 1 };
const GATE = { x0: -0.5, x1: 1.5 };
const DEPOSIT = new THREE.Vector3(0.5, TOP, 3.6);

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const mat = (color) => new THREE.MeshLambertMaterial({ color });
const sphere = (r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
};
const cyl = (r, h, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const cone = (r, h, color, x, y, z, rx = 0) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat(color));
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.castShadow = true;
  return m;
};

function animalModel(type) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const legs = (color, height = 0.28) => {
    g.userData.legs = [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.22], [0.2, 0.22]].map(([x, z]) => {
      const joint = new THREE.Group();
      joint.position.set(x, height, z);
      joint.add(cyl(0.06, height, color, 0, -height / 2, 0));
      body.add(joint);
      return joint;
    });
  };
  const head = new THREE.Group();
  head.name = 'head';
  if (type === 'sheep') {
    legs(0x4a3a35);
    for (const [x, y, z, r] of [[0, 0.55, 0, 0.46], [0.28, 0.58, 0.1, 0.34], [-0.28, 0.58, 0.1, 0.34], [0, 0.6, -0.3, 0.36], [0, 0.78, 0.12, 0.32], [0.2, 0.5, -0.25, 0.28], [-0.2, 0.5, -0.25, 0.28]]) body.add(sphere(r, 0xfffaf0, x, y, z));
    head.position.set(0, 0.55, 0.5);
    head.add(sphere(0.2, 0x4a3a35, 0, 0, 0.05, 1, 0.95, 1.1), sphere(0.09, 0xfffaf0, -0.15, 0.1, -0.02), sphere(0.09, 0xfffaf0, 0.15, 0.1, -0.02));
    const ears = [-1, 1].map((side) => {
      const ear = sphere(0.11, 0x806960, side * 0.19, 0.05, 0.015, 1.22, 0.5, 0.67);
      head.add(ear, sphere(0.045, 0xfff7de, side * 0.092, 0.049, 0.207), sphere(0.023, 0x261e1a, side * 0.093, 0.049, 0.242));
      return ear;
    });
    const tail = sphere(0.14, 0xfff6e4, 0, 0.48, -0.62, 0.8, 1.1, 1.15);
    body.add(tail);
    g.userData.ears = ears;
    g.userData.tail = tail;
  } else if (type === 'wolf') {
    legs(0x4a4a5a, 0.32);
    body.add(sphere(0.42, 0x77778c, 0, 0.55, -0.05, 0.9, 0.85, 1.45), sphere(0.2, 0x5a5a6c, 0, 0.55, -0.7, 0.7, 0.7, 1.6));
    head.position.set(0, 0.7, 0.62);
    head.add(sphere(0.25, 0x77778c), sphere(0.13, 0x4a4a5a, 0, -0.06, 0.26, 1, 0.8, 1.4), cone(0.09, 0.24, 0x4a4a5a, -0.15, 0.25, -0.02), cone(0.09, 0.24, 0x4a4a5a, 0.15, 0.25, -0.02), sphere(0.045, 0xffd54a, -0.1, 0.06, 0.2), sphere(0.045, 0xffd54a, 0.1, 0.06, 0.2));
  } else {
    legs(0x8e623b, 0.3);
    body.add(sphere(0.4, 0xd9a05b, 0, 0.5, -0.05, 0.85, 0.8, 1.35), sphere(0.17, 0xfff1d3, 0, 0.45, 0.35, 1, 1, 0.9), sphere(0.12, 0xd9a05b, 0, 0.62, -0.62, 0.7, 0.7, 1.7));
    head.position.set(0, 0.68, 0.6);
    head.add(sphere(0.24, 0xd9a05b), sphere(0.13, 0xfff1d3, 0, -0.06, 0.22, 1, 0.85, 1.2), sphere(0.05, 0x2b1d14, 0, -0.03, 0.36), sphere(0.11, 0x8e623b, -0.23, 0, -0.02, 0.6, 1.3, 0.8), sphere(0.11, 0x8e623b, 0.23, 0, -0.02, 0.6, 1.3, 0.8));
  }
  body.add(head);
  g.userData.body = body;
  g.scale.setScalar(1.3);
  return g;
}

export function createMeadow(container, hooks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeee5d3);
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 200);
  const target = new THREE.Vector3(0, 0, 0.6);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9d89a, 1.25));
  const sun = new THREE.DirectionalLight(0xfff4de, 1.5);
  sun.position.set(-8, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 5;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 11, bottom: -11, near: 1, far: 50 });
  scene.add(sun);

  const slab = (width, depth, height, top, side) => {
    const x = width / 2, z = depth / 2, r = 1.25;
    const outline = new THREE.Shape();
    outline.moveTo(-x + r, -z);
    outline.lineTo(x - r, -z);
    outline.quadraticCurveTo(x, -z, x, -z + r);
    outline.lineTo(x, z - r);
    outline.quadraticCurveTo(x, z, x - r, z);
    outline.lineTo(-x + r, z);
    outline.quadraticCurveTo(-x, z, -x, z - r);
    outline.lineTo(-x, -z + r);
    outline.quadraticCurveTo(-x, -z, -x + r, -z);
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 10 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, top - height, 0);
    const model = new THREE.Mesh(geometry, mat(side));
    scene.add(model);
  };
  slab(19.64, 14.66, 1.32, -0.06, 0xa87c55);
  slab(19.72, 14.66, 0.18, -0.025, 0x76914d);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d');
  const shadowGradient = context.createRadialGradient(64, 64, 16, 64, 64, 64);
  shadowGradient.addColorStop(0, '#50433480');
  shadowGradient.addColorStop(0.66, '#50433453');
  shadowGradient.addColorStop(1, '#50433400');
  context.fillStyle = shadowGradient;
  context.fillRect(0, 0, 128, 128);
  const tabletopShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 21),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }),
  );
  tabletopShadow.rotation.x = -Math.PI / 2;
  tabletopShadow.position.set(0.45, -1.4, 0.5);
  scene.add(tabletopShadow);

  const mounds = [
    { x: -5.1, z: 5.5, width: 1.35, depth: 1.28, height: 0.88 },
    { x: 6.55, z: 5.2, width: 1.85, depth: 1.5, height: 1.12 },
    { x: 9, z: 0.55, width: 0.95, depth: 1.8, height: 0.70 },
    { x: 6.85, z: -6.55, width: 0.9, depth: 1, height: 0.65 },
    { x: -9.1, z: 1.4, width: 0.63, depth: 1.45, height: 0.48 },
  ];
  const elevation = (x, z) => mounds.reduce((height, mound) => {
    const distance = ((x - mound.x) / mound.width) ** 2 + ((z - mound.z) / mound.depth) ** 2;
    return height + mound.height * Math.max(0, 1 - distance) ** 2;
  }, 0);

  const terrain = new THREE.PlaneGeometry(GROUND.w, GROUND.d, 100, 80);
  terrain.rotateX(-Math.PI / 2);
  const vertices = terrain.getAttribute('position');
  const terrainColors = [];
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i);
    const y = elevation(x, z);
    vertices.setY(i, y);
    const slope = (elevation(x + 0.08, z - 0.06) - y) / 0.1;
    const shade = Math.max(0.73, Math.min(1, 0.96 - slope * 0.25 + y * 0.05));
    terrainColors.push(shade, shade, shade);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  const painted = new THREE.Mesh(terrain, new THREE.MeshBasicMaterial({
    map: paintGround(), vertexColors: true, transparent: true, alphaTest: 0.12,
  }));
  scene.add(painted);
  const catcher = new THREE.Mesh(terrain, new THREE.ShadowMaterial({ opacity: 0.22, depthWrite: false }));
  catcher.position.y = 0.012;
  catcher.receiveShadow = true;
  scene.add(catcher);

  const rand = rng(11);
  const deco = new THREE.Group();
  scene.add(deco);
  const canopies = [];
  const tree = (x, z, color, scale, shape = 'round') => {
    const tree = new THREE.Group();
    const canopy = new THREE.Group();
    canopy.position.y = 0.65;
    tree.add(cyl(0.12, 0.85, 0x8e623b, 0, 0.425, 0), canopy);
    if (shape === 'fir') {
      for (let i = 0; i < 3; i++) {
        const shade = new THREE.Color(color).multiplyScalar(0.84 + i * 0.12);
        canopy.add(cone(0.86 - i * 0.20, 0.9, shade, 0, 0.32 + i * 0.48, 0));
      }
    } else if (shape === 'willow') {
      canopy.add(sphere(0.91, color, 0.05, 0.39, 0, 1.29, 0.65, 0.85));
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        canopy.add(sphere(0.34, color, Math.cos(angle) * 0.68, 0.08, Math.sin(angle) * 0.56, 0.7, 1.22, 0.7));
      }
    } else if (shape === 'tall') {
      canopy.add(sphere(0.73, color, 0, 0.68, 0, 0.72, 1.45, 0.78));
      canopy.add(sphere(0.46, color, -0.23, 0.42, 0.2));
    } else {
      for (const [dx, dy, dz, r] of [[0, 0.45, 0, 0.75], [0.45, 0.2, 0.15, 0.52], [-0.45, 0.25, -0.1, 0.55], [0.1, 0.85, 0.05, 0.5], [0, 0.2, 0.45, 0.5]]) canopy.add(sphere(r, color, dx, dy, dz));
    }
    tree.position.set(x, elevation(x, z), z);
    tree.rotation.y = rand() * Math.PI * 2;
    tree.scale.setScalar(scale);
    deco.add(tree);
    canopies.push({ canopy, phase: x * 0.4 + z * 0.15 });
  };
  const trees = [
    [-9.2, -6.65, 0x316450, 1.12, 'fir'], [-5.85, -6.8, 0x8ab64d, 0.83, 'round'],
    [6.8, -6.55, 0x71a553, 1.38, 'tall'], [9.22, -5.78, 0x3a7d65, 0.87, 'fir'],
    [8.85, 5.18, 0xbf9c4e, 1.16, 'round'], [-4.82, 6.15, 0x718c46, 0.76, 'tall'],
    [6.47, 6.37, 0x8db66b, 1.31, 'willow'], [8.64, -0.65, 0x79a957, 0.88, 'tall'],
    [-9.03, 6.06, 0x398265, 0.95, 'fir'], [2.62, -6.78, 0x9eaf50, 0.76, 'round'],
    [-9.16, 1.42, 0xd98295, 0.9, 'willow'], [9.1, 1.87, 0x64905b, 0.53, 'round'],
  ];
  for (const [x, z, color, scale, shape] of trees) tree(x, z, color, scale, shape);

  const river = new THREE.CurvePath();
  const riverNodes = riverPoints.map(([x, z]) => new THREE.Vector3(x, 0.025, z));
  let from = riverNodes[0];
  for (let i = 1; i < riverNodes.length - 1; i++) {
    const to = riverNodes[i].clone().lerp(riverNodes[i + 1], 0.5);
    river.add(new THREE.QuadraticBezierCurve3(from, riverNodes[i], to));
    from = to;
  }
  river.add(new THREE.LineCurve3(from, riverNodes.at(-1)));
  const waterfall = new THREE.Mesh(
    new THREE.PlaneGeometry(1.29, 1.3),
    new THREE.MeshBasicMaterial({ color: 0x51adae }),
  );
  waterfall.position.set(-8.19, -0.66, 7.345);
  deco.add(waterfall);
  const fallingWater = Array.from({ length: 9 }, (_, i) => {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.055, 0.24),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xb5e6de : 0x75cac7 }),
    );
    streak.position.set(-8.76 + i * 0.142, 0, 7.353);
    deco.add(streak);
    return streak;
  });
  const ripples = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xc7edff, transparent: true, opacity: 0.68, depthWrite: false }),
    38,
  );
  const currents = Array.from({ length: ripples.count }, (_, i) => ({
    start: i / ripples.count,
    lane: (rand() - 0.5) * 1.2,
    length: 0.24 + rand() * 0.52,
    speed: 0.08 + rand() * 0.055,
  }));
  ripples.frustumCulled = false;
  deco.add(ripples);

  const blades = new THREE.BufferGeometry();
  blades.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.045, 0, 0, 0.045, 0, 0, -0.055, 0.29, 0.01,
    -0.025, 0, 0.03, 0.06, 0, 0.03, 0.13, 0.22, 0.04,
    0, 0, -0.04, 0.08, 0, -0.04, 0.04, 0.34, -0.08,
  ], 3));
  const tufts = [];
  for (let i = 0; i < 180; i++) {
    const x = (rand() - 0.5) * 20, z = (rand() - 0.5) * 14;
    if (x < -6.1 && x > -9.2) continue;
    if (z > 0.7 && x > -0.6 && x < 3.5) continue;
    if (x > 6.5 && x < 9 && z < 0) continue;
    tufts.push({ x, y: elevation(x, z), z, angle: rand() * Math.PI, scale: 0.58 + rand() * 0.75 });
  }
  const grass = new THREE.InstancedMesh(blades, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), tufts.length);
  const grassColors = [0x6ca638, 0x80b641, 0x94c94f, 0x568b36].map((color) => new THREE.Color(color));
  tufts.forEach((_, i) => grass.setColorAt(i, grassColors[i % grassColors.length]));
  grass.frustumCulled = false;
  deco.add(grass);

  const flowers = [];
  const flowerColors = [0xff929e, 0xffd05c, 0xfff5d6, 0xc6a3d8];
  for (const [x, z] of [[-5.95, 4.35], [-4, 6.22], [3.37, 4.67], [5.55, 6.11], [8.57, 2.6], [-6.08, -3.62]]) {
    for (let i = 0; i < 4; i++) {
      const flower = new THREE.Group();
      const height = 0.19 + rand() * 0.2;
      flower.add(cyl(0.025, height, 0x66823d, 0, height / 2, 0));
      flower.add(sphere(0.11, flowerColors[(i + flowers.length) % flowerColors.length], 0, height, 0, 1, 0.52, 1));
      flower.add(sphere(0.05, 0xffdc6d, 0, height + 0.045, 0));
      const flowerX = x + (rand() - 0.5) * 0.95;
      const flowerZ = z + (rand() - 0.5) * 0.85;
      flower.position.set(flowerX, elevation(flowerX, flowerZ), flowerZ);
      deco.add(flower);
      flowers.push(flower);
    }
  }
  const reeds = [];
  for (const [bankX, bankZ] of [[-8.75, -4.35], [-7.15, -2.7], [-6.47, 1.3], [-8.66, 4.25], [-7.5, 5.85]]) {
    const reed = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const height = 0.33 + rand() * 0.35;
      const stem = cyl(0.025, height, 0x698740, (i - 1.5) * 0.14, height / 2, i % 2 * 0.11);
      stem.rotation.z = (i - 1.5) * 0.12;
      reed.add(stem);
      const seed = sphere(0.065, 0x916b49, stem.position.x - Math.sin(stem.rotation.z) * height / 2, height, stem.position.z, 0.74, 1.8, 0.74);
      reed.add(seed);
    }
    reed.position.set(bankX, elevation(bankX, bankZ), bankZ);
    deco.add(reed);
    reeds.push(reed);
  }

  const bridge = new THREE.Group();
  const plankGeometry = new THREE.BoxGeometry(0.205, 0.105, 0.67);
  const wood = [0xb78351, 0xcb9861, 0xc28b56].map(mat);
  for (let i = 0; i < 11; i++) {
    const plank = new THREE.Mesh(plankGeometry, wood[i % wood.length]);
    const x = (i - 5) * 0.204;
    plank.position.set(x, 0.09 + 0.26 * (1 - (x / 1.15) ** 2), 0);
    plank.rotation.z = -x * 0.33;
    plank.castShadow = true;
    bridge.add(plank);
  }
  for (const x of [-0.96, 0.96]) {
    for (const z of [-0.38, 0.38]) bridge.add(cyl(0.047, 0.42, 0x856344, x, 0.31, z));
  }
  const railGeometry = new THREE.CylinderGeometry(0.032, 0.032, 1.99, 6).rotateZ(Math.PI / 2);
  for (const z of [-0.38, 0.38]) {
    const rail = new THREE.Mesh(railGeometry, wood[0]);
    rail.position.set(0, 0.51, z);
    bridge.add(rail);
  }
  bridge.position.set(-7.36, 0, -3.45);
  bridge.rotation.y = -0.16;
  deco.add(bridge);

  const butterflies = [[-5.5, 4.65, 0xffcc65], [5.5, 5.1, 0xff9bb5], [8.45, 2.75, 0xeadc8a]].map(([x, z, color], i) => {
    const body = new THREE.Group();
    const wings = [-1, 1].map((side) => {
      const wing = new THREE.Group();
      const petal = sphere(0.18, color, side * 0.15, 0, -0.015, 0.95, 0.12, 1.2);
      petal.castShadow = false;
      wing.add(petal);
      body.add(wing);
      return wing;
    });
    deco.add(body);
    return { body, wings, x, z, offset: i * 2.2 };
  });

  const instance = new THREE.Object3D();
  const waterPoint = new THREE.Vector3();
  const waterTangent = new THREE.Vector3();
  const waterNormal = new THREE.Vector3();
  function moveLandscape(time) {
    for (const { canopy, phase } of canopies) {
      canopy.rotation.z = Math.sin(time * 1.7 + phase) * 0.09;
      canopy.rotation.x = Math.cos(time * 1.25 + phase) * 0.065;
    }
    for (const reed of reeds) {
      reed.rotation.z = Math.sin(time * 2.1 + reed.position.z * 0.75) * 0.22;
      reed.rotation.x = Math.cos(time * 1.6 + reed.position.z) * 0.19;
    }
    for (const flower of flowers) {
      flower.rotation.z = Math.sin(time * 2.1 + flower.position.x * 0.7 + flower.position.z) * 0.28;
      flower.rotation.x = Math.cos(time * 1.8 + flower.position.z) * 0.13;
    }
    for (const { body, wings, x, z, offset } of butterflies) {
      const flight = time * 1.13 + offset;
      body.position.set(x + Math.cos(flight) * 0.95, 0.55 + Math.sin(flight * 2.4) * 0.22, z + Math.sin(flight) * 0.72);
      body.rotation.y = -flight;
      const flap = Math.sin(time * 17 + offset) * 0.95;
      wings[0].rotation.z = -flap;
      wings[1].rotation.z = flap;
    }
    tufts.forEach(({ x, y, z, angle, scale }, i) => {
      instance.position.set(x, y + 0.025, z);
      instance.rotation.set(Math.sin(time * 2.7 + z * 0.65 + x * 0.35) * 0.31, angle, 0);
      instance.scale.setScalar(scale);
      instance.updateMatrix();
      grass.setMatrixAt(i, instance.matrix);
    });
    grass.instanceMatrix.needsUpdate = true;
    currents.forEach(({ start, lane, length, speed }, i) => {
      const progress = (start + time * speed) % 1;
      river.getPoint(progress, waterPoint);
      river.getTangent(progress, waterTangent);
      instance.position.copy(waterPoint).addScaledVector(waterNormal.set(waterTangent.z, 0, -waterTangent.x), lane);
      instance.rotation.set(0, Math.atan2(waterTangent.x, waterTangent.z), 0);
      const edge = Math.max(0, Math.min(1, (7.6 - Math.abs(waterPoint.z)) * 3));
      instance.scale.set(0.075 * edge, 1, length * edge);
      instance.updateMatrix();
      ripples.setMatrixAt(i, instance.matrix);
    });
    ripples.instanceMatrix.needsUpdate = true;
    fallingWater.forEach((streak, i) => {
      const fall = (time * 0.82 + i * 0.39) % 1;
      streak.position.y = -0.065 - fall * 1.19;
      streak.scale.y = Math.min(1, fall * 7, (1 - fall) * 7);
    });
  }
  moveLandscape(0);
  for (const [x, z, scale] of [[-7.93, -3, 0.45], [-7.3, 0.2, 0.35], [-8.52, 4.23, 0.37], [-6.09, -5.12, 0.28], [6.6, 3.25, 0.22], [4.03, 6.57, 0.35]]) {
    const rock = sphere(scale, 0xa6aaa1, x, elevation(x, z) + scale * 0.28, z, 1.1, 0.54, 0.85);
    rock.rotation.y = rand() * Math.PI;
    deco.add(rock);
  }

  const WOOD = 0xb98550;
  const rod = (x0, z0, x1, z1, y, r = 0.045, color = WOOD, parent = deco) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat(color));
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.rotation.set(z0 === z1 ? 0 : Math.PI / 2, 0, z0 === z1 ? Math.PI / 2 : 0);
    m.castShadow = true;
    parent.add(m);
  };
  const post = (x, z) => deco.add(cyl(0.09, 0.95, 0x8e623b, x, 0.47, z));
  for (let x = PEN.x0; x <= PEN.x1; x++) {
    post(x, PEN.z0);
    if (x < GATE.x0 || x > GATE.x1) post(x, PEN.z1);
  }
  for (let z = PEN.z0 + 1; z < PEN.z1; z++) { post(PEN.x0, z); post(PEN.x1, z); }
  for (const y of [0.35, 0.72]) {
    rod(PEN.x0, PEN.z0, PEN.x1, PEN.z0, y);
    rod(PEN.x0, PEN.z0, PEN.x0, PEN.z1, y);
    rod(PEN.x1, PEN.z0, PEN.x1, PEN.z1, y);
    rod(PEN.x0, PEN.z1, GATE.x0, PEN.z1, y);
    rod(GATE.x1, PEN.z1, PEN.x1, PEN.z1, y);
  }
  post(GATE.x0, PEN.z1);
  post(GATE.x1, PEN.z1);

  const leafMesh = (dir) => {
    const pivot = new THREE.Group();
    for (const y of [0.3, 0.55, 0.8]) rod(0, 0, dir * 1.0, 0, y, 0.04, 0xe0b070, pivot);
    pivot.add(cyl(0.05, 0.9, 0xe0b070, dir * 0.97, 0.5, 0), cyl(0.05, 0.9, 0xe0b070, dir * 0.03, 0.5, 0));
    return pivot;
  };
  const leafL = leafMesh(1);
  const leafR = leafMesh(-1);
  leafL.position.set(GATE.x0, 0, PEN.z1);
  leafR.position.set(GATE.x1, 0, PEN.z1);
  deco.add(leafL, leafR);
  let gateTarget = 0, gateNow = 0;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 0.07), mat(0xf0dca8));
  sign.position.set(0.5, 1.55, PEN.z1);
  sign.castShadow = true;
  deco.add(sign, cyl(0.05, 1.5, 0x8e623b, -0.15, 0.75, PEN.z1), cyl(0.05, 1.5, 0x8e623b, 1.15, 0.75, PEN.z1));

  const actors = new Map();
  const tweens = [];
  const held = new Set();
  let calm = false;
  let size = { w: 1, h: 1 };
  let stageBusy = false;
  const unclaimed = new Map();
  let arrivals = [];

  const penSpot = () => new THREE.Vector3(PEN.x0 + 0.8 + Math.random() * (PEN.x1 - PEN.x0 - 1.6), TOP, PEN.z0 + 0.8 + Math.random() * (PEN.z1 - PEN.z0 - 1.8));

  function spawn(id, type = 'sheep', at = penSpot()) {
    const model = animalModel(type);
    model.position.copy(at);
    model.userData = { ...model.userData, id, type, target: at.clone(), speed: 0.6 + Math.random() * 0.4, nextMove: performance.now() + Math.random() * 3000, idlePhase: Math.random() * 7, anim: null, name: '', stage: false };
    model.traverse((o) => { o.userData.actorId = id; });
    scene.add(model);
    actors.set(id, model);
    return model;
  }

  function puff(at) {
    for (let i = 0; i < 9; i++) {
      const c = sphere(0.16 + Math.random() * 0.1, 0xffffff);
      c.castShadow = false;
      c.position.copy(at).add(new THREE.Vector3(0, 0.6, 0));
      scene.add(c);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2.6, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 2.6);
      const t0 = performance.now();
      tweens.push((now) => {
        const k = (now - t0) / 900;
        if (k >= 1) { scene.remove(c); c.geometry.dispose(); c.material.dispose(); return true; }
        c.position.addScaledVector(v, 0.016);
        v.y -= 0.05;
        c.scale.setScalar(1 - k);
        return false;
      });
    }
  }

  function setSheep(list) {
    const flock = new Set(list.map(({ id }) => id));
    for (const [id, actor] of actors) {
      if (actor.userData.stage || flock.has(id)) continue;
      scene.remove(actor);
      actors.delete(id);
      held.delete(id);
    }
    for (const id of unclaimed.keys()) if (!flock.has(id)) unclaimed.delete(id);
    for (const sheep of list.slice(0, 28)) {
      const actor = actors.get(sheep.id);
      if (actor) actor.userData.name = sheep.name ?? '';
      else if (stageBusy) unclaimed.set(sheep.id, sheep.name ?? '');
      else spawn(sheep.id).userData.name = sheep.name ?? '';
    }
  }

  function setDeposit(count) {
    if (arrivals.length === count) return;
    for (const { id, a } of arrivals) {
      scene.remove(a);
      actors.delete(id);
    }
    arrivals = Array.from({ length: count }, (_, i) => {
      const home = DEPOSIT.clone().add(new THREE.Vector3((i - (count - 1) / 2) * 1.25, 0, 0));
      const id = `arrival-${i}`;
      const start = calm ? home : home.clone().add(new THREE.Vector3(0, 0, 1.9 + i * 0.45));
      const a = spawn(id, 'sheep', start);
      Object.assign(a.userData, { stage: true, nextMove: Infinity, target: home, speed: 2.8 });
      a.rotation.y = Math.PI;
      return { id, a };
    });
  }

  function animate(id, action) {
    const a = actors.get(id);
    if (!a || a.userData.stage) return;
    if (calm && action !== 'bleat') return;
    a.userData.anim = { action, t0: performance.now() };
    if (action === 'run') { a.userData.target = penSpot(); a.userData.speed = 3; }
    hooks.onAction?.(id, action, a.userData.name);
  }

  const swap = (g, type) => {
    const old = g.a;
    const model = animalModel(type);
    model.position.copy(old.position);
    model.rotation.y = old.rotation.y;
    model.userData = { ...model.userData, stage: true, type, nextMove: Infinity, idlePhase: old.userData.idlePhase, target: old.position.clone(), speed: 0, anim: calm ? null : { action: 'jump', t0: performance.now() } };
    scene.remove(old);
    scene.add(model);
    actors.set(g.id, model);
    if (!calm) puff(old.position);
    g.a = model;
  };

  function stage(reveal, done) {
    const entered = reveal.outcome === 'entered';
    stageBusy = true;
    setDeposit(reveal.cards.length);
    const leaving = entered ? [] : [...actors].filter(([, actor]) => !actor.userData.stage);
    for (const [, actor] of leaving) actor.userData.stage = true;
    const group = arrivals.map((arrival, i) => ({ ...arrival, t: reveal.cards[i] }));
    arrivals = [];
    const wait = calm ? 60 : 600;
    const at = (ms, fn) => setTimeout(fn, ms);
    at(wait, () => group.forEach((g) => {
      if (g.t !== 'sheep') swap(g, g.t);
    }));
    const flee = (g, dx) => {
      g.a.userData.target = new THREE.Vector3(g.a.position.x + dx, TOP, g.a.position.z + 8);
      g.a.userData.speed = 4.5;
      g.fled = true;
    };
    const wolves = () => group.filter((g) => g.t === 'wolf');
    const dogs = () => group.filter((g) => g.t === 'dog');
    const sheep = () => group.filter((g) => g.t === 'sheep');
    const chase = wait + (calm ? 100 : 550);
    if (entered) {
      at(chase, () => {
        const w = wolves(), d = dogs();
        const k = Math.min(w.length, d.length);
        for (let i = 0; i < k; i++) {
          flee(w[i], -6);
          d[i].a.userData.target = new THREE.Vector3(w[i].a.position.x - 8, TOP, w[i].a.position.z + 8);
          d[i].a.userData.speed = 4.8;
          d[i].fled = true;
        }
        const prey = sheep();
        w.slice(k).forEach((wolf, i) => {
          const victim = prey[i];
          if (!victim) return flee(wolf, 6);
          wolf.a.userData.target = victim.a.position.clone().add(new THREE.Vector3(0, 0, 0.8));
          wolf.a.userData.speed = 4;
          at(calm ? 40 : 500, () => { if (!calm) puff(victim.a.position); scene.remove(victim.a); actors.delete(victim.id); victim.eaten = true; flee(wolf, 6); });
        });
      });
      at(chase + (calm ? 100 : 950), () => { gateTarget = 1; });
      at(chase + (calm ? 200 : 1200), () => {
        for (const g of sheep().filter((s) => !s.eaten)) {
          const gate = new THREE.Vector3(0.5, TOP, PEN.z1 - 0.85);
          g.a.userData.target = gate;
          g.a.userData.speed = 3.6;
          if (calm) g.a.position.copy(gate);
          else at(950, () => {
            g.a.userData.target = penSpot();
            g.a.userData.speed = 2.2;
          });
          g.a.userData.stage = false;
          g.a.userData.nextMove = performance.now() + 6000;
          const real = unclaimed.entries().next().value;
          if (real) {
            const [id, name] = real;
            unclaimed.delete(id);
            actors.delete(g.id);
            actors.set(id, g.a);
            g.a.userData.id = id;
            g.a.userData.name = name;
            g.a.traverse((o) => { o.userData.actorId = id; });
          } else {
            g.a.userData.stage = true;
          }
        }
      });
      at(chase + (calm ? 400 : 2900), () => { gateTarget = 0; });
    } else if (!calm) {
      at(chase, () => {
        gateTarget = 1;
        for (const [, actor] of leaving) {
          actor.userData.anim = null;
          actor.userData.target.set(0.5, TOP, PEN.z1 + 0.2);
          actor.userData.speed = 4.8;
        }
      });
      at(chase + 1800, () => leaving.forEach(([, actor], i) => {
        actor.userData.target.set(1.5 + (i % 3) * 0.4, TOP, 7.6);
      }));
      at(chase + 2600, () => group.forEach((g) => puff(g.a.position)));
    }
    const end = chase + (calm ? 450 : entered ? 3250 : 3450);
    at(end, () => {
      gateTarget = 0;
      for (const { id, a } of group) {
        if (!a.userData.stage) continue;
        scene.remove(a);
        actors.delete(id);
      }
      for (const [id, actor] of leaving) {
        scene.remove(actor);
        actors.delete(id);
        held.delete(id);
      }
      stageBusy = false;
      for (const [id, name] of unclaimed) spawn(id).userData.name = name;
      unclaimed.clear();
      done?.();
    });
    return end;
  }

  let zoom = 1, baseD = 20;
  const ZOFF = 1.8;
  const pan = { x: 0, z: ZOFF };
  const view = new THREE.Vector3();
  const tilt = (52 * Math.PI) / 180;
  const clampView = () => {
    zoom = Math.min(3, Math.max(0.6, zoom));
    const lim = Math.max(0, 1 - 1 / zoom) * 9 + 4.5;
    pan.x = Math.min(lim, Math.max(-lim, pan.x));
    pan.z = Math.min(lim * 0.8 + ZOFF, Math.max(-lim * 0.8, pan.z));
  };
  function updateCamera() {
    clampView();
    const d = baseD / zoom;
    view.set(target.x + pan.x, target.y, target.z + pan.z);
    camera.position.set(view.x, view.y + d * Math.sin(tilt), view.z + d * Math.cos(tilt));
    camera.lookAt(view);
    camera.updateProjectionMatrix();
  }
  const dom = renderer.domElement;
  dom.style.touchAction = 'none';
  const pointers = new Map();
  let drag = null, pinch = 0;
  dom.addEventListener('pointerdown', (e) => {
    const r = dom.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dom.setPointerCapture?.(e.pointerId);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
    let best = null, bestD = 44;
    for (const [id, a] of actors) {
      if (a.userData.type !== 'sheep' || a.userData.stage) continue;
      const v = a.position.clone().add(new THREE.Vector3(0, 0.6, 0)).project(camera);
      const d = Math.hypot(((v.x + 1) / 2) * r.width - px, ((1 - v.y) / 2) * r.height - py);
      if (d < bestD) { bestD = d; best = id; }
    }
    if (best) { drag = null; hooks.onPick?.(best); return; }
    hooks.onPick?.(null);
    drag = { x: e.clientX, y: e.clientY };
  });
  dom.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const n = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) { zoom *= n / pinch; updateCamera(); }
      pinch = n;
      return;
    }
    if (!drag) return;
    const k = (2 * (baseD / zoom) * Math.tan((camera.fov * Math.PI) / 360)) / size.h;
    pan.x -= (e.clientX - drag.x) * k;
    pan.z -= ((e.clientY - drag.y) * k) / Math.sin(tilt);
    drag = { x: e.clientX, y: e.clientY };
    updateCamera();
  });
  const release = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; if (!pointers.size) drag = null; };
  dom.addEventListener('pointerup', release);
  dom.addEventListener('pointercancel', release);
  dom.addEventListener('wheel', (e) => { e.preventDefault(); zoom *= Math.exp(-e.deltaY * 0.0015); updateCamera(); }, { passive: false });
  dom.addEventListener('dblclick', () => { zoom = 1; pan.x = 0; pan.z = ZOFF; updateCamera(); });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    size = { w, h };
    renderer.setSize(w, h, false);
    dom.style.width = '100%';
    dom.style.height = '100%';
    camera.aspect = w / h;
    const tanY = Math.tan((camera.fov * Math.PI) / 360);
    baseD = 1.3 * Math.max(10.8 / (tanY * camera.aspect), 6.2 / tanY);
    updateCamera();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const idleActions = ['graze', 'sleep', 'jump', 'bleat', 'dance'];
  let last = performance.now(), landscapeTick = -1;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const tick = calm ? 0 : Math.floor(now / 45);
    if (tick !== landscapeTick) {
      moveLandscape(tick * 0.045);
      landscapeTick = tick;
    }
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i](now)) tweens.splice(i, 1);
    gateNow += (gateTarget - gateNow) * Math.min(1, dt * 4);
    leafL.rotation.y = gateNow * 1.5;
    leafR.rotation.y = -gateNow * 1.5;
    for (const a of actors.values()) {
      const u = a.userData;
      const body = u.body;
      body.position.y = 0;
      body.rotation.set(0, 0, 0);
      const head = body.getObjectByName('head');
      if (head) head.rotation.x = 0;
      if (!calm && !u.stage && !u.anim && now > u.nextMove) {
        if (Math.random() < 0.42) {
          u.target = penSpot();
          u.speed = 0.5 + Math.random() * 0.55;
        } else {
          const action = idleActions[Math.floor(Math.random() * idleActions.length)];
          u.target.copy(a.position);
          u.anim = { action, t0: now };
        }
        u.nextMove = now + 2200 + Math.random() * 5500;
      }
      const anim = u.anim;
      const k = anim ? (now - anim.t0) / ACTION_MS[anim.action] : 1;
      if (anim && k >= 1) u.anim = null;
      const asleep = anim && anim.action === 'sleep' && k < 1;
      const to = u.target.clone().sub(a.position);
      to.y = 0;
      const dist = to.length();
      const moving = !asleep && dist > 0.05 && u.speed > 0 && (!calm || u.stage || u.speed > 1);
      if (moving) {
        const step = Math.min(dist, u.speed * dt);
        a.position.addScaledVector(to.normalize(), step);
        const want = Math.atan2(to.x, to.z);
        let d = want - a.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        a.rotation.y += d * Math.min(1, dt * 8);
        body.position.y = Math.abs(Math.sin(now * 0.012 * (u.speed + 1))) * 0.07 * Math.min(2, u.speed);
      } else if (u.speed > 1 && !u.stage) u.speed = 0.6;
      const stride = !calm && moving ? Math.sin(now * 0.012 * (u.speed + 1)) * 0.7 : 0;
      u.legs.forEach((leg, i) => { leg.rotation.x = (i === 0 || i === 3 ? 1 : -1) * stride; });
      if (u.ears) {
        const twitch = calm ? 0 : Math.pow(Math.max(0, Math.sin(now * 0.002 + u.idlePhase)), 14);
        u.ears[0].rotation.z = twitch * 0.7;
        u.ears[1].rotation.z = -twitch * 0.43;
        u.tail.rotation.y = calm ? 0 : Math.sin(now * 0.009 + u.idlePhase) * (moving ? 0.45 : twitch * 0.35);
      }
      if (anim && k >= 0 && k < 1) {
        if (anim.action === 'jump') body.position.y = Math.sin(k * Math.PI) * 0.9;
        if (anim.action === 'dance') { body.rotation.z = Math.sin(k * Math.PI * 8) * 0.3; body.position.y = Math.abs(Math.sin(k * Math.PI * 8)) * 0.25; a.rotation.y += dt * 6; }
        if (anim.action === 'sleep') { body.position.y = -0.1; body.rotation.z = 0.2; }
        if (anim.action === 'graze' && head) head.rotation.x = 0.9;
        if (anim.action === 'bleat') { body.scale.set(1 + Math.sin(k * Math.PI * 6) * 0.08, 1, 1); if (head) head.rotation.x = -0.4; }
      } else body.scale.set(1, 1, 1);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setSheep,
    setDeposit,
    hold(id, on) {
      const a = actors.get(id);
      if (!a) return;
      if (on) { held.add(id); a.userData.speed = 0; a.userData.nextMove = Infinity; }
      else { held.delete(id); a.userData.nextMove = performance.now() + 800; }
    },
    animate,
    stage,
    setCalm: (v) => { calm = v; },
    setPanX: (x) => { pan.x = x; updateCamera(); },
    screenOf(id) {
      const a = actors.get(id);
      if (!a) return null;
      const v = a.position.clone().add(new THREE.Vector3(0, 0.6, 0)).project(camera);
      return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h };
    },
  };
}
