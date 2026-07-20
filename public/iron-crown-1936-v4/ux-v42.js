'use strict';

/** V4.2.2 compatibility hook and military-experience loader. */
(() => {
  window.__IRON_V42_STABLE_BUILD__ = '4.2.2-stable.1';

  if (!document.querySelector('link[data-iron-v422]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'style-v422.css?v=422s1';
    link.dataset.ironV422 = 'true';
    document.head.appendChild(link);
  }

  const load = (src, done) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = done || null;
    script.onerror = () => console.error(`无法载入V4.2.2模块：${src}`);
    document.head.appendChild(script);
  };
  load('engine-v422.js?v=422s1', () => load('ux-v422.js?v=422s1'));

  setInterval(() => {
    if (!window.GameV4 || GameV4.speed !== 0 || GameV4.__userPaused) return;
    const gameVisible = !document.getElementById('gameScreen')?.classList.contains('hidden');
    if (!gameVisible) return;
    GameV4.__autoStarted = true;
    GameV4.clock ??= { desiredSpeed: 1, lastAdvanceAt: Date.now(), stalledTicks: 0 };
    GameV4.clock.desiredSpeed = 1;
    GameV4.setSpeed(1);
    document.querySelectorAll('.speed-button').forEach(button => button.classList.toggle('active', Number(button.dataset.speed) === 1));
  }, 1500);
})();
