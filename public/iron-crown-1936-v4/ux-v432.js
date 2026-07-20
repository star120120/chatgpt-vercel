'use strict';

/** V4.3.2 operational-war visualization and battle reporting. */
(() => {
  if (window.__IRON_V432_UX_ACTIVE__) return;
  window.__IRON_V432_UX_ACTIVE__ = true;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let lastSignature = '';
  let inspectorTimer = null;

  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function countryName(code) {
    return GameV4?.countries?.[code]?.short || code || '未知';
  }

  function ensureOperationalVisualLayer() {
    const world = document.getElementById('mapWorld');
    if (!world) return null;
    let layer = document.getElementById('operationalWarLayer');
    if (!layer) {
      layer = svgEl('g', { id: 'operationalWarLayer', class: 'v432-operational-war-layer' });
      const labelLayer = document.getElementById('labelLayer');
      world.insertBefore(layer, labelLayer || null);
    }
    return layer;
  }

  function ensureArrowMarker() {
    const defs = document.querySelector('#strategyMap defs');
    if (!defs || document.getElementById('v432ArrowMarker')) return;
    const marker = svgEl('marker', {
      id: 'v432ArrowMarker',
      viewBox: '0 0 10 10',
      refX: 8,
      refY: 5,
      markerWidth: 5,
      markerHeight: 5,
      orient: 'auto-start-reverse',
      markerUnits: 'strokeWidth',
    });
    marker.appendChild(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'v432-arrow-head' }));
    defs.appendChild(marker);
  }

  function daysBetween(dateA, dateB) {
    if (!dateA || !dateB) return 999;
    return Math.abs((new Date(`${dateA}T00:00:00Z`) - new Date(`${dateB}T00:00:00Z`)) / 86400000);
  }

  function addProvinceOverlay(layer, provinceId, className, color, titleText) {
    const sourcePath = document.querySelector(`.province-shape[data-id="${CSS.escape(provinceId)}"]`);
    if (!sourcePath) return;
    const path = svgEl('path', {
      d: sourcePath.getAttribute('d'),
      class: className,
      'data-war-province': provinceId,
    });
    path.style.setProperty('--war-color', color || '#d3b65a');
    const title = svgEl('title');
    title.textContent = titleText;
    path.appendChild(title);
    path.addEventListener('click', event => {
      event.stopPropagation();
      MapV4.selectProvince(provinceId, false);
    });
    layer.appendChild(path);
  }

  function addPhaseMarker(layer, front) {
    const source = MapV4.getProvince(front.source);
    const target = MapV4.getProvince(front.target);
    if (!source || !target) return;
    const [x1, y1] = MapV4.project(source.center);
    const [x2, y2] = MapV4.project(target.center);
    const attackerColor = GameV4.countries[front.attacker]?.color || '#d5bb6d';
    const line = svgEl('path', {
      d: `M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 - 16} ${x2},${y2}`,
      class: `v432-operation-arrow ${front.phase || 'battle'}`,
      'marker-end': 'url(#v432ArrowMarker)',
    });
    line.style.setProperty('--war-color', attackerColor);
    layer.appendChild(line);

    const scale = 1 / Math.max(1, MapV4.getZoom());
    const x = (x1 + x2) / 2;
    const y = (y1 + y2) / 2 - 14;
    const marker = svgEl('g', {
      class: `v432-phase-marker ${front.phase || 'battle'}`,
      transform: `translate(${x} ${y}) scale(${scale})`,
    });
    marker.appendChild(svgEl('rect', { x: -32, y: -10, width: 64, height: 20, rx: 7 }));
    const text = svgEl('text', { x: 0, y: 3.5 });
    text.textContent = GameV4.frontPhaseLabel(front);
    marker.appendChild(text);
    const title = svgEl('title');
    const targetProvince = GameV4.provinces[front.target];
    const progressText = ['breakthrough', 'occupation'].includes(front.phase)
      ? `控制权争夺 ${Math.round(front.occupationProgress || 0)}%`
      : `战斗态势 ${front.progress >= 25 ? '进攻方占优' : front.progress <= -25 ? '防守方占优' : '双方胶着'}`;
    title.textContent = `${countryName(front.attacker)}进攻${targetProvince?.name || ''} · ${progressText}`;
    marker.appendChild(title);
    marker.addEventListener('click', event => {
      event.stopPropagation();
      MapV4.selectProvince(front.target, false);
    });
    layer.appendChild(marker);
  }

  function addRetreatArrow(layer, retreat) {
    if (daysBetween(GameV4.date, retreat.date) > 12) return;
    const source = MapV4.getProvince(retreat.from);
    const target = MapV4.getProvince(retreat.to);
    if (!source || !target) return;
    const [x1, y1] = MapV4.project(source.center);
    const [x2, y2] = MapV4.project(target.center);
    const line = svgEl('line', {
      x1, y1, x2, y2,
      class: 'v432-retreat-arrow',
      'marker-end': 'url(#v432ArrowMarker)',
    });
    const title = svgEl('title');
    title.textContent = `${countryName(retreat.controller)}守军从${GameV4.provinces[retreat.from]?.name}撤往${GameV4.provinces[retreat.to]?.name}`;
    line.appendChild(title);
    layer.appendChild(line);
  }

  function addRecentReportBubble(layer, report) {
    if (daysBetween(GameV4.date, report.date) > 4 || !report.provinceId) return;
    const province = MapV4.getProvince(report.provinceId);
    if (!province) return;
    const [x, y] = MapV4.project(province.center);
    const scale = 1 / Math.max(1, MapV4.getZoom());
    const group = svgEl('g', {
      class: `v432-report-bubble ${report.type || ''}`,
      transform: `translate(${x} ${y - 28}) scale(${scale})`,
    });
    group.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 9 }));
    const symbol = svgEl('text', { x: 0, y: 3.4 });
    symbol.textContent = report.type === 'occupation' ? '旗' : report.type === 'retreat' ? '退' : report.type === 'encirclement' ? '围' : '!';
    group.appendChild(symbol);
    const title = svgEl('title');
    title.textContent = `${report.title}：${report.text}`;
    group.appendChild(title);
    group.addEventListener('click', event => {
      event.stopPropagation();
      MapV4.selectProvince(report.provinceId, false);
      openWarLog();
    });
    layer.appendChild(group);
  }

  function warVisualSignature() {
    if (typeof GameV4 === 'undefined' || !GameV4) return '';
    const state = GameV4.ensureOperationalWarState();
    const fronts = GameV4.fronts.map(front => `${front.id}:${front.phase}:${Math.round(front.progress)}:${Math.round(front.occupationProgress || 0)}:${front.active}`).join('|');
    const occupations = Object.values(state.provinces).map(item => `${item.provinceId}:${item.phase}:${Math.round(item.control || 0)}:${item.controller}`).join('|');
    const retreats = state.retreats.slice(0, 8).map(item => `${item.date}:${item.from}:${item.to}`).join('|');
    return `${GameV4.date}|${MapV4.getZoom().toFixed(2)}|${fronts}|${occupations}|${retreats}`;
  }

  function renderOperationalWar(force = false) {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    ensureArrowMarker();
    const layer = ensureOperationalVisualLayer();
    if (!layer) return;
    const signature = warVisualSignature();
    if (!force && signature === lastSignature) return;
    lastSignature = signature;
    layer.replaceChildren();
    const state = GameV4.ensureOperationalWarState();

    for (const occupation of Object.values(state.provinces)) {
      const controllerColor = GameV4.countries[occupation.controller || occupation.attacker]?.color || '#c8a958';
      if (occupation.phase === 'breakthrough' || occupation.phase === 'occupation') {
        addProvinceOverlay(layer, occupation.provinceId, `v432-contested-overlay ${occupation.phase}`, controllerColor,
          `${GameV4.provinces[occupation.provinceId]?.name}：${countryName(occupation.attacker)}正在争夺控制权，尚未正式易手。`);
      } else if (occupation.phase === 'occupied' && occupation.owner !== occupation.controller) {
        addProvinceOverlay(layer, occupation.provinceId, 'v432-occupied-overlay', controllerColor,
          `${GameV4.provinces[occupation.provinceId]?.name}：法理属于${countryName(occupation.owner)}，现由${countryName(occupation.controller)}占领。`);
      }
    }

    for (const front of GameV4.fronts) {
      if (front.active || ['breakthrough', 'occupation'].includes(front.phase)) addPhaseMarker(layer, front);
    }
    for (const retreat of state.retreats.slice(0, 12)) addRetreatArrow(layer, retreat);
    for (const report of state.reports.slice(0, 8)) addRecentReportBubble(layer, report);
  }

  function battleStateText(state) {
    if (!state) return '';
    if (state.phase === 'planning') return '部队正在积累计划度，尚未发起进攻。';
    if (state.phase === 'contact') return '前锋部队正在接敌，双方主力尚未全部投入。';
    if (state.phase === 'battle') return '双方在战场宽度限制下持续交战，组织度和补给将决定能否突破。';
    if (state.phase === 'breakthrough') return '守军防线已经被撕开，但该地区仍由原守军控制。';
    if (state.phase === 'occupation') return '进攻方正在建立道路、城市和补给节点控制，地区尚未正式易手。';
    if (state.phase === 'repulsed') return '进攻未能建立稳定突破口，战线暂时停止。';
    if (state.phase === 'occupied') return '地区已经完成军事占领，但法理所有权没有自动改变。';
    return '';
  }

  function enhanceInspector() {
    if (typeof GameV4 === 'undefined' || !GameV4?.selectedProvince) return;
    const host = document.getElementById('inspectorContent');
    if (!host) return;
    const provinceId = GameV4.selectedProvince;
    const state = GameV4.getProvinceBattleState(provinceId);
    host.querySelector('.v432-battle-card')?.remove();
    host.querySelectorAll('.inspector-section').forEach(section => {
      if (section.querySelector('.front-card')) section.classList.toggle('v432-old-front-hidden', Boolean(state));
    });
    if (!state) return;

    const province = GameV4.provinces[provinceId];
    const attacker = countryName(state.attacker);
    const defender = countryName(state.defender);
    const report = state.lastReport;
    const attackerSupply = report?.attackerSupply || (state.front ? GameV4.operationalSupplyStatus(state.attacker, state.front.source) : null);
    const defenderSupply = report?.defenderSupply || GameV4.operationalSupplyStatus(state.defender || province.controller, provinceId);
    const control = Math.round(state.control || 0);
    const occupation = state.occupation;
    const eastPrussiaNote = /东普鲁士/.test(province.name)
      ? `<div class="v432-enclave-note"><b>东普鲁士飞地</b><span>${defenderSupply?.route === 'sea' ? `当前依靠${defenderSupply.label}维持。波罗的海遭封锁时，补给和防御效率会迅速下降。` : defenderSupply?.route === 'isolated' ? '陆路与海运补给均未建立，守军处于孤立状态。' : `当前补给：${defenderSupply?.label || '未知'}。`}</span></div>`
      : '';

    const card = document.createElement('section');
    card.className = `v432-battle-card phase-${state.phase}`;
    card.innerHTML = `<header><div><small>区域作战过程</small><h3>${province.name} · ${state.phaseLabel}</h3></div><span>${attacker} → ${defender}</span></header><p>${battleStateText(state)}</p><div class="v432-control-track"><i style="width:${control}%"></i></div><div class="v432-control-labels"><span>${state.phase === 'occupied' ? `现控制：${countryName(province.controller)}` : `进攻方控制建立：${control}%`}</span><span>${state.days || 0}天</span></div><div class="v432-battle-grid"><div><small>进攻方补给</small><b>${attackerSupply?.label || '准备中'}</b></div><div><small>防守方补给</small><b>${defenderSupply?.label || '未知'}</b></div><div><small>进攻累计伤亡</small><b>${Math.round(state.front?.attackerCasualties || occupation?.attackerCasualties || 0).toLocaleString()}</b></div><div><small>防守累计伤亡</small><b>${Math.round(state.front?.defenderCasualties || occupation?.defenderCasualties || 0).toLocaleString()}</b></div></div>${eastPrussiaNote}${occupation?.legacy ? `<div class="v432-legacy-note">${occupation.note}</div>` : ''}<button data-v432-open-war-log>打开战况记录</button>`;
    const provinceCard = host.querySelector('.province-card');
    if (provinceCard) provinceCard.after(card); else host.prepend(card);
    card.querySelector('[data-v432-open-war-log]').onclick = openWarLog;
  }

  function ensureWarLog() {
    if (!document.getElementById('v432WarLogButton')) {
      const button = document.createElement('button');
      button.id = 'v432WarLogButton';
      button.className = 'v432-war-log-button';
      button.textContent = '战况';
      button.onclick = openWarLog;
      document.body.appendChild(button);
    }
    if (!document.getElementById('v432WarLog')) {
      const panel = document.createElement('section');
      panel.id = 'v432WarLog';
      panel.className = 'v432-war-log hidden';
      panel.innerHTML = '<header><div><small>逐日战线与占领记录</small><b>战况中心</b></div><button data-v432-close-war-log>×</button></header><div id="v432WarLogBody"></div>';
      document.body.appendChild(panel);
      panel.querySelector('[data-v432-close-war-log]').onclick = () => panel.classList.add('hidden');
    }
  }

  function openWarLog() {
    ensureWarLog();
    renderWarLog();
    document.getElementById('v432WarLog').classList.remove('hidden');
  }

  function renderWarLog() {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    ensureWarLog();
    const state = GameV4.ensureOperationalWarState();
    const active = GameV4.fronts.filter(front => front.active || ['breakthrough', 'occupation'].includes(front.phase));
    const body = document.getElementById('v432WarLogBody');
    body.innerHTML = `<section><h3>正在进行的战役</h3>${active.map(front => {
      const target = GameV4.provinces[front.target];
      const progressText = ['breakthrough', 'occupation'].includes(front.phase)
        ? `控制权建立${Math.round(front.occupationProgress || 0)}%`
        : front.progress > 25 ? '进攻方占优' : front.progress < -25 ? '防守方占优' : '双方胶着';
      return `<button class="v432-active-battle" data-v432-front-target="${front.target}"><b>${countryName(front.attacker)} → ${target?.name}</b><span>${GameV4.frontPhaseLabel(front)} · ${progressText}</span><small>持续${front.daysFought + (front.phaseDays || 0)}天 · 进攻伤亡${Math.round(front.attackerCasualties || 0).toLocaleString()} · 防守伤亡${Math.round(front.defenderCasualties || 0).toLocaleString()}</small></button>`;
    }).join('') || '<div class="v432-empty-war">当前没有正在推进的战役。</div>'}</section><section><h3>近期战况</h3>${state.reports.slice(0, 20).map(report => `<button class="v432-war-report" data-v432-report-province="${report.provinceId || ''}"><time>${report.date}</time><div><b>${report.title}</b><span>${report.text}</span></div></button>`).join('') || '<div class="v432-empty-war">尚无战况记录。</div>'}</section><section><h3>部队重建名册</h3>${Object.values(GameV4.countries).flatMap(country => (country.reconstitutionPool || []).map(item => ({ ...item, country: country.short }))).slice(-12).reverse().map(item => `<article class="v432-reconstitution"><time>${item.date}</time><div><b>${item.country} · ${item.name}</b><span>${item.reason}</span></div></article>`).join('') || '<div class="v432-empty-war">没有撤销番号的严重减员部队。</div>'}</section>`;
    body.querySelectorAll('[data-v432-front-target],[data-v432-report-province]').forEach(button => button.onclick = () => {
      const provinceId = button.dataset.v432FrontTarget || button.dataset.v432ReportProvince;
      if (!provinceId) return;
      document.getElementById('v432WarLog').classList.add('hidden');
      MapV4.selectProvince(provinceId, true);
    });
  }

  ensureWarLog();
  const inspector = document.getElementById('inspectorContent');
  if (inspector) new MutationObserver(() => {
    clearTimeout(inspectorTimer);
    inspectorTimer = setTimeout(enhanceInspector, 80);
  }).observe(inspector, { childList: true, subtree: false });
  const world = document.getElementById('mapWorld');
  if (world) new MutationObserver(() => renderOperationalWar(true)).observe(world, { attributes: true, attributeFilter: ['transform'] });

  setInterval(() => {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    renderOperationalWar(false);
    enhanceInspector();
    const button = document.getElementById('v432WarLogButton');
    const active = GameV4.fronts.filter(front => front.active || ['breakthrough', 'occupation'].includes(front.phase)).length;
    button.textContent = active ? `战况 ${active}` : '战况';
    if (!document.getElementById('v432WarLog').classList.contains('hidden')) renderWarLog();
  }, 800);
})();
