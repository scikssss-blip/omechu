// ═════════════════════════════════════════════
// 오메추 음식 친구들 (크레파스 그림체, 오리지널 캐릭터 16종)
// - 그림은 SVG로 만들고, 한 번 만든 모양은 이미지로 저장해 다시 씀(가볍게)
// - 좋아요한 메뉴의 분류 수에 따라 캐릭터가 하나씩 열림
// ═════════════════════════════════════════════
(function () {
  const P = d => `<path d="${d}" {A}/>`;
  const R = (x, y, w, h, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" {A}/>`;
  const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" {A}/>`;
  const E = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" {A}/>`;
  // id, 이름, 조각[[도형, 밝은색, 어두운색]], 얼굴[x,y,배율], 팔[x1,y1,x2,y2], 다리 y, 머리 꼭대기 y, 덧그림, 여는 조건
  const CHARS = [
    ['onigiri', '주먹밥', [[P('M0 -44 C20 -44 35 -10 36 12 C37 31 22 38 0 38 C-22 38 -37 31 -36 12 C-35 -10 -20 -44 0 -44Z'), '#fffdf7', '#e6dccb'], [P('M-18 18 h36 v20 q-18 3 -36 0z'), '#4b6b52', '#2b3f30']], [0, -2, 1], [-31, 8, 31, 8], 34, -44, '', null],
    ['mandu', '만두', [[P('M-42 26 C-44 -4 -20 -34 0 -34 C20 -34 44 -4 42 26 C22 37 -22 37 -42 26Z'), '#fff4de', '#e3c690']], [0, 8, 1], [-37, 14, 37, 14], 32, -34, '<path d="M-20 -26 q6 10 1 20 M-7 -32 q6 11 1 22 M7 -32 q6 11 1 22 M20 -26 q5 9 0 18" stroke="#b38a52" stroke-width="3.2" fill="none" stroke-linecap="round" filter="url(#cr)"/>', null],
    ['egg', '계란프라이', [[P('M-38 -8 C-48 -34 -14 -48 2 -40 C24 -50 50 -30 40 -6 C52 14 34 38 4 34 C-24 42 -50 22 -38 -8Z'), '#ffffff', '#ece4d3'], [C(0, -3, 23), '#ffcb45', '#f09a12']], [0, -2, 1], [-39, 10, 39, 10], 32, -44, '<ellipse cx="-8" cy="-13" rx="7" ry="4" fill="#fff" opacity=".55"/>', null],
    ['kimbap', '김밥', [[C(0, -4, 36), '#3c5a44', '#1c2c20'], [C(0, -4, 30), '#fffdf7', '#e6dccb'], [R(-17, -24, 11, 11, 3), '#ffcf45', '#e3a118'], [R(-4, -27, 9, 13, 3), '#7fcc6a', '#4c9a3c'], [R(7, -24, 11, 11, 5), '#f2895a', '#c25a2c']], [0, 8, .85], [-34, 10, 34, 10], 32, -40, '', null],
    ['tteok', '떡볶이', [[R(-22, -44, 44, 82, 22), '#ff7a62', '#c8372b']], [0, -8, .82], [-22, 6, 22, 6], 36, -44, '<rect x="-14" y="-38" width="8" height="40" rx="4" fill="#fff" opacity=".35"/><g fill="#7a1f16" opacity=".8"><circle cx="13" cy="-28" r="2"/><circle cx="-12" cy="24" r="1.8"/><circle cx="12" cy="18" r="1.4"/></g>', [['🌶️ 매운/얼큰한맛', '🌶️ 매운 음식'], 3, '매운 메뉴']],
    ['eomuk', '어묵꼬치', [[P('M-24 -40 q24 -10 48 0 q-10 13 0 24 q-24 10 -48 0 q10 -13 0 -24Z'), '#f6cf94', '#d39550'], [P('M-27 -8 q27 -11 54 0 q-11 15 0 29 q-27 11 -54 0 q11 -15 0 -29Z'), '#f6cf94', '#d39550']], [0, 8, .85], [-26, 10, 26, 10], 34, -46, '<path d="M0 -56 v8 M0 40 v10" stroke="#8a6a3a" stroke-width="3.4" stroke-linecap="round" filter="url(#cr)"/>', [['🍲 국물/찌개'], 3, '국물 메뉴']],
    ['bungeo', '붕어빵', [[P('M-36 0 C-36 -26 -10 -36 12 -32 C23 -30 31 -23 35 -15 L49 -27 Q44 0 49 27 L35 15 C31 25 21 32 8 32 C-14 34 -36 24 -36 0Z'), '#f2bd6e', '#c67c32']], [-14, -6, .85], [-30, 12, null, null], 30, -32, '<g stroke="#9a5a1f" stroke-width="2.4" fill="none" stroke-linecap="round" filter="url(#cr)"><path d="M4 -22 q6 6 0 12 q6 6 0 12 q6 6 0 12"/><path d="M16 -20 q6 6 0 12 q6 6 0 12 q6 6 0 10"/></g>', [['🍯 달달한맛'], 2, '달달한 메뉴']],
    ['pudding', '푸딩', [[P('M-32 36 L-25 -24 Q0 -42 25 -24 L32 36 Q0 41 -32 36Z'), '#ffe18e', '#efb43f'], [P('M-26 -16 Q0 -36 26 -16 L25 -24 Q0 -46 -25 -24Z'), '#9a4e22', '#6a2e10'], [C(0, -44, 5), '#ef3b52', '#b51f35']], [0, 6, 1], [-29, 10, 29, 10], 34, -40, '', [['🍯 달달한맛'], 4, '달달한 메뉴']],
    ['chicken', '치킨다리', [[P('M-6 30 C-30 30 -34 -2 -26 -22 C-18 -42 18 -46 28 -24 C36 -6 26 18 8 26 L6 38 Q0 44 -6 38Z'), '#eeaa55', '#b8661f'], [R(-6, 34, 12, 8, 3), '#fff7ea', '#e3d6c0']], [0, -6, 1], [-28, 10, 28, 10], 34, -42, '<g fill="#a85a1a" opacity=".45"><circle cx="-16" cy="-24" r="2"/><circle cx="12" cy="-30" r="1.8"/><circle cx="20" cy="-6" r="2.2"/></g>', [['🍺 술안주'], 3, '술안주 메뉴']],
    ['cupramen', '컵라면', [[P('M-30 -18 L-24 36 Q0 40 24 36 L30 -18Z'), '#fffdf7', '#e6dccb'], [R(-28, 4, 56, 14, 2), '#ec6250', '#c23a2a'], [P('M-34 -22 q34 -10 68 0 v6 q-34 -8 -68 0z'), '#e0503a', '#a8301f']], [0, -4, .85], [-28, 10, 28, 10], 36, -24, '<path d="M-20 -24 q4 -8 8 0 q4 -8 8 0 q4 -8 8 0 q4 -8 8 0" stroke="#e8b83a" stroke-width="3" fill="none" stroke-linecap="round" filter="url(#cr)"/>', [['🌙 야식'], 3, '야식 메뉴']],
    ['hotteok', '호떡', [[E(0, 0, 42, 28), '#eaae5e', '#b8702a']], [0, 0, 1], [-38, 6, 38, 6], 26, -28, '<path d="M18 14 q6 4 4 10 q-3 -2 -6 -4z" fill="#6b2f12" opacity=".8"/>', [['🥶 추운 날'], 3, '추운 날 메뉴']],
    ['icecream', '아이스크림', [[P('M-22 4 L0 42 L22 4Z'), '#ebb86e', '#c48434'], [P('M-32 4 C-40 -18 -20 -44 0 -44 C20 -44 40 -18 32 4 Q20 12 8 4 Q0 12 -8 4 Q-20 12 -32 4Z'), '#ffc6d8', '#ef8fb0']], [0, -14, .9], [-30, -6, 30, -6], 38, -44, '<path d="M-16 8 L8 34 M-6 4 L14 26 M16 8 L-8 34 M6 4 L-14 26" stroke="#9a5a1f" stroke-width="1.6" opacity=".6" filter="url(#cr)"/><g><rect x="-14" y="-30" width="6" height="2.6" rx="1.3" fill="#6cbf5a"/><rect x="10" y="-34" width="6" height="2.6" rx="1.3" fill="#ffd23d"/><rect x="18" y="-16" width="6" height="2.6" rx="1.3" fill="#7ab8ff"/></g>', [['☀️ 더운 날'], 3, '더운 날 메뉴']],
    ['pizza', '피자 조각', [[P('M-34 -30 Q0 -46 34 -30 L4 36 Q0 40 -4 36Z'), '#ffd66e', '#eaa93a'], [P('M-36 -32 Q0 -50 36 -32 L34 -24 Q0 -40 -34 -24Z'), '#f0bf76', '#c4863a'], [C(-14, -16, 5.5), '#e0503a', '#a8301f'], [C(12, -12, 5), '#e0503a', '#a8301f'], [C(0, 12, 4.5), '#e0503a', '#a8301f']], [0, -2, .8], [-24, 4, 24, 4], 32, -44, '', [['🍝 양식'], 2, '양식 메뉴']],
    ['burger', '햄버거', [[P('M-36 -4 C-36 -36 36 -36 36 -4Z'), '#f6bb60', '#d4862a'], [P('M-40 -2 q10 8 20 0 q10 8 20 0 q10 8 20 0 q10 8 20 0 v4 h-80z'), '#86d46e', '#4c9a3c'], [R(-38, 4, 76, 9, 4), '#ffd84a', '#e3a918'], [R(-36, 12, 72, 11, 5), '#8a4a2a', '#5a2a12'], [P('M-36 22 h72 q0 16 -36 16 q-36 0 -36 -16z'), '#f6bb60', '#d4862a']], [0, -14, .8], [-34, 10, 34, 10], 34, -30, '', [['🍝 양식'], 4, '양식 메뉴']],
    ['salmon', '연어초밥', [[R(-36, 0, 72, 34, 16), '#fffdf7', '#e6dccb'], [P('M-40 4 C-40 -22 40 -22 40 4 C40 10 -40 10 -40 4Z'), '#ffab7a', '#ea6a37']], [0, 18, .85], [-34, 14, 34, 14], 32, -18, '<path d="M-26 -10 q6 10 2 16 M-10 -14 q6 12 2 19 M8 -14 q6 12 2 19 M24 -10 q6 10 2 15" stroke="#fff4ea" stroke-width="2.8" fill="none" stroke-linecap="round" filter="url(#cr)"/>', [['🍣 일식'], 2, '일식 메뉴']],
    ['takoyaki', '타코야키', [[C(0, -2, 34), '#f0be78', '#c4843a']], [0, 8, .9], [-32, 10, 32, 10], 32, -36, '<path d="M-30 -14 q10 -8 18 0 q8 -8 16 0 q8 -8 16 0 q8 -6 10 2" stroke="#5a2a12" stroke-width="5.5" fill="none" stroke-linecap="round" filter="url(#cr)"/><path d="M-26 -16 q8 6 14 0 M2 -16 q8 6 14 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>', [['🍣 일식'], 4, '일식 메뉴']],
  ];
  const BY = Object.fromEntries(CHARS.map(c => [c[0], c]));
  const IDS = CHARS.map(c => c[0]);
  const INK = '#6a4a3a';
  const DEFS = `<defs>
    <filter id="cr" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" result="d"/><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="9" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 1.6" result="mask"/><feComposite in="d" in2="mask" operator="in"/></filter>
    <filter id="crf" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="turbulence" baseFrequency=".9 .12" numOctaves="2" seed="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.5" result="mask"/><feComposite in="SourceGraphic" in2="mask" operator="in" result="f"/><feDisplacementMap in="f" in2="n" scale="2"/></filter>
    <filter id="halo" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="d"/><feFlood flood-color="#fffaf0" flood-opacity=".92"/><feComposite in2="d" operator="in" result="w"/><feMerge><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
  const FACES = {
    smile: (ink) => `<circle cx="-9" cy="0" r="3.6" fill="${ink}"/><circle cx="9" cy="0" r="3.6" fill="${ink}"/><circle cx="-8" cy="-1.3" r="1.1" fill="#fff"/><circle cx="10" cy="-1.3" r="1.1" fill="#fff"/><path d="M-4 7 q4 4 8 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    happy: (ink) => `<path d="M-13 1 q4 -5 8 0 M5 1 q4 -5 8 0" stroke="${ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M-5 6 q5 8 10 0z" fill="#d9483a" stroke="${ink}" stroke-width="1.6"/>`,
    sleepy: (ink) => `<path d="M-13 1 h8 M5 1 h8" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/><ellipse cx="0" cy="8" rx="2.6" ry="2" fill="${ink}"/><text x="16" y="-10" font-size="9" fill="${ink}" font-family="sans-serif">z</text>`,
    wow: (ink) => `<circle cx="-9" cy="0" r="4.2" fill="${ink}"/><circle cx="9" cy="0" r="4.2" fill="${ink}"/><circle cx="-8" cy="-1.5" r="1.3" fill="#fff"/><circle cx="10" cy="-1.5" r="1.3" fill="#fff"/><ellipse cx="0" cy="9" rx="3" ry="3.8" fill="${ink}"/>`,
  };
  // 소품: 머리 꼭대기(top)와 얼굴 위치(fx, fy) 기준으로 얹음
  const ACC = {
    none: () => '',
    towel: (t) => `<g filter="url(#cr)"><path d="M-24 ${t + 9} q24 -10 48 0 l-2 7 q-22 -8 -44 0z" fill="#fff" stroke="${INK}" stroke-width="1.6"/><path d="M22 ${t + 10} l9 -4 l-1 8z" fill="#fff" stroke="${INK}" stroke-width="1.4"/></g>`,
    beanie: (t) => `<g filter="url(#crf)"><path d="M-20 ${t + 8} q20 -24 40 0z" fill="#e2564b"/><rect x="-22" y="${t + 5}" width="44" height="7" rx="3.5" fill="#b83b31"/><circle cx="0" cy="${t - 10}" r="5" fill="#fff"/></g>`,
    glasses: (t, fx, fy, fs) => `<g transform="translate(${fx} ${fy}) scale(${fs})" filter="url(#cr)"><circle cx="-9" cy="0" r="7" fill="none" stroke="${INK}" stroke-width="2.2"/><circle cx="9" cy="0" r="7" fill="none" stroke="${INK}" stroke-width="2.2"/><path d="M-2 0 h4" stroke="${INK}" stroke-width="2.2"/></g>`,
    ribbon: (t) => `<g filter="url(#crf)"><path d="M0 ${t + 2} l-12 -7 v14z M0 ${t + 2} l12 -7 v14z" fill="#ff6b9a"/><circle cx="0" cy="${t + 2}" r="3.4" fill="#e0457a"/></g>`,
    chef: (t) => `<g filter="url(#crf)"><rect x="-14" y="${t - 6}" width="28" height="10" rx="3" fill="#fff"/><circle cx="-10" cy="${t - 10}" r="7" fill="#fff"/><circle cx="0" cy="${t - 14}" r="8" fill="#fff"/><circle cx="10" cy="${t - 10}" r="7" fill="#fff"/></g><g filter="url(#cr)"><path d="M-14 ${t + 4} h28" stroke="${INK}" stroke-width="1.4"/></g>`,
  };
  function svgOf(kind, shoe, acc, face, halo) {
    const c = BY[kind] || BY.onigiri;
    const [, , parts, [fx, fy, fs], [ax1, ay1, ax2, ay2], ly, top, extra] = c;
    const limbs = `<path d="M-12 ${ly} q-1 6 -4 9 M12 ${ly} q1 6 4 9 M${ax1} ${ay1} q-10 4 -10 14${ax2 != null ? ` M${ax2} ${ay2} q10 4 10 14` : ''}" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round" filter="url(#cr)"/>
      <g filter="url(#crf)"><ellipse cx="-17" cy="${ly + 9}" rx="6" ry="3.2" fill="${shoe}"/><ellipse cx="17" cy="${ly + 9}" rx="6" ry="3.2" fill="${shoe}"/></g>`;
    const fills = parts.map(([el, , dark]) => el.replace('{A}', `fill="${dark}" filter="url(#crf)"`)).join('');
    const lights = parts.map(([el, light]) => `<g transform="translate(-3 -4) scale(.86)" opacity=".75">${el.replace('{A}', `fill="${light}" filter="url(#crf)"`)}</g>`).join('');
    const lines = parts.map(([el]) => el.replace('{A}', `fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" filter="url(#cr)"`)).join('');
    const blush = `<g filter="url(#crf)"><ellipse cx="-18" cy="7" rx="6.5" ry="4" fill="#ff7a6a" opacity=".7"/><ellipse cx="18" cy="7" rx="6.5" ry="4" fill="#ff7a6a" opacity=".7"/></g>`;
    const faceSvg = `<g transform="translate(${fx} ${fy}) scale(${fs})">${blush}<g filter="url(#cr)">${(FACES[face] || FACES.smile)('#4a3026')}</g></g>`;
    const accSvg = (ACC[acc] || ACC.none)(top, fx, fy, fs);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -64 120 124">${DEFS}<g ${halo ? 'filter="url(#halo)"' : ''}>${limbs}${fills}${lights}${extra}${lines}${faceSvg}${accSvg}</g></svg>`;
  }
  const cache = new Map();
  function url(kind, shoe, acc, face, halo) {
    const k = [kind, shoe, acc, face, halo ? 1 : 0].join('|');
    if (!cache.has(k)) cache.set(k, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgOf(kind, shoe, acc, face, halo)));
    return cache.get(k);
  }
  // 여는 조건: 좋아요한 메뉴 중 해당 분류 개수
  function likedTagCounts() {
    const liked = (typeof getLikedMenus === 'function' ? getLikedMenus() : []).map(m => m.name);
    const db = typeof menuDB !== 'undefined' ? menuDB : [];
    const cnt = {};
    liked.forEach(n => { const m = db.find(x => x.name === n); if (m) m.tags.forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }); });
    return cnt;
  }
  function progress(id) {
    const c = BY[id]; if (!c || !c[8]) return { open: true };
    const [tags, need, label] = c[8]; const cnt = likedTagCounts();
    const have = Math.max(...tags.map(t => cnt[t] || 0));
    return { open: have >= need, have, need, label };
  }
  const isOpen = (id) => progress(id).open;
  window.FoodChars = { IDS, BY, url, svgOf, progress, isOpen, name: (id) => (BY[id] || BY.onigiri)[1] };
})();
