// ═════════════════════════════════════════════
// 오메추 포차: 실시간으로 모여 앉는 가상 포장마차
// - Supabase Realtime(Presence + Broadcast) 사용, 대화는 서버에 저장하지 않음
// - 테이블 3개 × 4자리, 테이블 안에서만 대화
// - 오메추 추천 엔진으로 '오늘의 안주' 투표
// ═════════════════════════════════════════════
(function () {
  const TABLES = 3, SEATS = 4;
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
  function track() { if (!ch) return; return ch.track({ nick: nick(), color: me.color, acc: me.acc, face: me.face, table: myTable, seat: mySeat, at: seatAt }); }

  // ── 자리 ──
  const seatedAt = (t) => Object.entries(state).filter(([, p]) => p.table === t && p.seat !== null && p.seat !== undefined).map(([sid, p]) => ({ ...p, sid }));
  function freeSeat(t) {
    const taken = new Set(seatedAt(t).filter(p => p.sid !== SID).map(p => p.seat));
    for (let s = 0; s < SEATS; s++) if (!taken.has(s)) return s;
    return null;
  }
  async function sit(t) {
    if (!joined) { showToast('포차에 연결하는 중이에요. 잠시만요!'); return; }
    const s = freeSeat(t);
    if (s === null) { showToast('그 테이블은 자리가 꽉 찼어요 😅'); return; }
    myTable = t; mySeat = s; seatAt = Date.now();
    await track(); sys(t, '자리에 앉았어요. 옆 사람에게 인사해 보세요 👋'); render();
  }
  async function sitAny() {
    let best = null, bestN = -1;
    for (let t = 0; t < TABLES; t++) { const n = seatedAt(t).filter(p => p.sid !== SID).length; if (n < SEATS && n > bestN) { best = t; bestN = n; } }
    if (best === null) { showToast('지금은 모든 자리가 꽉 찼어요 😅'); return; }
    sit(best);
  }
  async function stand() { myTable = null; mySeat = null; await track(); render(); }
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

  // ── 화면 ──
  function seatHTML(t, s) {
    const p = seatedAt(t).find(x => x.seat === s);
    if (!p) return `<div class="pc-seat empty">${avatarSVG({ color: '#888', acc: 'none', face: 'sleepy' }, 56)}<div class="pc-stool"></div><div class="pc-name" style="color:#8a85a8">빈자리</div></div>`;
    const b = bubbles[p.sid]; const showB = b && b.until > Date.now();
    return `<div class="pc-seat ${p.sid === SID ? 'me' : ''} ${showB && b.cheers ? 'cheers' : ''}" onclick="Pocha.mute('${p.sid}')">
      ${showB ? `<div class="pc-bubble">${esc(b.text)}</div>` : ''}
      ${avatarSVG(p, 56)}<div class="pc-stool"></div><div class="pc-name">${esc(p.nick)}${p.sid === SID ? ' (나)' : ''}</div></div>`;
  }
  function dishHTML(t) {
    const d = dishes[t];
    if (!d) return '<span class="pc-dish-emoji">🍢</span>';
    const img = typeof getMenuImg === 'function' ? getMenuImg(d) : null;
    return img ? `<img class="pc-dish" src="${img}" alt="${esc(d)}">` : '<span class="pc-dish-emoji">🍽️</span>';
  }
  function render() {
    const root = document.getElementById('pocha-root'); if (!root || document.getElementById('page-pocha').style.display === 'none') return;
    const total = Object.keys(state).length;
    const viewT = myTable !== null ? myTable : 0;
    const scene = `
      <div class="pc-scene ${rainCtx ? 'raining' : ''}"><div class="pc-rain"></div>
        <div class="pc-top">
          <div style="display:flex;align-items:center"><button class="pc-back" onclick="showPage('fun')">‹</button>
            <span class="pc-live">${joined ? `🏮 지금 <b>${total}</b>명 포차에 있어요` : '연결 중...'}</span></div>
          <div><button class="pc-iconbtn" onclick="Pocha.toggleRain()">${rainCtx ? '🔇' : '🌧️'}</button><button class="pc-iconbtn" onclick="Pocha.openDress()">👕 꾸미기</button></div>
        </div>
        <div class="pc-tent"><div class="pc-awning"></div><div class="pc-sign">오메추 포차</div>
          <div class="pc-lights"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>
        <div class="pc-sub">${myTable !== null ? `${myTable + 1}번 테이블` : '빈자리에 앉아서 오늘 뭐 먹을지 같이 골라요'}</div>
        <div class="pc-table-wrap"><div class="pc-table">
          ${[0, 1, 2, 3].map(s => seatHTML(viewT, s)).join('')}
          <div class="pc-board">${dishHTML(viewT)}</div>
        </div></div>
      </div>`;

    let body = '';
    if (myTable === null) {
      body = `<div class="pc-card"><div style="font-weight:700;margin-bottom:10px">자리 고르기</div><div class="pc-tables">
        ${[0, 1, 2].map(t => { const ps = seatedAt(t).filter(p => p.sid !== SID); const full = ps.length >= SEATS;
          return `<div class="pc-trow"><div><div style="font-size:13px;font-weight:700">${t + 1}번 테이블 <span style="color:var(--muted);font-weight:400">${ps.length}/${SEATS}</span></div>
            <div class="who">${ps.map(p => avatarSVG(p, 28)).join('') || '<span style="font-size:11px;color:var(--muted)">아직 아무도 없어요</span>'}</div></div>
            <button ${full || !joined ? 'disabled' : ''} onclick="Pocha.sit(${t})">${full ? '만석' : '앉기'}</button></div>`; }).join('')}
        </div><button class="cta-btn crave-btn" style="margin-top:12px" ${joined ? '' : 'disabled'} onclick="Pocha.sitAny()">🪑 아무 데나 앉기</button></div>
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
    root.innerHTML = scene + `<div class="pc-body">${body}</div>`;
    const inp = document.getElementById('pc-msg'); if (inp) { inp.value = prevVal; if (hadFocus) inp.focus(); }
    const log = document.getElementById('pc-log'); if (log) log.scrollTop = log.scrollHeight;
  }

  // 투표 남은 시간 표시 갱신
  setInterval(() => { if (myTable !== null && votes[myTable] && !votes[myTable].done) render(); }, 1000);

  window.Pocha = { findWinner,
    open() { connect(); render(); },
    close() { if (myTable !== null) stand(); },
    sit, sitAny, stand, send, cheers, startVote, vote, mute, toggleRain, openDress, closeDress, setLook, render,
    avatarSVG, count: () => Object.keys(state).length,
  };
})();
