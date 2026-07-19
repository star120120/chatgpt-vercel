'use strict';

/** V4.2.1 stable UX: event-driven updates, low-frequency polling and a guarded clock watchdog. */
(() => {
  if (window.__IRON_V421_UX_ACTIVE__) return;
  window.__IRON_V421_UX_ACTIVE__ = true;
  const BUILD_LABELS = {
    civ: '民用工厂', mil: '军用工厂', dockyard: '海军船坞', infrastructure: '基础设施',
    rail: '铁路', fort: '陆上要塞', airBase: '空军基地', navalBase: '海军基地', supplyHub: '补给枢纽',
  };
  const directTypes = new Set(['navalBase', 'fort', 'airBase']);
  const shownBattleEvents = new Set();
  let tooltipTimer = null;
  let lastObservedDay = null;
  let lastDayChangedAt = Date.now();
  let lastEventSignature = '';
  let inspectorTimer = null;
  let panelTimer = null;

  const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

  function ensureOverlay() {
    if (!document.getElementById('v421Tooltip')) {
      const tooltip = document.createElement('div');
      tooltip.id = 'v421Tooltip';
      tooltip.className = 'v41-tooltip hidden';
      document.body.appendChild(tooltip);
    }
    if (!document.getElementById('v421BattleLayer')) {
      const layer = document.createElement('div');
      layer.id = 'v421BattleLayer';
      layer.className = 'v41-battle-layer';
      document.body.appendChild(layer);
    }
    if (!document.getElementById('v421Toast')) {
      const toast = document.createElement('div');
      toast.id = 'v421Toast';
      toast.className = 'v41-toast hidden';
      document.body.appendChild(toast);
    }
    if (!document.getElementById('v42EventCenter')) {
      const center = document.createElement('section');
      center.id = 'v42EventCenter';
      center.className = 'v42-event-center hidden';
      center.innerHTML = '<header><b>战略事件与预警</b><button id="v42EventClose">×</button></header><div id="v42EventBody"></div>';
      document.body.appendChild(center);
      document.getElementById('v42EventClose').onclick = () => center.classList.add('hidden');
    }
    if (!document.getElementById('v42EventButton')) {
      const button = document.createElement('button');
      button.id = 'v42EventButton';
      button.className = 'v42-event-button hidden';
      button.textContent = '预警';
      document.body.appendChild(button);
      button.onclick = () => {
        const center = document.getElementById('v42EventCenter');
        center.classList.toggle('hidden');
        if (!center.classList.contains('hidden')) {
          for (const alert of GameV4?.intelligenceAlerts || []) alert.read = true;
          renderEventCenter(true);
        }
      };
    }
    if (!document.getElementById('v421PerformanceBadge')) {
      const badge = document.createElement('div');
      badge.id = 'v421PerformanceBadge';
      badge.className = 'v421-performance-badge hidden';
      document.body.appendChild(badge);
    }
  }

  function showToast(text, type = 'bad') {
    ensureOverlay();
    const toast = document.getElementById('v421Toast');
    toast.textContent = text;
    toast.className = `v41-toast ${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }

  function showTooltip(anchor, text, duration = 2400) {
    ensureOverlay();
    const tooltip = document.getElementById('v421Tooltip');
    tooltip.textContent = text;
    tooltip.classList.remove('hidden');
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(300, Math.max(190, tooltip.offsetWidth));
    const left = clampNumber(rect.left + rect.width / 2 - width / 2, 8, window.innerWidth - width - 8);
    let top = rect.top - tooltip.offsetHeight - 10;
    if (top < 8) top = rect.bottom + 10;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => tooltip.classList.add('hidden'), duration);
  }

  function enhanceInspector() {
    if (!GameV4?.selectedProvince) return;
    const province = GameV4.provinces[GameV4.selectedProvince];
    const actions = document.querySelector('#inspectorContent .province-actions');
    if (!province || !actions) return;

    for (const type of directTypes) {
      if (actions.querySelector(`[data-build="${type}"]`)) continue;
      const button = document.createElement('button');
      button.dataset.build = type;
      button.dataset.v421Direct = 'true';
      button.textContent = BUILD_LABELS[type];
      actions.appendChild(button);
    }

    actions.querySelectorAll('[data-build]').forEach(button => {
      const type = button.dataset.build;
      const result = GameV4.getConstructionEligibility(province.id, type);
      const rule = BUILDING_RULES[type];
      button.disabled = false;
      button.setAttribute('aria-disabled', String(!result.ok));
      button.classList.toggle('rule-disabled', !result.ok);
      button.dataset.ruleReason = result.reason;
      button.title = result.reason;
      if (rule) button.textContent = `${BUILD_LABELS[type] || rule.name} ${Number(province[type] || 0)}/${rule.maxLevel}`;
    });

    const card = document.querySelector('#inspectorContent .province-card');
    if (card && !card.querySelector('.v41-province-intel')) {
      const supply = province.supplyReport || GameV4.calculateSupplyFlow(province.controller, province.id);
      const shortages = GameV4.countries[province.controller]?.shortages || {};
      const shortageText = Object.entries(shortages).filter(([, active]) => active).map(([key]) => RESOURCE_NAMES[key]).join('、') || '无';
      const intel = document.createElement('div');
      intel.className = 'v41-province-intel';
      intel.innerHTML = `<span class="${province.isCoastal ? 'good' : ''}">${province.isCoastal ? '⚓ 沿海省份' : '▣ 内陆省份'}</span><span>补给链：${supply.connected ? `畅通 · 瓶颈铁路${supply.bottleneckRail}级` : supply.reason}</span>${province.specialRole ? `<span class="gold">★ ${province.specialRole}</span>` : ''}<span class="${shortageText === '无' ? '' : 'bad'}">战略短缺：${shortageText}</span>`;
      card.appendChild(intel);
    }
  }

  function enhancePanelButtons() {
    if (!GameV4) return;
    document.querySelectorAll('#systemPanel [data-decision]').forEach(button => {
      const result = GameV4.getDecisionEligibility(button.dataset.decision, GameV4.selectedProvince);
      button.disabled = false;
      button.setAttribute('aria-disabled', String(!result.ok));
      button.classList.toggle('rule-disabled', !result.ok);
      button.dataset.ruleReason = result.reason;
    });
    document.querySelectorAll('#systemPanel [data-policy]').forEach(button => {
      const result = GameV4.getPolicyEligibility(button.dataset.policy);
      button.disabled = false;
      button.setAttribute('aria-disabled', String(!result.ok));
      button.classList.toggle('rule-disabled', !result.ok);
      button.dataset.ruleReason = result.reason;
    });
  }

  function screenPoint(event) {
    const svg = document.getElementById('strategyMap');
    const world = document.getElementById('mapWorld');
    const matrix = world?.getScreenCTM?.();
    if (!svg || !matrix) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const point = svg.createSVGPoint();
    point.x = event.x;
    point.y = event.y;
    const transformed = point.matrixTransform(matrix);
    return { x: transformed.x, y: transformed.y };
  }

  function renderBattleEvents() {
    if (!GameV4?.battleEvents?.length) return;
    ensureOverlay();
    const layer = document.getElementById('v421BattleLayer');
    for (const event of GameV4.battleEvents.slice(-12)) {
      if (shownBattleEvents.has(event.id)) continue;
      shownBattleEvents.add(event.id);
      const point = screenPoint(event);
      const bubble = document.createElement('div');
      bubble.className = `v41-battle-bubble ${event.result || 'battle'}`;
      bubble.textContent = event.text;
      bubble.style.left = `${clampNumber(point.x, 80, window.innerWidth - 80)}px`;
      bubble.style.top = `${clampNumber(point.y, 100, window.innerHeight - 110)}px`;
      layer.appendChild(bubble);
      requestAnimationFrame(() => bubble.classList.add('show'));
      setTimeout(() => bubble.classList.add('leave'), 2600);
      setTimeout(() => bubble.remove(), event.ttl || 3800);
    }
    if (shownBattleEvents.size > 120) shownBattleEvents.clear();
  }

  function eventSignature() {
    const alerts = GameV4?.intelligenceAlerts || [];
    const spanish = GameV4?.civilWars?.spain;
    const operations = GameV4?.expeditions || [];
    return `${alerts[0]?.id || ''}|${alerts.length}|${spanish?.resolved || false}|${spanish?.republican?.support || 0}|${spanish?.nationalist?.support || 0}|${operations.map(op => `${op.id}:${op.status}:${Math.round(op.progress)}`).join(',')}`;
  }

  function renderEventCenter(force = false) {
    if (!GameV4) return;
    ensureOverlay();
    const center = document.getElementById('v42EventCenter');
    const signature = eventSignature();
    const alerts = GameV4.intelligenceAlerts || [];
    const unread = alerts.filter(alert => !alert.read).length;
    document.getElementById('v42EventButton').textContent = unread ? `预警 ${unread}` : '预警';
    if (center.classList.contains('hidden')) return;
    if (!force && signature === lastEventSignature) return;
    lastEventSignature = signature;

    const spanish = GameV4.civilWars?.spain;
    const operations = GameV4.expeditions || [];
    const body = document.getElementById('v42EventBody');
    body.innerHTML = `${spanish ? `<article class="v42-event-card"><h3>西班牙内战</h3><p>阶段：${spanish.phase}${spanish.resolved ? ` · 胜方：${spanish.winner === 'nationalist' ? '国民军' : '共和国'}` : ''}</p><p>共和国支持度 ${Math.round(spanish.republican.support)} · 国民军支持度 ${Math.round(spanish.nationalist.support)}</p>${spanish.resolved ? '' : `<div class="v42-actions"><button data-spain="republican" data-package="equipment">援助共和国装备</button><button data-spain="nationalist" data-package="equipment">援助国民军装备</button><button data-spain="republican" data-package="air">支援共和国空军</button><button data-spain="nationalist" data-package="air">支援国民军空军</button></div>`}</article>` : ''}${operations.length ? `<article class="v42-event-card"><h3>联合行动</h3>${operations.map(op => `<p>${GameV4.provinces[op.sourceProvinceId]?.name} → ${GameV4.provinces[op.targetProvinceId]?.name} · ${op.status} · 计划${Math.round(op.planning)}% · 进度${Math.round(op.progress)}%</p>`).join('')}</article>` : ''}<article class="v42-event-card"><h3>最近预警</h3>${alerts.slice(0, 12).map(alert => `<button class="v42-alert ${alert.severity}" data-alert-province="${alert.provinceId || ''}"><time>${alert.date}</time><span>${alert.text}</span></button>`).join('') || '<p>暂无预警。</p>'}</article>`;

    body.querySelectorAll('[data-spain]').forEach(button => button.onclick = () => {
      const result = GameV4.supportSpanishFaction(GameV4.player, button.dataset.spain, button.dataset.package);
      showToast(result.ok ? '援助已经送出' : result.reason, result.ok ? 'good' : 'bad');
      renderEventCenter(true);
    });
    body.querySelectorAll('[data-alert-province]').forEach(button => button.onclick = () => {
      const id = button.dataset.alertProvince;
      if (id) MapV4.selectProvince(id, true);
    });
  }

  function updatePerformanceBadge() {
    if (!GameV4) return;
    ensureOverlay();
    const badge = document.getElementById('v421PerformanceBadge');
    const ms = GameV4.performanceState?.lastAdvanceMs || 0;
    if (ms < 220) {
      badge.classList.add('hidden');
      return;
    }
    badge.textContent = ms > 800 ? `性能保护：单日 ${Math.round(ms)}ms` : `稳定模式 ${Math.round(ms)}ms`;
    badge.classList.remove('hidden');
  }

  function installRenderThrottle(elementId, minimumGap) {
    const element = document.getElementById(elementId);
    if (!element || element.__ironThrottleInstalled) return;
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!descriptor?.get || !descriptor?.set) return;
    element.__ironThrottleInstalled = true;
    element.__ironLastWrite = 0;
    element.__ironLastProvince = null;
    Object.defineProperty(element, 'innerHTML', {
      configurable: true,
      get() { return descriptor.get.call(this); },
      set(value) {
        const now = performance.now();
        const speed = GameV4?.speed || 0;
        const provinceChanged = elementId === 'inspectorContent' && element.__ironLastProvince !== GameV4?.selectedProvince;
        const forced = now < (window.__IRON_FORCE_RENDER_UNTIL || 0);
        const shouldThrottle = speed >= 2 && !provinceChanged && !forced && now - element.__ironLastWrite < minimumGap;
        if (shouldThrottle) return;
        element.__ironLastWrite = now;
        if (elementId === 'inspectorContent') element.__ironLastProvince = GameV4?.selectedProvince || null;
        descriptor.set.call(this, value);
      },
    });
  }

  function throttleMapMethod(name, minimumGap) {
    const original = MapV4?.[name];
    if (typeof original !== 'function' || original.__ironThrottled) return;
    let lastRun = 0;
    const wrapped = function throttledMapRender(...args) {
      const now = performance.now();
      const forced = now < (window.__IRON_FORCE_RENDER_UNTIL || 0);
      if (!forced && GameV4?.speed >= 2 && now - lastRun < minimumGap) return;
      lastRun = now;
      return original.apply(this, args);
    };
    wrapped.__ironThrottled = true;
    MapV4[name] = wrapped;
  }

  function autoStartClock() {
    if (!GameV4) return;
    GameV4.clock ??= { desiredSpeed: 1, lastAdvanceAt: Date.now(), stalledTicks: 0 };
    if (GameV4.speed === 0 && !GameV4.__userPaused && !GameV4.__autoStarted) {
      GameV4.__autoStarted = true;
      GameV4.clock.desiredSpeed = 1;
      GameV4.setSpeed(1);
      document.querySelectorAll('.speed-button').forEach(button => button.classList.toggle('active', Number(button.dataset.speed) === 1));
    }
  }

  function watchdogTick() {
    if (!GameV4) return;
    document.getElementById('v42EventButton')?.classList.remove('hidden');
    autoStartClock();
    if (lastObservedDay === null) {
      lastObservedDay = GameV4.day;
      lastDayChangedAt = Date.now();
    } else if (GameV4.day !== lastObservedDay) {
      lastObservedDay = GameV4.day;
      lastDayChangedAt = Date.now();
    } else if (GameV4.speed > 0 && !GameV4._advancingDay && Date.now() - lastDayChangedAt > 6000) {
      const advanced = GameV4.advanceDay();
      lastDayChangedAt = Date.now();
      if (advanced !== false) showToast('时间循环已自动恢复', 'good');
    }
    renderBattleEvents();
    renderEventCenter(false);
    updatePerformanceBadge();
  }

  document.addEventListener('click', event => {
    const speedButton = event.target.closest?.('.speed-button');
    if (speedButton && GameV4) {
      const speed = Number(speedButton.dataset.speed);
      GameV4.__userPaused = speed === 0;
      GameV4.__autoStarted = true;
      if (speed > 0) GameV4.clock.desiredSpeed = speed;
    }

    const buildButton = event.target.closest?.('[data-build]');
    if (buildButton && GameV4?.selectedProvince) {
      const result = GameV4.getConstructionEligibility(GameV4.selectedProvince, buildButton.dataset.build);
      if (!result.ok) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showTooltip(buildButton, result.reason);
        showToast(result.reason, 'bad');
      } else if (buildButton.dataset.v421Direct === 'true') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const ok = GameV4.queueConstruction(GameV4.selectedProvince, buildButton.dataset.build);
        showToast(ok ? `✅ ${BUILD_LABELS[buildButton.dataset.build]}已加入建设队列` : GameV4.lastActionResult?.reason || '❌ 无法建设', ok ? 'good' : 'bad');
      }
    }

    const ruleButton = event.target.closest?.('#systemPanel [data-decision], #systemPanel [data-policy]');
    if (ruleButton && ruleButton.dataset.ruleReason && ruleButton.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showTooltip(ruleButton, ruleButton.dataset.ruleReason);
      showToast(ruleButton.dataset.ruleReason, 'bad');
    }
  }, true);

  document.addEventListener('pointerover', event => {
    const button = event.target.closest?.('[data-rule-reason]');
    if (button?.dataset.ruleReason) showTooltip(button, button.dataset.ruleReason, 1500);
  }, true);

  ensureOverlay();
  document.addEventListener('pointerdown', () => { window.__IRON_FORCE_RENDER_UNTIL = performance.now() + 180; }, true);
  installRenderThrottle('inspectorContent', 320);
  installRenderThrottle('panelContent', 360);
  throttleMapMethod('updateStyles', 220);
  throttleMapMethod('renderUnits', 220);
  throttleMapMethod('renderFronts', 220);
  const inspector = document.getElementById('inspectorContent');
  if (inspector) {
    new MutationObserver(() => {
      clearTimeout(inspectorTimer);
      inspectorTimer = setTimeout(enhanceInspector, 80);
    }).observe(inspector, { childList: true, subtree: false });
  }
  const panel = document.getElementById('panelContent');
  if (panel) {
    new MutationObserver(() => {
      clearTimeout(panelTimer);
      panelTimer = setTimeout(enhancePanelButtons, 100);
    }).observe(panel, { childList: true, subtree: false });
  }

  setInterval(watchdogTick, 1200);
})();
