const $ = (s) => document.querySelector(s);
const app = $('#app');
const ICON = { sheep: '🐑', wolf: '🐺', dog: '🐕' };
const NAME = { sheep: 'Mouton', wolf: 'Loup', dog: 'Chien' };
const ACTIONS = { jump: 'Sauter', graze: 'Brouter', sleep: 'Dormir', bleat: 'Bêler', run: 'Courir', dance: 'Danser' };
const ERR = {
  room_not_found: 'Salle introuvable', not_enough_players: 'Il faut au moins 2 joueurs', room_full: 'Salle pleine',
  game_started: 'Partie déjà commencée', host_only: "Réservé à l'hôte", bad_selection: 'Choisis 1 à 3 cartes', stale_round: 'Manche dépassée',
};

const url = new URL(location.href);
const parts = url.pathname.split('/').filter(Boolean);
const displayCode = parts[0] === 'display' ? parts[1] : null;
let roomCode = parts[0] === 'room' ? parts[1] : null;
let snap = null, selected = new Set(), claimKind = 'all-sheep', claimCount = 1, err = '', sheepState = new Map(), openMenu = null;

const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const saved = () => { try { return JSON.parse(localStorage.getItem('loup') || '{}'); } catch { return {}; } };

ws.onopen = () => {
  if (displayCode) return send({ type: 'display:attach', code: displayCode });
  const s = saved();
  if (roomCode && s.code === roomCode && s.token) send({ type: 'room:join', code: roomCode, displayName: s.name || 'Mouton', resumeToken: s.token });
  else render();
};
ws.onclose = () => { $('#status').textContent = 'Déconnecté — recharge la page pour reprendre'; };
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'room:joined') {
    roomCode = m.code;
    const name = saved().name;
    localStorage.setItem('loup', JSON.stringify({ code: m.code, token: m.resumeToken, name }));
    history.replaceState(null, '', `/room/${m.code}`);
  } else if (m.type === 'room:snapshot') {
    const phaseChanged = !snap || snap.phase !== m.phase || snap.roundId !== m.roundId;
    snap = m; err = '';
    if (phaseChanged) selected.clear();
    render();
  } else if (m.type === 'error') { err = ERR[m.code] || m.code; render(); }
  else if (m.type === 'meadow:sheep_action') playAction(m.sheepId, m.action);
  else if (m.type === 'meadow:sheep_removed') { const el = document.querySelector(`[data-sheep="${m.sheepId}"]`); el?.classList.add('poof'); }
  else if (m.type === 'round:revealed') beep(m.reveal.resolution.sheepEaten ? 180 : 520);
};

function beep(freq) {
  if ($('#mute').checked) return;
  try { const c = new AudioContext(), o = c.createOscillator(); o.frequency.value = freq; o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.15); } catch {}
}
$('#calm').onchange = () => document.body.classList.toggle('calm', $('#calm').checked);
if (matchMedia('(prefers-reduced-motion: reduce)').matches) { $('#calm').checked = true; document.body.classList.add('calm'); }

const pName = (id) => snap.players.find((p) => p.id === id)?.name ?? '?';
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

function pos(id) {
  if (!sheepState.has(id)) sheepState.set(id, { x: 16 + Math.random() * 68, y: 10 + Math.random() * 70 });
  return sheepState.get(id);
}

function wander() {
  for (const s of sheepState.values()) { s.x = Math.min(88, Math.max(14, s.x + (Math.random() - .5) * 14)); s.y = Math.min(78, Math.max(4, s.y + (Math.random() - .5) * 20)); }
  document.querySelectorAll('[data-sheep]').forEach((n) => { const s = sheepState.get(n.dataset.sheep); if (s) { n.style.left = s.x + '%'; n.style.top = s.y + '%'; } });
}
setInterval(wander, 3000);

function playAction(id, action) {
  const n = document.querySelector(`[data-sheep="${id}"]`);
  if (!n) return;
  n.classList.remove('jump', 'dance', 'bleat', 'sleep', 'run', 'graze');
  void n.offsetWidth;
  n.classList.add(action);
  if (action === 'run') { const s = sheepState.get(id); s.x = Math.min(88, Math.max(14, s.x + (Math.random() - .5) * 50)); n.style.left = s.x + '%'; }
  if (action === 'bleat') beep(330);
  setTimeout(() => n.classList.remove(action), 2500);
}

