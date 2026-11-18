import * as THREE from 'three';

const N = 16;
const HALF = N / 2;
const TOP = 0.5;
const ACTION_MS = { jump: 600, dance: 1200, bleat: 900, sleep: 3500, graze: 2200, run: 1400 };
const PEN = { x0: -3, x1: 4, z0: -6, z1: 1 };
const GATE = { x0: -0.5, x1: 1.5 };
const DEPOSIT = new THREE.Vector3(0.5, TOP, 3.4);

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const world = (gx, gz) => new THREE.Vector3(gx - HALF + 0.5, TOP, gz - HALF + 0.5);
const riverX = (gz) => 2 + Math.round(Math.sin(gz * 0.55) * 1.1);
const pathX = (gz) => (gz >= 9 ? 8 : 8 + Math.round(Math.sin(gz * 0.5 + 1)));
const inPen = (gx, gz) => gx >= 5 && gx <= 11 && gz >= 2 && gz <= 8;

const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: true }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

function animalModel(type) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const legs = (c) => [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([x, z]) => body.add(box(0.14, 0.22, 0.14, c, x, 0.11, z)));
  if (type === 'sheep') {
    legs(0x3b2f2f);
    body.add(box(0.7, 0.5, 0.9, 0xfff5db, 0, 0.47, 0));
    body.add(box(0.76, 0.3, 0.6, 0xffffff, 0, 0.62, 0));
    const head = box(0.34, 0.34, 0.34, 0x3b2f2f, 0, 0.62, 0.55);
    head.name = 'head';
    body.add(head);
    head.add(box(0.1, 0.1, 0.04, 0xffffff, -0.09, 0.05, 0.18), box(0.1, 0.1, 0.04, 0xffffff, 0.09, 0.05, 0.18));
  } else if (type === 'wolf') {
    legs(0x4a4a5a);
    body.add(box(0.6, 0.45, 1.0, 0x6b6b80, 0, 0.45, 0));
    const head = box(0.4, 0.38, 0.4, 0x6b6b80, 0, 0.6, 0.6);
    head.name = 'head';
    head.add(box(0.2, 0.16, 0.26, 0x4a4a5a, 0, -0.06, 0.28), box(0.08, 0.16, 0.08, 0x4a4a5a, -0.13, 0.26, 0), box(0.08, 0.16, 0.08, 0x4a4a5a, 0.13, 0.26, 0), box(0.06, 0.06, 0.03, 0xffd54a, -0.1, 0.06, 0.2), box(0.06, 0.06, 0.03, 0xffd54a, 0.1, 0.06, 0.2));
    body.add(head, box(0.14, 0.14, 0.5, 0x4a4a5a, 0, 0.55, -0.7));
  } else {
    legs(0x8e623b);
    body.add(box(0.55, 0.4, 0.9, 0xd9a05b, 0, 0.42, 0));
    const head = box(0.38, 0.36, 0.38, 0xd9a05b, 0, 0.58, 0.55);
    head.name = 'head';
    head.add(box(0.12, 0.2, 0.08, 0x8e623b, -0.2, 0, 0), box(0.12, 0.2, 0.08, 0x8e623b, 0.2, 0, 0), box(0.14, 0.12, 0.16, 0x3b2f2f, 0, -0.06, 0.26));
    body.add(head, box(0.12, 0.12, 0.4, 0xd9a05b, 0, 0.55, -0.6));
  }
  g.userData.body = body;
  return g;
}

