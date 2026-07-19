'use strict';

/** Stable shared loader for V4.1/V4.2. Prevents the former 280ms global polling loop. */
(() => {
  if (window.__IRON_V421_LOADER__) return;
  window.__IRON_V421_LOADER__ = true;
  const buttons = ['newBtn', 'loadBtn'].map(id => document.getElementById(id)).filter(Boolean);
  buttons.forEach(button => { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = '正在载入稳定模块…'; });
  let finished = false;
  const unlock = (failed = false) => {
    if (finished) return;
    finished = true;
    buttons.forEach(button => { button.disabled = false; button.textContent = button.dataset.originalText || button.textContent; });
    if (failed) console.warn('性能优化模块载入失败，已启用基础兼容模式。');
  };
  const load = (src, done) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = done || null;
    script.onerror = () => unlock(true);
    document.head.appendChild(script);
  };
  load('engine-v421.js?v=421s3', () => load('ux-v421.js?v=421s3', () => unlock(false)));
  setTimeout(() => unlock(true), 8000);
})();
