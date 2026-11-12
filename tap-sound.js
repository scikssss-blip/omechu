// 버튼 누를 때 나는 짧은 소리 (기기에서 직접 만듦, 파일 없음)
// 끄기: localStorage 'wmjTapSound' = '0'  (설정 화면에서 바꿈)
(function () {
  let ctx = null, last = 0;
  const on = () => { try { return localStorage.getItem('wmjTapSound') !== '0'; } catch (e) { return true; } };
  const SEL = 'button, a.btn, [onclick], .tag, .fav-chip, .cat-card, .similar-chip, [role="button"], label';
  function tick(kind) {
    if (!on()) return;
    const now = performance.now(); if (now - last < 45) return; last = now;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      // 톡: 높은 음이 빠르게 내려가는 짧은 소리 / 선택 켜짐은 살짝 높게
      const base = kind === 'on' ? 1150 : kind === 'off' ? 620 : 880;
      o.type = 'triangle'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.07);
      f.type = 'lowpass'; f.frequency.value = 2600;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(f).connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.1);
    } catch (e) {}
  }
  document.addEventListener('pointerdown', (e) => {
    const el = e.target && e.target.closest && e.target.closest(SEL);
    if (!el || el.disabled || el.closest('[data-nosound]')) return;
    // 켜고 끄는 버튼(태그·조건)은 켜질 때/꺼질 때 소리를 다르게
    const toggle = el.matches('.tag, .fav-chip');
    tick(toggle ? (el.classList.contains('active') ? 'off' : 'on') : 'tap');
  }, { passive: true, capture: true });
  window.TapSound = { tick, isOn: on, set(v) { try { localStorage.setItem('wmjTapSound', v ? '1' : '0'); } catch (e) {} if (v) tick('on'); } };
})();
