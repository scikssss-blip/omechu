// ═════════════════════════════════════════════
// 오메추 포차: 실시간으로 모여 앉는 가상 포장마차
// - Supabase Realtime(Presence + Broadcast) 사용, 대화는 서버에 저장하지 않음
// - 테이블 3개 × 4자리, 테이블 안에서만 대화
// - 오메추 추천 엔진으로 '오늘의 안주' 투표
// ═════════════════════════════════════════════
(function () {
  const TABLES = 4, SEATS = 4;                                  // 0~2: 천막 테이블, 3: 혼술 바
  const W = 720, H = 960, SPEED = 170;                          // 골목 크기(px), 걷는 속도(px/초)
  const TABLE_POS = [[180, 250], [540, 250], [180, 720], [540, 720]];
  const TABLE_NAME = ['1번 테이블', '2번 테이블', '3번 테이블', '이모네 바'];
  const SEAT_OFF = [[-74, -4], [74, -4], [-44, 58], [44, 58]];   // 둥근 테이블 둘레
  const BAR_OFF = [[-81, 40], [-27, 40], [27, 40], [81, 40]];    // 바 의자 한 줄
  const seatXY = (t, s) => { const [cx, cy] = TABLE_POS[t], o = (t === 3 ? BAR_OFF : SEAT_OFF)[s]; return [cx + o[0], cy + o[1]]; };
  const SPAWN = [360, 900];
  const SID = Math.random().toString(36).slice(2, 10);          // 이번 접속용 임시 ID (개인 식별 X)
  const COLORS = ['#ffb3a7', '#ffd36b', '#a8e6a1', '#9ad0ff', '#c9b6ff', '#ffb3de', '#f5f0e8', '#ffa94d'];
  const ACCS = [['none', '없음'], ['towel', '수건 머리띠'], ['beanie', '털모자'], ['glasses', '안경'], ['ribbon', '리본'], ['chef', '요리사 모자']];
  const FACES = [['smile', '방긋'], ['happy', '신남'], ['sleepy', '졸림'], ['wow', '놀람']];
  const BAD = /(시발|씨발|씨빨|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|좆|존나|개새|새끼|꺼져|닥쳐|섹스|자살|죽어|느금|애미|애비)/g;

  let ch = null, joined = false, myTable = null, mySeat = null, seatAt = 0;
  let state = {};                 // sid -> presence
  let logs = {}; for (let i = 0; i < TABLES; i++) logs[i] = [];
  let votes = {};                 // table -> {id, opts, by, picks:{sid:idx}, until, done, winner}
  let dishes = {};                // table -> menu name
  let bubbles = {};               // sid -> {text, until}
  let muted = new Set();
  let lastSend = 0;
  let rainCtx = null;
  let pos = { x: SPAWN[0], y: SPAWN[1] }, target = null, pendingSeat = null, walkRAF = 0, follow = false;
  const lastDrawn = {};          // sid -> {x, y} 다른 손님 이동 애니메이션용

  const look = () => {
    try { return Object.assign({ color: COLORS[Math.floor(Math.random() * COLORS.length)], acc: 'towel', face: 'smile' }, JSON.parse(localStorage.getItem('wmjPochaLook') || '{}')); }
    catch (e) { return { color: COLORS[0], acc: 'towel', face: 'smile' }; }
  };
  let me = look();
  const esc = (v) => (typeof escHtml === 'function' ? escHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, ''));
  const nick = () => (typeof getMyNick === 'function' ? getMyNick() : '손님');

  // ── 다른 손님이 보낸 값은 믿지 않고 정해진 값만 받기 ──
  const okSid = (v) => typeof v === 'string' && /^[a-z0-9]{1,24}$/i.test(v);
  const okTable = (v) => Number.isInteger(v) && v >= 0 && v < TABLES;
  const okSeat = (v) => Number.isInteger(v) && v >= 0 && v < SEATS;
  const ACC_KEYS = ACCS.map(a => a[0]), FACE_KEYS = FACES.map(f => f[0]);
  function safePresence(p) {
    if (!p || typeof p !== 'object') return null;
    const table = okTable(p.table) ? p.table : null;
    return {
      nick: String(p.nick ?? '손님').slice(0, 12),
      color: COLORS.includes(p.color) ? p.color : COLORS[6],
      acc: ACC_KEYS.includes(p.acc) ? p.acc : 'none',
      face: FACE_KEYS.includes(p.face) ? p.face : 'smile',
      table, seat: table !== null && okSeat(p.seat) ? p.seat : null,
      at: typeof p.at === 'number' && isFinite(p.at) ? p.at : Date.now(),
      x: Number.isFinite(p.x) ? Math.max(0, Math.min(W, Math.round(p.x))) : SPAWN[0],
      y: Number.isFinite(p.y) ? Math.max(0, Math.min(H, Math.round(p.y))) : SPAWN[1],
    };
  }

  // ── 캐릭터 그림 (오리지널 '주먹밥' 캐릭터) ──
  function avatarSVG(l, size = 64) {
    const c = l.color || '#f5f0e8';
    const eyes = {
      smile: '<circle cx="23" cy="34" r="2.6" fill="#2b2b2b"/><circle cx="41" cy="34" r="2.6" fill="#2b2b2b"/><path d="M27 41 q5 5 10 0" stroke="#2b2b2b" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
      happy: '<path d="M20 35 q3-4 6 0 M38 35 q3-4 6 0" stroke="#2b2b2b" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M26 40 q6 7 12 0 z" fill="#e2564b"/>',
      sleepy: '<path d="M20 35 h6 M38 35 h6" stroke="#2b2b2b" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="32" cy="42" rx="2.5" ry="2" fill="#2b2b2b"/>',
      wow: '<circle cx="23" cy="34" r="3.2" fill="#2b2b2b"/><circle cx="41" cy="34" r="3.2" fill="#2b2b2b"/><ellipse cx="32" cy="43" rx="3" ry="4" fill="#2b2b2b"/>',
    }[l.face] || '';
    const acc = {
      towel: '<path d="M10 22 q22-10 44 0 l-2 6 q-20-8-40 0 z" fill="#fff" stroke="#ddd"/><path d="M51 24 l8 -3 l-1 7 z" fill="#fff" stroke="#ddd"/>',
      beanie: '<path d="M12 24 q20-22 40 0 z" fill="#e2564b"/><rect x="10" y="21" width="44" height="6" rx="3" fill="#b83b31"/><circle cx="32" cy="7" r="4" fill="#fff"/>',
      glasses: '<circle cx="23" cy="34" r="6.5" fill="none" stroke="#2b2b2b" stroke-width="2"/><circle cx="41" cy="34" r="6.5" fill="none" stroke="#2b2b2b" stroke-width="2"/><path d="M29.5 34 h5" stroke="#2b2b2b" stroke-width="2"/>',
      ribbon: '<path d="M32 16 l-10 -6 v12 z M32 16 l10 -6 v12 z" fill="#ff6b9a"/><circle cx="32" cy="16" r="3" fill="#e0457a"/>',
      chef: '<rect x="18" y="12" width="28" height="10" rx="3" fill="#fff" stroke="#ddd"/><circle cx="22" cy="10" r="6" fill="#fff"/><circle cx="32" cy="7" r="7" fill="#fff"/><circle cx="42" cy="10" r="6" fill="#fff"/>',
    }[l.acc] || '';
    return `<svg class="pc-ava" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 10 C46 10 56 30 57 44 C58 54 48 58 32 58 C16 58 6 54 7 44 C8 30 18 10 32 10 Z" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>
      <rect x="18" y="47" width="28" height="10" rx="3" fill="#2b3a2e"/>
      <ellipse cx="17" cy="41" rx="4" ry="2.5" fill="#ff8a8a" opacity=".55"/><ellipse cx="47" cy="41" rx="4" ry="2.5" fill="#ff8a8a" opacity=".55"/>
      ${eyes}${acc}</svg>`;
  }

  // ── 접속 ──
  function connect() {
    if (ch || typeof sb === 'undefined') return;
    ch = sb.channel('omechu-pocha-v1', { config: { presence: { key: SID }, broadcast: { self: true } } });
    ch.on('presence', { event: 'sync' }, () => {
      const raw = ch.presenceState(); state = {};
      Object.entries(raw).forEach(([k, arr]) => { const p = okSid(k) && arr && safePresence(arr[0]); if (p) state[k] = p; });
      resolveSeatConflict(); render();
    });
    ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const p = okSid(key) && newPresences && safePresence(newPresences[0]);
      if (p && myTable !== null && p.table === myTable && key !== SID) sys(myTable, `${esc(p.nick)}님이 자리에 앉았어요`);
    });
    ch.on('broadcast', { event: 'chat' }, ({ payload: m }) => {
      if (!m || !okSid(m.sid) || !okTable(m.table) || muted.has(m.sid)) return;
      m.nick = String(m.nick ?? '손님').slice(0, 12);
      const t = clean(m.text);
      logs[m.table] = (logs[m.table] || []).concat([{ nick: m.nick, text: t, sid: m.sid }]).slice(-40);
      bubbles[m.sid] = { text: t, until: Date.now() + 4500 };
      render(); setTimeout(render, 4600);
    });
    ch.on('broadcast', { event: 'cheers' }, ({ payload: m }) => {
      if (!m || !okSid(m.sid) || !okTable(m.table) || muted.has(m.sid)) return; m.nick = String(m.nick ?? '손님').slice(0, 12); bubbles[m.sid] = { text: '짠! 🍻', until: Date.now() + 2500, cheers: true };
      if (m.table === myTable && m.sid !== SID) sys(myTable, `${esc(m.nick)}님이 짠! 했어요`);
      render(); setTimeout(render, 2600);
    });
    ch.on('broadcast', { event: 'vote_start' }, ({ payload: v }) => {
      if (!v || !okTable(v.table) || typeof v.id !== 'string' || !Array.isArray(v.opts)) return;
      if (votes[v.table] && !votes[v.table].done) return;   // 진행 중인 투표는 덮어쓰지 않음
      v.opts = v.opts.slice(0, 3).map(o => String(o ?? '').slice(0, 20)); if (!v.opts.length) return;
      v.nick = String(v.nick ?? '손님').slice(0, 12); v.id = v.id.slice(0, 40);
      votes[v.table] = { id: v.id, opts: v.opts, by: v.nick, picks: {}, until: Date.now() + 25000, done: false };
      if (v.table === myTable) sys(myTable, `${esc(v.nick)}님이 안주 투표를 시작했어요 (25초)`);
      render(); setTimeout(() => finishVote(v.table, v.id), 25500);
    });
    ch.on('broadcast', { event: 'vote' }, ({ payload: v }) => {
      if (!v || !okTable(v.table) || !okSid(v.sid)) return;
      const cur = votes[v.table]; if (!cur || cur.id !== v.id || cur.done) return;
      if (!Number.isInteger(v.idx) || v.idx < 0 || v.idx >= cur.opts.length) return;
      cur.picks[v.sid] = v.idx; render();
      const seated = seatedAt(v.table).length;
      if (Object.keys(cur.picks).length >= seated) finishVote(v.table, v.id);
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { joined = true; await track(); render(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { joined = false; render(); }
    });
  }
  function disconnect() { if (ch) { try { sb.removeChannel(ch); } catch (e) {} ch = null; joined = false; myTable = null; mySeat = null; state = {}; } }
  function track() {
    if (!ch) return;
    const dest = target || pos;
    return ch.track({ nick: nick(), color: me.color, acc: me.acc, face: me.face, table: myTable, seat: mySeat, at: seatAt, x: Math.round(dest.x), y: Math.round(dest.y) });
  }

  // ── 자리 ──
  const seatedAt = (t) => Object.entries(state).filter(([, p]) => p.table === t && p.seat !== null && p.seat !== undefined).map(([sid, p]) => ({ ...p, sid }));
  const seatTaken = (t, s) => seatedAt(t).some(p => p.sid !== SID && p.seat === s);
  function freeSeat(t) {
    for (let s = 0; s < SEATS; s++) if (!seatTaken(t, s)) return s;
    return null;
  }
  // 걸어가서 앉기
  function goSit(t, s) {
    if (!joined) { showToast('포차에 연결하는 중이에요. 잠시만요!'); return; }
    if (seatTaken(t, s)) { showToast('누가 앉아 있는 자리예요'); return; }
    if (myTable !== null) { myTable = null; mySeat = null; }
    pendingSeat = { t, s };
    const [x, y] = seatXY(t, s); walkTo(x, y);
  }
  async function sitNow(t, s) {
    if (seatTaken(t, s)) { const f = freeSeat(t); if (f === null) { showToast('그 테이블은 자리가 꽉 찼어요 😅'); return; } s = f; const [x, y] = seatXY(t, s); pos = { x, y }; }
    myTable = t; mySeat = s; seatAt = Date.now();
    await track(); sys(t, '자리에 앉았어요. 옆 사람에게 인사해 보세요 👋'); render();
  }
  async function sit(t) { const s = freeSeat(t); if (s === null) { showToast('그 테이블은 자리가 꽉 찼어요 😅'); return; } goSit(t, s); }
  async function sitAny() {
    let best = null, bestN = -1;
    for (let t = 0; t < TABLES; t++) { const n = seatedAt(t).filter(p => p.sid !== SID).length; if (n < SEATS && n > bestN) { best = t; bestN = n; } }
    if (best === null) { showToast('지금은 모든 자리가 꽉 찼어요 😅'); return; }
    sit(best);
  }
  async function stand() {
    if (myTable === null) return;
    const [x, y] = seatXY(myTable, mySeat); myTable = null; mySeat = null; pos = { x, y: y + 34 };
    await track(); render();
  }

  // ── 걷기 ──
  function walkTo(x, y) {
    x = Math.max(16, Math.min(W - 16, x)); y = Math.max(30, Math.min(H - 10, y));
    target = { x, y }; follow = true; track(); render();
    // 화면이 가려져 있을 때도 멈추지 않게(백그라운드에선 rAF가 멈춤)
    const next = (fn) => document.hidden ? setTimeout(() => fn(performance.now()), 100) : requestAnimationFrame(fn);
    if (!walkRAF) { let last = performance.now(); const step = (now) => {
      const dt = Math.min(0.3, (now - last) / 1000); last = now;
      if (!target) { walkRAF = 0; return; }
      const dx = target.x - pos.x, dy = target.y - pos.y, d = Math.hypot(dx, dy), mv = SPEED * dt;
      if (d <= mv) {
        pos = { ...target }; target = null; walkRAF = 0; drawMe(false);
        if (pendingSeat) { const ps = pendingSeat; pendingSeat = null; sitNow(ps.t, ps.s); } else { track(); render(); }
        return;
      }
      pos = { x: pos.x + dx / d * mv, y: pos.y + dy / d * mv }; me.face_dir = dx < 0 ? -1 : 1;
      drawMe(true); walkRAF = next(step);
    }; walkRAF = next(step); }
  }
  function onWorldTap(e) {
    const world = document.getElementById('pc-world'); if (!world) return;
    const r = world.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    // 빈 의자 근처를 눌렀으면 걸어가서 앉기
    for (let t = 0; t < TABLES; t++) for (let s = 0; s < SEATS; s++) {
      const [sx, sy] = seatXY(t, s);
      if (Math.hypot(sx - x, sy - y) < 30 && !(t === myTable && s === mySeat)) { if (!seatTaken(t, s)) { goSit(t, s); return; } }
    }
    if (myTable !== null) { const [sx, sy] = seatXY(myTable, mySeat); myTable = null; mySeat = null; pos = { x: sx, y: sy + 34 }; }
    pendingSeat = null; walkTo(x, y);
  }

  // 같은 자리를 두 명이 잡으면 먼저 앉은 사람이 우선
  function resolveSeatConflict() {
    if (myTable === null) return;
    const clash = seatedAt(myTable).find(p => p.sid !== SID && p.seat === mySeat && (p.at < seatAt || (p.at === seatAt && p.sid < SID)));
    if (clash) {
      const s = freeSeat(myTable);
      if (s === null) { myTable = null; mySeat = null; showToast('자리가 겹쳐서 일어났어요. 다른 테이블을 골라주세요'); }
      else mySeat = s;
      track();
    }
  }

  // ── 대화 ──
  function clean(t) { return String(t || '').slice(0, 60).replace(BAD, (m) => '♡'.repeat(m.length)); }
  function sys(t, text) { logs[t] = (logs[t] || []).concat([{ sys: true, text }]).slice(-40); render(); }
  function send() {
    const el = document.getElementById('pc-msg'); if (!el) return;
    const text = el.value.trim(); if (!text || myTable === null) return;
    if (Date.now() - lastSend < 1500) { showToast('조금만 천천히 말해 주세요 🙂'); return; }
    lastSend = Date.now(); el.value = '';
    ch.send({ type: 'broadcast', event: 'chat', payload: { table: myTable, sid: SID, nick: nick(), text: clean(text) } });
  }
  function cheers() {
    if (myTable === null || Date.now() - lastSend < 1500) return; lastSend = Date.now();
    ch.send({ type: 'broadcast', event: 'cheers', payload: { table: myTable, sid: SID, nick: nick() } });
  }
  function mute(sid) {
    if (sid === SID) return;
    const p = state[sid];
    if (!confirm(`${p ? p.nick : '이 손님'}님의 말을 안 볼까요? (이번 접속 동안)`)) return;
    muted.add(sid); logs[myTable] = (logs[myTable] || []).filter(m => m.sid !== sid); render(); showToast('🙈 이 손님의 말을 숨겼어요');
  }

  // ── 안주 투표 (오메추 추천 엔진 사용) ──
  function startVote() {
    if (myTable === null) return;
    const cur = votes[myTable]; if (cur && !cur.done) { showToast('이미 투표 중이에요'); return; }
    const pool = (typeof menuDB !== 'undefined' ? menuDB : []).filter(m => m.tags.includes('🍺 술안주') || m.tags.includes('🌙 야식'));
    let opts = typeof pickWeighted === 'function' ? pickWeighted(pool, 3) : pool.sort(() => Math.random() - .5).slice(0, 3);
    opts = opts.map(m => m.name);
    ch.send({ type: 'broadcast', event: 'vote_start', payload: { table: myTable, id: SID + Date.now(), opts, nick: nick() } });
  }
  function vote(idx) {
    const cur = votes[myTable]; if (!cur || cur.done || cur.picks[SID] !== undefined) return;
    ch.send({ type: 'broadcast', event: 'vote', payload: { table: myTable, id: cur.id, idx, sid: SID } });
  }
  function findWinner() { const v = votes[myTable]; if (v && v.done && v.winner && typeof openNearbyMap === 'function') openNearbyMap(v.winner); }
  function finishVote(t, id) {
    const cur = votes[t]; if (!cur || cur.id !== id || cur.done) return;
    cur.done = true;
    const cnt = cur.opts.map((_, i) => Object.values(cur.picks).filter(x => x === i).length);
    const max = Math.max(...cnt); const win = cnt.indexOf(max);   // 동점이면 앞 순서
    cur.winner = cur.opts[win]; dishes[t] = cur.winner;
    if (t === myTable) sys(t, `🍢 오늘의 안주는 '${esc(cur.winner)}'! (${max}표)`);
    render();
  }

  // ── 비 소리 (직접 만든 잔잔한 빗소리) ──
  function toggleRain() {
    const scene = document.querySelector('.pc-scene');
    if (rainCtx) { rainCtx.close(); rainCtx = null; scene && scene.classList.remove('raining'); render(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
      const g = ctx.createGain(); g.gain.value = 0.35;
      src.connect(f).connect(g).connect(ctx.destination); src.start();
      rainCtx = ctx; scene && scene.classList.add('raining'); render();
    } catch (e) { showToast('이 기기에서는 소리를 낼 수 없어요'); }
  }

  // ── 꾸미기 ──
  function openDress() { document.getElementById('pc-dress').style.display = 'flex'; renderDress(); }
  function closeDress() { document.getElementById('pc-dress').style.display = 'none'; }
  function setLook(k, v) { me[k] = v; localStorage.setItem('wmjPochaLook', JSON.stringify(me)); renderDress(); track(); render(); }
  function renderDress() {
    const el = document.getElementById('pc-dress-body'); if (!el) return;
    el.innerHTML = `
      <div class="pc-preview">${avatarSVG(me, 96)}</div>
      <div style="font-size:12px;color:var(--muted)">색깔</div>
      <div class="pc-opts">${COLORS.map(c => `<button class="pc-swatch ${me.color === c ? 'on' : ''}" style="background:${c}" onclick="Pocha.setLook('color','${c}')"></button>`).join('')}</div>
      <div style="font-size:12px;color:var(--muted)">소품</div>
      <div class="pc-opts">${ACCS.map(([k, n]) => `<button class="${me.acc === k ? 'on' : ''}" onclick="Pocha.setLook('acc','${k}')">${n}</button>`).join('')}</div>
      <div style="font-size:12px;color:var(--muted)">표정</div>
      <div class="pc-opts">${FACES.map(([k, n]) => `<button class="${me.face === k ? 'on' : ''}" onclick="Pocha.setLook('face','${k}')">${n}</button>`).join('')}</div>
      <button class="cta-btn crave-btn" style="margin-top:4px" onclick="Pocha.closeDress()">이걸로 할게요</button>`;
  }

  // ── 화면: 골목 지도 ──
  function worldSVG() {
    const tent = (t) => {
      const [cx, cy] = TABLE_POS[t];
      if (t === 3) return `<g transform="translate(${cx} ${cy})">
        <rect x="-120" y="-92" width="240" height="190" rx="14" fill="#3a2a26"/>
        <rect x="-120" y="-92" width="240" height="26" rx="10" fill="url(#pcAwnO)"/>
        <rect x="-104" y="-30" width="208" height="40" rx="8" fill="#7a4b2a"/><rect x="-104" y="-30" width="208" height="8" rx="4" fill="#94603a"/>
        <g fill="#ffd36b"><rect x="-80" y="-58" width="10" height="18" rx="2"/><rect x="-60" y="-58" width="10" height="18" rx="2" fill="#7fd3a0"/><rect x="60" y="-58" width="24" height="20" rx="4" fill="#cfd8e3"/></g>
        ${BAR_OFF.map(([x, y]) => `<ellipse cx="${x}" cy="${y + 10}" rx="17" ry="8" fill="#1d4ca3"/><ellipse cx="${x}" cy="${y + 6}" rx="17" ry="8" fill="#2d6cdf"/>`).join('')}
        <text x="0" y="-104" class="pc-tname">${TABLE_NAME[t]}</text></g>`;
      return `<g transform="translate(${cx} ${cy})">
        <rect x="-120" y="-100" width="240" height="210" rx="14" fill="#3a2a26"/>
        <rect x="-120" y="-100" width="240" height="26" rx="10" fill="url(#pcAwnR)"/>
        ${SEAT_OFF.map(([x, y]) => `<ellipse cx="${x}" cy="${y + 10}" rx="17" ry="8" fill="#1d4ca3"/><ellipse cx="${x}" cy="${y + 6}" rx="17" ry="8" fill="#2d6cdf"/>`).join('')}
        <ellipse cx="0" cy="16" rx="52" ry="30" fill="#8f1a12"/><ellipse cx="0" cy="10" rx="52" ry="30" fill="#e2564b"/><ellipse cx="0" cy="6" rx="40" ry="20" fill="#ff6b5e" opacity=".35"/>
        <text x="0" y="-112" class="pc-tname">${TABLE_NAME[t]}</text></g>`;
    };
    const lamps = [[60, 470], [240, 470], [480, 470], [660, 470], [300, 640], [420, 640], [300, 830], [420, 830]];
    return `<svg class="pc-map" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs>
        <pattern id="pcBrick" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#231e2b"/><path d="M0 16h32M16 0v16M0 32h32M0 16v16M32 16v16" stroke="#2c2636" stroke-width="1.2"/></pattern>
        <pattern id="pcAwnR" width="36" height="26" patternUnits="userSpaceOnUse"><rect width="18" height="26" fill="#e2564b"/><rect x="18" width="18" height="26" fill="#fff1e6"/></pattern>
        <pattern id="pcAwnO" width="36" height="26" patternUnits="userSpaceOnUse"><rect width="18" height="26" fill="#ff8a1c"/><rect x="18" width="18" height="26" fill="#ffd8a8"/></pattern>
        <radialGradient id="pcGlowG"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#pcBrick)"/>
      <rect x="0" y="420" width="${W}" height="110" fill="#1b1622"/><path d="M0 475h${W}" stroke="#3a3249" stroke-width="3" stroke-dasharray="16 14"/>
      <rect x="300" y="530" width="120" height="${H - 530}" fill="#1b1622"/>
      ${lamps.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="70" fill="url(#pcGlowG)"/>`).join('')}
      <path d="M0 418 Q90 440 180 418 T360 418 T540 418 T720 418" stroke="#4a4058" stroke-width="1.5" fill="none"/>
      ${[30, 90, 150, 210, 270, 330, 390, 450, 510, 570, 630, 690].map((x, i) => `<circle class="pc-bulb" style="animation-delay:${(i % 3) * .8}s" cx="${x}" cy="${425 + Math.sin(x / 57) * 8}" r="5" fill="#ffd36b"/>`).join('')}
      ${[0, 1, 2, 3].map(tent).join('')}
      <g transform="translate(360 ${H - 30})"><rect x="-58" y="-16" width="116" height="30" rx="10" fill="#c8102e"/><text x="0" y="5" class="pc-sign2">오메추 포차 골목</text></g>
    </svg>`;
  }
  function ensureShell(root) {
    if (document.getElementById('pc-world')) return;
    root.innerHTML = `
      <div class="pc-scene ${rainCtx ? 'raining' : ''}">
        <div class="pc-top">
          <div style="display:flex;align-items:center"><button class="pc-back" aria-label="뒤로 가기" onclick="showPage('fun')">‹</button><span class="pc-live" id="pc-live"></span></div>
          <div><button class="pc-iconbtn" id="pc-rainbtn" aria-label="빗소리 켜고 끄기" onclick="Pocha.toggleRain()"></button><button class="pc-iconbtn" onclick="Pocha.openDress()">👕 꾸미기</button></div>
        </div>
        <div class="pc-viewwrap"><div class="pc-view" id="pc-view">
          <div class="pc-world" id="pc-world" style="width:${W}px;height:${H}px">${worldSVG()}<div id="pc-dishes"></div><div id="pc-people"></div></div>
        </div><div class="pc-rain"></div></div>
        <div class="pc-hint" id="pc-hint"></div>
      </div>
      <div class="pc-body" id="pc-panel"></div>`;
    const world = document.getElementById('pc-world');
    let down = null;
    world.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    world.addEventListener('click', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return; if (e.target.closest('.pc-person:not(.me)')) return; onWorldTap(e); });
    centerOn(pos.x, pos.y, false);
    document.getElementById('pc-view').addEventListener('touchstart', () => { follow = false; }, { passive: true });
    document.getElementById('pc-view').addEventListener('wheel', () => { follow = false; }, { passive: true });
  }
  function centerOn(x, y, smooth) {
    const v = document.getElementById('pc-view'); if (!v) return;
    v.scrollTo({ left: x - v.clientWidth / 2, top: y - v.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
  }
  function personHTML(p, sid) {
    const b = bubbles[sid]; const showB = b && b.until > Date.now();
    return `${showB ? `<div class="pc-bubble">${esc(b.text)}</div>` : ''}<div class="pc-body2">${avatarSVG(p, 46)}</div><div class="pc-name">${esc(p.nick)}${sid === SID ? ' (나)' : ''}</div>`;
  }
  function placeEl(el, x, y, seated) { el.style.transform = `translate(${x - 30}px, ${y - (seated ? 42 : 52)}px)`; el.style.zIndex = String(Math.round(y)); }
  function drawMe(walking) {
    const el = document.getElementById('pc-p-' + SID); if (!el) return;
    el.classList.toggle('walking', !!walking);
    el.querySelector('.pc-body2') && (el.querySelector('.pc-body2').style.transform = `scaleX(${me.face_dir || 1})`);
    const [x, y] = myTable !== null ? seatXY(myTable, mySeat) : [pos.x, pos.y];
    placeEl(el, x, y, myTable !== null);
    if (follow) { const v = document.getElementById('pc-view'); if (v) { const cx = x - v.clientWidth / 2, cy = y - v.clientHeight / 2; v.scrollLeft += (cx - v.scrollLeft) * 0.12; v.scrollTop += (cy - v.scrollTop) * 0.12; } }
  }
  function updateWorld() {
    const layer = document.getElementById('pc-people'); if (!layer) return;
    const people = { ...state };
    people[SID] = { nick: nick(), color: me.color, acc: me.acc, face: me.face, table: myTable, seat: mySeat, x: pos.x, y: pos.y };
    const seen = new Set();
    Object.entries(people).forEach(([sid, p]) => {
      seen.add(sid);
      let el = document.getElementById('pc-p-' + sid);
      if (!el) { el = document.createElement('div'); el.id = 'pc-p-' + sid; el.className = 'pc-person' + (sid === SID ? ' me' : ''); if (sid !== SID) el.addEventListener('click', () => mute(sid)); layer.appendChild(el); }
      el.innerHTML = personHTML(p, sid);
      el.classList.toggle('seated', p.table !== null && p.seat !== null);
      if (sid === SID) { drawMe(!!target); return; }
      const [x, y] = (p.table !== null && p.seat !== null) ? seatXY(p.table, p.seat) : [p.x, p.y];
      const prev = lastDrawn[sid];
      if (prev && (prev.x !== x || prev.y !== y)) {
        const dur = Math.min(6, Math.hypot(x - prev.x, y - prev.y) / SPEED);
        el.style.transition = `transform ${dur}s linear`; el.classList.add('walking'); clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('walking'), dur * 1000);
        el.querySelector('.pc-body2').style.transform = `scaleX(${x < prev.x ? -1 : 1})`;
      } else if (!prev) el.style.transition = 'none';
      placeEl(el, x, y, p.table !== null && p.seat !== null); lastDrawn[sid] = { x, y };
    });
    [...layer.children].forEach(el => { const sid = el.id.slice(5); if (!seen.has(sid)) { el.remove(); delete lastDrawn[sid]; } });
    // 투표로 정한 안주를 테이블 위에
    const dl = document.getElementById('pc-dishes');
    if (dl) dl.innerHTML = Object.entries(dishes).map(([t, d]) => {
      const img = typeof getMenuImg === 'function' ? getMenuImg(d) : null; const [cx, cy] = TABLE_POS[+t];
      return img ? `<img class="pc-dish2" src="${img}" alt="" onerror="this.remove()" style="left:${cx - 26}px;top:${cy + (+t === 3 ? -40 : -12)}px">` : '';
    }).join('');
  }
  function renderPanel() {
    const panel = document.getElementById('pc-panel'); if (!panel) return;
    const total = Object.keys(state).length;
    const live = document.getElementById('pc-live'); if (live) live.innerHTML = joined ? `🏮 지금 <b>${total}</b>명 포차에 있어요` : '연결 중...';
    const rb = document.getElementById('pc-rainbtn'); if (rb) rb.textContent = rainCtx ? '🔇' : '🌧️';
    const hint = document.getElementById('pc-hint');
    if (hint) hint.textContent = myTable !== null ? `${TABLE_NAME[myTable]}에 앉아 있어요 · 다른 곳을 누르면 일어나서 걸어가요` : '빈 곳을 누르면 걸어가고, 파란 의자를 누르면 앉아요';
    let body = '';
    if (myTable === null) {
      body = `<div class="pc-card"><div style="font-weight:700;margin-bottom:10px">자리 현황</div><div class="pc-tables">
        ${[0, 1, 2, 3].map(t => { const ps = seatedAt(t).filter(p => p.sid !== SID); const full = ps.length >= SEATS;
          return `<div class="pc-trow"><div><div style="font-size:13px;font-weight:700">${TABLE_NAME[t]} <span style="color:var(--muted);font-weight:400">${ps.length}/${SEATS}</span></div>
            <div class="who">${ps.map(p => avatarSVG(p, 28)).join('') || '<span style="font-size:11px;color:var(--muted)">아직 아무도 없어요</span>'}</div></div>
            <button ${full || !joined ? 'disabled' : ''} onclick="Pocha.sit(${t})">${full ? '만석' : '가서 앉기'}</button></div>`; }).join('')}
        </div><button class="cta-btn crave-btn" style="margin-top:12px" ${joined ? '' : 'disabled'} onclick="Pocha.sitAny()">🪑 빈자리 찾아가기</button></div>
        <div style="font-size:11px;color:var(--muted);text-align:center;line-height:1.6">대화는 저장되지 않아요. 같은 테이블에 앉은 사람끼리만 보여요.<br>불편한 손님은 캐릭터를 눌러 말을 숨길 수 있어요.</div>`;
    } else {
      const v = votes[myTable];
      const voteHTML = v ? `<div class="pc-card"><div style="font-weight:700">🍢 안주 투표 ${v.done ? `— <span style="color:var(--orange)">${esc(v.winner)}</span> 당첨!` : `<span style="font-size:12px;color:var(--muted)">(${Math.max(0, Math.ceil((v.until - Date.now()) / 1000))}초 남음)</span>`}</div>
        <div class="pc-vote">${v.opts.map((o, i) => { const n = Object.values(v.picks).filter(x => x === i).length; const img = typeof getMenuImg === 'function' ? getMenuImg(o) : null;
          return `<button class="${v.picks[SID] === i ? 'mine' : ''}" ${v.done || v.picks[SID] !== undefined ? 'disabled' : ''} onclick="Pocha.vote(${i})">${img ? `<img src="${img}" alt="">` : ''}<div>${esc(o)}</div><div class="cnt">${n}표</div></button>`; }).join('')}</div>
        ${v.done ? `<button class="pc-iconbtn" style="width:100%;margin:10px 0 0;background:var(--surface);color:var(--text);border-color:var(--border);padding:9px" onclick="Pocha.findWinner()">📍 ${esc(v.winner)} 근처에서 찾기</button>` : ''}</div>` : '';
      body = `<div class="pc-card"><div class="pc-actions">
          <button class="hot" onclick="Pocha.cheers()">🍻 짠!</button>
          <button onclick="Pocha.startVote()">🍢 안주 고르기</button>
          <button onclick="Pocha.stand()">🚪 일어나기</button></div></div>
        ${voteHTML}
        <div class="pc-card"><div class="pc-log" id="pc-log">${(logs[myTable] || []).map(m => m.sys ? `<div class="sys">${m.text}</div>` : `<div class="msg"><b>${esc(m.nick)}</b>${esc(m.text)}</div>`).join('') || '<div class="sys">아직 조용해요. 먼저 말을 걸어보세요!</div>'}</div>
          <div class="pc-input"><input id="pc-msg" maxlength="60" placeholder="오늘 뭐 드실 거예요?" onkeydown="if(event.key==='Enter')Pocha.send()"><button onclick="Pocha.send()">전송</button></div></div>`;
    }
    const prevVal = document.getElementById('pc-msg')?.value || '';
    const hadFocus = document.activeElement && document.activeElement.id === 'pc-msg';
    panel.innerHTML = body;
    const inp = document.getElementById('pc-msg'); if (inp) { inp.value = prevVal; if (hadFocus) inp.focus(); }
    const log = document.getElementById('pc-log'); if (log) log.scrollTop = log.scrollHeight;
  }
  function render() {
    const root = document.getElementById('pocha-root'); if (!root || document.getElementById('page-pocha').style.display === 'none') return;
    ensureShell(root);
    document.querySelector('.pc-scene')?.classList.toggle('raining', !!rainCtx);
    updateWorld(); renderPanel();
  }

  // 투표 남은 시간 표시 갱신
  setInterval(() => { if (myTable !== null && votes[myTable] && !votes[myTable].done) render(); }, 1000);

  window.Pocha = { findWinner,
    open() { connect(); render(); },
    close() { if (myTable !== null) stand(); },
    sit, sitAny, stand, goSit, walkTo, send, cheers, startVote, vote, mute, toggleRain, openDress, closeDress, setLook, render,
    avatarSVG, count: () => Object.keys(state).length,
  };
})();
