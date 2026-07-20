'use strict';

/** Unifies the former alert widget into the V4.3.1 strategic event center. */
(() => {
  if (window.__IRON_V431_INTEL_ACTIVE__) return;
  window.__IRON_V431_INTEL_ACTIVE__ = true;
  let lastSignature = '';

  function renderIntelligenceFeed() {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    const oldButton = document.getElementById('v42EventButton');
    const oldCenter = document.getElementById('v42EventCenter');
    if (oldButton) oldButton.classList.add('v431-retired-alert');
    if (oldCenter) oldCenter.classList.add('v431-retired-alert');

    const decisionButton = document.getElementById('v431DecisionButton');
    const strategicBody = document.getElementById('v431StrategicBody');
    if (!decisionButton || !strategicBody) return;
    const alerts = GameV4.intelligenceAlerts || [];
    const unread = alerts.filter(alert => !alert.read).length;
    decisionButton.dataset.unread = unread ? String(unread) : '';

    const signature = alerts.slice(0, 12).map(alert => `${alert.id}:${alert.read}`).join('|');
    const existing = strategicBody.querySelector('.v431-intelligence-section');
    if (existing && signature === lastSignature) return;
    lastSignature = signature;
    existing?.remove();

    const section = document.createElement('section');
    section.className = 'v431-event-section v431-intelligence-section';
    section.innerHTML = `<div class="v431-intelligence-heading"><h3>情报与作战预警</h3><button data-v431-read-all ${unread ? '' : 'disabled'}>全部标记已读</button></div>${alerts.slice(0, 12).map(alert => `<button class="v431-intelligence-row ${alert.severity || ''} ${alert.read ? 'read' : ''}" data-v431-alert-province="${alert.provinceId || ''}" data-v431-alert-id="${alert.id}"><time>${alert.date}</time><span><b>${alert.type || '情报'}</b>${alert.text}</span></button>`).join('') || '<div class="v431-empty"><span>当前没有新的情报或作战预警。</span></div>'}`;
    strategicBody.appendChild(section);

    section.querySelector('[data-v431-read-all]')?.addEventListener('click', () => {
      alerts.forEach(alert => { alert.read = true; });
      lastSignature = '';
      renderIntelligenceFeed();
    });
    section.querySelectorAll('[data-v431-alert-id]').forEach(button => button.onclick = () => {
      const alert = alerts.find(item => item.id === button.dataset.v431AlertId);
      if (alert) alert.read = true;
      const provinceId = button.dataset.v431AlertProvince;
      if (provinceId) {
        document.getElementById('v431StrategicCenter')?.classList.add('hidden');
        MapV4.selectProvince(provinceId, true);
      }
      lastSignature = '';
      renderIntelligenceFeed();
    });
  }

  document.addEventListener('click', event => {
    if (!event.target.closest?.('#v431DecisionButton')) return;
    setTimeout(() => {
      const alerts = typeof GameV4 !== 'undefined' && GameV4 ? GameV4.intelligenceAlerts || [] : [];
      alerts.forEach(alert => { alert.read = true; });
      lastSignature = '';
      renderIntelligenceFeed();
    }, 80);
  }, true);

  setInterval(renderIntelligenceFeed, 950);
})();
