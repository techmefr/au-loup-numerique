import { createMeadow } from './meadow3d.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const NAME = { sheep: 'Mouton', wolf: 'Loup déguisé', dog: 'Chien déguisé' };
const ACTIONS = { jump: 'Sauter', graze: 'Brouter', sleep: 'Dormir', bleat: 'Bêler', run: 'Courir', dance: 'Danser' };
const MODES = {
  'ni-vu': ['Ni vu ni mouton', 'Annonce que ce sont des moutons. Le chien est autorisé.', 2, 8, 'Ni vu'],
  compte: ['Compte tes moutons !', 'Annonce combien de moutons passeront le portail.', 2, 8, 'Compte'],
  'loup-parmi-nous': ['Loup parmi nous', 'Rôles secrets. Sauvez 15 moutons ou dévorez-en 8 selon votre camp.', 3, 8, 'Rôles'],
  'passe-ton-loup': ['Passe ton loup !', 'Passe une carte au joueur suivant. Loup et chien dans la même main font perdre.', 2, 8, 'Passe'],
  'troupeau-de-tete': ['Troupeau de tête', 'Place une carte dans ton troupeau ou celui d’un adversaire. Le plus grand troupeau survivant gagne.', 2, 6, 'Troupeaux'],
  'qui-sy-frotte': ['Qui s’y frotte s’y pique !', 'Pioche une carte à la fois ou arrête-toi pour garder tes points. Mode en test.', 2, 8, 'Pioche'],
};
const campName = (camp) => camp === 'wolf' ? 'Loups' : 'Moutons';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const RULE_PAGES = [
  ['histoire.webp', 'Le principe en 4 images'],
  ['couverture.webp', 'Résumé des modes'],
  ['modes-1-2-6.webp', 'Modes 1, 2 et 6'],
  ['modes-3-4-5.webp', 'Modes 3, 4 et 5'],
];
const ERR = {
  need_three_players: 'Ce mode demande au moins 3 joueurs', room_not_found: 'Salle introuvable', not_enough_players: 'Il faut au moins 2 joueurs', room_full: 'Salle pleine',
  game_started: 'Partie déjà commencée', host_only: "Réservé à l'hôte", bad_selection: 'Choisis 1 à 3 cartes', stale_round: 'Manche dépassée',
};

const url = new URL(location.href);
const parts = url.pathname.split('/').filter(Boolean);
const displayCode = parts[0] === 'display' ? parts[1] : null;
let roomCode = parts[0] === 'room' ? parts[1] : null;
let announcement = '', placementTarget = '';
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
  onAction: (id, action) => { if (action === 'bleat') { toast('Bêêê !', 1000); playSound('bleat'); } },
});
if (!displayCode) meadow.setSheep(Array.from({ length: 6 }, (_, i) => ({ id: `demo-${i}` })));

window.loup = { meadow };
let radialId = null;
let resolving = null;
function syncSheepPanel() {
  const controls = $('#game-controls');
  if (!controls) return;
  controls.hidden = Boolean(radialId);
  $('#sheep-panel').hidden = !radialId;
  $('#sheep-rename').hidden = !snap.sheep.some((sheep) => sheep.id === radialId) || snap.hostId !== snap.you;
}

function closeRadial(restoreFocus = false) {
  if (!radialId) return;
  $('#menu').replaceChildren();
  meadow.hold(radialId, false);
  radialId = null;
  syncSheepPanel();
  if (restoreFocus) {
    $('#game-controls .card:not(:disabled), #game-controls #vw, #game-controls #next, #game-controls #again')?.focus({ preventScroll: true });
  }
}

addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeRadial(true);
  closeRules();
});

