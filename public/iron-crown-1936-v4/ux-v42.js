'use strict';

/** V4.2 UX: auto-start clock, stall watchdog, event center and operational alerts. */
(() => {
  let lastDay = null;
  let lastDayChangedAt = Date.now();

  function ensureEventCenter() {
    if (document.getElementById('v42EventCenter')) return;
    const box = document.createElement('section');
    box.id = 'v42EventCenter';
    box.className = 'v42-event-center hidden';
    box.innerHTML = '<header><b>战略事件与预警</b><button id="v42EventClose">×</button></header><div id="v42EventBody"></div>';
    document.body.appendChild(box);
    document.getElementById('v42EventClose').onclick = () => box.classList.add('hidden');

    const button = document.createElement('button');
    button.id = 'v42EventButton';
    button.className = 'v42-event-button';
    button.textContent = '预警';
    document.body.appendChild(button);
    button.onclick = () => { renderEventCenter(); box.classList.toggle('hidden'); };
  }

  function renderEventCenter() {
    if (!GameV4) return;
    ensureEventCenter();
    const body = document.getElementById('v42EventBody');
    const alerts = GameV4.intelligenceAlerts || [];
    const spanish = GameV4.civilWars?.spain;
    const operations = GameV4.expeditions || [];
    body.innerHTML = `
      ${spanish ? `<article class="v42-event-card"><h3>西班牙内战</h3><p>阶段：${spanish.phase}${spanish.resolved ? ` · 胜方：${spanish.winner === 'nationalist' ? '国民军' : '共和国'}` : ''}</p><p>共和国支持度 ${Math.round(spanish.republican.support)} · 国民军支持度 ${Math.round(spanish.nationalist.support)}</p>${spanish.resolved ? '' : `<div class="v42-actions"><button data-spain="republican" data-package="equipment">援助共和国装备</button><button data-spain="nationalist" data-package="equipment">援助国民军装备</button><button data-spain="republican" data-package="air">支援共和国空军</button><button data-spain="nationalist" data-package="air">支援国民军空军</button></div>`}</article>` : ''}
      ${operations.length ? `<article class="v42-event-card"><h3>联合行动</h3>${operations.map(op => `<p>${GameV4.provinces[op.sourceProvinceId]?.name} → ${GameV4.provinces[op.targetProvinceId]?.name} · ${op.status} · 计划${Math.round(op.planning)}% · 进度${Math.round(op.progress)}%</p>`).join('')}</article>` : ''}
      <article class="v42-event-card"><h3>最近预警</h3>${alerts.slice(0, 12).map(a => `<button class="v42-alert ${a.severity}" data-alert-province="${a.provinceId || ''}"><time>${a.date}</time><span>${a.text}</span></button>`).join('') || '<p>暂无预警。</p>'}</article>`;
    body.querySelectorAll('[data-spain]').forEach(button => button.onclick = () => {
      const result = GameV4.supportSpanishFaction(GameV4.player, button.dataset.spain, button.dataset.package);
      const toast = document.getElementById('v41Toast');
      if (toast) { toast.textContent = result.ok ? '援助已经送出' : result.reason; toast.className = `v41-toast ${result.ok ? 'good' : 'bad'}`; setTimeout(() => toast.classList.add('hidden'), 2200); }
      renderEventCenter();
    });
    body.querySelectorAll('[data-alert-province]').forEach(button => button.onclick = () => {
      const id = button.dataset.alertProvince;
      if (id) MapV4.selectProvince(id, true);
    });
    const unread = alerts.filter(a => !a.read).length;
    document.getElementById('v42EventButton').textContent = unread ? `预警 ${unread}` : '预警';
  }

  function autoStartClock() {
    if (!GameV4) return;
    GameV4.clock ??= { desiredSpeed: 1, lastAdvanceAt: Date.now(), stalledTicks: 0 };
    if (GameV4.speed === 0 && !GameV4.__userPaused) {
      GameV4.setSpeed(GameV4.clock.desiredSpeed || 1);
      document.querySelectorAll('.speed-button').forEach(b => b.classList.toggle('active', Number(b.dataset.speed) === GameV4.speed));
    }
  }

  document.addEventListener('click', event => {
    const speed = event.target.closest?.('.speed-button');
    if (!speed || !GameV4) return;
    const value = Number(speed.dataset.speed);
    GameV4.__userPaused = value === 0;
    if (value > 0) GameV4.clock.desiredSpeed = value;
  }, true);

  ensureEventCenter();
  setInterval(() => {
    if (!GameV4) return;
    if (lastDay === null) { lastDay = GameV4.day; lastDayChangedAt = Date.now(); autoStartClock(); }
    if (GameV4.day !== lastDay) { lastDay = GameV4.day; lastDayChangedAt = Date.now(); }
    if (GameV4.speed > 0 && Date.now() - lastDayChangedAt > 4500) {
      GameV4.advanceDay();
      lastDayChangedAt = Date.now();
      GameV4.pushAlert('系统', '时间循环已从停摆状态自动恢复。', null, 'info');
    }
    autoStartClock();
    renderEventCenter();
  }, 1000);
})();
