import { createMeadow } from './meadow3d.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const NAME = { sheep: 'Mouton', wolf: 'Loup déguisé', dog: 'Chien déguisé' };
const ACTIONS = { jump: 'Sauter', graze: 'Brouter', sleep: 'Dormir', bleat: 'Bêler', run: 'Courir', dance: 'Danser' };
const MODE_INFO = { 'ni-vu': 'Tu annonces seulement « que des moutons ». Si un loup se cache dans le lot, ce n’est pas vrai. Le plus simple pour débuter.', compte: 'Tu annonces combien de moutons vont rentrer (0 à 3), en tenant compte du chien qui chasse le loup. Plus fin, plus de bluff.' };
const MODES = { 'ni-vu': 'Ni vu ni mouton', compte: 'Compte tes moutons !' };
const RULE_PAGES = [
  ['histoire.webp', 'Le principe en 4 images'],
  ['couverture.webp', 'Résumé des modes'],
  ['modes-1-2-6.webp', 'Modes 1, 2 et 6'],
  ['modes-3-4-5.webp', 'Modes 3, 4 et 5'],
];
const ERR = {
  room_not_found: 'Salle introuvable', not_enough_players: 'Il faut au moins 2 joueurs', room_full: 'Salle pleine',
  game_started: 'Partie déjà commencée', host_only: "Réservé à l'hôte", bad_selection: 'Choisis 1 à 3 cartes', stale_round: 'Manche dépassée',
};

const url = new URL(location.href);
const parts = url.pathname.split('/').filter(Boolean);
const displayCode = parts[0] === 'display' ? parts[1] : null;
let roomCode = parts[0] === 'room' ? parts[1] : null;
let snap = null, selected = new Set(), claimCount = 1, err = '', prefMode = 'ni-vu';

if (displayCode) $('#scene').classList.add('big');

const toast = (text, ms = 2200) => {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('on'), ms);
};

const meadow = createMeadow($('#scene'), {
  onPick: (id) => (id ? openRadial(id) : closeRadial()),
  onAction: (id, action) => { if (action === 'bleat') { toast('Bêêê !', 1000); beep(330); } },
});
if (!displayCode) meadow.setSheep(Array.from({ length: 6 }, (_, i) => ({ id: `demo-${i}` })));

window.loup = { meadow };
let radialId = null;
let resolving = null;
function closeRadial() { $('#menu').innerHTML = ''; if (radialId) meadow.hold(radialId, false); radialId = null; }
addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeRadial(); closeRules(); } });

function openRadial(id) {
  closeRadial();
  const raw = meadow.screenOf(id);
  if (!raw) return;
  const sc = $('#scene');
  const inset = 101;
  const pos = { x: Math.min(Math.max(raw.x, inset), sc.clientWidth - inset), y: Math.min(Math.max(raw.y, inset), sc.clientHeight - inset) };
  radialId = id;
  meadow.hold(id, true);
  const sheep = snap?.sheep.find((s) => s.id === id);
  const canName = snap && snap.hostId === snap.you;
  const items = Object.entries(ACTIONS);
  const R = 70;
  const buttons = items.map(([k, v], i) => {
    const a = (-90 + (360 / items.length) * i) * (Math.PI / 180);
    return `<button class="rbtn" data-a="${k}" role="menuitem" style="left:calc(50% + ${Math.cos(a) * R}px);top:calc(50% + ${Math.sin(a) * R}px)">${v}</button>`;
  }).join('');
  const center = canName ? '<button class="rbtn rname" data-a="rename" aria-label="Donner un prénom">✎</button>' : '';
  $('#menu').innerHTML = `<div class="radial" style="left:${pos.x}px;top:${pos.y}px" role="menu" aria-label="Actions ${sheep?.name ?? 'du mouton'}">${buttons}${center}</div>`;
  $('#menu').firstChild.onclick = (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'rename') {
      const name = prompt('Prénom du mouton ?');
      if (name) send({ type: 'sheep:rename', sheepId: id, name });
    } else if (snap) send({ type: 'sheep:action', sheepId: id, action: a });
    else meadow.animate(id, a);
    closeRadial();
  };
  $('#menu').querySelector('button')?.focus();
}