function openRadial(id) {
  if (resolving) return;
  const position = meadow.screenOf(id);
  if (!position) return;
  closeRadial();
  const scene = $('#scene');
  const inset = 94;
  const x = Math.max(inset, Math.min(position.x, scene.clientWidth - inset));
  const y = Math.max(inset, Math.min(position.y, scene.clientHeight - inset));
  radialId = id;
  meadow.hold(id, true);

  const actions = Object.entries(ACTIONS);
  const radius = 66;
  const buttons = actions.map(([action, label], i) => {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / actions.length;
    const left = Math.cos(angle) * radius;
    const top = Math.sin(angle) * radius;
    return `<button class="rbtn" data-action="${action}" style="left:calc(50% + ${left}px);top:calc(50% + ${top}px)">${label}</button>`;
  }).join('');
  $('#menu').innerHTML = `<div class="radial" style="left:${x}px;top:${y}px" role="group" aria-label="Actions du mouton">${buttons}</div>`;
  $('#menu').firstChild.onclick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    closeRadial(true);
    if (snap && !displayCode && snap.sheep.some((sheep) => sheep.id === id)) send({ type: 'sheep:action', sheepId: id, action });
    else meadow.animate(id, action);
  };
  syncSheepPanel();
  $('#menu button').focus({ preventScroll: true });
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
    if (changed) {
      selected.clear();
      announcement = '';
      placementTarget = '';
      closeRadial();
    }
    if (resolving && resolving.roundId !== m.roundId) resolving = null;
    meadow.setSheep(m.sheep.length || m.phase !== 'lobby' ? m.sheep : Array.from({ length: 6 }, (_, i) => ({ id: `demo-${i}` })));
    meadow.setDeposit(m.phase === 'voting' ? m.pile : m.phase === 'select' ? Math.min(3, m.variant?.pile ?? 0) : 0);
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
    playSound(r.outcome === 'entered' && !r.resolution.sheepEaten ? 'entered' : 'result');
    render();
  });
}

const sounds = {
  card: [{ pitch: 392, end: 370, length: 0.07, volume: 0.025 }],
  bleat: [
    { pitch: 315, end: 275, length: 0.12, volume: 0.031 },
    { pitch: 288, end: 218, length: 0.15, volume: 0.023, delay: 0.13 },
  ],
  entered: [
    { pitch: 392, length: 0.18, volume: 0.032 },
    { pitch: 494, length: 0.22, volume: 0.03, delay: 0.11 },
  ],
  result: [
    { pitch: 330, length: 0.15, volume: 0.027 },
    { pitch: 294, length: 0.18, volume: 0.023, delay: 0.1 },
  ],
};
let audio;
let soundOutput;
const mute = $('#mute');

async function enableAudio() {
  if (!audio) {
    audio = new AudioContext();
    soundOutput = audio.createGain();
    soundOutput.connect(audio.destination);
  }
  soundOutput.gain.value = mute.checked ? 0 : 1;
  if (audio.state === 'suspended') await audio.resume();
}

mute.onchange = () => {
  if (mute.checked) {
    if (soundOutput) soundOutput.gain.value = 0;
  } else {
    enableAudio().catch(() => {});
  }
};

