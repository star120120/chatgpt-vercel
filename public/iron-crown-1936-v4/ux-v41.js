'use strict';

/** V4.1 UX layer: actionable tooltips, construction rule feedback and battle bubbles. */
(() => {
  const BUILD_LABELS = {
    civ: '民用工厂', mil: '军用工厂', dockyard: '海军船坞', infrastructure: '基础设施',
    rail: '铁路', fort: '陆上要塞', airBase: '空军基地', navalBase: '海军基地', supplyHub: '补给枢纽',
  };
  const directTypes = new Set(['navalBase', 'fort', 'airBase']);
  const shownBattleEvents = new Set();
  let tooltipTimer = null;

  function ensureOverlay() {
    if (!document.getElementById('v41Tooltip')) {
      const tooltip = document.createElement('div');
      tooltip.id = 'v41Tooltip';
      tooltip.className = 'v41-tooltip hidden';
      document.body.appendChild(tooltip);
    }
    if (!document.getElementById('v41BattleLayer')) {
      const layer = document.createElement('div');
      layer.id = 'v41BattleLayer';
      layer.className = 'v41-battle-layer';
      document.body.appendChild(layer);
    }
    if (!document.getElementById('v41Toast')) {
      const toast = document.createElement('div');
      toast.id = 'v41Toast';
      toast.className = 'v41-toast hidden';
      document.body.appendChild(toast);
    }
  }

  function showRuleToast(text, type = 'bad') {
    ensureOverlay();
    const toast = document.getElementById('v41Toast');
    toast.textContent = text;
    toast.className = `v41-toast ${type}`;
    clearTimeout(showRuleToast.timer);
    showRuleToast.timer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }

  function showTooltip(anchor, text, duration = 2400) {
    ensureOverlay();
    const tooltip = document.getElementById('v41Tooltip');
    tooltip.textContent = text;
    tooltip.classList.remove('hidden');
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(300, Math.max(190, tooltip.offsetWidth));
    const left = clamp(rect.left + rect.width / 2 - width / 2, 8, window.innerWidth - width - 8);
    let top = rect.top - tooltip.offsetHeight - 10;
    if (top < 8) top = rect.bottom + 10;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => tooltip.classList.add('hidden'), duration);
  }

  function selectedProvince() {
    return GameV4?.selectedProvince ? GameV4.provinces[GameV4.selectedProvince] : null;
  }

  function enhanceInspector() {
    if (!GameV4) return;
    const province = selectedProvince();
    const actions = document.querySelector('#inspectorContent .province-actions');
    if (!province || !actions) return;

    for (const type of directTypes) {
      if (actions.querySelector(`[data-build="${type}"]`)) continue;
      const button = document.createElement('button');
      button.dataset.build = type;
      button.dataset.v41Direct = 'true';
      button.textContent = BUILD_LABELS[type];
      actions.appendChild(button);
    }

    actions.querySelectorAll('[data-build]').forEach(button => {
      const type = button.dataset.build;
      const eligibility = GameV4.getConstructionEligibility(province.id, type);
      const rule = BUILDING_RULES[type];
      const current = Number(province[type] || 0);
      button.disabled = false; // keep tappable so a rejected action can explain itself on iPad.
      button.setAttribute('aria-disabled', String(!eligibility.ok));
      button.classList.toggle('rule-disabled', !eligibility.ok);
      button.dataset.ruleReason = eligibility.reason;
      button.title = eligibility.reason;
      if (rule && !button.dataset.v41Named) {
        button.textContent = `${BUILD_LABELS[type] || rule.name} ${current}/${rule.maxLevel}`;
        button.dataset.v41Named = 'true';
      }
    });

    const card = document.querySelector('#inspectorContent .province-card');
    if (card && !card.querySelector('.v41-province-intel')) {
      const supply = province.supplyReport || GameV4.calculateSupplyFlow(province.controller, province.id);
      const shortages = GameV4.countries[province.controller]?.shortages || {};
      const shortageText = Object.entries(shortages).filter(([, active]) => active).map(([key]) => RESOURCE_NAMES[key]).join('、') || '无';
      const intel = document.createElement('div');
      intel.className = 'v41-province-intel';
      intel.innerHTML = `
        <span class="${province.isCoastal ? 'good' : ''}">${province.isCoastal ? '⚓ 沿海省份' : '▣ 内陆省份'}</span>
        <span>补给链：${supply.connected ? `畅通 · 瓶颈铁路${supply.bottleneckRail}级` : supply.reason}</span>
        ${province.specialRole ? `<span class="gold">★ ${province.specialRole}</span>` : ''}
        <span class="${shortageText === '无' ? '' : 'bad'}">战略短缺：${shortageText}</span>`;
      card.appendChild(intel);
    }
  }


  function enhancePoliticalButtons() {
    if (!GameV4) return;
    document.querySelectorAll('[data-decision]').forEach(button => {
      const result = GameV4.getDecisionEligibility(button.dataset.decision, GameV4.selectedProvince);
      button.disabled = false;
      button.setAttribute('aria-disabled', String(!result.ok));
      button.classList.toggle('rule-disabled', !result.ok);
      button.dataset.ruleReason = result.reason;
      button.title = result.reason;
    });
    document.querySelectorAll('[data-policy]').forEach(button => {
      const result = GameV4.getPolicyEligibility(button.dataset.policy);
      button.disabled = false;
      button.setAttribute('aria-disabled', String(!result.ok));
      button.classList.toggle('rule-disabled', !result.ok);
      button.dataset.ruleReason = result.reason;
      button.title = result.reason;
    });
  }

  function handlePoliticalClick(event) {
    const decisionButton = event.target.closest?.('[data-decision]');
    const policyButton = event.target.closest?.('[data-policy]');
    const button = decisionButton || policyButton;
    if (!button || !GameV4) return;
    const result = decisionButton
      ? GameV4.getDecisionEligibility(decisionButton.dataset.decision, GameV4.selectedProvince)
      : GameV4.getPolicyEligibility(policyButton.dataset.policy);
    if (result.ok) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showTooltip(button, result.reason);
    showRuleToast(result.reason, result.code === 'COMPLETED' ? 'good' : 'bad');
  }

  function handleBuildClick(event) {
    const button = event.target.closest?.('[data-build]');
    if (!button || !GameV4 || !GameV4.selectedProvince) return;
    const type = button.dataset.build;
    const eligibility = GameV4.getConstructionEligibility(GameV4.selectedProvince, type);
    if (!eligibility.ok) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showTooltip(button, eligibility.reason);
      showRuleToast(eligibility.reason, 'bad');
      return;
    }
    if (button.dataset.v41Direct === 'true') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const ok = GameV4.queueConstruction(GameV4.selectedProvince, type);
      showRuleToast(ok ? `✅ ${BUILD_LABELS[type]}已加入建设队列` : GameV4.lastActionResult?.reason || '❌ 无法建设', ok ? 'good' : 'bad');
      setTimeout(enhanceInspector, 20);
    }
  }

  function showButtonHint(event) {
    const button = event.target.closest?.('[data-build]');
    if (!button?.dataset.ruleReason) return;
    showTooltip(button, button.dataset.ruleReason, 1600);
  }

  function screenPoint(event) {
    const svg = document.getElementById('v4Map');
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
    const layer = document.getElementById('v41BattleLayer');
    for (const event of GameV4.battleEvents) {
      if (shownBattleEvents.has(event.id)) continue;
      shownBattleEvents.add(event.id);
      const point = screenPoint(event);
      const bubble = document.createElement('div');
      bubble.className = `v41-battle-bubble ${event.result || 'battle'}`;
      bubble.textContent = event.text;
      bubble.style.left = `${clamp(point.x, 80, window.innerWidth - 80)}px`;
      bubble.style.top = `${clamp(point.y, 100, window.innerHeight - 110)}px`;
      layer.appendChild(bubble);
      requestAnimationFrame(() => bubble.classList.add('show'));
      setTimeout(() => bubble.classList.add('leave'), 3000);
      setTimeout(() => bubble.remove(), event.ttl || 4200);
    }
  }

  function updateShortageBadge() {
    const country = GameV4?.currentCountry?.();
    const topbar = document.querySelector('.topbar');
    if (!country || !topbar) return;
    let badge = document.getElementById('v41ShortageBadge');
    const shortages = Object.entries(country.shortages || {}).filter(([, active]) => active).map(([key]) => RESOURCE_NAMES[key]);
    if (!shortages.length) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('button');
      badge.id = 'v41ShortageBadge';
      badge.className = 'v41-shortage-badge';
      topbar.appendChild(badge);
    }
    badge.textContent = `资源短缺：${shortages.join('、')}`;
    badge.onclick = () => showTooltip(badge, '❌ 战略资源为零：相关生产线、空军效率和机械化部队机动能力受到惩罚。请通过贸易或占领资源区恢复供应。', 3800);
  }

  ensureOverlay();
  document.addEventListener('click', handleBuildClick, true);
  document.addEventListener('click', handlePoliticalClick, true);
  document.addEventListener('pointerover', showButtonHint, true);
  document.addEventListener('focusin', showButtonHint, true);

  const observer = new MutationObserver(() => {
    enhanceInspector();
    enhancePoliticalButtons();
    updateShortageBadge();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setInterval(() => {
    enhanceInspector();
    enhancePoliticalButtons();
    renderBattleEvents();
    updateShortageBadge();
  }, 280);
})();
