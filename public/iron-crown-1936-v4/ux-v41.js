'use strict';

/** Stable shared loader for V4.1/V4.2. Prevents the former 280ms global polling loop. */
(() => {
  if (window.__IRON_V421_LOADER__) return;
  window.__IRON_V421_LOADER__ = true;
  const load = (src, done) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = done || null;
    script.onerror = () => console.error(`无法载入性能优化模块：${src}`);
    document.head.appendChild(script);
  };
  load('engine-v421.js?v=421s2', () => load('ux-v421.js?v=421s2'));
})();
