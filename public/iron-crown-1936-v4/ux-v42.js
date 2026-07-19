'use strict';

/** V4.2 compatibility hook. The main stable UX is loaded from ux-v41.js. */
window.__IRON_V42_STABLE_BUILD__ = '4.2.1-stable.1';
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
