import * as THREE from 'three';

const N = 16;
const HALF = N / 2;
const TOP = 0.5;
const ACTION_MS = { jump: 600, dance: 1200, bleat: 900, sleep: 3500, graze: 2200, run: 1400 };

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const world = (gx, gz) => new THREE.Vector3(gx - HALF + 0.5, TOP, gz - HALF + 0.5);
const riverX = (gz) => 2 + Math.round(Math.sin(gz * 0.55) * 1.1);
const pathX = (gz) => 8 + Math.round(Math.sin(gz * 0.4 + 1) * 1);

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
  scene.fog = new THREE.Fog(0x0a2e22, 40, 80);
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
      const water = Math.abs(gx - riverX(gz)) <= 0;
      const way = !water && Math.abs(gx - pathX(gz)) <= 0;
      const h = water ? 0.6 : 1;
      const color = water ? 0x4f9dd7 : way ? 0xe9d9b0 : (rand() > 0.5 ? 0x8fc765 : 0x84bd5c);
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
  for (let i = 0; i < 18; i++) {
    const gx = Math.floor(rand() * N), gz = Math.floor(rand() * N);
    if (Math.abs(gx - riverX(gz)) <= 1 || Math.abs(gx - pathX(gz)) <= 1) continue;
    if (gx > 4 && gx < 13 && gz > 2 && gz < 13 && rand() > 0.25) continue;
    const p = world(gx, gz);
    const t = new THREE.Group();
    const hgt = 1 + Math.floor(rand() * 2);
    t.add(box(0.4, hgt, 0.4, 0x8e623b, 0, hgt / 2, 0));
    const leaf = rand() > 0.5 ? 0x2f7a4a : 0x3f9a58;
    t.add(box(1.5, 0.9, 1.5, leaf, 0, hgt + 0.3, 0), box(1.0, 0.8, 1.0, leaf, 0, hgt + 1.0, 0), box(0.5, 0.5, 0.5, leaf, 0, hgt + 1.6, 0));
    t.position.copy(p);
    deco.add(t);
  }
  const flowerColors = [0xff6b9d, 0xffd54a, 0xffffff, 0xb28dff];
  for (let i = 0; i < 40; i++) {
    const gx = Math.floor(rand() * N), gz = Math.floor(rand() * N);
    if (gx === riverX(gz) || gx === pathX(gz)) continue;
    const p = world(gx, gz);
    const f = box(0.14, 0.14, 0.14, flowerColors[i % 4], (rand() - 0.5) * 0.7, 0.12, (rand() - 0.5) * 0.7);
    f.position.add(p);
    deco.add(f);
  }
  for (const gz of [6, 7]) {
    const b = box(1.4, 0.15, 1, 0x8e623b);
    b.position.copy(world(riverX(gz), gz)).add(new THREE.Vector3(0, -0.05, 0));
    deco.add(b);
  }

  const actors = new Map();
  const tweens = [];
  const clock = new THREE.Clock();
  let calm = false;
  let size = { w: 1, h: 1 };

  const pickTarget = () => {
    for (let k = 0; k < 20; k++) {
      const gx = 5 + Math.floor(Math.random() * 10), gz = 1 + Math.floor(Math.random() * 14);
      if (Math.abs(gx - riverX(gz)) > 1) return world(gx, gz);
    }
    return world(10, 8);
  };

  function spawn(id, type = 'sheep', at = pickTarget()) {
    const model = animalModel(type);
    model.position.copy(at);
    model.userData = { ...model.userData, id, type, target: at.clone(), speed: 0.6 + Math.random() * 0.4, nextMove: performance.now() + Math.random() * 3000, anim: null, name: '' };
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

  function remove(id) {
    const a = actors.get(id);
    if (!a) return;
    actors.delete(id);
    if (calm) { scene.remove(a); return; }
    puff(a.position);
    const t0 = performance.now();
    tweens.push((now) => {
      const k = Math.min(1, (now - t0) / 500);
      a.scale.setScalar(1 - k);
      if (k >= 1) { scene.remove(a); return true; }
      return false;
    });
  }

  function setSheep(list) {
    const ids = new Set(list.map((s) => s.id));
    for (const id of [...actors.keys()]) if (!ids.has(id) && actors.get(id).userData.type === 'sheep' && !actors.get(id).userData.stage) remove(id);
    for (const s of list) {
      const a = actors.get(s.id) ?? spawn(s.id, 'sheep', pickTarget());
      a.userData.name = s.name ?? '';
    }
  }

  function animate(id, action) {
    const a = actors.get(id);
    if (!a) return;
    if (calm && action !== 'bleat') return;
    a.userData.anim = { action, t0: performance.now() };
    if (action === 'run') { a.userData.target = pickTarget(); a.userData.speed = 3; }
    hooks.onAction?.(id, action, a.userData.name);
  }

  function stage(cards, done) {
    const spots = cards.map((t, i) => world(6 + i * 1.6, 7).add(new THREE.Vector3(0, 0, 0)));
    const group = [];
    cards.forEach((t, i) => {
      const id = `stage-${i}-${performance.now()}`;
      const a = spawn(id, 'sheep', spots[i]);
      a.userData.stage = true;
      a.userData.target = spots[i].clone();
      a.userData.nextMove = Infinity;
      a.rotation.y = Math.PI / 2;
      group.push({ a, t, id, home: spots[i] });
    });
    const wait = calm ? 200 : 1000;
    setTimeout(() => {
      for (const g of group) {
        if (g.t === 'sheep') continue;
        const old = g.a;
        const model = animalModel(g.t);
        model.position.copy(old.position);
        model.rotation.y = old.rotation.y;
        model.userData = { ...model.userData, stage: true, type: g.t, nextMove: Infinity, target: old.position.clone(), speed: 0, anim: { action: 'jump', t0: performance.now() } };
        scene.remove(old);
        actors.delete(g.id);
        scene.add(model);
        actors.set(g.id, model);
        puff(old.position);
        g.a = model;
      }
    }, wait);
    setTimeout(() => {
      const dogs = group.filter((g) => g.t === 'dog');
      const wolves = group.filter((g) => g.t === 'wolf');
      if (!calm) {
        wolves.slice(0, dogs.length).forEach((w, i) => {
          w.a.userData.target = new THREE.Vector3(-HALF - 3, TOP, w.home.z + (i - 0.5) * 3);
          w.a.userData.speed = 4;
          dogs[i].a.userData.target = new THREE.Vector3(-HALF + 1, TOP, w.home.z + (i - 0.5) * 3);
          dogs[i].a.userData.speed = 4.4;
        });
      }
    }, wait + 900);
    setTimeout(() => {
      for (const g of group) { scene.remove(g.a); actors.delete(g.id); }
      done?.();
    }, wait + (calm ? 2200 : 4200));
  }

  const ray = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...actors.values()].filter((a) => a.userData.type === 'sheep' && !a.userData.stage), true);
    const id = hits[0]?.object.userData.actorId;
    if (id) hooks.onPick?.(id, e.clientX - r.left, e.clientY - r.top);
    else hooks.onPick?.(null);
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
    camera.left = -view * aspect / 1.15;
    camera.right = view * aspect / 1.15;
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
    for (const a of actors.values()) {
      const u = a.userData;
      const body = u.body;
      body.position.y = 0;
      body.rotation.set(0, 0, 0);
      const head = body.getObjectByName('head');
      if (head) head.rotation.x = 0;
      a.scale.x = a.scale.x;
      const anim = u.anim;
      const k = anim ? (now - anim.t0) / ACTION_MS[anim.action] : 1;
      if (anim && k >= 1) u.anim = null;
      const asleep = anim && anim.action === 'sleep' && k < 1;
      if (!calm && !asleep && now > u.nextMove && !u.stage) {
        u.target = pickTarget();
        u.speed = 0.5 + Math.random() * 0.5;
        u.nextMove = now + 3500 + Math.random() * 5000;
      }
      const to = u.target.clone().sub(a.position);
      to.y = 0;
      const dist = to.length();
      const moving = !asleep && dist > 0.05 && u.speed > 0;
      if (moving) {
        const step = Math.min(dist, u.speed * dt);
        a.position.addScaledVector(to.normalize(), step);
        const want = Math.atan2(to.x, to.z);
        let d = want - a.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        a.rotation.y += d * Math.min(1, dt * 8);
        if (!calm) body.position.y = Math.abs(Math.sin(now * 0.012 * (u.speed + 1))) * 0.08 * Math.min(2, u.speed);
      } else if (u.speed > 1) u.speed = 0.6;
      if (anim && k < 1) {
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