function meadowHtml() {
  const sheep = snap.sheep.map((s) => { const p = pos(s.id); return `<button class="sheep" data-sheep="${s.id}" style="left:${p.x}%;top:${p.y}%" aria-label="Mouton ${s.name ?? ''}">🐑<span>${s.name ?? ''}</span></button>`; }).join('');
  return `<div class="meadow" id="meadow" role="group" aria-label="Prairie, ${snap.sheep.length} moutons">${sheep}</div>`;
}

function bindMeadow() {
  document.querySelectorAll('[data-sheep]').forEach((n) => {
    n.onclick = () => {
      if (displayCode) return;
      document.querySelector('.menu')?.remove();
      const m = el(`<div class="menu" role="menu">${Object.entries(ACTIONS).map(([k, v]) => `<button data-a="${k}" role="menuitem">${v}</button>`).join('')}${snap.hostId === snap.you ? '<button data-a="rename" class="alt">Nommer</button>' : ''}</div>`);
      m.style.left = Math.min(n.offsetLeft, 200) + 'px'; m.style.top = Math.min(n.offsetTop + 50, 150) + 'px';
      m.onclick = (e) => {
        const a = e.target.dataset.a; if (!a) return;
        if (a === 'rename') { const name = prompt('Prénom du mouton ?'); if (name) send({ type: 'sheep:rename', sheepId: n.dataset.sheep, name }); }
        else send({ type: 'sheep:action', sheepId: n.dataset.sheep, action: a });
        m.remove();
      };
      $('#meadow').append(m);
    };
  });
}