const LOCAL = location.hostname.endsWith('github.io') || url.searchParams.has('local');
const ws = LOCAL ? new (await import('./local.js')).LocalSocket() : new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const saved = () => { try { return JSON.parse(localStorage.getItem('loup') || '{}'); } catch { return {}; } };

ws.onopen = () => {
  if (displayCode) return send({ type: 'display:attach', code: displayCode });
  const s = saved();
  if (roomCode && s.code === roomCode && s.token) send({ type: 'room:join', code: roomCode, displayName: s.name || 'Mouton', resumeToken: s.token });
  else render();
};
ws.onclose = () => toast('Déconnecté — recharge la page', 5000);
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'room:joined') {
    roomCode = m.code;
    localStorage.setItem('loup', JSON.stringify({ code: m.code, token: m.resumeToken, name: saved().name }));
    if (!LOCAL) history.replaceState(null, '', `/room/${m.code}`);
  } else if (m.type === 'room:snapshot') {
    const changed = !snap || snap.phase !== m.phase || snap.roundId !== m.roundId;
    snap = m; err = '';
    if (changed) selected.clear();
    if (resolving && resolving.roundId !== m.roundId) resolving = null;
    meadow.setSheep(m.sheep.length || m.phase !== 'lobby' ? m.sheep : Array.from({ length: 6 }, (_, i) => ({ id: `demo-${i}` })));
    meadow.setDeposit(m.phase === 'voting' ? m.pile : 0);
    render();
    if (changed && m.phase === 'voting' && m.authorId === m.you) showMeadowOnPhone();
  } else if (m.type === 'error') { err = ERR[m.code] || m.code; render(); }
  else if (m.type === 'meadow:sheep_action') meadow.animate(m.sheepId, m.action);
  else if (m.type === 'round:revealed') onRevealed(m.reveal);
};

function showMeadowOnPhone() {
  if (matchMedia('(max-width: 850px)').matches) $('#scene').scrollIntoView({ block: 'start' });
}

function onRevealed(r) {
  const current = { roundId: snap.roundId, sheepCount: snap.sheep.length, players: snap.players };
  resolving = current;
  closeRadial();
  showMeadowOnPhone();
  meadow.stage(r, () => {
    if (resolving !== current) return;
    resolving = null;
    beep(r.outcome === 'entered' ? (r.resolution.sheepEaten ? 220 : 560) : 180);
    render();
  });
}

function beep(freq) {
  if ($('#mute').checked) return;
  try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = freq; g.gain.value = 0.05; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.15); } catch {}
}
const applyCalm = () => { document.body.classList.toggle('calm', $('#calm').checked); meadow.setCalm($('#calm').checked); };
$('#calm').onchange = applyCalm;
if (matchMedia('(prefers-reduced-motion: reduce)').matches) $('#calm').checked = true;
applyCalm();

function closeRules() { $('#rules').hidden = true; }
$('#rules-open').onclick = () => {
  $('#rules-body').innerHTML = RULE_PAGES.map(([f, t]) => `<figure><img src="assets/rules/${f}" alt="${t}" loading="lazy"><figcaption>${t}</figcaption></figure>`).join('');
  $('#rules').hidden = false;
  $('#rules-close').focus();
};
$('#rules-close').onclick = closeRules;

const pName = (id) => snap.players.find((p) => p.id === id)?.name ?? '?';
const cardImg = (type) => `<img src="assets/cards/${type}.png" alt="" draggable="false">`;
const cardHtml = (c, extra = '', attrs = '') => `<button class="card ${extra}" ${attrs} data-id="${c.id ?? ''}" aria-label="${NAME[c.type]}">${cardImg(c.type)}</button>`;
const chip = (label, value, cls = '') => `<div class="chip ${cls}"><small>${label}</small><b>${value}</b></div>`;