export function createMeadow(container, hooks) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a2e22);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
  camera.position.set(22, 20, 22);
  camera.lookAt(0, -0.8, 0);

  scene.add(new THREE.HemisphereLight(0xfff1d3, 0x2f613f, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d3, 1.4);
  sun.position.set(-12, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  scene.add(sun);

  const rand = rng(42);
  const cells = [];
  for (let gx = 0; gx < N; gx++) {
    for (let gz = 0; gz < N; gz++) {
      const water = gx === riverX(gz);
      const way = !water && gx === pathX(gz);
      const h = water ? 0.6 : 1;
      const pen = inPen(gx, gz);
      const color = water ? 0x4f9dd7 : way ? 0xe9d9b0 : pen ? (rand() > 0.8 ? 0xd8c070 : 0x9bd06a) : rand() > 0.5 ? 0x8fc765 : 0x84bd5c;
      cells.push({ gx, gz, h, color });
    }
  }
  const ground = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), cells.length);
  const tmp = new THREE.Object3D();
  cells.forEach((c, i) => {
    tmp.position.set(c.gx - HALF + 0.5, TOP - c.h / 2, c.gz - HALF + 0.5);
    tmp.scale.set(1, c.h, 1);
    tmp.updateMatrix();
    ground.setMatrixAt(i, tmp.matrix);
    ground.setColorAt(i, new THREE.Color(c.color));
  });
  ground.receiveShadow = true;
  scene.add(ground);
  const base = box(N + 0.4, 2, N + 0.4, 0x6b4a2b, 0, -1.2, 0);
  base.castShadow = false;
  scene.add(base);

  const deco = new THREE.Group();
  scene.add(deco);
  for (let i = 0; i < 30; i++) {
    const gx = Math.floor(rand() * N), gz = Math.floor(rand() * N);
    if (Math.abs(gx - riverX(gz)) <= 1 || Math.abs(gx - pathX(gz)) <= 1) continue;
    if (gx >= 4 && gx <= 12 && gz >= 1 && gz <= 12) continue;
    const t = new THREE.Group();
    const hgt = 1 + Math.floor(rand() * 2);
    t.add(box(0.4, hgt, 0.4, 0x8e623b, 0, hgt / 2, 0));
    const leaf = rand() > 0.5 ? 0x2f7a4a : 0x3f9a58;
    t.add(box(1.5, 0.9, 1.5, leaf, 0, hgt + 0.3, 0), box(1.0, 0.8, 1.0, leaf, 0, hgt + 1.0, 0), box(0.5, 0.5, 0.5, leaf, 0, hgt + 1.6, 0));
    t.position.copy(world(gx, gz));
    deco.add(t);
  }
  const flowerColors = [0xff6b9d, 0xffd54a, 0xffffff, 0xb28dff];
  for (let i = 0; i < 40; i++) {
    const gx = Math.floor(rand() * N), gz = Math.floor(rand() * N);
    if (gx === riverX(gz) || gx === pathX(gz) || inPen(gx, gz)) continue;
    const f = box(0.14, 0.14, 0.14, flowerColors[i % 4], (rand() - 0.5) * 0.7, 0.12, (rand() - 0.5) * 0.7);
    f.position.add(world(gx, gz));
    deco.add(f);
  }
  for (const gz of [5, 6]) {
    const b = box(1.4, 0.15, 1, 0x8e623b);
    b.position.copy(world(riverX(gz), gz)).add(new THREE.Vector3(0, -0.05, 0));
    deco.add(b);
  }

  const WOOD = 0xb07a45;
  const post = (x, z) => deco.add(box(0.18, 1.0, 0.18, 0x8e623b, x, TOP + 0.5, z));
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (const y of [0.35, 0.75]) {
      const r = box(x0 === x1 ? 0.08 : len, 0.1, z0 === z1 ? 0.08 : len, WOOD, (x0 + x1) / 2, TOP + y, (z0 + z1) / 2);
      deco.add(r);
    }
  };
  for (let x = PEN.x0; x <= PEN.x1; x++) {
    post(x, PEN.z0);
    if (x < GATE.x0 || x > GATE.x1) post(x, PEN.z1);
  }
  for (let z = PEN.z0 + 1; z < PEN.z1; z++) { post(PEN.x0, z); post(PEN.x1, z); }
  rail(PEN.x0, PEN.z0, PEN.x1, PEN.z0);
  rail(PEN.x0, PEN.z0, PEN.x0, PEN.z1);
  rail(PEN.x1, PEN.z0, PEN.x1, PEN.z1);
  rail(PEN.x0, PEN.z1, GATE.x0, PEN.z1);
  rail(GATE.x1, PEN.z1, PEN.x1, PEN.z1);
  post(GATE.x0, PEN.z1);
  post(GATE.x1, PEN.z1);

  const leafMesh = (dir) => {
    const pivot = new THREE.Group();
    const w = 1.0;
    for (const y of [0.3, 0.55, 0.8]) pivot.add(box(w, 0.09, 0.07, 0xd9a05b, (dir * w) / 2, TOP + y, 0));
    pivot.add(box(0.07, 0.7, 0.07, 0xd9a05b, dir * 0.96, TOP + 0.55, 0));
    pivot.add(box(0.07, 0.7, 0.07, 0xd9a05b, dir * 0.04, TOP + 0.55, 0));
    return pivot;
  };
  const leafL = leafMesh(1);
  const leafR = leafMesh(-1);
  leafL.position.set(GATE.x0, 0, PEN.z1);
  leafR.position.set(GATE.x1, 0, PEN.z1);
  deco.add(leafL, leafR);
  let gateTarget = 0, gateNow = 0;
  const sign = box(1.2, 0.5, 0.08, 0xe9d9b0, 0.5, TOP + 1.7, PEN.z1);
  deco.add(sign, box(0.08, 1.2, 0.08, 0x8e623b, 0.5, TOP + 1.1, PEN.z1));

  const actors = new Map();
  const tweens = [];
  let calm = false;
  let size = { w: 1, h: 1 };
  let stageBusy = false;
  const unclaimed = [];
  let deposit = null;

  const penSpot = () => new THREE.Vector3(PEN.x0 + 0.7 + Math.random() * (PEN.x1 - PEN.x0 - 1.4), TOP, PEN.z0 + 0.7 + Math.random() * (PEN.z1 - PEN.z0 - 1.6));

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
    for (let i = 0; i < 10; i++) {
      const c = box(0.22, 0.22, 0.22, 0xffffff, 0, 0, 0);
      c.castShadow = false;
      c.position.copy(at).add(new THREE.Vector3(0, 0.6, 0));
      scene.add(c);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2.4, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2.4);
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
    for (const s of list) {
      const a = actors.get(s.id);
      if (a) { a.userData.name = s.name ?? ''; continue; }
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
    for (let i = 0; i < n; i++) {
      const c = new THREE.Group();
      c.add(box(0.78, 0.06, 1.1, 0xfff1d3), box(0.64, 0.08, 0.96, 0x3f9a58), box(0.34, 0.1, 0.3, 0xfff5db));
      c.position.set((i - (n - 1) / 2) * 1.0, 0.05, 0);
      c.rotation.y = (i - (n - 1) / 2) * 0.2;
      deposit.add(c);
    }
    deposit.scale.setScalar(1.5);
    deposit.position.copy(DEPOSIT);
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
      const home = DEPOSIT.clone().add(new THREE.Vector3((i - (cards.length - 1) / 2) * 1.3, 0, 0));
      const id = `stage-${performance.now()}-${i}`;
      const a = spawn(id, 'sheep', home);
      Object.assign(a.userData, { stage: true, nextMove: Infinity, speed: 0 });
      a.rotation.y = 0;
      return { a, t, id, home };
    });
    const wait = calm ? 200 : 1100;
    const at = (ms, fn) => setTimeout(fn, ms);
    at(wait, () => group.forEach((g) => { if (g.t !== 'sheep') swap(g, g.t); }));
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
        const left = w.slice(k);
        const prey = sheep();
        left.forEach((wolf, i) => {
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

  const ray = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...actors.values()].filter((a) => a.userData.type === 'sheep' && !a.userData.stage), true);
    const id = hits[0]?.object.userData.actorId;
    hooks.onPick?.(id ?? null);
  });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    size = { w, h };
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    const view = 9.6;
    const aspect = w / h;
    camera.left = (-view * aspect) / 1.15;
    camera.right = (view * aspect) / 1.15;
    camera.top = view / 1.15;
    camera.bottom = -view / 1.15;
    camera.updateProjectionMatrix();
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
        body.position.y = Math.abs(Math.sin(now * 0.012 * (u.speed + 1))) * 0.08 * Math.min(2, u.speed);
      } else if (u.speed > 1 && !u.stage) u.speed = 0.6;
      if (anim && k >= 0 && k < 1) {
        if (anim.action === 'jump') body.position.y = Math.sin(k * Math.PI) * 0.9;
        if (anim.action === 'dance') { body.rotation.z = Math.sin(k * Math.PI * 8) * 0.35; body.position.y = Math.abs(Math.sin(k * Math.PI * 8)) * 0.25; a.rotation.y += dt * 6; }
        if (anim.action === 'sleep') { body.position.y = -0.12; body.rotation.z = 0.15; }
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
    animate,
    stage,
    setCalm: (v) => { calm = v; },
    screenOf(id) {
      const a = actors.get(id);
      if (!a) return null;
      const v = a.position.clone().project(camera);
      return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h };
    },
  };
}