async function playSound(cue) {
  if (mute.checked) return;
  try {
    await enableAudio();
    if (mute.checked || audio.state !== 'running') return;
    const now = audio.currentTime;
    for (const { pitch, end = pitch, length, volume, delay = 0 } of sounds[cue]) {
      const start = now + delay;
      const stop = start + length;
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(pitch, start);
      oscillator.frequency.exponentialRampToValueAtTime(end, stop);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(volume, start + 0.018);
      envelope.gain.exponentialRampToValueAtTime(0.001, stop);
      oscillator.connect(envelope);
      envelope.connect(soundOutput);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(start);
      oscillator.stop(stop);
    }
  } catch {
    // Audio can be unavailable or blocked by the browser.
  }
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

const pName = (id) => escapeHtml(snap.players.find((p) => p.id === id)?.name ?? '?');
const cardImg = (type) => `<img src="assets/cards/${type}.png" alt="" draggable="false">`;
const cardHtml = (c, extra = '', attrs = '') => `<button class="card ${extra}" ${attrs} data-id="${c.id ?? ''}" aria-label="${NAME[c.type]}">${cardImg(c.type)}</button>`;
const chip = (label, value, cls = '') => `<div class="chip ${cls}"><small>${label}</small><b>${value}</b></div>`;

function hud() {
  $('#chips').innerHTML = snap
    ? chip('SALLE', snap.code) + chip('MANCHE', snap.roundNo || '–') + chip('DANS L’ENCLOS', resolving?.sheepCount ?? snap.sheep.length, 'gold') + chip('MODE', MODES[snap.mode][4])
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
  if (r.outcome === 'author_took') return `${pName(r.accuserId)} a bien crié AU LOUP ! ${pName(r.authorId)} a menti et ramasse les cartes de la prairie et de la pose. Le troupeau quitte l’enclos.`;
  return `${pName(r.accuserId)} s'est trompé : ${pName(r.authorId)} disait vrai. ${pName(r.accuserId)} ramasse les cartes de la prairie et de la pose. Le troupeau quitte l’enclos.`;
}

function faceUpCards(cards) {
  return cards.length ? `<div class="reveal-row">${cards.map((type) => cardHtml({ type }, '', 'disabled')).join('')}</div>` : '';
}

function variantPanel(g, isAuthor, isHost) {
  const variant = g.variant;
  const mode = g.mode;
  const isHidden = mode === 'loup-parmi-nous';
  const isPass = mode === 'passe-ton-loup';
  const isFlock = mode === 'troupeau-de-tete';
  const isRisk = mode === 'qui-sy-frotte';
  const finished = g.phase === 'finished';
  const role = g.role ? `<p class="claim">Ton camp secret · ${campName(g.role)}</p>` : '';
  const progress = isHidden
    ? `<p>${g.sheepSaved} / 15 moutons sauvés · ${variant.sheepEaten} / 8 dévorés</p>`
    : '';
  const turns = variant.announcements.filter((item) => item.text).map((item) => `<li>${pName(item.playerId)} · « ${escapeHtml(item.text)} »</li>`).join('');
  const announcements = turns ? `<ul class="small">${turns}</ul>` : '';
  if (variant.result) {
    const result = variant.result;
    let summary = `${result.saved} mouton(s) sauvé(s) · ${result.eaten} dévoré(s)`;
    if (isRisk) summary = `${pName(g.authorId)} marque ${result.saved} point(s).`;
    if (isPass) summary = `${pName(result.loserId)} perd la manche avec un loup et un chien dans sa main.`;
    if (isFlock) summary = 'Les chiens chassent les loups, puis les troupeaux sont comptés.';
    const winners = result.winners?.map(pName).join(', ');
    const victory = result.winningCamp ? `Le camp des ${campName(result.winningCamp)} gagne !`
      : winners ? `${winners} · ${result.winners.length === 1 ? 'Victoire !' : 'Victoire partagée !'}`
      : finished && isHidden ? 'Fin de partie · Aucun camp ne l’emporte.' : '';
    const flocks = (result.flocks ?? []).map((flock) =>
      `<details><summary>${pName(flock.playerId)} · ${flock.saved} survivant(s)</summary>${faceUpCards(flock.cards)}</details>`).join('');
    const roles = Object.entries(variant.roles).map(([id, camp]) => `${pName(id)} · ${campName(camp)}`).join(' / ');
    const buttons = isHost ? `<div class="row"><button class="gold" id="${finished ? 'again' : 'next'}">${finished ? 'Rejouer' : isRisk ? 'Joueur suivant' : 'Manche suivante'}</button>
      </div>` : '';
    return `<section class="panel"><h2>${finished ? 'Fin de partie' : 'Résultat'}</h2>${role}${progress}<p>${summary}</p>
      ${victory ? `<p class="verdict good">${victory}</p>` : ''}${roles ? `<p class="small">${roles}</p>` : ''}
      ${faceUpCards(result.cards)}${flocks}${announcements}${buttons}</section>`;
  }
  const nextPlayer = g.players[(g.players.findIndex((player) => player.id === g.authorId) + 1) % g.players.length];
  const flockCounts = isFlock ? `<ul class="score">${variant.flocks.map((flock) => `<li>${pName(flock.playerId)} · ${flock.count} carte(s)</li>`).join('')}</ul>` : '';
  const current = isAuthor ? 'À toi de jouer !' : `Au tour de ${pName(g.authorId)}`;
  if (isRisk) {
    return `<section class="panel"><h2>${current}</h2><p>Pioche · ${variant.deck} carte(s)</p>
      <p class="claim">${variant.turnSheep} mouton(s) · ${variant.shields} protection(s)</p>
      ${faceUpCards(variant.turnCards)}
      ${isAuthor ? `<div class="row"><button id="variant-draw" class="gold">Piocher</button>
        <button id="variant-stop" ${variant.turnCards.length ? '' : 'disabled'}>J’arrête</button></div>` : ''}</section>`;
  }
  const instruction = isHidden ? 'Pose 1 à 3 cartes dans la bergerie.'
    : isPass ? `Choisis une carte à passer à ${pName(nextPlayer.id)}.` : 'Choisis une carte et le troupeau qui la recevra.';
  const target = isFlock ? `<label class="inline">Destination <select id="flock-target">${g.players.map((player) =>
    `<option value="${player.id}" ${(placementTarget || g.you) === player.id ? 'selected' : ''}>${pName(player.id)}</option>`).join('')}</select></label>` : '';
  const claim = isHidden ? `<label class="f">Ton annonce <input id="announcement" type="text" maxlength="80" value="${escapeHtml(announcement)}"></label>` : '';
  return `<section class="panel"><h2>${current}</h2>${role}${progress}
    ${isHidden ? `<p>${variant.pile} carte(s) dans la bergerie</p>` : ''}${flockCounts}${announcements}
    ${isAuthor ? `<p>${instruction}</p>` : ''}${g.hand?.length ? `<div class="hand" id="hand">${handCards(g.hand, isAuthor)}</div>` : ''}
    ${isAuthor ? `${claim}<div class="row">${target}<button class="gold" id="variant-play" ${selected.size ? '' : 'disabled'}>${isPass ? 'Passer la carte' : 'Poser'}</button></div>` : ''}</section>`;
}

function render() {
  hud();
  $('#mode-home').hidden = !LOCAL || !snap;
  document.body.classList.toggle('home', !displayCode && (!snap || snap.phase === 'lobby'));
  if (!snap) document.body.classList.remove('ingame');
  if (!snap) {
    if (displayCode) { app.innerHTML = '<div class="panel">Connexion à la salle…</div>'; return; }
    const s = saved();
    app.innerHTML = `<div class="panel"><h2>Bienvenue dans la prairie</h2>
      <p>Choisis un des six modes du jeu.</p>
      <label class="f">Ton prénom<input type="text" id="name" maxlength="16" value="${escapeHtml(s.name)}"></label>
      <fieldset class="modes"><legend>Mode de jeu</legend>
        ${Object.entries(MODES).map(([key, [title, description, min, max]]) => `<label class="mode"><input type="radio" name="mode" value="${key}" ${prefMode === key ? 'checked' : ''}><b>${title}</b><span>${min} à ${max} joueurs · ${description}</span></label>`).join('')}
      </fieldset>
      <div class="row"><button id="rules-home">Voir les règles illustrées</button></div>
      <div class="row"><button id="solo" class="gold">Jouer contre l'ordinateur</button>
        <label class="inline">Adversaires <select id="bots"></select></label></div>
      ${LOCAL ? '<p class="small">Version en ligne : tu joues contre les ordinateurs, directement dans ton navigateur. Le multijoueur entre amis demande le serveur (voir le README).</p>' : `<div class="row"><button id="create">Créer une partie entre amis</button></div>
      <label class="f">Code de la salle<input type="text" id="code" maxlength="4" value="${escapeHtml(roomCode)}" style="text-transform:uppercase"></label>
      <div class="row"><button id="join" class="green">Rejoindre une partie</button></div>`}
      <p class="err" role="alert">${err}</p></div>`;
    const name = () => { const n = $('#name').value.trim() || 'Mouton'; localStorage.setItem('loup', JSON.stringify({ ...saved(), name: n })); return n; };
    const mode = () => { prefMode = document.querySelector('[name=mode]:checked').value; return prefMode; };
    const updateBots = () => {
      const bots = $('#bots');
      const previous = Number(bots.value) || 2;
      const [, , min, max] = MODES[mode()];
      bots.replaceChildren(...Array.from({ length: max - min + 1 }, (_, i) => new Option(i + min - 1, i + min - 1)));
      bots.value = String(Math.min(max - 1, Math.max(min - 1, previous)));
    };
    document.querySelectorAll('[name=mode]').forEach((radio) => radio.onchange = updateBots);
    updateBots();
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
    body = `<div class="panel"><h2>Salle ${g.code}</h2><div class="row">${LOCAL ? '' : `<img class="qr" src="qr/${g.code}.svg" alt="QR code pour rejoindre la salle ${g.code}" width="150" height="150">`}<div><div class="codebox" aria-hidden="true">${g.code}</div><p>Mode : ${MODES[g.mode][0]}</p><p>Lien : <a href="${link}">${link}</a></p><p>Écran partagé : <a href="/display/${g.code}" target="_blank">/display/${g.code}</a></p></div></div>
      ${isHost ? `<button id="start" class="gold" ${g.players.length < g.minPlayers ? 'disabled' : ''}>Lancer la partie (${g.players.length} joueurs)</button>` : '<p>En attente de l’hôte…</p>'}</div>`;
  } else if (g.variant) {
    body = variantPanel(g, isAuthor && !displayCode, isHost && !displayCode);
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
  const board = (resolving?.players ?? g.players).map((p) => `<li class="${p.id === you ? 'me' : ''} ${p.id === g.authorId && g.phase !== 'lobby' ? 'turn' : ''}"><span class="dot ${p.connected ? '' : 'off'}"></span><span>${p.bot ? '🤖 ' : ''}${escapeHtml(p.name)}${p.id === g.hostId ? ' 👑' : ''}${p.id === you ? ' (toi)' : ''}</span><span class="cards-left"><img src="assets/cards/back.png" alt="cartes en main" width="16" height="22"> ${p.cards}</span><span class="pts">🐑 ${p.score}</span></li>`).join('');
  const sheepList = (resolving ? g.sheep.slice(0, resolving.sheepCount) : g.sheep).map((s, i) => `<button class="sr" data-sheep="${s.id}">Mouton ${escapeHtml(s.name || i + 1)} : actions</button>`).join('');
  document.body.classList.toggle('ingame', !displayCode && g.phase !== 'lobby');
  const stack = !displayCode && (g.phase === 'select' || g.phase === 'voting')
    ? `<div id="stack">Cartes restantes <b>${g.hand.length}</b></div>`
    : '';
  const controls = displayCode && !g.reveal && !g.variant ? `<h2>Salle ${g.code}</h2>` : body;
  const canSwap = !displayCode && g.phase !== 'lobby' && !resolving;
  const returnLabel = g.phase === 'select' ? 'Revenir aux cartes' : g.phase === 'voting' ? 'Revenir au vote' : 'Revenir au résultat';
  const gamePanel = canSwap
    ? `<div id="game-controls">${controls}</div>
      <section id="sheep-panel" class="panel" hidden aria-labelledby="sheep-title">
        <h2 id="sheep-title">Jouer avec un mouton</h2>
        <p>Choisis une action autour du mouton dans la prairie.</p>
        <div class="row"><button id="sheep-back">${returnLabel}</button><button id="sheep-rename" hidden>Donner un prénom</button></div>
      </section>`
    : controls;
  app.innerHTML = stack + gamePanel + `<div class="panel"><ul class="score">${board}</ul></div><div class="sr">${sheepList}</div><p class="err" role="alert">${err}</p>`;
  document.querySelectorAll('.sr [data-sheep]').forEach((button) => { button.onclick = () => openRadial(button.dataset.sheep); });
  $('#sheep-back')?.addEventListener('click', () => closeRadial(true));
  $('#sheep-rename')?.addEventListener('click', () => {
    const id = radialId;
    const name = prompt('Prénom du mouton ?');
    if (name && id) send({ type: 'sheep:rename', sheepId: id, name });
    closeRadial(true);
  });
  syncSheepPanel();
  if (displayCode) return;
  $('#start')?.addEventListener('click', () => send({ type: 'game:start' }));
  $('#next')?.addEventListener('click', () => send({ type: 'game:next' }));
  $('#again')?.addEventListener('click', () => send({ type: 'game:start' }));
  if (g.variant) {
    const playVariant = (action) => send({ type: 'variant:play', roundId: g.roundId, action });
    $('#variant-draw')?.addEventListener('click', () => playVariant({ kind: 'draw' }));
    $('#variant-stop')?.addEventListener('click', () => playVariant({ kind: 'stop' }));
    $('#variant-play')?.addEventListener('click', () => playVariant({
      kind: 'place', cardIds: [...selected], targetId: placementTarget || g.you, announcement,
    }));
    $('#announcement')?.addEventListener('input', (event) => { announcement = event.target.value; });
    $('#flock-target')?.addEventListener('change', (event) => { placementTarget = event.target.value; });
  }
  document.querySelectorAll('#hand .card:not([disabled])').forEach((b) => b.onclick = () => {
    if (selected.has(b.dataset.id)) selected.delete(b.dataset.id); else if (g.variant && g.mode !== 'loup-parmi-nous') {
      selected.clear();
      selected.add(b.dataset.id);
    } else if (selected.size < 3) selected.add(b.dataset.id);
    playSound('card');
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
$('#mode-home').onclick = () => location.reload();
$('#splash-play').onclick = hideSplash;
$('#splash-rules').onclick = () => { hideSplash(); $('#rules-open').click(); };
$('#share').onclick = async () => {
  const link = snap && !LOCAL ? `${location.origin}/room/${snap.code}` : location.origin + location.pathname.replace(/\/(room|display)\/.*$/, '/');
  const data = { title: 'AU LOUP !', text: 'Viens jouer à AU LOUP !', url: link };
  try { if (navigator.share) { await navigator.share(data); return; } } catch { return; }
  try { await navigator.clipboard.writeText(link); toast('Lien copié !'); } catch { prompt('Copie ce lien', link); }
};
