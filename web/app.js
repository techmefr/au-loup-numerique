import { createMeadow } from '/meadow3d.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const ICON = { sheep: '🐑', wolf: '🐺', dog: '🐕' };
const NAME = { sheep: 'Mouton', wolf: 'Loup', dog: 'Chien' };
const CORNER = { sheep: 'M', wolf: 'L', dog: 'C' };
const ACTIONS = { jump: 'Sauter', graze: 'Brouter', sleep: 'Dormir', bleat: 'Bêler', run: 'Courir', dance: 'Danser' };
const ERR = {
  room_not_found: 'Salle introuvable', not_enough_players: 'Il faut au moins 2 joueurs', room_full: 'Salle pleine',
  game_started: 'Partie déjà commencée', host_only: "Réservé à l'hôte", bad_selection: 'Choisis 1 à 3 cartes', stale_round: 'Manche dépassée',
};

const url = new URL(location.href);
const parts = url.pathname.split('/').filter(Boolean);
const displayCode = parts[0] === 'display' ? parts[1] : null;
let roomCode = parts[0] === 'room' ? parts[1] : null;
let snap = null, selected = new Set(), claimKind = 'all-sheep', claimCount = 1, err = '';

if (displayCode) $('#scene').classList.add('big');

const toast = (text) => {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('on'), 1400);
};

const meadow = createMeadow($('#scene'), {
  onPick: (id, x, y) => (id ? openRadial(id, x, y) : ($('#menu').innerHTML = '')),
  onAction: (id, action, name) => { if (action === 'bleat') { toast('Bêêê !'); beep(330); } },
});
meadow.setSheep(Array.from({ length: 6 }, (_, i) => ({ id: `demo-${i}` })));

function openRadial(id, x, y) {
  const menu = $('#menu');
  const sheep = snap?.sheep.find((s) => s.id === id);
  const canName = snap && snap.hostId === snap.you;
  menu.innerHTML = `<div class="radial" style="left:${x}px;top:${y}px" role="menu"><h4>${sheep?.name || 'Mouton'}</h4>${Object.entries(ACTIONS).map(([k, v]) => `<button data-a="${k}" role="menuitem">${v}</button>`).join('')}${canName ? '<button data-a="rename" class="gold">Nommer</button>' : ''}</div>`;
  menu.firstChild.onclick = (e) => {
    const a = e.target.dataset?.a;
    if (!a) return;
    if (a === 'rename') {
      const name = prompt('Prénom du mouton ?');
      if (name) send({ type: 'sheep:rename', sheepId: id, name });
    } else if (snap) send({ type: 'sheep:action', sheepId: id, action: a });
    else meadow.animate(id, a);
    menu.innerHTML = '';
  };
  menu.firstChild.querySelector('button')?.focus();
}

const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const saved = () => { try { return JSON.parse(localStorage.getItem('loup') || '{}'); } catch { return {}; } };

ws.onopen = () => {
  if (displayCode) return send({ type: 'display:attach', code: displayCode });
  const s = saved();
  if (roomCode && s.code === roomCode && s.token) send({ type: 'room:join', code: roomCode, displayName: s.name || 'Mouton', resumeToken: s.token });
  else render();
};
ws.onclose = () => toast('Déconnecté — recharge la page');
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'room:joined') {
    roomCode = m.code;
    localStorage.setItem('loup', JSON.stringify({ code: m.code, token: m.resumeToken, name: saved().name }));
    history.replaceState(null, '', `/room/${m.code}`);
  } else if (m.type === 'room:snapshot') {
    const changed = !snap || snap.phase !== m.phase || snap.roundId !== m.roundId;
    snap = m; err = '';
    if (changed) selected.clear();
    meadow.setSheep(m.sheep);
    render();
  } else if (m.type === 'error') { err = ERR[m.code] || m.code; render(); }
  else if (m.type === 'meadow:sheep_action') meadow.animate(m.sheepId, m.action);
  else if (m.type === 'round:revealed') {
    beep(m.reveal.resolution.sheepEaten ? 180 : 520);
    meadow.stage(m.reveal.cards);
    toast(m.reveal.resolution.sheepEaten ? `Oh non ! ${m.reveal.resolution.sheepEaten} mouton perdu` : `${m.reveal.resolution.sheepSaved} mouton sauvé !`);
  }
};

function beep(freq) {
  if ($('#mute').checked) return;
  try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = freq; g.gain.value = 0.05; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.15); } catch {}
}
const applyCalm = () => { document.body.classList.toggle('calm', $('#calm').checked); meadow.setCalm($('#calm').checked); };
$('#calm').onchange = applyCalm;
if (matchMedia('(prefers-reduced-motion: reduce)').matches) $('#calm').checked = true;
applyCalm();

const pName = (id) => snap.players.find((p) => p.id === id)?.name ?? '?';
const cardHtml = (c, extra = '') => `<button class="card ${c.type} ${extra}" data-id="${c.id ?? ''}" aria-label="${NAME[c.type]}"><span class="corner">${CORNER[c.type]}</span>${ICON[c.type]}<span class="label">${NAME[c.type].toUpperCase()}</span></button>`;
const chip = (label, value, cls = '') => `<div class="chip ${cls}"><small>${label}</small><b>${value}</b></div>`;