function hud() {
  $('#chips').innerHTML = snap
    ? chip('SALLE', snap.code) + chip('MANCHE', snap.roundNo || '–') + chip('DANS L’ENCLOS', resolving?.sheepCount ?? snap.sheep.length, 'gold') + chip('MODE', snap.mode === 'compte' ? 'COMPTE' : 'NI VU')
    : '';
}

function handCards(cards, interactive) {
  return cards.map((card) => {
    const isSelected = selected.has(card.id);
    return cardHtml(card, isSelected ? 'sel' : '', `${interactive ? '' : 'disabled'} aria-pressed="${isSelected}"`);
  }).join('');
}

function outcomeText(r, g) {
  if (r.outcome === 'entered') return r.resolution.sheepSaved ? `Le portail s'ouvre ! ${r.resolution.sheepSaved} mouton(s) rentrent dans l'enclos.` : "Le portail s'ouvre, mais aucun mouton ne rentre.";
  if (r.outcome === 'author_took') return `${pName(r.accuserId)} a bien crié AU LOUP ! ${pName(r.authorId)} a menti et reprend la pile. Le troupeau quitte l’enclos.`;
  return `${pName(r.accuserId)} s'est trompé : ${pName(r.authorId)} disait vrai. ${pName(r.accuserId)} ramasse la pile. Le troupeau quitte l’enclos.`;
}

