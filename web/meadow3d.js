import * as THREE from 'three';
import { GROUND, paintGround } from './ground.js';

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
  const legs = (c, h = 0.28) => [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.22], [0.2, 0.22]].forEach(([x, z]) => body.add(cyl(0.06, h, c, x, h / 2, z)));
  const head = new THREE.Group();
  head.name = 'head';
  if (type === 'sheep') {
    legs(0x4a3a35);
    for (const [x, y, z, r] of [[0, 0.55, 0, 0.46], [0.28, 0.58, 0.1, 0.34], [-0.28, 0.58, 0.1, 0.34], [0, 0.6, -0.3, 0.36], [0, 0.78, 0.12, 0.32], [0.2, 0.5, -0.25, 0.28], [-0.2, 0.5, -0.25, 0.28]]) body.add(sphere(r, 0xfffaf0, x, y, z));
    head.position.set(0, 0.55, 0.5);
    head.add(sphere(0.2, 0x4a3a35, 0, 0, 0.05, 1, 0.95, 1.1), sphere(0.09, 0xfffaf0, -0.15, 0.1, -0.02), sphere(0.09, 0xfffaf0, 0.15, 0.1, -0.02));
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
  scene.background = new THREE.Color(0xf1ebdd);
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

  const painted = new THREE.Mesh(new THREE.PlaneGeometry(GROUND.w, GROUND.d), new THREE.MeshBasicMaterial({ map: paintGround(), transparent: true }));
  painted.rotation.x = -Math.PI / 2;
  scene.add(painted);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(GROUND.w, GROUND.d), new THREE.ShadowMaterial({ opacity: 0.22 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.01;
  catcher.receiveShadow = true;
  scene.add(catcher);

  const rand = rng(11);
  const deco = new THREE.Group();
  scene.add(deco);
  const tree = (x, z, color, s = 1) => {
    const t = new THREE.Group();
    t.add(cyl(0.12 * s, 0.7 * s, 0x8e623b, 0, 0.35 * s, 0));
    for (const [dx, dy, dz, r] of [[0, 1.1, 0, 0.75], [0.45, 0.85, 0.15, 0.52], [-0.45, 0.9, -0.1, 0.55], [0.1, 1.5, 0.05, 0.5], [0, 0.85, 0.45, 0.5]]) t.add(sphere(r * s, color, dx * s, dy * s, dz * s));
    t.position.set(x, 0, z);
    deco.add(t);
  };
  const greens = [0x5aa63a, 0x6cb844, 0x4e9a35];
  [[-9.4, -7.2], [-5.6, -7.0], [6.9, -7.2], [9.6, -6.6], [9.4, 5.2], [-4.4, 7.2], [6.8, 7.0], [8.6, -1.0], [-9.4, 7.0], [2.4, -7.6]].forEach(([x, z], i) => tree(x, z, greens[i % 3], 0.9 + rand() * 0.5));
  tree(-9.2, 1.6, 0xe97aa6, 1.1);
  for (let i = 0; i < 28; i++) {
    const x = -10 + rand() * 20, z = -7.5 + rand() * 15;
    if (x > PEN.x0 - 1 && x < PEN.x1 + 1 && z > PEN.z0 - 1 && z < DEPOSIT.z + 1.5) continue;
    if (Math.abs(x + 7.6) < 1.8) continue;
    deco.add(sphere(0.09, [0xff6b9d, 0xffd54a, 0xffffff, 0xb28dff][i % 4], x, 0.1, z));
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

  const backTex = new THREE.TextureLoader().load('assets/cards/back.png');
  backTex.colorSpace = THREE.SRGBColorSpace;

  const actors = new Map();
  const tweens = [];
  const held = new Set();
  let calm = false;
  let size = { w: 1, h: 1 };
  let stageBusy = false;
  const unclaimed = [];
  let deposit = null;

  const penSpot = () => new THREE.Vector3(PEN.x0 + 0.8 + Math.random() * (PEN.x1 - PEN.x0 - 1.6), TOP, PEN.z0 + 0.8 + Math.random() * (PEN.z1 - PEN.z0 - 1.8));

  function spawn(id, type = 'sheep', at = penSpot()) {
    const model = animalModel(type);
    model.position.copy(at);
    model.userData = { ...model.userData, id, type, target: at.clone(), speed: 0.6 + Math.random() * 0.4, nextMove: performance.now() + Math.random() * 3000, anim: null, name: '', stage: false };
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
    const visible = () => [...actors.values()].filter((x) => x.userData.type === "sheep").length;
    for (const s of list) {
      const a = actors.get(s.id);
      if (a) { a.userData.name = s.name ?? ''; continue; }
      if (visible() >= 28) continue;
      if (stageBusy) { if (!unclaimed.includes(s.id)) unclaimed.push(s.id); continue; }
      spawn(s.id, 'sheep').userData.name = s.name ?? '';
    }
  }

  function setDeposit(n) {
    if (deposit && deposit.userData.n === n) return;
    if (deposit) { scene.remove(deposit); deposit = null; }
    if (!n) return;
    deposit = new THREE.Group();
    deposit.userData.n = n;
    const faceMat = new THREE.MeshBasicMaterial({ map: backTex });
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 1.25), [mat(0xfff1d3), mat(0xfff1d3), faceMat, mat(0xfff1d3), mat(0xfff1d3), mat(0xfff1d3)]);
      c.castShadow = true;
      c.position.set((i - (n - 1) / 2) * 1.05, 0.05 + i * 0.02, 0);
      c.rotation.y = (i - (n - 1) / 2) * 0.22;
      deposit.add(c);
    }
    deposit.position.copy(DEPOSIT);
    deposit.scale.setScalar(1.3);
    scene.add(deposit);
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
    model.userData = { ...model.userData, stage: true, type, nextMove: Infinity, target: old.position.clone(), speed: 0, anim: { action: 'jump', t0: performance.now() } };
    scene.remove(old);
    scene.add(model);
    actors.set(g.id, model);
    puff(old.position);
    g.a = model;
  };

  function stage(reveal, done) {
    const cards = reveal.cards;
    const entered = reveal.outcome === 'entered';
    stageBusy = true;
    setDeposit(0);
    const group = cards.map((t, i) => {
      const home = DEPOSIT.clone().add(new THREE.Vector3((i - (cards.length - 1) / 2) * 1.5, 0, 0));
      const id = `stage-${performance.now()}-${i}`;
      const a = spawn(id, 'sheep', home);
      Object.assign(a.userData, { stage: true, nextMove: Infinity, speed: 0 });
      a.rotation.y = 0;
      return { a, t, id, home };
    });
    const wait = calm ? 200 : 1100;
    const at = (ms, fn) => setTimeout(fn, ms);
    at(wait, () => group.forEach((g) => { puff(g.a.position); if (g.t !== 'sheep') swap(g, g.t); }));
    const flee = (g, dx) => {
      g.a.userData.target = new THREE.Vector3(g.a.position.x + dx, TOP, g.a.position.z + 8);
      g.a.userData.speed = 4.5;
      g.fled = true;
    };
    const wolves = () => group.filter((g) => g.t === 'wolf');
    const dogs = () => group.filter((g) => g.t === 'dog');
    const sheep = () => group.filter((g) => g.t === 'sheep');
    const chase = wait + (calm ? 400 : 1200);
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
          at(900, () => { puff(victim.a.position); scene.remove(victim.a); actors.delete(victim.id); victim.eaten = true; flee(wolf, 6); });
        });
      });
      at(chase + 2600, () => { gateTarget = 1; });
      at(chase + 3300, () => {
        for (const g of sheep().filter((s) => !s.eaten)) {
          g.a.userData.target = penSpot();
          g.a.userData.speed = 1.4;
          g.a.userData.stage = false;
          g.a.userData.nextMove = performance.now() + 6000;
          const real = unclaimed.shift();
          if (real) { actors.delete(g.id); actors.set(real, g.a); g.a.userData.id = real; g.a.traverse((o) => { o.userData.actorId = real; }); }
        }
      });
      at(chase + 5400, () => { gateTarget = 0; });
    } else {
      at(chase + 600, () => wolves().forEach((g, i) => { g.a.userData.anim = { action: 'dance', t0: performance.now() + i * 100 }; }));
      at(chase + 2200, () => group.forEach((g) => { puff(g.a.position); scene.remove(g.a); actors.delete(g.id); }));
    }
    const end = entered ? chase + 6000 : chase + 2800;
    at(end, () => {
      for (const g of group) {
        if (!g.a.userData.stage) continue;
        scene.remove(g.a);
        actors.delete(g.id);
      }
      stageBusy = false;
      for (const id of unclaimed.splice(0)) spawn(id, 'sheep');
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
    zoom = Math.min(3, Math.max(0.7, zoom));
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
    baseD = Math.max(10.8 / (tanY * camera.aspect), 6.2 / tanY);
    updateCamera();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i](now)) tweens.splice(i, 1);
    gateNow += (gateTarget - gateNow) * Math.min(1, dt * 4);
    leafL.rotation.y = gateNow * 1.5;
    leafR.rotation.y = -gateNow * 1.5;
    if (deposit) deposit.position.y = TOP + Math.sin(now * 0.004) * 0.04;
    for (const a of actors.values()) {
      const u = a.userData;
      const body = u.body;
      body.position.y = 0;
      body.rotation.set(0, 0, 0);
      const head = body.getObjectByName('head');
      if (head) head.rotation.x = 0;
      const anim = u.anim;
      const k = anim ? (now - anim.t0) / ACTION_MS[anim.action] : 1;
      if (anim && k >= 1) u.anim = null;
      const asleep = anim && anim.action === 'sleep' && k < 1;
      if (!calm && !asleep && now > u.nextMove && !u.stage) {
        u.target = penSpot();
        u.speed = 0.5 + Math.random() * 0.5;
        u.nextMove = now + 3500 + Math.random() * 5000;
      }
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