function hud() {
  $('#chips').innerHTML = snap
    ? chip('SALLE', snap.code) + chip('MANCHE', `${snap.roundNo}/${snap.totalRounds || '–'}`) + chip('SAUVÉS', snap.sheepSaved, 'gold') + chip('PIOCHE', snap.deck)
    : '';
}

function fan(cards, interactive) {
  const n = cards.length, mid = (n - 1) / 2;
  return cards.map((c, i) => {
    const r = (i - mid) * 5, y = Math.abs(i - mid) * Math.abs(i - mid) * 4;
    const html = cardHtml(c, selected.has(c.id) ? 'sel' : '').replace('class="card', `style="--r:${r}deg;--y:${y}px" ${interactive ? '' : 'disabled'} aria-pressed="${selected.has(c.id)}" class="card`);
    return html;
  }).join('');
}

function render() {
  hud();
  if (!snap) {
    if (displayCode) { app.innerHTML = '<div class="panel">Connexion à la salle…</div>'; return; }
    const s = saved();
    app.innerHTML = `<div class="panel"><h2>Bienvenue dans la prairie</h2>
      <p>Bluffe avec des moutons… ou des loups déguisés !</p>
      <label class="f">Ton prénom<input type="text" id="name" maxlength="16" value="${s.name ?? ''}"></label>
      <div class="row"><button id="create" class="gold">Créer une partie</button></div>
      <label class="f">Code de la salle<input type="text" id="code" maxlength="4" value="${roomCode ?? ''}" style="text-transform:uppercase"></label>
      <div class="row"><button id="join">Rejoindre une partie</button></div>
      <details><summary>Comment jouer</summary>
      <p>À ton tour, pose 1 à 3 cartes face cachée et annonce « Ce sont des moutons ». Les autres votent en secret : « AU LOUP ! » ou « Je valide ». Un chien annule un loup, un loup restant mange un mouton.</p></details>
      <p class="err" role="alert">${err}</p></div>`;
    const name = () => { const n = $('#name').value.trim() || 'Mouton'; localStorage.setItem('loup', JSON.stringify({ ...saved(), name: n })); return n; };
    $('#create').onclick = () => send({ type: 'room:create', displayName: name(), voteSeconds: 60 });
    $('#join').onclick = () => send({ type: 'room:join', code: $('#code').value.trim().toUpperCase(), displayName: name() });
    return;
  }
  const g = snap, you = g.you, isAuthor = g.authorId === you, isHost = g.hostId === you;
  let body = '';
  if (g.phase === 'lobby') {
    const link = `${location.origin}/room/${g.code}`;
    body = `<div class="panel"><h2>Salle ${g.code}</h2><div class="row"><img class="qr" src="/qr/${g.code}.svg" alt="QR code pour rejoindre la salle ${g.code}" width="150" height="150"><div><div class="codebox" aria-hidden="true">${g.code}</div><p>Lien : <a href="${link}">${link}</a></p><p>Écran partagé : <a href="/display/${g.code}" target="_blank">/display/${g.code}</a></p></div></div>
      ${isHost ? `<button id="start" class="gold" ${g.players.length < 2 ? 'disabled' : ''}>Lancer la partie (${g.players.length} joueurs)</button>` : '<p>En attente de l’hôte…</p>'}</div>`;
  } else if (g.phase === 'select') {
    body = isAuthor
      ? `<div class="panel"><h2>À toi de jouer !</h2><div class="hand" id="hand">${fan(g.hand, true)}</div>
        <div class="row center"><label><input type="radio" name="ck" value="all-sheep" ${claimKind === 'all-sheep' ? 'checked' : ''}> « Ce sont des moutons »</label>
        <label><input type="radio" name="ck" value="survivors" ${claimKind === 'survivors' ? 'checked' : ''}> Moutons sauvés :</label>
        <input type="text" id="cc" inputmode="numeric" value="${claimCount}" style="width:70px" aria-label="Nombre de moutons sauvés annoncé"></div>
        <div class="row center"><button id="play" ${selected.size < 1 ? 'disabled' : ''}>Jouer ${selected.size} carte(s)</button></div></div>`
      : `<div class="panel"><h2>${pName(g.authorId)} choisit ses cartes…</h2><div class="hand" id="hand">${fan(g.hand, false)}</div></div>`;
  } else if (g.phase === 'voting') {
    const claim = g.claim.kind === 'all-sheep' ? 'Ce sont des moutons !' : `${g.claim.count} mouton(s) sauvé(s) !`;
    const backs = Array.from({ length: g.pile }, (_, i) => `<div class="card back" style="--r:${(i - (g.pile - 1) / 2) * 8}deg" aria-hidden="true"></div>`).join('');
    body = `<div class="panel"><h2>${pName(g.authorId)} pose ${g.pile} carte(s)</h2><p><span class="claim">« ${claim} »</span></p>
      <div class="pile" id="pile">${backs}</div>
      <p>Votes : ${g.voted}/${g.voters}</p>`;
    if (!isAuthor && !g.myVote) body += `<p>Glisse la pile à gauche (AU LOUP !) ou à droite (Je valide), ou utilise les boutons.</p>
      <div class="row center"><button class="red" id="vw">← AU LOUP !</button><button class="green" id="vt">Je valide →</button></div>`;
    else body += `<p>${isAuthor ? 'Les autres votent…' : 'Vote enregistré. En attente des autres…'}</p>`;
    body += '</div>';
  } else {
    const r = g.reveal;
    const good = !r.lie || r.caught;
    body = `<div class="panel reveal"><div class="verdict ${r.lie ? 'bad' : 'good'}">${r.lie ? 'BLUFF !' : 'HONNÊTE !'}</div>
      <div class="reveal-row">${r.cards.map((t, i) => cardHtml({ type: t }, 'big').replace('class="card', `style="--i:${i}" disabled class="card`)).join('')}</div>
      <p style="text-align:center">${r.caught ? 'Démasqué par le groupe' : 'Cru par le groupe'} — 🐑 sauvés : ${r.resolution.sheepSaved} · 💨 perdus : ${r.resolution.sheepEaten} · 🐕 loups chassés : ${r.resolution.wolvesChased}</p>
      <p style="text-align:center">${Object.entries(r.votes).map(([id, v]) => `${pName(id)} → ${v === 'wolf' ? 'AU LOUP' : v === 'trust' ? 'valide' : 'absent'}`).join(' · ')}</p>
      ${g.phase === 'finished' ? '<div class="verdict">FIN DE PARTIE</div>' : ''}
      <div class="row center">${isHost ? `<button class="gold" id="${g.phase === 'finished' ? 'again' : 'next'}">${g.phase === 'finished' ? 'Rejouer' : 'Manche suivante'}</button>` : '<span>En attente de l’hôte…</span>'}</div></div>`;
    void good;
  }
  const board = g.players.map((p) => `<li class="${p.id === you ? 'me' : ''} ${p.id === g.authorId && g.phase !== 'lobby' ? 'turn' : ''}"><span class="dot ${p.connected ? '' : 'off'}"></span><span>${p.name}${p.id === g.hostId ? ' 👑' : ''}${p.id === you ? ' (toi)' : ''}</span><span>🃏 ${p.cards}</span><span class="pts">${p.score} pts</span></li>`).join('');
  const sheepList = g.sheep.map((s, i) => `<button class="sr" data-sheep="${s.id}">Mouton ${s.name || i + 1} : actions</button>`).join('');
  app.innerHTML = (displayCode ? `<h2>Salle ${g.code} — ${g.phase}</h2>` : body) + `<div class="panel"><ul class="score">${board}</ul></div><div class="sr">${sheepList}</div><p class="err" role="alert">${err}</p>`;
  document.querySelectorAll('.sr [data-sheep]').forEach((b) => { b.onclick = () => { const p = meadow.screenOf(b.dataset.sheep); openRadial(b.dataset.sheep, p?.x ?? 100, p?.y ?? 100); }; });
  if (displayCode) return;
  $('#start')?.addEventListener('click', () => send({ type: 'game:start' }));
  $('#next')?.addEventListener('click', () => send({ type: 'game:next' }));
  $('#again')?.addEventListener('click', () => send({ type: 'game:start' }));
  document.querySelectorAll('#hand .card:not([disabled])').forEach((b) => b.onclick = () => {
    if (selected.has(b.dataset.id)) selected.delete(b.dataset.id); else if (selected.size < 3) selected.add(b.dataset.id);
    beep(selected.has(b.dataset.id) ? 600 : 420);
    render();
  });
  document.querySelectorAll('[name=ck]').forEach((r) => r.onchange = () => { claimKind = r.value; });
  $('#cc')?.addEventListener('input', (e) => { claimCount = Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0)); });
  $('#play')?.addEventListener('click', () => send({ type: 'cards:submit', roundId: g.roundId, cardIds: [...selected], claim: claimKind === 'all-sheep' ? { kind: 'all-sheep' } : { kind: 'survivors', count: claimCount } }));
  const vote = (choice) => send({ type: 'vote:submit', roundId: g.roundId, choice });
  $('#vw')?.addEventListener('click', () => vote('wolf'));
  $('#vt')?.addEventListener('click', () => vote('trust'));
  const pile = $('#pile');
  if (pile && !isAuthor && !g.myVote) {
    let x0 = null;
    pile.onpointerdown = (e) => { x0 = e.clientX; pile.setPointerCapture(e.pointerId); };
    pile.onpointermove = (e) => { if (x0 !== null) { const d = e.clientX - x0; pile.style.transform = `translateX(${d}px) rotate(${d / 20}deg)`; pile.style.outline = d < -40 ? '4px solid #e0453a' : d > 40 ? '4px solid #4caf50' : ''; } };
    pile.onpointerup = (e) => { const d = e.clientX - x0; x0 = null; pile.style.transform = ''; pile.style.outline = ''; if (d < -80) vote('wolf'); else if (d > 80) vote('trust'); };
  }
}
render();