function render() {
  hud();
  document.body.classList.toggle('home', !displayCode && (!snap || snap.phase === 'lobby'));
  if (!snap) document.body.classList.remove('ingame');
  if (!snap) {
    if (displayCode) { app.innerHTML = '<div class="panel">Connexion à la salle…</div>'; return; }
    const s = saved();
    app.innerHTML = `<div class="panel"><h2>Bienvenue dans la prairie</h2>
      <p>Pose 1 à 3 cartes devant l'enclos. Les autres décident : laisser entrer… ou crier AU LOUP !</p>
      <label class="f">Ton prénom<input type="text" id="name" maxlength="16" value="${s.name ?? ''}"></label>
      <fieldset class="modes"><legend>Mode de jeu</legend>
        ${Object.entries(MODES).map(([k, v]) => `<label class="mode"><input type="radio" name="mode" value="${k}" ${prefMode === k ? 'checked' : ''}><b>${v}</b><span>${MODE_INFO[k]}</span></label>`).join('')}
      </fieldset>
      <div class="row"><button id="rules-home">Voir les règles illustrées</button></div>
      <div class="row"><button id="solo" class="gold">Jouer contre l'ordinateur</button>
        <label class="inline">Adversaires <select id="bots"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option></select></label></div>
      ${LOCAL ? '<p class="small">Version en ligne : tu joues contre les ordinateurs, directement dans ton navigateur. Le multijoueur entre amis demande le serveur (voir le README).</p>' : `<div class="row"><button id="create">Créer une partie entre amis</button></div>
      <label class="f">Code de la salle<input type="text" id="code" maxlength="4" value="${roomCode ?? ''}" style="text-transform:uppercase"></label>
      <div class="row"><button id="join" class="green">Rejoindre une partie</button></div>`}
      <p class="err" role="alert">${err}</p></div>`;
    const name = () => { const n = $('#name').value.trim() || 'Mouton'; localStorage.setItem('loup', JSON.stringify({ ...saved(), name: n })); return n; };
    const mode = () => { prefMode = document.querySelector('[name=mode]:checked').value; return prefMode; };
    $('#rules-home').onclick = () => $('#rules-open').click();
    $('#solo').onclick = () => send({ type: 'room:create', displayName: name(), voteSeconds: 60, mode: mode(), bots: Number($('#bots').value), solo: true });
    if (!LOCAL) $('#create').onclick = () => send({ type: 'room:create', displayName: name(), voteSeconds: 60, mode: mode() });
    if (!LOCAL) $('#join').onclick = () => send({ type: 'room:join', code: $('#code').value.trim().toUpperCase(), displayName: name() });
    return;
  }
  const g = snap, you = g.you, isAuthor = g.authorId === you, isHost = g.hostId === you;
  let body = '';
  if (g.phase === 'lobby') {
    const link = `${location.origin}/room/${g.code}`;
    body = `<div class="panel"><h2>Salle ${g.code}</h2><div class="row">${LOCAL ? '' : `<img class="qr" src="qr/${g.code}.svg" alt="QR code pour rejoindre la salle ${g.code}" width="150" height="150">`}<div><div class="codebox" aria-hidden="true">${g.code}</div><p>Mode : ${MODES[g.mode]}</p><p>Lien : <a href="${link}">${link}</a></p><p>Écran partagé : <a href="/display/${g.code}" target="_blank">/display/${g.code}</a></p></div></div>
      ${isHost ? `<button id="start" class="gold" ${g.players.length < 2 ? 'disabled' : ''}>Lancer la partie (${g.players.length} joueurs)</button>` : '<p>En attente de l’hôte…</p>'}</div>`;
  } else if (g.phase === 'select') {
    const claimUi = g.mode === 'compte'
      ? `<div class="row center"><label>Moutons qui rentreront : <input type="text" id="cc" inputmode="numeric" value="${claimCount}" style="width:70px" aria-label="Nombre de moutons annoncé"></label></div>`
      : `<p class="center-text"><span class="claim">« Ce sont des moutons ! »</span></p>`;
    body = isAuthor
      ? `<div class="panel"><h2>À toi de jouer !</h2><p>Choisis 1 à 3 cartes à poser devant l'enclos.</p><div class="hand" id="hand">${handCards(g.hand, true)}</div>${claimUi}
        <div class="row center"><button id="play" ${selected.size < 1 ? 'disabled' : ''}>Envoyer ${selected.size ? '(' + selected.size + ')' : ''}</button></div></div>`
      : `<div class="panel"><h2>${pName(g.authorId)} choisit ses cartes…</h2><div class="hand" id="hand">${handCards(g.hand, false)}</div></div>`;
  } else if (g.phase === 'voting') {
    const claim = g.claim.kind === 'all-sheep' ? 'Ce sont des moutons !' : `${g.claim.count} mouton(s) vont rentrer !`;
    const backs = Array.from({ length: g.pile }, (_, i) => `<div class="card back" style="--r:${(i - (g.pile - 1) / 2) * 8}deg" aria-hidden="true"><img src="assets/cards/back.png" alt="" draggable="false"></div>`).join('');
    body = `<div class="panel"><h2>${pName(g.authorId)} pose ${g.pile} carte(s) devant l'enclos</h2><p><span class="claim">« ${claim} »</span></p>
      <div class="pile" id="pile">${backs}</div>
      <p>Réponses : ${g.voted}/${g.voters}</p>`;
    if (!isAuthor && !g.myVote) body += `<p>Glisse la pile à gauche pour crier AU LOUP !, à droite pour laisser entrer — ou utilise les boutons.</p>
      <div class="row center"><button class="red" id="vw">← AU LOUP !</button><button class="green" id="vt">Je valide →</button></div>`;
    else body += `<p>${isAuthor ? 'Les autres décident…' : 'Réponse enregistrée. En attente des autres…'}</p>`;
    body += '</div>';
  } else if (resolving) {
    body = '<div class="panel" role="status"><h2>Regarde le portail…</h2><p>La manche se joue dans la prairie.</p></div>';
  } else {
    const r = g.reveal;
    const win = g.winnerId ? `<div class="verdict good">${pName(g.winnerId)} n'a plus de cartes : VICTOIRE !</div>` : '';
    body = `<div class="panel reveal"><div class="verdict ${r.lie ? 'bad' : 'good'}">${r.lie ? 'BLUFF !' : 'HONNÊTE !'}</div>
      <div class="reveal-row">${r.cards.map((t, i) => cardHtml({ type: t }, 'big', `style="--i:${i}" disabled`)).join('')}</div>
      <p class="center-text">${outcomeText(r, g)}</p>
      <p class="center-text small">${Object.entries(r.votes).map(([id, v]) => `${pName(id)} : ${v === 'wolf' ? 'AU LOUP' : v === 'trust' ? 'valide' : 'absent'}`).join(' · ')}</p>
      ${win}
      <div class="row center">${isHost ? `<button class="gold" id="${g.phase === 'finished' ? 'again' : 'next'}">${g.phase === 'finished' ? 'Rejouer' : 'Manche suivante'}</button>` : '<span>En attente de l’hôte…</span>'}</div></div>`;
    if (g.phase === 'finished') body = body.replace('id="next"', 'id="again"');
  }
  const board = (resolving?.players ?? g.players).map((p) => `<li class="${p.id === you ? 'me' : ''} ${p.id === g.authorId && g.phase !== 'lobby' ? 'turn' : ''}"><span class="dot ${p.connected ? '' : 'off'}"></span><span>${p.bot ? '🤖 ' : ''}${p.name}${p.id === g.hostId ? ' 👑' : ''}${p.id === you ? ' (toi)' : ''}</span><span class="cards-left"><img src="assets/cards/back.png" alt="cartes en main" width="16" height="22"> ${p.cards}</span><span class="pts">🐑 ${p.score}</span></li>`).join('');
  const sheepList = (resolving ? g.sheep.slice(0, resolving.sheepCount) : g.sheep).map((s, i) => `<button class="sr" data-sheep="${s.id}">Mouton ${s.name || i + 1} : actions</button>`).join('');
  document.body.classList.toggle('ingame', !displayCode && g.phase !== 'lobby');
  const stack = !displayCode && (g.phase === 'select' || g.phase === 'voting')
    ? `<div id="stack">Cartes restantes <b>${g.hand.length}</b></div>`
    : '';
  app.innerHTML = stack + (displayCode && !g.reveal ? `<h2>Salle ${g.code}</h2>` : body) + `<div class="panel"><ul class="score">${board}</ul></div><div class="sr">${sheepList}</div><p class="err" role="alert">${err}</p>`;
  document.querySelectorAll('.sr [data-sheep]').forEach((b) => { b.onclick = () => openRadial(b.dataset.sheep); });
  if (displayCode) return;
  $('#start')?.addEventListener('click', () => send({ type: 'game:start' }));
  $('#next')?.addEventListener('click', () => send({ type: 'game:next' }));
  $('#again')?.addEventListener('click', () => send({ type: 'game:start' }));
  document.querySelectorAll('#hand .card:not([disabled])').forEach((b) => b.onclick = () => {
    if (selected.has(b.dataset.id)) selected.delete(b.dataset.id); else if (selected.size < 3) selected.add(b.dataset.id);
    beep(selected.has(b.dataset.id) ? 600 : 420);
    render();
  });
  $('#cc')?.addEventListener('input', (e) => { claimCount = Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0)); });
  $('#play')?.addEventListener('click', () => send({ type: 'cards:submit', roundId: g.roundId, cardIds: [...selected], claim: g.mode === 'compte' ? { kind: 'survivors', count: claimCount } : { kind: 'all-sheep' } }));
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

const splash = $('#splash');
const hideSplash = () => { splash.hidden = true; };
if (!displayCode && (!navigator.webdriver || url.searchParams.has('splash')) && !roomCode) splash.hidden = false;
$('#splash-play').onclick = hideSplash;
$('#splash-rules').onclick = () => { hideSplash(); $('#rules-open').click(); };
$('#share').onclick = async () => {
  const link = snap && !LOCAL ? `${location.origin}/room/${snap.code}` : location.origin + location.pathname.replace(/\/(room|display)\/.*$/, '/');
  const data = { title: 'AU LOUP !', text: 'Viens jouer à AU LOUP !', url: link };
  try { if (navigator.share) { await navigator.share(data); return; } } catch { return; }
  try { await navigator.clipboard.writeText(link); toast('Lien copié !'); } catch { prompt('Copie ce lien', link); }
};
