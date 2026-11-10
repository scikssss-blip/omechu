// ═════════════════════════════════════════════
// 오메추 먹자골목: 걸어 다니다 가게에 들어가 같이 앉는 가상 공간
// - 골목(street)에서 가게 문을 누르면 그 가게 방으로 들어간다
// - 가게: 포차 · 한식집 · 일식집 · 중식집 · 양식집 (테이블 4개 × 4자리)
// - Supabase Realtime(Presence + Broadcast) 사용, 대화는 서버에 저장하지 않음
// - 골목 채널: 모든 손님이 '지금 어느 가게에 있는지'를 공유 (문 위 인원 표시)
// - 가게 채널: 그 가게 안의 자리·대화·투표
// ═════════════════════════════════════════════
(function () {
  const SEATS = 4, SPEED = 170;
  const SID = Math.random().toString(36).slice(2, 10);          // 이번 접속용 임시 ID (개인 식별 X)
  const COLORS = ['#ffb3a7', '#ffd36b', '#a8e6a1', '#9ad0ff', '#c9b6ff', '#ffb3de', '#f5f0e8', '#ffa94d'];
  const ACCS = [['none', '없음'], ['towel', '수건 머리띠'], ['beanie', '털모자'], ['glasses', '안경'], ['ribbon', '리본'], ['chef', '요리사 모자']];
  const FACES = [['smile', '방긋'], ['happy', '신남'], ['sleepy', '졸림'], ['wow', '놀람']];
  const BAD = /(시발|씨발|씨빨|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|좆|존나|개새|새끼|꺼져|닥쳐|섹스|자살|죽어|느금|애미|애비)/g;

  // ── 가게 설정 ──
  const SEAT_KIND = {
    round: [[-74, -4], [74, -4], [-44, 58], [44, 58]],     // 둥근 테이블 둘레
    bar:   [[-81, 40], [-27, 40], [27, 40], [81, 40]],     // 카운터 한 줄
    low:   [[-42, -60], [42, -60], [-42, 56], [42, 56]],   // 좌식 상 (방석 위아래)
    booth: [[-78, -20], [-78, 34], [78, -20], [78, 34]],   // 소파 부스 (좌우)
  };
  const ROOMS = {
    street: { name: '오메추 먹자골목', w: 420, h: 1000, ch: 'omechu-street-v1', spawn: [210, 940], tables: [] },
    pocha: { name: '오메추 포차', kind: '포장마차', w: 720, h: 960, ch: 'omechu-pocha-v1', spawn: [360, 880], exit: [360, 930],
      tags: ['🍺 술안주', '🌙 야식'], vote: '안주', door: [210, 262], front: { x: 50, y: 70, w: 320, h: 160 },
      tables: [{ x: 180, y: 250, k: 'round', n: '1번 테이블' }, { x: 540, y: 250, k: 'round', n: '2번 테이블' }, { x: 180, y: 680, k: 'round', n: '3번 테이블' }, { x: 540, y: 680, k: 'bar', n: '이모네 바' }] },
    korean: { name: '오메추 밥상', kind: '한식집', w: 720, h: 900, ch: 'omechu-room-korean-v1', spawn: [360, 820], exit: [360, 870],
      tags: ['🍱 한식'], vote: '메뉴', door: [192, 440], front: { x: 8, y: 290, w: 160, h: 180 },
      tables: [{ x: 180, y: 260, k: 'low', n: '1번 상' }, { x: 540, y: 260, k: 'low', n: '2번 상' }, { x: 180, y: 590, k: 'low', n: '3번 상' }, { x: 540, y: 590, k: 'low', n: '4번 상' }] },
    japanese: { name: '오메추 스시야', kind: '일식집', w: 720, h: 900, ch: 'omechu-room-japanese-v1', spawn: [360, 820], exit: [360, 870],
      tags: ['🍣 일식'], vote: '메뉴', door: [228, 440], front: { x: 252, y: 290, w: 160, h: 180 },
      tables: [{ x: 360, y: 200, k: 'bar', n: '스시 카운터' }, { x: 160, y: 500, k: 'low', n: '1번 자리' }, { x: 560, y: 500, k: 'low', n: '2번 자리' }, { x: 360, y: 620, k: 'low', n: '3번 자리' }] },
    chinese: { name: '오메추 반점', kind: '중식집', w: 720, h: 900, ch: 'omechu-room-chinese-v1', spawn: [360, 820], exit: [360, 870],
      tags: ['🥢 중식'], vote: '메뉴', door: [192, 740], front: { x: 8, y: 590, w: 160, h: 180 },
      tables: [{ x: 180, y: 250, k: 'round', n: '1번 원탁' }, { x: 540, y: 250, k: 'round', n: '2번 원탁' }, { x: 180, y: 590, k: 'round', n: '3번 원탁' }, { x: 540, y: 590, k: 'round', n: '4번 원탁' }] },
    western: { name: '오메추 비스트로', kind: '양식집', w: 720, h: 900, ch: 'omechu-room-western-v1', spawn: [360, 820], exit: [360, 870],
      tags: ['🍝 양식'], vote: '메뉴', door: [228, 740], front: { x: 252, y: 590, w: 160, h: 180 },
      tables: [{ x: 180, y: 240, k: 'booth', n: '1번 부스' }, { x: 540, y: 240, k: 'booth', n: '2번 부스' }, { x: 180, y: 580, k: 'booth', n: '3번 부스' }, { x: 540, y: 580, k: 'booth', n: '4번 부스' }] },
  };
  const SHOPS = ['pocha', 'korean', 'japanese', 'chinese', 'western'];

  let room = 'street', R = ROOMS.street;
  let lobby = null, ch = null, joined = false, myTable = null, mySeat = null, seatAt = 0;
  let state = {}, lobbyState = {};
  let logs = {}, votes = {}, dishes = {}, bubbles = {};
  let muted = new Set(), lastSend = 0, rainCtx = null;
  let pos = { x: R.spawn[0], y: R.spawn[1] }, target = null, pendingSeat = null, pendingDoor = null, walkRAF = 0, follow = false;
  let lastDrawn = {}, K = 1;   // K: 골목을 폰 폭에 맞추는 배율

  const look = () => {
    try { return Object.assign({ color: COLORS[Math.floor(Math.random() * COLORS.length)], acc: 'towel', face: 'smile' }, JSON.parse(localStorage.getItem('wmjPochaLook') || '{}')); }
    catch (e) { return { color: COLORS[0], acc: 'towel', face: 'smile' }; }
  };
  let me = look();
  const esc = (v) => (typeof escHtml === 'function' ? escHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, ''));
  const nick = () => (typeof getMyNick === 'function' ? getMyNick() : '손님');
  const T = () => R.tables.length;
  const seatXY = (t, s) => { const tb = R.tables[t], o = SEAT_KIND[tb.k][s]; return [tb.x + o[0], tb.y + o[1]]; };

  // ── 다른 손님이 보낸 값은 믿지 않고 정해진 값만 받기 ──
  const okSid = (v) => typeof v === 'string' && /^[a-z0-9]{1,24}$/i.test(v);
  const okTable = (v) => Number.isInteger(v) && v >= 0 && v < T();
  const okSeat = (v) => Number.isInteger(v) && v >= 0 && v < SEATS;
  const ACC_KEYS = ACCS.map(a => a[0]), FACE_KEYS = FACES.map(f => f[0]);
  function safePresence(p, w, h) {
    if (!p || typeof p !== 'object') return null;
    const table = okTable(p.table) ? p.table : null;
    return {
      nick: String(p.nick ?? '손님').slice(0, 12),
      color: COLORS.includes(p.color) ? p.color : COLORS[6],
      acc: ACC_KEYS.includes(p.acc) ? p.acc : 'none',
      face: FACE_KEYS.includes(p.face) ? p.face : 'smile',
      table, seat: table !== null && okSeat(p.seat) ? p.seat : null,
      at: typeof p.at === 'number' && isFinite(p.at) ? p.at : Date.now(),
      x: Number.isFinite(p.x) ? Math.max(0, Math.min(w, Math.round(p.x))) : R.spawn[0],
      y: Number.isFinite(p.y) ? Math.max(0, Math.min(h, Math.round(p.y))) : R.spawn[1],
      room: SHOPS.includes(p.room) ? p.room : 'street',
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

  // ── 접속: 골목 채널(어느 가게에 있는지) ──
  function connectLobby() {
    if (lobby || typeof sb === 'undefined') return;
    lobby = sb.channel(ROOMS.street.ch, { config: { presence: { key: SID } } });
    lobby.on('presence', { event: 'sync' }, () => {
      const raw = lobby.presenceState(); lobbyState = {};
      Object.entries(raw).forEach(([k, arr]) => { const p = okSid(k) && arr && safePresence(arr[0], ROOMS.street.w, ROOMS.street.h); if (p) lobbyState[k] = p; });
      if (room === 'street') { state = lobbyState; joined = true; }
      render();
    });
    lobby.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { if (room === 'street') joined = true; await trackLobby(); render(); }
    });
  }
  function trackLobby() {
    if (!lobby) return;
    const dest = target || pos;
    return lobby.track({ nick: nick(), color: me.color, acc: me.acc, face: me.face, room, x: Math.round(dest.x), y: Math.round(dest.y) });
  }
  // ── 접속: 가게 채널 ──
  function connectRoom() {
    if (ch || room === 'street' || typeof sb === 'undefined') return;
    const my = room;
    ch = sb.channel(R.ch, { config: { presence: { key: SID }, broadcast: { self: true } } });
    ch.on('presence', { event: 'sync' }, () => {
      if (room !== my) return;
      const raw = ch.presenceState(); state = {};
      Object.entries(raw).forEach(([k, arr]) => { const p = okSid(k) && arr && safePresence(arr[0], R.w, R.h); if (p) state[k] = p; });
      resolveSeatConflict(); render();
    });
    ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const p = okSid(key) && newPresences && safePresence(newPresences[0], R.w, R.h);
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
      if (v.table === myTable) sys(myTable, `${esc(v.nick)}님이 ${R.vote} 투표를 시작했어요 (25초)`);
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
      if (room !== my) return;
      if (status === 'SUBSCRIBED') { joined = true; await track(); render(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { joined = false; render(); }
    });
  }
  function leaveRoomChannel() { if (ch) { try { sb.removeChannel(ch); } catch (e) {} ch = null; } }
  function track() {
    trackLobby();
    if (!ch || room === 'street') return;
    const dest = target || pos;
    return ch.track({ nick: nick(), color: me.color, acc: me.acc, face: me.face, table: myTable, seat: mySeat, at: seatAt, x: Math.round(dest.x), y: Math.round(dest.y) });
  }

  // ── 가게 드나들기 ──
  function enterRoom(id, from) {
    if (!ROOMS[id] || id === room) return;
    leaveRoomChannel();
    const prev = room;
    room = id; R = ROOMS[id];
    myTable = null; mySeat = null; target = null; pendingSeat = null; pendingDoor = null;
    logs = {}; votes = {}; dishes = {}; bubbles = {}; lastDrawn = {};
    state = id === 'street' ? lobbyState : {}; joined = id === 'street' ? !!lobby : false;
    if (id === 'street') { const d = ROOMS[from || prev]?.door || R.spawn; pos = { x: d[0], y: d[1] }; }
    else pos = { x: R.spawn[0], y: R.spawn[1] };
    const rootEl = document.getElementById('pocha-root'); if (rootEl) rootEl.innerHTML = '';
    trackLobby(); connectRoom(); render();
    if (id !== 'street' && typeof showToast === 'function') showToast(`${R.kind} '${R.name}'에 들어왔어요`);
  }

  // ── 자리 ──
  const seatedAt = (t) => Object.entries(state).filter(([, p]) => p.table === t && p.seat !== null && p.seat !== undefined).map(([sid, p]) => ({ ...p, sid }));
  const seatTaken = (t, s) => seatedAt(t).some(p => p.sid !== SID && p.seat === s);
  function freeSeat(t) { for (let s = 0; s < SEATS; s++) if (!seatTaken(t, s)) return s; return null; }
  function goSit(t, s) {
    if (room === 'street') return;
    if (!joined) { showToast('가게에 연결하는 중이에요. 잠시만요!'); return; }
    if (seatTaken(t, s)) { showToast('누가 앉아 있는 자리예요'); return; }
    if (myTable !== null) { myTable = null; mySeat = null; }
    pendingSeat = { t, s }; pendingDoor = null;
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
    for (let t = 0; t < T(); t++) { const n = seatedAt(t).filter(p => p.sid !== SID).length; if (n < SEATS && n > bestN) { best = t; bestN = n; } }
    if (best === null) { showToast('지금은 모든 자리가 꽉 찼어요 😅'); return; }
    sit(best);
  }
  async function stand() {
    if (myTable === null) return;
    const [x, y] = seatXY(myTable, mySeat); myTable = null; mySeat = null; pos = { x, y: y + 34 };
    await track(); render();
  }
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

  // ── 걷기 ──
  function walkTo(x, y) {
    x = Math.max(16, Math.min(R.w - 16, x)); y = Math.max(30, Math.min(R.h - 10, y));
    target = { x, y }; follow = true; track(); render();
    const next = (fn) => {   // 보통은 화면 주사율(rAF)로, rAF가 멈춘 환경에선 타이머로 대신
      let done = false;
      const id = requestAnimationFrame((t) => { if (!done) { done = true; clearTimeout(to); fn(t); } });
      const to = setTimeout(() => { if (!done) { done = true; cancelAnimationFrame(id); fn(performance.now()); } }, 80);
      return 1;
    };
    if (!walkRAF) { let last = performance.now(); const step = (now) => {
      const dt = Math.min(0.3, (now - last) / 1000); last = now;
      if (!target) { walkRAF = 0; return; }
      const dx = target.x - pos.x, dy = target.y - pos.y, d = Math.hypot(dx, dy), mv = SPEED * dt;
      if (d <= mv) {
        pos = { ...target }; target = null; walkRAF = 0; drawMe(false); if (follow) centerOn(pos.x, pos.y, true);
        if (pendingSeat) { const ps = pendingSeat; pendingSeat = null; sitNow(ps.t, ps.s); }
        else if (pendingDoor) { const d2 = pendingDoor; pendingDoor = null; enterRoom(d2); }
        else { track(); render(); }
        return;
      }
      pos = { x: pos.x + dx / d * mv, y: pos.y + dy / d * mv }; me.face_dir = dx < 0 ? -1 : 1;
      drawMe(true); walkRAF = next(step);
    }; walkRAF = next(step); }
  }
  function onWorldTap(e) {
    const world = document.getElementById('pc-world'); if (!world) return;
    const r = world.getBoundingClientRect(); const x = (e.clientX - r.left) / K, y = (e.clientY - r.top) / K;
    pendingSeat = null; pendingDoor = null;
    if (room === 'street') {
      // 가게 문(또는 간판)을 누르면 걸어가서 들어가기
      for (const id of SHOPS) { const s = shopRect(id); if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) { pendingDoor = id; walkTo(ROOMS[id].door[0], ROOMS[id].door[1]); return; } }
      walkTo(x, y); return;
    }
    // 나가는 문
    if (Math.hypot(x - R.exit[0], y - R.exit[1]) < 50) {
      if (myTable !== null) { myTable = null; mySeat = null; }
      pendingDoor = 'street'; walkTo(R.exit[0], R.exit[1]); return;
    }
    for (let t = 0; t < T(); t++) for (let s = 0; s < SEATS; s++) {
      const [sx, sy] = seatXY(t, s);
      if (Math.hypot(sx - x, sy - y) < 30 && !(t === myTable && s === mySeat)) { if (!seatTaken(t, s)) { goSit(t, s); return; } }
    }
    if (myTable !== null) { const [sx, sy] = seatXY(myTable, mySeat); myTable = null; mySeat = null; pos = { x: sx, y: sy + 34 }; }
    walkTo(x, y);
  }
  function leave() { if (room === 'street') return; if (myTable !== null) { myTable = null; mySeat = null; } pendingSeat = null; pendingDoor = 'street'; walkTo(R.exit[0], R.exit[1]); }

  // ── 대화 ──
  function clean(t) { return String(t || '').slice(0, 60).replace(BAD, (m) => '♡'.repeat(m.length)); }
  function sys(t, text) { logs[t] = (logs[t] || []).concat([{ sys: true, text }]).slice(-40); render(); }
  function send() {
    const el = document.getElementById('pc-msg'); if (!el || !ch) return;
    const text = el.value.trim(); if (!text || myTable === null) return;
    if (Date.now() - lastSend < 1500) { showToast('조금만 천천히 말해 주세요 🙂'); return; }
    lastSend = Date.now(); el.value = '';
    ch.send({ type: 'broadcast', event: 'chat', payload: { table: myTable, sid: SID, nick: nick(), text: clean(text) } });
  }
  function cheers() {
    if (!ch || myTable === null || Date.now() - lastSend < 1500) return; lastSend = Date.now();
    ch.send({ type: 'broadcast', event: 'cheers', payload: { table: myTable, sid: SID, nick: nick() } });
  }
  function mute(sid) {
    if (sid === SID) return;
    const p = state[sid];
    if (!confirm(`${p ? p.nick : '이 손님'}님의 말을 안 볼까요? (이번 접속 동안)`)) return;
    muted.add(sid); if (myTable !== null) logs[myTable] = (logs[myTable] || []).filter(m => m.sid !== sid); render(); showToast('🙈 이 손님의 말을 숨겼어요');
  }

  // ── 메뉴 투표 (가게 음식 중에서 오메추 추천 엔진으로 후보 3개) ──
  function startVote() {
    if (myTable === null || !ch) return;
    const cur = votes[myTable]; if (cur && !cur.done) { showToast('이미 투표 중이에요'); return; }
    const pool = (typeof menuDB !== 'undefined' ? menuDB : []).filter(m => R.tags.some(t => m.tags.includes(t)));
    let opts = typeof pickWeighted === 'function' ? pickWeighted(pool, 3) : pool.sort(() => Math.random() - .5).slice(0, 3);
    opts = opts.map(m => m.name);
    ch.send({ type: 'broadcast', event: 'vote_start', payload: { table: myTable, id: SID + Date.now(), opts, nick: nick() } });
  }
  function vote(idx) {
    const cur = votes[myTable]; if (!ch || !cur || cur.done || cur.picks[SID] !== undefined) return;
    ch.send({ type: 'broadcast', event: 'vote', payload: { table: myTable, id: cur.id, idx, sid: SID } });
  }
  function findWinner() { const v = votes[myTable]; if (v && v.done && v.winner && typeof openNearbyMap === 'function') openNearbyMap(v.winner); }
  function finishVote(t, id) {
    const cur = votes[t]; if (!cur || cur.id !== id || cur.done) return;
    cur.done = true;
    const cnt = cur.opts.map((_, i) => Object.values(cur.picks).filter(x => x === i).length);
    const max = Math.max(...cnt); const win = cnt.indexOf(max);   // 동점이면 앞 순서
    cur.winner = cur.opts[win]; dishes[t] = cur.winner;
    if (t === myTable) sys(t, `🍽️ 오늘의 ${R.vote}는 '${esc(cur.winner)}'! (${max}표)`);
    render();
  }

  // ── 비 소리 (직접 만든 잔잔한 빗소리) ──
  function toggleRain() {
    if (rainCtx) { rainCtx.close(); rainCtx = null; render(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
      const g = ctx.createGain(); g.gain.value = 0.35;
      src.connect(f).connect(g).connect(ctx.destination); src.start();
      rainCtx = ctx; render();
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

  // ══════════ 그림: 골목과 가게 ══════════
  const DEFS = `<defs>
    <pattern id="pcBrick" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#231e2b"/><path d="M0 16h32M16 0v16M0 32h32M0 16v16M32 16v16" stroke="#2c2636" stroke-width="1.2"/></pattern>
    <pattern id="pcStone" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#2a2530"/><rect x="2" y="2" width="36" height="16" rx="3" fill="#302a37"/><rect x="-18" y="22" width="36" height="16" rx="3" fill="#302a37"/><rect x="22" y="22" width="36" height="16" rx="3" fill="#302a37"/></pattern>
    <pattern id="pcWood" width="120" height="30" patternUnits="userSpaceOnUse"><rect width="120" height="30" fill="#7a5233"/><path d="M0 29.5h120M60 0v30" stroke="#5e3d24" stroke-width="1.5"/><path d="M10 12 q20 -4 40 0" stroke="#86603f" fill="none"/></pattern>
    <pattern id="pcTatami" width="80" height="160" patternUnits="userSpaceOnUse"><rect width="80" height="160" fill="#b9b27a"/><rect x="1.5" y="1.5" width="77" height="157" fill="none" stroke="#3f5a3a" stroke-width="3"/><path d="M0 40h80M0 80h80M0 120h80" stroke="#aaa36c" stroke-width="1"/></pattern>
    <pattern id="pcCnFloor" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#5a1a17"/><rect x="4" y="4" width="40" height="40" fill="#661f1b"/><circle cx="24" cy="24" r="6" fill="none" stroke="#8a2c24" stroke-width="2"/></pattern>
    <pattern id="pcChecker" width="56" height="56" patternUnits="userSpaceOnUse"><rect width="56" height="56" fill="#6e6258"/><rect width="28" height="28" fill="#4a403a"/><rect x="28" y="28" width="28" height="28" fill="#4a403a"/></pattern>
    <pattern id="pcAwnR" width="36" height="26" patternUnits="userSpaceOnUse"><rect width="18" height="26" fill="#e2564b"/><rect x="18" width="18" height="26" fill="#fff1e6"/></pattern>
    <pattern id="pcAwnO" width="36" height="26" patternUnits="userSpaceOnUse"><rect width="18" height="26" fill="#ff8a1c"/><rect x="18" width="18" height="26" fill="#ffd8a8"/></pattern>
    <pattern id="pcAwnG" width="36" height="26" patternUnits="userSpaceOnUse"><rect width="18" height="26" fill="#2f6b4f"/><rect x="18" width="18" height="26" fill="#f4efe2"/></pattern>
    <radialGradient id="pcGlowG"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
  </defs>`;
  const stoolSVG = (x, y, c = '#2d6cdf', d = '#1d4ca3') => `<ellipse cx="${x}" cy="${y + 10}" rx="17" ry="8" fill="${d}"/><ellipse cx="${x}" cy="${y + 6}" rx="17" ry="8" fill="${c}"/>`;
  const cushionSVG = (x, y, c) => `<rect x="${x - 18}" y="${y - 6}" width="36" height="26" rx="8" fill="${c}"/><rect x="${x - 14}" y="${y - 3}" width="28" height="19" rx="6" fill="none" stroke="rgba(255,255,255,.25)"/>`;
  function furnitureSVG(tb, theme) {
    const { x, y, k } = tb; const S = SEAT_KIND[k].map(([dx, dy]) => [x + dx, y + dy]);
    if (k === 'round') {
      const top = theme === 'chinese' ? '#f2e6c9' : '#e2564b', side = theme === 'chinese' ? '#b89b62' : '#8f1a12';
      const lazy = theme === 'chinese' ? `<circle cx="${x}" cy="${y + 8}" r="22" fill="#d8c79c" stroke="#b89b62" stroke-width="2"/>` : '';
      const seats = theme === 'chinese' ? S.map(([a, b]) => stoolSVG(a, b, '#c8102e', '#8f0b20')).join('') : S.map(([a, b]) => stoolSVG(a, b)).join('');
      return `${seats}<ellipse cx="${x}" cy="${y + 16}" rx="52" ry="30" fill="${side}"/><ellipse cx="${x}" cy="${y + 10}" rx="52" ry="30" fill="${top}"/>${lazy}`;
    }
    if (k === 'bar') {
      const wood = theme === 'japanese' ? '#d9b98a' : '#7a4b2a', edge = theme === 'japanese' ? '#e8cfa6' : '#94603a';
      const seats = S.map(([a, b]) => stoolSVG(a, b, theme === 'japanese' ? '#3f5a3a' : '#2d6cdf', theme === 'japanese' ? '#2b3f28' : '#1d4ca3')).join('');
      const extra = theme === 'japanese'
        ? `<rect x="${x - 104}" y="${y - 52}" width="208" height="22" rx="4" fill="#cfe6ee" opacity=".7"/><g>${[-80, -40, 0, 40, 80].map(o => `<ellipse cx="${x + o}" cy="${y - 41}" rx="9" ry="5" fill="${o % 80 === 0 ? '#ff8a65' : '#fff'}"/>`).join('')}</g>`
        : `<g><rect x="${x - 80}" y="${y - 58}" width="10" height="18" rx="2" fill="#ffd36b"/><rect x="${x - 60}" y="${y - 58}" width="10" height="18" rx="2" fill="#7fd3a0"/><rect x="${x + 60}" y="${y - 58}" width="24" height="20" rx="4" fill="#cfd8e3"/></g>`;
      return `${extra}<rect x="${x - 104}" y="${y - 30}" width="208" height="40" rx="8" fill="${wood}"/><rect x="${x - 104}" y="${y - 30}" width="208" height="8" rx="4" fill="${edge}"/>${seats}`;
    }
    if (k === 'low') {
      const cush = theme === 'japanese' ? '#3f5a3a' : '#b8433a';
      return `${S.map(([a, b]) => cushionSVG(a, b, cush)).join('')}<rect x="${x - 76}" y="${y - 36}" width="152" height="76" rx="8" fill="#5e3d24"/><rect x="${x - 76}" y="${y - 40}" width="152" height="74" rx="8" fill="${theme === 'japanese' ? '#4a3626' : '#8a5a34'}"/>`;
    }
    if (k === 'booth') {
      return `<rect x="${x - 104}" y="${y - 52}" width="38" height="112" rx="12" fill="#7a1f2b"/><rect x="${x + 66}" y="${y - 52}" width="38" height="112" rx="12" fill="#7a1f2b"/>
        <rect x="${x - 56}" y="${y - 34}" width="112" height="76" rx="8" fill="#3b2b22"/><rect x="${x - 56}" y="${y - 38}" width="112" height="74" rx="8" fill="#f4efe2"/>
        <circle cx="${x}" cy="${y - 2}" r="6" fill="#ffd36b"/><circle cx="${x}" cy="${y - 2}" r="16" fill="url(#pcGlowG)"/>`;
    }
    return '';
  }
  function exitSVG() {
    const [x, y] = R.exit;
    return `<g transform="translate(${x} ${y})"><rect x="-56" y="-14" width="112" height="26" rx="10" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.35)"/><text x="0" y="5" class="pc-sign2" style="font-size:13px">🚪 골목으로 나가기</text></g>`;
  }
  function roomSVG() {
    const th = room, w = R.w, h = R.h;
    let floor = '', deco = '';
    if (th === 'pocha') {
      floor = `<rect width="${w}" height="${h}" fill="url(#pcBrick)"/><rect x="0" y="420" width="${w}" height="110" fill="#1b1622"/><path d="M0 475h${w}" stroke="#3a3249" stroke-width="3" stroke-dasharray="16 14"/><rect x="300" y="530" width="120" height="${h - 530}" fill="#1b1622"/>`;
      deco = `${[[60, 470], [240, 470], [480, 470], [660, 470], [300, 640], [420, 640], [300, 830], [420, 830]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="70" fill="url(#pcGlowG)"/>`).join('')}
        <path d="M0 418 Q90 440 180 418 T360 418 T540 418 T720 418" stroke="#4a4058" stroke-width="1.5" fill="none"/>
        ${[30, 90, 150, 210, 270, 330, 390, 450, 510, 570, 630, 690].map((x, i) => `<circle class="pc-bulb" style="animation-delay:${(i % 3) * .8}s" cx="${x}" cy="${425 + Math.sin(x / 57) * 8}" r="5" fill="#ffd36b"/>`).join('')}`;
      const tents = R.tables.map(tb => `<rect x="${tb.x - 120}" y="${tb.y - (tb.k === 'bar' ? 92 : 100)}" width="240" height="${tb.k === 'bar' ? 190 : 210}" rx="14" fill="#3a2a26"/><rect x="${tb.x - 120}" y="${tb.y - (tb.k === 'bar' ? 92 : 100)}" width="240" height="26" rx="10" fill="url(#${tb.k === 'bar' ? 'pcAwnO' : 'pcAwnR'})"/>`).join('');
      floor += tents;
    } else if (th === 'korean') {
      floor = `<rect width="${w}" height="${h}" fill="url(#pcWood)"/><rect width="${w}" height="90" fill="#efe3c8"/>${[0, 1, 2, 3, 4, 5].map(i => `<g transform="translate(${20 + i * 118} 10)"><rect width="104" height="70" fill="#f8f1df" stroke="#6b4a2b" stroke-width="4"/><path d="M34 0v70M70 0v70M0 23h104M0 47h104" stroke="#6b4a2b" stroke-width="2"/></g>`).join('')}`;
      deco = `<rect x="250" y="96" width="220" height="34" rx="6" fill="#3a2a1c"/><text x="360" y="119" class="pc-sign2" style="font-size:16px;fill:#ffe9b0">오메추 밥상</text>
        <g transform="translate(40 ${h - 120})"><rect width="50" height="70" rx="6" fill="#4b6b3a"/><circle cx="25" cy="-6" r="22" fill="#6c8f4e"/></g><g transform="translate(630 ${h - 120})"><rect width="50" height="70" rx="6" fill="#4b6b3a"/><circle cx="25" cy="-6" r="22" fill="#6c8f4e"/></g>`;
    } else if (th === 'japanese') {
      floor = `<rect width="${w}" height="${h}" fill="url(#pcTatami)"/><rect width="${w}" height="100" fill="#2a2420"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${i * 90 + 6}" y="70" width="80" height="58" rx="4" fill="${i % 2 ? '#22324a' : '#2b3f5c'}"/>`).join('')}`;
      deco = `<text x="360" y="58" class="pc-sign2" style="font-size:18px;fill:#ffe9b0">오메추 스시야</text>
        ${[110, 610].map(x => `<g transform="translate(${x} 150)"><rect x="-14" y="-4" width="28" height="6" fill="#222"/><ellipse cx="0" cy="22" rx="18" ry="24" fill="#e2564b"/><path d="M-18 14h36M-18 30h36" stroke="#a8321f" stroke-width="2"/><circle cx="0" cy="22" r="40" fill="url(#pcGlowG)"/></g>`).join('')}`;
    } else if (th === 'chinese') {
      floor = `<rect width="${w}" height="${h}" fill="url(#pcCnFloor)"/><rect width="${w}" height="92" fill="#8f0b20"/><path d="M0 88h${w}" stroke="#d8b25a" stroke-width="5"/><path d="M0 76h${w}" stroke="#d8b25a" stroke-width="2" stroke-dasharray="12 8"/>`;
      deco = `<rect x="250" y="16" width="220" height="44" rx="6" fill="#d8b25a"/><text x="360" y="46" class="pc-sign2" style="font-size:18px;fill:#7a0a18">오메추 반점</text>
        ${[70, 360, 650].map(x => `<g transform="translate(${x} 120)"><path d="M0 -20v12" stroke="#d8b25a" stroke-width="2"/><ellipse cx="0" cy="12" rx="20" ry="22" fill="#e0301e"/><rect x="-10" y="-12" width="20" height="5" fill="#d8b25a"/><rect x="-10" y="31" width="20" height="5" fill="#d8b25a"/><path d="M0 36v14" stroke="#ffd36b" stroke-width="2"/><circle cx="0" cy="12" r="44" fill="url(#pcGlowG)"/></g>`).join('')}`;
    } else if (th === 'western') {
      floor = `<rect width="${w}" height="${h}" fill="url(#pcChecker)"/><rect width="${w}" height="96" fill="#2f4a3c"/><rect y="90" width="${w}" height="8" fill="#c9a45c"/>`;
      deco = `<g>${[40, 120, 200, 520, 600, 680].map((x, i) => `<rect x="${x - 6}" y="${22 + (i % 2) * 6}" width="12" height="40" rx="5" fill="${['#5b1a2a', '#2f5a3a', '#7a2a1a'][i % 3]}"/>`).join('')}</g>
        <rect x="250" y="20" width="220" height="44" rx="22" fill="#f4efe2"/><text x="360" y="49" class="pc-sign2" style="font-size:17px;fill:#2f4a3c">오메추 비스트로</text>`;
    }
    const labels = R.tables.map(tb => `<text x="${tb.x}" y="${tb.y - (tb.k === 'bar' ? 104 : tb.k === 'low' ? 92 : 112)}" class="pc-tname">${tb.n}</text>`).join('');
    return `<svg class="pc-map" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${DEFS}${floor}${deco}${R.tables.map(tb => furnitureSVG(tb, th)).join('')}${labels}${exitSVG()}</svg>`;
  }
  // 골목: 가게 앞면
  function shopRect(id) { return ROOMS[id].front; }
  function streetSVG() {
    const w = ROOMS.street.w, h = ROOMS.street.h;
    const front = (id) => {
      const r = shopRect(id), R2 = ROOMS[id], cx = r.x + r.w / 2;
      if (id === 'pocha') return `<g><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14" fill="#3a2a26"/><rect x="${r.x}" y="${r.y}" width="${r.w}" height="30" rx="12" fill="url(#pcAwnR)"/>
        <rect x="${cx - 74}" y="${r.y + 42}" width="148" height="34" rx="10" fill="#c8102e"/><text x="${cx}" y="${r.y + 65}" class="pc-sign2" style="font-size:17px">오메추 포차</text>
        <rect x="${cx - 36}" y="${r.y + 88}" width="72" height="72" rx="6" fill="#ffb15c" opacity=".85"/><path d="M${cx} ${r.y + 88}v72" stroke="#c46a1a" stroke-width="2"/>
        ${[r.x + 22, r.x + 60, r.w + r.x - 60, r.w + r.x - 22].map(x => `<circle class="pc-bulb" cx="${x}" cy="${r.y + 100}" r="5" fill="#ffd36b"/>`).join('')}
        <circle cx="${cx}" cy="${r.y + 130}" r="80" fill="url(#pcGlowG)"/><text x="${cx}" y="${r.y + r.h + 18}" class="pc-tname" style="font-size:13px">${R2.kind}</text></g>`;
      const st = { korean: ['#6b4a2b', 'url(#pcWood)', '#ffe9b0', '#3a2a1c'], japanese: ['#2a2420', '#2b3f5c', '#ffe9b0', '#14100e'], chinese: ['#8f0b20', '#661f1b', '#7a0a18', '#d8b25a'], western: ['#2f4a3c', '#3c5a4a', '#2f4a3c', '#f4efe2'] }[id];
      const left = r.x < w / 2, doorX = left ? r.x + r.w - 26 : r.x + 2;
      const deco = { korean: `<path d="M${r.x + 10} ${r.y + 10} L${cx} ${r.y - 12} L${r.x + r.w - 10} ${r.y + 10}Z" fill="#3a2a1c"/>`,
        japanese: `${[0, 1, 2, 3].map(i => `<rect x="${r.x + 14 + i * 34}" y="${r.y + 50}" width="30" height="34" rx="3" fill="${i % 2 ? '#22324a' : '#2b3f5c'}"/>`).join('')}`,
        chinese: `<ellipse cx="${r.x + 20}" cy="${r.y + 70}" rx="10" ry="12" fill="#e0301e"/><ellipse cx="${r.x + r.w - 20}" cy="${r.y + 70}" rx="10" ry="12" fill="#e0301e"/>`,
        western: `<rect x="${r.x}" y="${r.y + 46}" width="${r.w}" height="20" fill="url(#pcAwnG)"/>` }[id];
      return `<g><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="12" fill="${st[0]}"/><rect x="${r.x + 8}" y="${r.y + 48}" width="${r.w - 16}" height="${r.h - 56}" rx="8" fill="${st[1]}"/>
        ${deco}
        <rect x="${r.x + 10}" y="${r.y + 8}" width="${r.w - 20}" height="32" rx="8" fill="${st[3]}"/><text x="${cx}" y="${r.y + 30}" class="pc-sign2" style="font-size:14px;fill:${st[2]}">${R2.name}</text>
        <rect x="${r.x + 22}" y="${r.y + 96}" width="${r.w - 60}" height="44" rx="6" fill="#ffd98a" opacity=".5"/>
        <rect x="${doorX}" y="${r.y + r.h - 70}" width="24" height="64" rx="4" fill="#ffcf7a" opacity=".95"/>
        <circle cx="${doorX + 12}" cy="${r.y + r.h - 40}" r="60" fill="url(#pcGlowG)"/>
        <text x="${cx}" y="${r.y + r.h - 14}" class="pc-tname" style="font-size:13px">${R2.kind}</text></g>`;
    };
    return `<svg class="pc-map" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${DEFS}
      <rect width="${w}" height="${h}" fill="url(#pcBrick)"/>
      <rect x="168" y="230" width="84" height="${h - 230}" fill="url(#pcStone)"/><rect x="40" y="248" width="340" height="30" fill="url(#pcStone)"/>
      <path d="M210 290v${h - 330}" stroke="#3a3249" stroke-width="3" stroke-dasharray="14 12"/>
      ${[330, 520, 640, 830].map((y, i) => `<circle class="pc-bulb" style="animation-delay:${(i % 3) * .8}s" cx="${i % 2 ? 252 : 168}" cy="${y}" r="5" fill="#ffd36b"/><circle cx="${i % 2 ? 252 : 168}" cy="${y}" r="56" fill="url(#pcGlowG)"/>`).join('')}
      ${SHOPS.map(front).join('')}
      <g transform="translate(210 ${h - 22})"><rect x="-78" y="-18" width="156" height="32" rx="10" fill="#c8102e"/><text x="0" y="5" class="pc-sign2">오메추 먹자골목</text></g>
    </svg>`;
  }

  // ══════════ 화면 ══════════
  function ensureShell(root) {
    if (document.getElementById('pc-world') && root.dataset.room === room) return;
    root.dataset.room = room;
    root.innerHTML = `
      <div class="pc-scene">
        <div class="pc-top">
          <div style="display:flex;align-items:center;min-width:0"><button class="pc-back" aria-label="뒤로 가기" onclick="Pocha.back()">‹</button><span class="pc-live" id="pc-live"></span></div>
          <div style="flex-shrink:0"><button class="pc-iconbtn" id="pc-rainbtn" aria-label="빗소리 켜고 끄기" onclick="Pocha.toggleRain()"></button><button class="pc-iconbtn" onclick="Pocha.openDress()">👕 꾸미기</button></div>
        </div>
        <div class="pc-viewwrap"><div class="pc-view" id="pc-view">
          <div class="pc-sizer" id="pc-sizer"><div class="pc-world" id="pc-world" style="width:${R.w}px;height:${R.h}px">${room === 'street' ? streetSVG() : roomSVG()}<div id="pc-doors"></div><div id="pc-dishes"></div><div id="pc-people"></div></div></div>
        </div><div class="pc-rain"></div></div>
        <div class="pc-hint" id="pc-hint"></div>
      </div>
      <div class="pc-body" id="pc-panel"></div>`;
    const world = document.getElementById('pc-world');
    let down = null;
    world.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    world.addEventListener('click', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return; if (e.target.closest('.pc-person:not(.me)')) return; onWorldTap(e); });
    const view = document.getElementById('pc-view');
    K = room === 'street' ? Math.min(1, (view.clientWidth || R.w) / R.w) : 1;
    world.style.transform = K < 1 ? `scale(${K})` : '';
    const sizer = document.getElementById('pc-sizer'); sizer.style.width = R.w * K + 'px'; sizer.style.height = R.h * K + 'px';
    view.addEventListener('touchstart', () => { follow = false; }, { passive: true });
    view.addEventListener('wheel', () => { follow = false; }, { passive: true });
    centerOn(pos.x, pos.y, false);
  }
  function centerOn(x, y, smooth) {
    const v = document.getElementById('pc-view'); if (!v) return;
    v.scrollTo({ left: x * K - v.clientWidth / 2, top: y * K - v.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
  }
  function personHTML(p, sid) {
    const b = bubbles[sid]; const showB = b && b.until > Date.now();
    return `${showB ? `<div class="pc-bubble">${esc(b.text)}</div>` : ''}<div class="pc-body2">${avatarSVG(p, 46)}</div><div class="pc-name">${esc(p.nick)}${sid === SID ? ' (나)' : ''}</div>`;
  }
  function placeEl(el, x, y, seated) { el.style.transform = `translate(${x - 30}px, ${y - (seated ? 42 : 52)}px)`; el.style.zIndex = String(Math.round(y)); }
  function drawMe(walking) {
    const el = document.getElementById('pc-p-' + SID); if (!el) return;
    el.classList.toggle('walking', !!walking);
    const b2 = el.querySelector('.pc-body2'); if (b2) b2.style.transform = `scaleX(${me.face_dir || 1})`;
    const [x, y] = myTable !== null ? seatXY(myTable, mySeat) : [pos.x, pos.y];
    placeEl(el, x, y, myTable !== null);
    if (follow) { const v = document.getElementById('pc-view'); if (v) { const cx = x * K - v.clientWidth / 2, cy = y * K - v.clientHeight / 2; v.scrollLeft += (cx - v.scrollLeft) * 0.12; v.scrollTop += (cy - v.scrollTop) * 0.12; } }
  }
  function roomCounts() {
    const c = {}; Object.values(lobbyState).forEach(p => { c[p.room] = (c[p.room] || 0) + 1; }); return c;
  }
  function updateWorld() {
    const layer = document.getElementById('pc-people'); if (!layer) return;
    const people = {};
    Object.entries(state).forEach(([sid, p]) => { if (room !== 'street' || p.room === 'street') people[sid] = p; });
    people[SID] = { nick: nick(), color: me.color, acc: me.acc, face: me.face, table: myTable, seat: mySeat, x: pos.x, y: pos.y };
    const seen = new Set();
    Object.entries(people).forEach(([sid, p]) => {
      seen.add(sid);
      let el = document.getElementById('pc-p-' + sid);
      if (!el) { el = document.createElement('div'); el.id = 'pc-p-' + sid; el.className = 'pc-person' + (sid === SID ? ' me' : ''); if (sid !== SID) el.addEventListener('click', () => mute(sid)); layer.appendChild(el); }
      el.innerHTML = personHTML(p, sid);
      const seated = p.table !== null && p.table !== undefined && p.seat !== null && p.seat !== undefined && room !== 'street';
      el.classList.toggle('seated', seated);
      if (sid === SID) { drawMe(!!target); return; }
      const [x, y] = seated ? seatXY(p.table, p.seat) : [p.x, p.y];
      const prev = lastDrawn[sid];
      if (prev && (prev.x !== x || prev.y !== y)) {
        const dur = Math.min(6, Math.hypot(x - prev.x, y - prev.y) / SPEED);
        el.style.transition = `transform ${dur}s linear`; el.classList.add('walking'); clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('walking'), dur * 1000);
        el.querySelector('.pc-body2').style.transform = `scaleX(${x < prev.x ? -1 : 1})`;
      } else if (!prev) el.style.transition = 'none';
      placeEl(el, x, y, seated); lastDrawn[sid] = { x, y };
    });
    [...layer.children].forEach(el => { const sid = el.id.slice(5); if (!seen.has(sid)) { el.remove(); delete lastDrawn[sid]; } });
    // 골목: 가게 문 위에 지금 인원
    const dl0 = document.getElementById('pc-doors');
    if (dl0) dl0.innerHTML = room !== 'street' ? '' : (() => { const c = roomCounts(); return SHOPS.map(id => { const r = shopRect(id); return `<div class="pc-doorcount" style="left:${r.x + r.w / 2}px;top:${r.y - 14}px">${c[id] ? `🔥 ${c[id]}명` : '비어 있어요'}</div>`; }).join(''); })();
    // 투표로 정한 메뉴를 테이블 위에
    const dl = document.getElementById('pc-dishes');
    if (dl) dl.innerHTML = room === 'street' ? '' : Object.entries(dishes).map(([t, d]) => {
      const img = typeof getMenuImg === 'function' ? getMenuImg(d) : null; const tb = R.tables[+t]; if (!tb) return '';
      return img ? `<img class="pc-dish2" src="${img}" alt="" onerror="this.remove()" style="left:${tb.x - 26}px;top:${tb.y + (tb.k === 'bar' ? -40 : -14)}px">` : '';
    }).join('');
  }
  function renderPanel() {
    const panel = document.getElementById('pc-panel'); if (!panel) return;
    const live = document.getElementById('pc-live');
    const lobbyN = Object.keys(lobbyState).length;
    if (live) live.innerHTML = room === 'street'
      ? (lobby ? `🏮 골목에 <b>${lobbyN}</b>명` : '연결 중...')
      : (joined ? `${esc(R.kind)} <b>${Object.keys(state).length}</b>명` : '연결 중...');
    const rb = document.getElementById('pc-rainbtn'); if (rb) rb.textContent = rainCtx ? '🔇' : '🌧️';
    document.querySelector('.pc-scene')?.classList.toggle('raining', !!rainCtx);
    const hint = document.getElementById('pc-hint');
    if (hint) hint.textContent = room === 'street' ? '가게를 누르면 걸어가서 들어가요'
      : myTable !== null ? `${R.tables[myTable].n}에 앉아 있어요 · 다른 곳을 누르면 일어나서 걸어가요`
      : '빈 곳을 누르면 걸어가고, 빈자리를 누르면 앉아요';
    let body = '';
    if (room === 'street') {
      const c = roomCounts();
      body = `<div class="pc-card"><div style="font-weight:700;margin-bottom:10px">어디로 들어갈까요?</div><div class="pc-tables">
        ${SHOPS.map(id => `<div class="pc-trow"><div><div style="font-size:13px;font-weight:700">${ROOMS[id].name} <span style="color:var(--muted);font-weight:400">${ROOMS[id].kind}</span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${c[id] ? `지금 ${c[id]}명 있어요` : '아직 아무도 없어요'}</div></div>
          <button onclick="Pocha.go('${id}')">들어가기</button></div>`).join('')}
        </div></div>
        <div style="font-size:11px;color:var(--muted);text-align:center;line-height:1.6">대화는 저장되지 않아요. 같은 테이블에 앉은 사람끼리만 보여요.<br>불편한 손님은 캐릭터를 눌러 말을 숨길 수 있어요.</div>`;
    } else if (myTable === null) {
      body = `<div class="pc-card"><div style="font-weight:700;margin-bottom:10px">${esc(R.name)} 자리 현황</div><div class="pc-tables">
        ${R.tables.map((tb, t) => { const ps = seatedAt(t).filter(p => p.sid !== SID); const full = ps.length >= SEATS;
          return `<div class="pc-trow"><div><div style="font-size:13px;font-weight:700">${tb.n} <span style="color:var(--muted);font-weight:400">${ps.length}/${SEATS}</span></div>
            <div class="who">${ps.map(p => avatarSVG(p, 28)).join('') || '<span style="font-size:11px;color:var(--muted)">아직 아무도 없어요</span>'}</div></div>
            <button ${full || !joined ? 'disabled' : ''} onclick="Pocha.sit(${t})">${full ? '만석' : '가서 앉기'}</button></div>`; }).join('')}
        </div><button class="cta-btn crave-btn" style="margin-top:12px" ${joined ? '' : 'disabled'} onclick="Pocha.sitAny()">🪑 빈자리 찾아가기</button>
        <button class="pc-leave" onclick="Pocha.leave()">🚪 골목으로 나가기</button></div>`;
    } else {
      const v = votes[myTable];
      const voteHTML = v ? `<div class="pc-card"><div style="font-weight:700">🍽️ ${R.vote} 투표 ${v.done ? `— <span style="color:var(--orange)">${esc(v.winner)}</span> 당첨!` : `<span style="font-size:12px;color:var(--muted)">(${Math.max(0, Math.ceil((v.until - Date.now()) / 1000))}초 남음)</span>`}</div>
        <div class="pc-vote">${v.opts.map((o, i) => { const n = Object.values(v.picks).filter(x => x === i).length; const img = typeof getMenuImg === 'function' ? getMenuImg(o) : null;
          return `<button class="${v.picks[SID] === i ? 'mine' : ''}" ${v.done || v.picks[SID] !== undefined ? 'disabled' : ''} onclick="Pocha.vote(${i})">${img ? `<img src="${img}" alt="">` : ''}<div>${esc(o)}</div><div class="cnt">${n}표</div></button>`; }).join('')}</div>
        ${v.done ? `<button class="pc-iconbtn" style="width:100%;margin:10px 0 0;background:var(--surface);color:var(--text);border-color:var(--border);padding:9px" onclick="Pocha.findWinner()">📍 ${esc(v.winner)} 근처에서 찾기</button>` : ''}</div>` : '';
      body = `<div class="pc-card"><div class="pc-actions">
          <button class="hot" onclick="Pocha.cheers()">🍻 짠!</button>
          <button onclick="Pocha.startVote()">🍽️ ${R.vote} 고르기</button>
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
    updateWorld(); renderPanel();
  }

  // 투표 남은 시간 표시 갱신
  setInterval(() => { if (myTable !== null && votes[myTable] && !votes[myTable].done) render(); }, 1000);

  window.Pocha = { findWinner,
    open(startRoom) { connectLobby(); trackLobby(); if (startRoom && ROOMS[startRoom] && startRoom !== room) enterRoom(startRoom); else { connectRoom(); render(); } },
    // 다른 화면으로 나가면 골목으로 돌아가고, 인원 집계에서도 빠진다
    close() { if (room !== 'street') enterRoom('street'); if (lobby) { try { lobby.untrack(); } catch (e) {} } },
    back() { if (room !== 'street') enterRoom('street'); else showPage('fun'); },
    go(id) { if (room !== 'street') return; const d = ROOMS[id]?.door; if (!d) return; pendingSeat = null; pendingDoor = id; walkTo(d[0], d[1]); },
    leave, sit, sitAny, stand, goSit, walkTo, send, cheers, startVote, vote, mute, toggleRain, openDress, closeDress, setLook, render,
    avatarSVG, room: () => room, count: () => Object.keys(lobbyState).length,
  };
})();