function render() {
  if (!snap) {
    if (displayCode) { app.innerHTML = '<p>Connexion à la salle…</p>'; return; }
    const s = saved();
    app.innerHTML = `<h2>Bienvenue dans la prairie</h2>
      <p>Bluffe avec des moutons… ou des loups déguisés !</p>
      <label>Ton prénom<input type="text" id="name" maxlength="16" value="${s.name ?? ''}"></label>
      <div class="row"><button id="create">Créer une partie</button></div>
      <label>Code de la salle<input type="text" id="code" maxlength="4" value="${roomCode ?? ''}" style="text-transform:uppercase"></label>
      <div class="row"><button class="alt" id="join">Rejoindre une partie</button></div>
      <details class="panel"><summary>Comment jouer</summary>
      <p>À ton tour, pose 1 à 3 cartes face cachée et annonce « Ce sont des moutons ». Les autres votent en secret : « AU LOUP ! » ou « Je valide ». Un chien annule un loup, un loup restant mange un mouton.</p></details>
      <p class="err" role="alert">${err}</p>`;
    const name = () => { const n = $('#name').value.trim() || 'Mouton'; localStorage.setItem('loup', JSON.stringify({ ...saved(), name: n })); return n; };
    $('#create').onclick = () => send({ type: 'room:create', displayName: name(), voteSeconds: 60 });
    $('#join').onclick = () => send({ type: 'room:join', code: $('#code').value.trim().toUpperCase(), displayName: name() });
    return;
  }
  const g = snap, you = g.you, isAuthor = g.authorId === you, isHost = g.hostId === you;
  $('#status').textContent = `Salle ${g.code} · manche ${g.roundNo}/${g.totalRounds || '–'} · 🐑 sauvés ${g.sheepSaved}`;
  let body = '';
  if (g.phase === 'lobby') {
    const link = `${location.origin}/room/${g.code}`;
    body = `<h2>Salle ${g.code}</h2><p>Lien à partager : <a href="${link}">${link}</a></p><p>Écran partagé : <a href="/display/${g.code}" target="_blank">/display/${g.code}</a></p>
      <ul>${g.players.map((p) => `<li>${p.name} ${p.connected ? '🟢' : '⚪'}${p.id === g.hostId ? ' (hôte)' : ''}</li>`).join('')}</ul>
      ${isHost ? `<button id="start" ${g.players.length < 2 ? 'disabled' : ''}>Lancer la partie (${g.players.length} joueurs)</button>` : '<p>En attente de l’hôte…</p>'}`;
  } else if (g.phase === 'select') {
    const hand = g.hand.map((c) => `<button class="card ${selected.has(c.id) ? 'sel' : ''}" data-id="${c.id}" aria-pressed="${selected.has(c.id)}" aria-label="${NAME[c.type]}">${ICON[c.type]}<small>${NAME[c.type]}</small></button>`).join('');
    body = isAuthor
      ? `<h2>À toi de jouer !</h2><div class="row" id="hand">${hand}</div>
        <div class="row"><label><input type="radio" name="ck" value="all-sheep" ${claimKind === 'all-sheep' ? 'checked' : ''}> « Ce sont des moutons »</label>
        <label><input type="radio" name="ck" value="survivors" ${claimKind === 'survivors' ? 'checked' : ''}> Moutons sauvés :</label>
        <input type="text" id="cc" inputmode="numeric" value="${claimCount}" style="width:60px"></div>
        <button id="play" ${selected.size < 1 ? 'disabled' : ''}>Jouer ${selected.size} carte(s)</button>`
      : `<h2>${pName(g.authorId)} choisit ses cartes…</h2><div class="row" id="hand">${hand.replace(/class="card/g, 'disabled class="card')}</div>`;
  } else if (g.phase === 'voting') {
    const claim = g.claim.kind === 'all-sheep' ? 'Ce sont des moutons !' : `${g.claim.count} mouton(s) sauvé(s) !`;
    body = `<h2>${pName(g.authorId)} pose ${g.pile} carte(s)</h2><p>« ${claim} »</p>
      <div class="pile" id="pile"><div class="card back" aria-hidden="true"></div></div>
      <p>Votes : ${g.voted}/${g.voters}</p>`;
    if (!isAuthor && !g.myVote) body += `<p>Glisse la pile à gauche (AU LOUP !) ou à droite (Je valide), ou utilise les boutons.</p>
      <div class="row"><button class="danger" id="vw">← AU LOUP !</button><button id="vt">Je valide →</button></div>`;
    else body += `<p>${isAuthor ? 'Les autres votent…' : 'Vote enregistré. En attente des autres…'}</p>`;
  } else {
    const r = g.reveal;
    body = `<div class="reveal"><h2>Révélation</h2><p>Cartes : ${r.cards.map((t) => ICON[t] + ' ' + NAME[t]).join(', ')}</p>
      <p>${r.lie ? 'Bluff ! 🎭' : 'Honnête ✅'} — ${r.caught ? 'démasqué' : 'cru par le groupe'}</p>
      <p>🐑 sauvés : ${r.resolution.sheepSaved} · 💨 perdus : ${r.resolution.sheepEaten} · 🐕 loups chassés : ${r.resolution.wolvesChased}</p>
      <p>Votes : ${Object.entries(r.votes).map(([id, v]) => `${pName(id)} → ${v === 'wolf' ? 'AU LOUP' : v === 'trust' ? 'valide' : 'absent'}`).join(' · ')}</p></div>
      ${g.phase === 'finished' ? '<h2>Fin de partie</h2>' : ''}
      ${isHost ? `<button id="next">${g.phase === 'finished' ? 'Rejouer' : 'Manche suivante'}</button>` : ''}`;
    if (g.phase === 'finished' && isHost) body = body.replace('id="next"', 'id="again"');
  }
  const board = g.players.map((p) => `<li>${p.name}${p.id === you ? ' (toi)' : ''} — ${p.cards} cartes — ${p.score} pts ${p.connected ? '' : '⚪'}</li>`).join('');
  const meadowHtmlStr = meadowHtml();
  app.innerHTML = (displayCode ? '' : body) + meadowHtmlStr + `<ul class="score panel">${board}</ul><p>Pioche : ${g.deck}</p><p class="err" role="alert">${err}</p>`;
  if (displayCode) app.insertAdjacentHTML('afterbegin', `<h2>Salle ${g.code} — ${g.phase}</h2>`);
  bindMeadow();
  if (displayCode) return;
  $('#start')?.addEventListener('click', () => send({ type: 'game:start' }));
  $('#next')?.addEventListener('click', () => send({ type: 'game:next' }));
  $('#again')?.addEventListener('click', () => send({ type: 'game:start' }));
  document.querySelectorAll('#hand .card:not([disabled])').forEach((b) => b.onclick = () => {
    if (selected.has(b.dataset.id)) selected.delete(b.dataset.id); else if (selected.size < 3) selected.add(b.dataset.id);
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
    pile.onpointermove = (e) => { if (x0 !== null) pile.style.transform = `translateX(${e.clientX - x0}px)`; };
    pile.onpointerup = (e) => { const d = e.clientX - x0; x0 = null; pile.style.transform = ''; if (d < -80) vote('wolf'); else if (d > 80) vote('trust'); };
  }
}
render();
