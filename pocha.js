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
  // bg: Canva 크레파스 배경. 테이블의 s는 그림 속 의자 위치(테이블 중심 기준), ly는 이름표, by는 인원 배지 위치
  const ROOMS = {
    street: { name: '오메추 먹자골목', w: 420, h: 832, ch: 'omechu-street-v1', spawn: [215, 790], bg: '/images/pocha/street.jpg', tables: [] },
    pocha: { name: '오메추 포차', kind: '포장마차', w: 720, h: 900, ch: 'omechu-pocha-v1', spawn: [200, 770], exit: [180, 830], bg: '/images/pocha/pocha.jpg', lights: [[50, 115, 110], [650, 60, 100], [700, 170, 100], [15, 330, 100]],
      tags: ['🍺 술안주', '🌙 야식'], vote: '안주', door: [215, 172], front: { x: 120, y: 0, w: 190, h: 150 },
      tables: [
        { x: 200, y: 430, k: 'round', n: '1번 테이블', s: [[-70, -45], [92, 2], [-75, 68], [32, 92]], by: 125 },
        { x: 550, y: 415, k: 'round', n: '2번 테이블', s: [[-100, 18], [92, 18], [-50, 98], [45, 98]], by: 130 },
        { x: 410, y: 650, k: 'round', n: '3번 테이블', s: [[-110, 32], [105, 12], [-50, 122], [50, 122]], by: 150 },
        { x: 370, y: 200, k: 'bar', n: '이모네 바', s: [[-145, 60], [-50, 60], [40, 60], [145, 60]], by: 95 }] },
    korean: { name: '오메추 밥상', kind: '한식집', w: 720, h: 900, ch: 'omechu-room-korean-v1', spawn: [360, 790], exit: [320, 850], bg: '/images/pocha/korean.jpg', lights: [[695, 130, 110], [360, 300, 220]],
      tags: ['🍱 한식'], vote: '메뉴', door: [160, 322], front: { x: 0, y: 190, w: 150, h: 230 },
      tables: [
        { x: 237, y: 335, k: 'low', n: '1번 상', s: [[3, -82], [-95, 12], [97, 12], [-2, 102]], by: 130 },
        { x: 505, y: 335, k: 'low', n: '2번 상', s: [[0, -82], [-93, 12], [93, 12], [3, 102]], by: 130 },
        { x: 222, y: 635, k: 'low', n: '3번 상', s: [[5, -95], [-105, 5], [110, 5], [0, 105]], by: 135 },
        { x: 515, y: 635, k: 'low', n: '4번 상', s: [[-8, -95], [-105, 5], [100, 5], [0, 105]], by: 135 }] },
    japanese: { name: '오메추 스시야', kind: '일식집', w: 720, h: 900, ch: 'omechu-room-japanese-v1', spawn: [360, 790], exit: [360, 860], bg: '/images/pocha/japanese.jpg', lights: [[55, 75, 120], [668, 85, 120], [50, 815, 110], [668, 820, 110]],
      tags: ['🍣 일식'], vote: '메뉴', door: [276, 332], front: { x: 290, y: 150, w: 130, h: 270 },
      tables: [
        { x: 365, y: 250, k: 'bar', n: '스시 카운터', s: [[-150, 50], [-50, 50], [50, 50], [155, 50]], by: 95 },
        { x: 165, y: 580, k: 'low', n: '1번 자리', s: [[-30, -72], [40, -72], [-35, 80], [35, 80]], by: 120 },
        { x: 360, y: 580, k: 'low', n: '2번 자리', s: [[-35, -72], [35, -72], [-35, 80], [35, 80]], by: 120 },
        { x: 555, y: 580, k: 'low', n: '3번 자리', s: [[-35, -72], [35, -72], [-35, 80], [35, 80]], by: 120 }] },
    chinese: { name: '오메추 반점', kind: '중식집', w: 720, h: 900, ch: 'omechu-room-chinese-v1', spawn: [360, 800], exit: [360, 860], bg: '/images/pocha/chinese.jpg', lights: [[95, 90, 170], [610, 35, 140], [30, 540, 120], [700, 430, 110], [150, 810, 90]],
      tags: ['🥢 중식'], vote: '메뉴', door: [152, 622], front: { x: 0, y: 470, w: 140, h: 280 },
      tables: [
        { x: 245, y: 325, k: 'round', n: '1번 원탁', s: [[-115, -10], [115, -10], [-75, 92], [75, 92]], by: 140 },
        { x: 535, y: 325, k: 'round', n: '2번 원탁', s: [[-115, -10], [115, -10], [-75, 92], [75, 92]], by: 140 },
        { x: 205, y: 650, k: 'round', n: '3번 원탁', s: [[-115, -10], [115, -10], [-75, 92], [75, 92]], by: 135 },
        { x: 525, y: 660, k: 'round', n: '4번 원탁', s: [[-115, -10], [115, -10], [-75, 92], [75, 92]], by: 125 }] },
    western: { name: '오메추 비스트로', kind: '양식집', w: 720, h: 900, ch: 'omechu-room-western-v1', spawn: [360, 760], exit: [360, 845], bg: '/images/pocha/western.jpg', lights: [[240, 15, 80], [585, 15, 80], [20, 185, 80], [20, 780, 90], [630, 825, 90], [205, 300, 70], [560, 300, 70], [190, 600, 70], [565, 600, 70]],
      tags: ['🍝 양식'], vote: '메뉴', door: [280, 622], front: { x: 295, y: 480, w: 125, h: 250 },
      tables: [
        { x: 200, y: 305, k: 'booth', n: '1번 부스', s: [[-112, -40], [-112, 45], [97, -40], [97, 45]], by: 100 },
        { x: 555, y: 305, k: 'booth', n: '2번 부스', s: [[-97, -40], [-97, 45], [110, -40], [110, 45]], by: 100 },
        { x: 190, y: 600, k: 'booth', n: '3번 부스', s: [[-112, -40], [-112, 45], [100, -40], [100, 45]], by: 100 },
        { x: 560, y: 600, k: 'booth', n: '4번 부스', s: [[-100, -40], [-100, 45], [112, -40], [112, 45]], by: 100 }] },
  };
  const BUILD = 'v11.12';   // 화면 아래에 보여서, 새 버전이 적용됐는지 바로 알 수 있음
  const SHOPS = ['pocha', 'korean', 'japanese', 'chinese', 'western'];

  let room = 'street', R = ROOMS.street;
  let lobby = null, ch = null, joined = false, myTable = null, mySeat = null, seatAt = 0;
  let state = {}, lobbyState = {};
  let logs = {}, votes = {}, dishes = {}, bubbles = {};
  let muted = new Set(), lastSend = 0, rainCtx = null, nearLog = [], hallLog = [], lastEmote = 0, chatTab = 'hall', unread = {}, pendingQuick = false;
  const EMOTES = ['👋', '😋', '😂', '🔥', '👍', '🍻'];
  const NEAR = 260;   // 이 거리 안에 있는 사람의 말만 보임
  let pos = { x: R.spawn[0], y: R.spawn[1] }, target = null, pendingSeat = null, pendingDoor = null, walkRAF = 0, follow = false;
  let lastDrawn = {}, K = 1, PS = 1, isOpen = false;   // PS: 화면에 맞춰 줄인 방에서 캐릭터를 다시 키우는 배율
  let _unused_k;   // K: 골목을 폰 폭에 맞추는 배율

  const look = () => {
    try { return Object.assign({ kind: 'onigiri', color: COLORS[Math.floor(Math.random() * COLORS.length)], acc: 'none', face: 'smile' }, JSON.parse(localStorage.getItem('wmjPochaLook') || '{}')); }
    catch (e) { return { kind: 'onigiri', color: COLORS[0], acc: 'none', face: 'smile' }; }
  };
  let me = look();
  const esc = (v) => (typeof escHtml === 'function' ? escHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, ''));
  const nick = () => (typeof getMyNick === 'function' ? getMyNick() : '손님');
  const T = () => R.tables.length;
  const seatXY = (t, s) => { const tb = R.tables[t], o = (tb.s || SEAT_KIND[tb.k])[s]; return [tb.x + o[0], tb.y + o[1]]; };

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
      kind: window.FoodChars && FoodChars.IDS.includes(p.kind) ? p.kind : 'onigiri',
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

  // ── 캐릭터 그림: 음식 친구들 16종 (pocha-chars.js, 크레파스 그림체) ──
  function avatarSVG(l, size = 64) {
    if (!window.FoodChars) return '';
    const src = FoodChars.url(l.kind || 'onigiri', l.color || COLORS[0], l.acc || 'none', l.face || 'smile', size <= 60);
    return `<img class="pc-ava" width="${size}" height="${size}" src="${src}" alt="" draggable="false">`;
  }

  // ── 접속: 골목 채널(어느 가게에 있는지) ──
  function connectLobby() {
    if (lobby || typeof sb === 'undefined') return;
    lobby = sb.channel(ROOMS.street.ch, { config: { presence: { key: SID } } });
    lobby.on('presence', { event: 'sync' }, () => {
      const raw = lobby.presenceState(); lobbyState = {};
      Object.entries(raw).forEach(([k, arr]) => { const p = okSid(k) && arr && safePresence(arr[0], ROOMS.street.w, ROOMS.street.h); if (p) lobbyState[k] = p; });
      applyMoves(lobbyState);
      if (room === 'street') { state = lobbyState; joined = true; }
      render();
    });
    lobby.on('broadcast', { event: 'move' }, ({ payload: m }) => { if (room === 'street') onMove(m, ROOMS.street.w, ROOMS.street.h); });
    lobby.on('broadcast', { event: 'emote' }, ({ payload: m }) => { if (room === 'street') onEmote(m); });
    lobby.on('broadcast', { event: 'say' }, ({ payload: m }) => { if (room === 'street') onSay(m); });
    lobby.on('broadcast', { event: 'hall' }, ({ payload: m }) => { if (room === 'street') onHall(m); });
    lobby.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { if (room === 'street') joined = true; await trackLobby(); render(); }
    });
  }
  function trackLobby() {
    if (!lobby) return;
    const dest = target || pos;
    return lobby.track({ nick: nick(), kind: me.kind, color: me.color, acc: me.acc, face: me.face, room, x: Math.round(dest.x), y: Math.round(dest.y) });
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
      applyMoves(state); resolveSeatConflict(); render();
    });
    ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const p = okSid(key) && newPresences && safePresence(newPresences[0], R.w, R.h);
      if (p && myTable !== null && p.table === myTable && key !== SID) sys(myTable, `${esc(p.nick)}님이 자리에 앉았어요`);
    });
    ch.on('broadcast', { event: 'move' }, ({ payload: m }) => { if (room === my) onMove(m, R.w, R.h); });
    ch.on('broadcast', { event: 'emote' }, ({ payload: m }) => { if (room === my) onEmote(m); });
    ch.on('broadcast', { event: 'say' }, ({ payload: m }) => { if (room === my) onSay(m); });
    ch.on('broadcast', { event: 'hall' }, ({ payload: m }) => { if (room === my) onHall(m); });
    ch.on('broadcast', { event: 'chat' }, ({ payload: m }) => {
      if (!m || !okSid(m.sid) || !okTable(m.table) || muted.has(m.sid)) return;
      m.nick = String(m.nick ?? '손님').slice(0, 12);
      const t = clean(m.text);
      logs[m.table] = (logs[m.table] || []).concat([{ nick: m.nick, text: t, sid: m.sid }]).slice(-40);
      if (m.table === myTable && chatTab !== 'table' && m.sid !== SID) unread.table = (unread.table || 0) + 1;
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
      if (status === 'SUBSCRIBED') { joined = true; await track(); render(); if (pendingQuick) setTimeout(() => { if (room === my && pendingQuick) { pendingQuick = false; quickSit(); } }, 700); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { joined = false; render(); }
    });
  }
  function leaveRoomChannel() { if (ch) { try { sb.removeChannel(ch); } catch (e) {} ch = null; } }
  function track() {
    trackLobby();
    if (!ch || room === 'street') return;
    const dest = target || pos;
    return ch.track({ nick: nick(), kind: me.kind, color: me.color, acc: me.acc, face: me.face, table: myTable, seat: mySeat, at: seatAt, x: Math.round(dest.x), y: Math.round(dest.y) });
  }

  // ── 걷는 위치는 메시지(broadcast)로, 위치 공유(presence)는 상태가 바뀔 때만 ──
  // 무료 요금제 한도: 위치 공유 초당 20건, 메시지 초당 100건 → 걷기는 메시지로 보내 여유를 둔다
  let moveTimer = 0, lastMoveAt = 0, trackTimer = 0, moves = {};   // moves: 최근 받은 걷기 목적지(위치 공유가 늦게 와도 되돌아가지 않게)
  function sendMove() {
    const c = room === 'street' ? lobby : ch; if (!c) return;
    const go = () => { moveTimer = 0; lastMoveAt = Date.now(); const d = target || pos;
      c.send({ type: 'broadcast', event: 'move', payload: { sid: SID, x: Math.round(d.x), y: Math.round(d.y) } }); };
    const wait = 300 - (Date.now() - lastMoveAt);
    if (wait <= 0) go(); else if (!moveTimer) moveTimer = setTimeout(go, wait);   // 너무 자주 누르면 마지막 것만
  }
  function applyMoves(st) { const now = Date.now(); Object.entries(st).forEach(([k, p]) => { const mv = moves[k]; if (mv && now - mv.t < 15000 && (p.table === null || p.table === undefined)) { p.x = mv.x; p.y = mv.y; } }); }
  function trackSoon() { clearTimeout(trackTimer); trackTimer = setTimeout(track, 3000); }   // 멈춘 뒤 3초 후 한 번만
  function onMove(m, w, h) {
    if (!m || !okSid(m.sid) || m.sid === SID || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const p = state[m.sid]; if (!p) return;
    if (room === 'street' && p.room !== 'street') return;
    if (p.table !== null && p.table !== undefined && room !== 'street') { p.table = null; p.seat = null; }
    p.x = Math.max(0, Math.min(w, Math.round(m.x))); p.y = Math.max(0, Math.min(h, Math.round(m.y)));
    moves[m.sid] = { x: p.x, y: p.y, t: Date.now() };
    updateWorld();
  }

  // ── 근처 말하기 · 감정 표현 (걷는 중에도 가능) ──
  const curChan = () => (room === 'street' ? lobby : ch);
  function posOf(sid) {
    if (sid === SID) return myTable !== null && room !== 'street' ? seatXY(myTable, mySeat) : [pos.x, pos.y];
    const p = state[sid]; if (!p) return null;
    if (room !== 'street' && p.table !== null && p.table !== undefined && p.seat !== null) return seatXY(p.table, p.seat);
    return [p.x, p.y];
  }
  function isNear(sid) { const a = posOf(sid), b = posOf(SID); return a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) <= NEAR; }
  function showBubble(sid, text, ms, emote) { bubbles[sid] = { text, until: Date.now() + ms, emote }; updateWorld(); setTimeout(updateWorld, ms + 100); }
  function emote(e) {
    const c = curChan(); if (!c || !EMOTES.includes(e)) return;
    if (Date.now() - lastEmote < 800) return; lastEmote = Date.now();
    c.send({ type: 'broadcast', event: 'emote', payload: { sid: SID, e } });
    showBubble(SID, e, 2500, true);
  }
  function say() {
    const el = document.getElementById('pc-msg'); const c = curChan(); if (!el || !c) return;
    const text = clean(el.value.trim()); if (!text) return;
    if (Date.now() - lastSend < 1500) { showToast('조금만 천천히 말해 주세요 🙂'); return; }
    lastSend = Date.now(); el.value = '';
    c.send({ type: 'broadcast', event: 'say', payload: { sid: SID, nick: nick(), text } });
    nearLog = nearLog.concat([{ nick: nick(), text, me: true }]).slice(-20);
    showBubble(SID, text, 5000); renderPanel();
  }
  // 가게(골목) 전체 채팅
  function hallSend() {
    const el = document.getElementById('pc-msg'); const c = curChan(); if (!el || !c) return;
    const text = clean(el.value.trim()); if (!text) return;
    if (Date.now() - lastSend < 1500) { showToast('조금만 천천히 말해 주세요 🙂'); return; }
    lastSend = Date.now(); el.value = '';
    c.send({ type: 'broadcast', event: 'hall', payload: { sid: SID, nick: nick(), text } });
    hallLog = hallLog.concat([{ nick: nick(), text, me: true }]).slice(-40);
    showBubble(SID, text, 4000); renderPanel();
  }
  function onHall(m) {
    if (!m || !okSid(m.sid) || m.sid === SID || muted.has(m.sid)) return;
    if (room === 'street' && state[m.sid] && state[m.sid].room !== 'street') return;
    const text = clean(m.text), who = String(m.nick ?? '손님').slice(0, 12);
    hallLog = hallLog.concat([{ nick: who, text, sid: m.sid }]).slice(-40);
    if (chatTab !== 'hall') unread.hall = (unread.hall || 0) + 1;
    if (state[m.sid]) showBubble(m.sid, text, 4000); else renderPanel();
    renderPanel();
  }
  function sendTab() { if (chatTab === 'table') send(); else if (chatTab === 'near') say(); else hallSend(); }
  function setTab(t) { chatTab = t; unread[t] = 0; renderPanel(); const i = document.getElementById('pc-msg'); if (i) i.focus(); }
  // 바로 앉기: 걷지 않고 빈자리에 바로 앉음
  function bestTable() {
    let best = null, bestN = -1;
    for (let t = 0; t < T(); t++) { const n = seatedAt(t).filter(p => p.sid !== SID).length; if (n < SEATS && n > bestN) { best = t; bestN = n; } }
    return best;
  }
  async function quickSit(tPick) {
    if (room === 'street') return;
    if (!joined) { pendingQuick = true; return; }
    const t = tPick ?? bestTable(); if (t === null) { showToast('지금은 모든 자리가 꽉 찼어요 😅'); return; }
    const s2 = freeSeat(t); if (s2 === null) { showToast('그 테이블은 자리가 꽉 찼어요 😅'); return; }
    target = null; pendingSeat = null; pendingDoor = null;
    const [x, y] = seatXY(t, s2); pos = { x, y }; chatTab = 'table';
    await sitNow(t, s2); centerOn(x, y, true);
  }
  function quickGo(id) { if (!ROOMS[id] || id === 'street') return; pendingQuick = true; if (room === id) { pendingQuick = false; quickSit(); } else enterRoom(id); }

  function onEmote(m) {
    if (!m || !okSid(m.sid) || m.sid === SID || muted.has(m.sid) || !EMOTES.includes(m.e) || !state[m.sid]) return;
    showBubble(m.sid, m.e, 2500, true);
  }
  function onSay(m) {
    if (!m || !okSid(m.sid) || m.sid === SID || muted.has(m.sid) || !state[m.sid]) return;
    if (room === 'street' && state[m.sid].room !== 'street') return;
    if (!isNear(m.sid)) return;                         // 멀리 있는 사람의 말은 안 보임
    const text = clean(m.text), who = String(m.nick ?? '손님').slice(0, 12);
    nearLog = nearLog.concat([{ nick: who, text, sid: m.sid }]).slice(-20);
    if (chatTab !== 'near') unread.near = (unread.near || 0) + 1;
    showBubble(m.sid, text, 5000); renderPanel();
  }

  // ── 가게 드나들기 ──
  function enterRoom(id, from) {
    if (!ROOMS[id] || id === room) return;
    leaveRoomChannel();
    const prev = room;
    room = id; R = ROOMS[id];
    myTable = null; mySeat = null; target = null; pendingSeat = null; pendingDoor = null;
    logs = {}; votes = {}; dishes = {}; bubbles = {}; lastDrawn = {}; moves = {}; nearLog = []; hallLog = []; unread = {}; chatTab = 'hall';
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
    myTable = t; mySeat = s; seatAt = Date.now(); chatTab = 'table'; unread.table = 0;
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
    target = { x, y }; follow = true; sendMove(); render();
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
        else { trackSoon(); render(); }
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
    // 테이블(의자·이름표 포함) 어디를 눌러도 바로 앉기 — 누른 곳에서 가장 가까운 빈자리
    for (let t = 0; t < T(); t++) {
      const tb = R.tables[t], dx = Math.abs(x - tb.x), dy = y - tb.y, wide = tb.k === 'bar' ? 215 : 150;
      if (dx > wide || dy < -125 || dy > (tb.by ?? 80) + 30) continue;
      if (t === myTable) return;
      let bs = null, bd = 1e9;
      for (let s2 = 0; s2 < SEATS; s2++) { if (seatTaken(t, s2)) continue; const [sx, sy] = seatXY(t, s2), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; bs = s2; } }
      if (bs === null) { showToast('그 테이블은 자리가 꽉 찼어요 😅'); return; }
      if (!joined) { showToast('가게에 연결하는 중이에요. 잠시만요!'); return; }
      const [qx, qy] = seatXY(t, bs); target = null; pendingSeat = null; pendingDoor = null; pos = { x: qx, y: qy };
      sitNow(t, bs); return;
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

  // ── 빗소리 (직접 합성한 ASMR 빗소리) + 비 내리는 화면 ──
  // 골목: 또렷한 빗소리와 빗줄기 / 포차: 천막에 톡톡 떨어지는 소리 / 가게 안: 창밖에서 들리는 먹먹한 빗소리
  let rainNodes = null, rainTimer = null, rainRaf = null;
  const rainProfile = () => room === 'street' ? { cut: 9000, drops: 5, vol: 0.9 } : room === 'pocha' ? { cut: 4200, drops: 11, vol: 0.8 } : { cut: 1100, drops: 1.5, vol: 0.75 };
  function rainTune() {
    if (!rainCtx || !rainNodes) return;
    const p = rainProfile(), t = rainCtx.currentTime;
    rainNodes.master.frequency.setTargetAtTime(p.cut, t, 0.6);
    rainNodes.out.gain.setTargetAtTime(p.vol, t, 0.8);
  }
  function rainDrop() {
    if (!rainCtx || !rainNodes) return;
    const ctx = rainCtx, t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = rainNodes.white;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = (room === 'pocha' ? 900 : 1800) + Math.random() * 2600; f.Q.value = 5 + Math.random() * 6;
    const g = ctx.createGain(), peak = (room === 'street' ? 0.05 : room === 'pocha' ? 0.11 : 0.04) * (0.4 + Math.random());
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.09);
    let last = g; if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = Math.random() * 1.6 - 0.8; g.connect(pn); last = pn; }
    src.connect(f).connect(g); last.connect(rainNodes.master);
    src.start(t, Math.random() * 3, 0.2);
  }
  function rainStop() {
    clearTimeout(rainTimer); rainTimer = null; cancelAnimationFrame(rainRaf); rainRaf = null;
    const ctx = rainCtx; rainCtx = null;
    if (ctx && rainNodes) { try { rainNodes.out.gain.setTargetAtTime(0, ctx.currentTime, 0.25); } catch (e) {} setTimeout(() => ctx.close().catch(() => {}), 900); }
    rainNodes = null;
  }
  function toggleRain() {
    if (rainCtx) { rainStop(); render(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const sr = ctx.sampleRate, len = sr * 4;
      const white = ctx.createBuffer(2, len, sr), brown = ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) { const w = white.getChannelData(c), b = brown.getChannelData(c); let last = 0;
        for (let i = 0; i < len; i++) { const n = Math.random() * 2 - 1; w[i] = n; last = (last + 0.02 * n) / 1.02; b[i] = last * 3.5; } }
      const loop = (buf) => { const s2 = ctx.createBufferSource(); s2.buffer = buf; s2.loop = true; s2.start(0, Math.random() * 3); return s2; };
      const master = ctx.createBiquadFilter(); master.type = 'lowpass'; master.Q.value = 0.3;
      const out = ctx.createGain(); out.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      master.connect(out).connect(comp).connect(ctx.destination);
      const layer = (buf, type, freq, q, gain) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = gain; loop(buf).connect(f).connect(g).connect(master); return g; };
      layer(white, 'highpass', 2200, 0.5, 0.055);                 // 쏴— 하는 가는 빗줄기
      const body = layer(white, 'bandpass', 620, 0.5, 0.20);      // 바닥에 떨어지는 굵은 비
      layer(brown, 'lowpass', 160, 0.7, 0.55);                    // 멀리서 깔리는 낮은 울림
      // 빗발이 아주 천천히 세졌다 약해졌다
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.06; lg.gain.value = 0.045; lfo.connect(lg).connect(body.gain); lfo.start();
      rainCtx = ctx; rainNodes = { master, out, white };
      const p = rainProfile(); master.frequency.value = p.cut; out.gain.setTargetAtTime(p.vol, ctx.currentTime, 0.9);
      const tick = () => { if (!rainCtx) return; rainDrop(); if (Math.random() < 0.3) rainDrop(); rainTimer = setTimeout(tick, 1000 / rainProfile().drops * (0.3 + Math.random() * 1.4)); };
      tick(); render(); rainDraw();
    } catch (e) { showToast('이 기기에서는 소리를 낼 수 없어요'); }
  }
  // 화면: 골목엔 빗줄기와 물 튀김, 포차엔 천막 가장자리로 떨어지는 빗방울, 가게 안은 창가만 살짝
  let rainDropsFx = [], rainSplash = [];
  function rainDraw() {
    cancelAnimationFrame(rainRaf);
    const cv = document.getElementById('pc-raincv'); if (!cv || !rainCtx) { rainRaf = null; return; }
    const wrap = cv.parentElement, W = wrap.clientWidth, H = wrap.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); rainDropsFx = []; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const kind = room === 'street' ? 2 : room === 'pocha' ? 1 : 0;
    const want = kind === 2 ? 110 : kind === 1 ? 26 : 12;
    while (rainDropsFx.length < want) { const z = Math.random(); rainDropsFx.push({ x: Math.random() * (W + 60), y: Math.random() * H, z, v: 520 + z * 620, l: 9 + z * 16 }); }
    rainDropsFx.length = want;
    const dt = 1 / 60, slant = 0.16;
    g.lineCap = 'round';
    for (const d of rainDropsFx) {
      d.y += d.v * dt; d.x -= d.v * dt * slant;
      // 포차·가게 안은 가장자리(천막 틈, 창가)에만
      const edge = kind === 2 ? true : (d.x < W * 0.09 || d.x > W * 0.93);
      if (d.y > H + 20 || d.x < -20) { if (kind === 2 && Math.random() < 0.5) rainSplash.push({ x: d.x + (d.y - H * (0.35 + Math.random() * 0.6)) * slant, y: H * (0.35 + Math.random() * 0.6), a: 1 }); d.y = -20 - Math.random() * 60; d.x = kind === 2 ? Math.random() * (W + 60) : (Math.random() < 0.5 ? Math.random() * W * 0.09 : W * (0.93 + Math.random() * 0.09)); }
      if (!edge) continue;
      g.strokeStyle = `rgba(200,220,255,${0.16 + d.z * 0.34})`; g.lineWidth = 0.7 + d.z * 0.9;
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * slant, d.y - d.l); g.stroke();
    }
    for (const sp of rainSplash) { sp.a -= 0.06; g.strokeStyle = `rgba(210,228,255,${Math.max(0, sp.a) * 0.5})`; g.lineWidth = 1; g.beginPath(); g.ellipse(sp.x, sp.y, (1 - sp.a) * 9 + 1, (1 - sp.a) * 3.2 + 0.5, 0, 0, Math.PI * 2); g.stroke(); }
    rainSplash = rainSplash.filter(sp => sp.a > 0).slice(-60);
    rainRaf = requestAnimationFrame(rainDraw);
  }

  // ── 꾸미기 ──
  function openDress() { document.getElementById('pc-dress').style.display = 'flex'; renderDress(); }
  function closeDress() { document.getElementById('pc-dress').style.display = 'none'; }
  function setLook(k, v) {
    if (k === 'kind' && !(window.FoodChars && FoodChars.isOpen(v))) { const pr = FoodChars.progress(v); showToast(`🔒 ${pr.label}에 좋아요를 ${pr.need}번 누르면 열려요 (지금 ${pr.have}번)`); return; }
    me[k] = v; const { face_dir, ...save } = me; localStorage.setItem('wmjPochaLook', JSON.stringify(save)); renderDress(); track(); render();
  }
  function renderDress() {
    const el = document.getElementById('pc-dress-body'); if (!el || !window.FoodChars) return;
    if (!FoodChars.isOpen(me.kind)) me.kind = 'onigiri';
    const chars = FoodChars.IDS.map(id => { const pr = FoodChars.progress(id); const on = me.kind === id;
      return `<button class="pc-char ${on ? 'on' : ''} ${pr.open ? '' : 'locked'}" onclick="Pocha.setLook('kind','${id}')" aria-label="${FoodChars.name(id)}${pr.open ? '' : ' (잠김)'}">
        <img src="${FoodChars.url(id, me.color, 'none', 'smile', false)}" alt="">${pr.open ? '' : `<span class="lock">🔒 ${pr.have}/${pr.need}</span>`}<span class="nm">${FoodChars.name(id)}</span></button>`; }).join('');
    const openN = FoodChars.IDS.filter(FoodChars.isOpen).length;
    el.innerHTML = `
      <div class="pc-preview">${avatarSVG(me, 112)}</div>
      <div style="font-size:12px;color:var(--muted)">음식 친구 <b style="color:var(--text)">${openN}</b>/${FoodChars.IDS.length} · 메뉴에 좋아요를 누르면 새 친구가 열려요</div>
      <div class="pc-chars">${chars}</div>
      <div style="font-size:12px;color:var(--muted)">신발 색</div>
      <div class="pc-opts">${COLORS.map(c => `<button class="pc-swatch ${me.color === c ? 'on' : ''}" style="background:${c}" aria-label="신발 색" onclick="Pocha.setLook('color','${c}')"></button>`).join('')}</div>
      <div style="font-size:12px;color:var(--muted)">소품</div>
      <div class="pc-opts">${ACCS.map(([k, n]) => `<button class="${me.acc === k ? 'on' : ''}" onclick="Pocha.setLook('acc','${k}')">${n}</button>`).join('')}</div>
      <div style="font-size:12px;color:var(--muted)">표정</div>
      <div class="pc-opts">${FACES.map(([k, n]) => `<button class="${me.face === k ? 'on' : ''}" onclick="Pocha.setLook('face','${k}')">${n}</button>`).join('')}</div>
      <button class="cta-btn crave-btn" style="margin-top:4px" onclick="Pocha.closeDress()">이걸로 할게요</button>`;
  }
  // 새로 열린 친구 알림
  function checkNewFriends() {
    if (!window.FoodChars) return;
    let seen = []; try { seen = JSON.parse(localStorage.getItem('wmjPochaUnlocked') || '[]'); } catch (e) {}
    const now = FoodChars.IDS.filter(FoodChars.isOpen);
    const fresh = now.filter(id => !seen.includes(id) && FoodChars.BY[id][8]);
    localStorage.setItem('wmjPochaUnlocked', JSON.stringify(now));
    if (fresh.length && seen.length) showToast(`🎉 새 친구 ${fresh.map(FoodChars.name).join(', ')}이(가) 생겼어요! 꾸미기에서 바꿔 보세요`);
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
    return `<g transform="translate(${x} ${y}) scale(${R.bg ? 1.6 : 1})"><rect x="-56" y="-14" width="112" height="26" rx="10" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.35)"/><text x="0" y="5" class="pc-sign2" style="font-size:13px">🚪 골목으로 나가기</text></g>`;
  }
  function roomSVG() {
    const th = room, w = R.w, h = R.h;
    if (R.bg) {
      return `<svg class="pc-map" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><image href="${R.bg}" width="${w}" height="${h}" preserveAspectRatio="none"/><rect width="${w}" height="${h}" fill="rgba(20,12,24,.12)"/>${exitSVG()}</svg>` + (R.lights || []).map(([x, y, r], i) => `<i class="pc-glow" style="left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;animation-delay:${-(i * 0.9)}s"></i>`).join('');
    }
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
    if (ROOMS.street.bg) {
      const sign = (id) => { const r = shopRect(id), cx = r.x + r.w / 2, y = r.y + r.h / 2; const tw = ROOMS[id].name.length * 13 + 20;
        return `<g class="pc-shop"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="transparent"/><rect x="${cx - tw / 2}" y="${y - 15}" width="${tw}" height="30" rx="15" fill="rgba(25,16,30,.72)" stroke="rgba(255,215,160,.55)"/><text x="${cx}" y="${y + 5}" class="pc-sign2" style="font-size:13px">${ROOMS[id].name}</text></g>`; };
      return `<svg class="pc-map" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><image href="${ROOMS.street.bg}" width="${w}" height="${h}" preserveAspectRatio="none"/>${SHOPS.map(sign).join('')}
        <g transform="translate(215 ${h - 18})"><rect x="-78" y="-16" width="156" height="30" rx="10" fill="#c8102e"/><text x="0" y="5" class="pc-sign2">오메추 먹자골목</text></g></svg>`;
    }
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
        <canvas class="pc-raincv" id="pc-raincv"></canvas><div class="pc-rainmood"></div></div></div>
        <div class="pc-emobar">${EMOTES.map(e => `<button aria-label="감정 표현 ${e}" onclick="Pocha.emote('${e}')">${e}</button>`).join('')}</div>
        <div class="pc-hint" id="pc-hint"></div><div class="pc-ver">먹자골목 ${BUILD}</div>
      </div>
      <div class="pc-body" id="pc-panel"></div>`;
    const world = document.getElementById('pc-world');
    let down = null;
    world.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    world.addEventListener('click', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return; if (e.target.closest('.pc-person:not(.me)')) return; onWorldTap(e); });
    const view = document.getElementById('pc-view');
    K = Math.min(1, (view.clientWidth || R.w) / R.w);
    PS = room === 'street' ? 1 : Math.min(1.7, 0.82 / K);
    world.style.transform = K < 1 ? `scale(${K})` : '';
    world.style.setProperty('--ps', PS);
    view.style.height = Math.min(R.h * K, Math.max(280, window.innerHeight - 390)) + 'px';
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
    return `${showB ? `<div class="pc-bubble${b.emote ? ' pc-emo' : ''}">${esc(b.text)}</div>` : ''}<div class="pc-body2">${avatarSVG(p, 46)}</div><div class="pc-name">${esc(p.nick)}${sid === SID ? ' (나)' : ''}</div>`;
  }
  function placeEl(el, x, y, seated) { el.style.transform = `translate(${x - 30}px, ${y - (seated ? 42 : 52)}px)` + (PS !== 1 ? ` scale(${PS})` : ''); el.style.zIndex = String(Math.round(y)); }
  function drawMe(walking) {
    const el = document.getElementById('pc-p-' + SID); if (!el) return;
    el.classList.toggle('walking', !!walking);
    const b2 = el.querySelector('.pc-body2'); if (b2) b2.style.transform = `scaleX(${me.face_dir || 1})`;
    const [x, y] = myTable !== null ? seatXY(myTable, mySeat) : [pos.x, pos.y];
    placeEl(el, x, y, myTable !== null);
    if (follow) { const v = document.getElementById('pc-view'); if (v) { const cx = x * K - v.clientWidth / 2, cy = y * K - v.clientHeight / 2; v.scrollLeft += (cx - v.scrollLeft) * 0.12; v.scrollTop += (cy - v.scrollTop) * 0.12; } }
  }
  function roomCounts() {
    const c = {}; Object.entries(lobbyState).forEach(([k, p]) => { const r = k === SID ? room : p.room; c[r] = (c[r] || 0) + 1; });
    if (!lobbyState[SID] && isOpen) c[room] = (c[room] || 0) + 1;
    return c;
  }
  function updateWorld() {
    const layer = document.getElementById('pc-people'); if (!layer) return;
    const people = {};
    Object.entries(state).forEach(([sid, p]) => { if (room !== 'street' || p.room === 'street') people[sid] = p; });
    people[SID] = { nick: nick(), kind: me.kind, color: me.color, acc: me.acc, face: me.face, table: myTable, seat: mySeat, x: pos.x, y: pos.y };
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
    if (dl0) dl0.innerHTML = room !== 'street'
      ? R.tables.map((tb, t) => { const n = seatedAt(t).length; return `<div class="pc-doorcount ${n ? 'hot' : ''}" style="left:${tb.x}px;top:${tb.y + (tb.by ?? (tb.k === 'bar' ? 64 : tb.k === 'low' ? 70 : 80))}px">${R.bg ? esc(tb.n) + ' · ' : ''}👥 ${n}/${SEATS}</div>`; }).join('')
      : (() => { const c = roomCounts(); return SHOPS.map(id => { const r = shopRect(id); return `<div class="pc-doorcount ${c[id] ? 'hot' : ''}" style="left:${r.x + r.w / 2}px;top:${Math.max(14, r.y + r.h / 2 - 30)}px">${c[id] ? '🔥' : '👥'} ${c[id] || 0}명</div>`; }).join(''); })();
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
      : (joined ? `${esc(R.name)} · <b>${Object.keys(state).length}</b>명` : '연결 중...');
    const rb = document.getElementById('pc-rainbtn'); if (rb) { rb.textContent = rainCtx ? '🌧️ 빗소리 끄기' : '🌧️ 빗소리'; rb.classList.toggle('on', !!rainCtx); }
    if (rainCtx) { rainTune(); if (!rainRaf) rainDraw(); }
    document.querySelector('.pc-scene')?.classList.toggle('raining', !!rainCtx);
    const hint = document.getElementById('pc-hint');
    if (hint) hint.style.display = room === 'street' ? '' : 'none';
    if (hint) hint.textContent = room === 'street' ? '가게를 누르면 걸어가서 들어가요'
      : myTable !== null ? `${R.tables[myTable].n}에 앉아 있어요 · 다른 곳을 누르면 일어나서 걸어가요`
      : '빈 곳을 누르면 걸어가고, 빈자리를 누르면 앉아요';
    const seated = myTable !== null && room !== 'street';
    if (!seated && chatTab === 'table') chatTab = 'hall';
    const TABS = (seated ? [['table', '🍻 우리 테이블']] : []).concat([['hall', room === 'street' ? '📢 골목 전체' : '📢 가게 전체'], ['near', '💬 근처']]);
    const src = chatTab === 'table' ? (logs[myTable] || []) : chatTab === 'near' ? nearLog : hallLog;
    const empty = { table: '아직 조용해요. 먼저 말을 걸어보세요!', hall: room === 'street' ? '골목에 있는 모두에게 보여요' : '이 가게에 있는 모두에게 보여요', near: '가까이 있는 사람에게만 보여요' }[chatTab];
    const nearCard = `<div class="pc-card pc-chat"><div class="pc-tabs">${TABS.map(([k, n]) => `<button class="${chatTab === k ? 'on' : ''}" onclick="Pocha.setTab('${k}')">${n}${unread[k] ? `<span class="dot">${unread[k]}</span>` : ''}</button>`).join('')}</div>
      <div class="pc-input" style="margin:0 0 8px"><input id="pc-msg" maxlength="60" placeholder="${chatTab === 'table' ? '오늘 뭐 드실 거예요?' : '안녕하세요! 뭐 드세요?'}" onkeydown="if(event.key==='Enter')Pocha.sendTab()"><button onclick="Pocha.sendTab()">전송</button></div>
      <div class="pc-log" id="pc-log" style="height:96px">${src.map(m => m.sys ? `<div class="sys">${m.text}</div>` : `<div class="msg"><b>${esc(m.nick)}</b>${esc(m.text)}</div>`).join('') || `<div class="sys">${empty}</div>`}</div></div>`;
    let body = '';
    if (room === 'street') {
      const c = roomCounts();
      body = nearCard + `<div class="pc-card"><div style="font-weight:700;margin-bottom:10px">어디로 들어갈까요?</div><div class="pc-tables">
        ${SHOPS.map(id => `<div class="pc-trow"><div><div style="font-size:13px;font-weight:700">${ROOMS[id].name} <span style="color:var(--muted);font-weight:400">${ROOMS[id].kind}</span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${c[id] ? `지금 ${c[id]}명 있어요` : '아직 아무도 없어요'}</div></div>
          <div style="display:flex;gap:6px"><button class="pc-ghost" onclick="Pocha.go('${id}')">걸어가기</button><button onclick="Pocha.quickGo('${id}')">바로 앉기</button></div></div>`).join('')}
        </div></div>
        <div style="font-size:11px;color:var(--muted);text-align:center;line-height:1.6">대화는 저장되지 않아요. 같은 테이블에 앉은 사람끼리만 보여요.<br>불편한 손님은 캐릭터를 눌러 말을 숨길 수 있어요.</div>`;
    } else if (myTable === null) {
      body = nearCard + `<div class="pc-card"><div style="font-weight:700;margin-bottom:10px">${esc(R.name)} 자리 현황</div><div class="pc-tables">
        ${R.tables.map((tb, t) => { const ps = seatedAt(t).filter(p => p.sid !== SID); const full = ps.length >= SEATS;
          return `<div class="pc-trow"><div><div style="font-size:13px;font-weight:700">${tb.n} <span style="color:var(--muted);font-weight:400">${ps.length}/${SEATS}</span></div>
            <div class="who">${ps.map(p => avatarSVG(p, 28)).join('') || '<span style="font-size:11px;color:var(--muted)">아직 아무도 없어요</span>'}</div></div>
            <button ${full || !joined ? 'disabled' : ''} onclick="Pocha.quickSit(${t})">${full ? '만석' : '앉기'}</button></div>`; }).join('')}
        </div><button class="cta-btn crave-btn" style="margin-top:12px" ${joined ? '' : 'disabled'} onclick="Pocha.quickSit()">🪑 바로 앉기</button>
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
        `;
      body = voteHTML + nearCard + body;
    }
    const prevVal = document.getElementById('pc-msg')?.value || '', prevSay = document.getElementById('pc-say')?.value || '';
    const hadFocus = document.activeElement && document.activeElement.id === 'pc-msg', hadSay = document.activeElement && document.activeElement.id === 'pc-say';
    panel.innerHTML = body;
    const inp = document.getElementById('pc-msg'); if (inp) { inp.value = prevVal; if (hadFocus) inp.focus(); }
    const sy = document.getElementById('pc-say'); if (sy) { sy.value = prevSay; if (hadSay) sy.focus(); }
    const log = document.getElementById('pc-log'); if (log) log.scrollTop = log.scrollHeight;
  }
  function render() {
    const root = document.getElementById('pocha-root'); if (!root || document.getElementById('page-pocha').style.display === 'none') return;
    ensureShell(root);
    updateWorld(); renderPanel();
  }

  // 위치 공유가 가끔 빠질 수 있어 열려 있는 동안 30초마다 다시 알림
  setInterval(() => { if (isOpen && !document.hidden) track(); }, 30000);

  // 투표 남은 시간 표시 갱신
  setInterval(() => { if (myTable !== null && votes[myTable] && !votes[myTable].done) render(); }, 1000);

  window.Pocha = { findWinner,
    open(startRoom) { isOpen = true; checkNewFriends(); connectLobby(); trackLobby(); if (startRoom && ROOMS[startRoom] && startRoom !== room) enterRoom(startRoom); else { connectRoom(); render(); } },
    // 다른 화면으로 나가면 골목으로 돌아가고, 인원 집계에서도 빠진다
    close() { isOpen = false; if (rainCtx) rainStop(); if (room !== 'street') enterRoom('street'); if (lobby) { try { lobby.untrack(); } catch (e) {} } },
    back() { if (room !== 'street') enterRoom('street'); else showPage('fun'); },
    go(id) { if (room !== 'street') return; const d = ROOMS[id]?.door; if (!d) return; pendingSeat = null; pendingDoor = id; walkTo(d[0], d[1]); },
    emote, say, sendTab, setTab, quickSit, quickGo, leave, sit, sitAny, stand, goSit, walkTo, send, cheers, startVote, vote, mute, toggleRain, openDress, closeDress, setLook, render,
    avatarSVG, room: () => room, count: () => Object.keys(lobbyState).length,
    who: () => Object.entries(lobbyState).map(([k, p]) => (k === SID ? '(나)' : '') + p.room + ':' + p.nick),
  };
})();
