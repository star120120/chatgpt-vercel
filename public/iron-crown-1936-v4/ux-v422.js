'use strict';

/** V4.2.2 interaction layer: hide numeric counters and expose army/air/navy directly on the map. */
(() => {
  if (window.__IRON_V422_UX_ACTIVE__) return;
  window.__IRON_V422_UX_ACTIVE__ = true;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TYPE_META = {
    infantry: { label: '步', name: '步兵', className: 'infantry' },
    motorized: { label: '摩', name: '摩托化', className: 'motorized' },
    armor: { label: '装', name: '装甲', className: 'armor' },
    mountain: { label: '山', name: '山地部队', className: 'mountain' },
  };
  let branch = 'army';
  let renderTimer = null;
  let lastSnapshotSignature = '';
  let inspectorTimer = null;
  let panelTimer = null;

  const svgElement = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function showToast(text, type = 'bad') {
    const node = document.getElementById('v421Toast') || document.getElementById('toast');
    if (!node) return;
    node.textContent = text;
    node.className = node.id === 'toast' ? `toast ${type}` : `v41-toast ${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => node.classList.add('hidden'), 2300);
  }

  function ensureNumericCounterControl() {
    const options = document.querySelector('.map-options');
    if (!options || document.getElementById('numericCounterToggle')) return;
    const label = document.createElement('label');
    label.className = 'v422-counter-toggle';
    label.innerHTML = '<input id="numericCounterToggle" type="checkbox"> 数字兵牌';
    options.insertBefore(label, options.lastElementChild);
    const input = label.querySelector('input');
    input.checked = false;
    window.__IRON_NUMERIC_COUNTERS__ = false;
    document.body.classList.remove('show-numeric-counters');
    input.onchange = () => {
      window.__IRON_NUMERIC_COUNTERS__ = input.checked;
      document.body.classList.toggle('show-numeric-counters', input.checked);
      if (!input.checked) document.getElementById('unitLayer')?.replaceChildren();
      else MapV4.renderUnits();
    };
  }

  function suppressNumericCounterDOM() {
    const layer = document.getElementById('unitLayer');
    if (!layer || layer.__v422Suppressed) return;
    layer.__v422Suppressed = true;
    const nativeAppend = layer.appendChild.bind(layer);
    layer.appendChild = node => window.__IRON_NUMERIC_COUNTERS__ ? nativeAppend(node) : node;
    layer.replaceChildren();
  }

  function ensureOperationalLayer() {
    const world = document.getElementById('mapWorld');
    if (!world) return null;
    let layer = document.getElementById('operationalLayer');
    if (!layer) {
      layer = svgElement('g', { id: 'operationalLayer', class: 'operational-layer' });
      world.appendChild(layer);
    }
    return layer;
  }

  function ensureBranchBar() {
    const stage = document.querySelector('.map-stage');
    if (!stage || document.getElementById('militaryBranchBar')) return;
    const bar = document.createElement('div');
    bar.id = 'militaryBranchBar';
    bar.className = 'v422-branch-bar';
    bar.innerHTML = '<span>作战单位</span><button data-military-branch="off">隐藏</button><button data-military-branch="army" class="active">陆军</button><button data-military-branch="air">空军</button><button data-military-branch="navy">海军</button>';
    stage.appendChild(bar);
    bar.querySelectorAll('[data-military-branch]').forEach(button => button.onclick = () => {
      branch = button.dataset.militaryBranch;
      if (GameV4) GameV4.ensureMilitaryUI().operationalBranch = branch;
      bar.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      renderOperationalMarkers(true);
    });
  }

  function markerTitle(group, text) {
    const title = svgElement('title');
    title.textContent = text;
    group.appendChild(title);
  }

  function markerAt(layer, coordinate, className, label, title, click) {
    const [x, y] = MapV4.project(coordinate);
    const scale = 1 / Math.max(1, MapV4.getZoom());
    const group = svgElement('g', { class: `operational-marker ${className}`, transform: `translate(${x} ${y}) scale(${scale})` });
    group.appendChild(svgElement('circle', { cx: 0, cy: 0, r: 12 }));
    const text = svgElement('text', { x: 0, y: 4 });
    text.textContent = label;
    group.appendChild(text);
    markerTitle(group, title);
    group.addEventListener('click', event => { event.stopPropagation(); click?.(); });
    layer.appendChild(group);
  }

  function renderArmyMarkers(layer, snapshot) {
    for (const entry of snapshot.army) {
      const mapProvince = MapV4.getProvince(entry.provinceId);
      if (!mapProvince) continue;
      const types = entry.types.slice(0, 3);
      const [x, y] = MapV4.project(mapProvince.center);
      const scale = 1 / Math.max(1, MapV4.getZoom());
      const group = svgElement('g', { class: 'operational-stack friendly-army', transform: `translate(${x} ${y}) scale(${scale})`, 'data-province': entry.provinceId });
      types.forEach((type, index) => {
        const meta = TYPE_META[type] || TYPE_META.infantry;
        const icon = svgElement('g', { class: `operational-marker ${meta.className}`, transform: `translate(${(index - (types.length - 1) / 2) * 19} 0)` });
        icon.appendChild(svgElement('rect', { x: -9, y: -9, width: 18, height: 18, rx: 3 }));
        const text = svgElement('text', { x: 0, y: 4 });
        text.textContent = meta.label;
        icon.appendChild(text);
        group.appendChild(icon);
      });
      markerTitle(group, `${entry.name}：${entry.divisions.map(div => `${div.name}（${Math.round(div.organization)}%组织度）`).join('、')}`);
      group.addEventListener('click', event => { event.stopPropagation(); MapV4.selectProvince(entry.provinceId, false); });
      layer.appendChild(group);
    }
    for (const enemy of snapshot.enemyArmy) {
      const mapProvince = MapV4.getProvince(enemy.provinceId);
      if (!mapProvince) continue;
      markerAt(layer, mapProvince.center, 'enemy-recon', '?', `${enemy.name}：侦察到敌军活动，具体规模不明`, () => MapV4.selectProvince(enemy.provinceId, false));
    }
  }

  function renderAirMarkers(layer, snapshot) {
    const grouped = new Map();
    for (const wing of snapshot.air) {
      if (!wing.provinceId) continue;
      if (!grouped.has(wing.provinceId)) grouped.set(wing.provinceId, []);
      grouped.get(wing.provinceId).push(wing);
    }
    for (const [provinceId, wings] of grouped) {
      const mapProvince = MapV4.getProvince(provinceId);
      if (!mapProvince) continue;
      const title = wings.map(wing => `${wing.name}：${wing.mission}，${wing.aircraft}架，效率${Math.round(wing.efficiency * 100)}%`).join('\n');
      markerAt(layer, mapProvince.center, 'air-wing', '✈', title, () => document.querySelector('[data-panel="air"]')?.click());
    }
  }

  function renderNavyMarkers(layer, snapshot) {
    for (const fleet of snapshot.navy) {
      let coordinate = fleet.coordinate;
      if (!coordinate && fleet.provinceId) coordinate = MapV4.getProvince(fleet.provinceId)?.center;
      if (!coordinate) continue;
      const ships = Object.entries(fleet.ships).filter(([, amount]) => amount > 0).map(([type, amount]) => `${NAVAL_EQUIPMENT[type]?.name || type}${amount}`).join('、');
      markerAt(layer, coordinate, 'naval-fleet', '⚓', `${fleet.name}：${fleet.mission}${fleet.zone ? ` · ${fleet.zone}` : ' · 港内待命'}，战备${Math.round(fleet.readiness)}%\n${ships}`, () => document.querySelector('[data-panel="navy"]')?.click());
    }
  }

  function snapshotSignature(snapshot) {
    return `${branch}|${GameV4?.day}|${snapshot.army.map(item => `${item.provinceId}:${item.types.join('.')}:${item.divisions.length}`).join('|')}|${snapshot.air.map(item => `${item.id}:${item.mission}:${item.region}`).join('|')}|${snapshot.navy.map(item => `${item.id}:${item.mission}:${item.zone}:${Math.round(item.readiness)}`).join('|')}`;
  }

  function renderOperationalMarkers(force = false) {
    const layer = ensureOperationalLayer();
    if (!layer || !GameV4) return;
    const snapshot = GameV4.militaryOperationalSnapshot(GameV4.player);
    const signature = snapshotSignature(snapshot);
    if (!force && signature === lastSnapshotSignature) return;
    lastSnapshotSignature = signature;
    layer.replaceChildren();
    layer.classList.toggle('hidden', branch === 'off');
    if (branch === 'off') return;
    if (branch === 'army') renderArmyMarkers(layer, snapshot);
    if (branch === 'air') renderAirMarkers(layer, snapshot);
    if (branch === 'navy') renderNavyMarkers(layer, snapshot);
  }

  function trainingButton(templateKey, template, provinceId) {
    const result = GameV4.getTrainingEligibility(provinceId, templateKey);
    const equipment = Object.entries(template.equipment).slice(0, 4).map(([item, amount]) => `${LAND_EQUIPMENT[item]?.name || item}${amount}`).join(' · ');
    return `<button class="v422-template-choice ${result.ok ? '' : 'locked'}" data-v422-train="${templateKey}" data-reason="${result.reason}"><b>${template.name}</b><span>人力${(template.manpower / 1000).toFixed(1)}K · 宽度${template.width} · 速度${template.speed}</span><small>${equipment}</small><em>${result.reason}</em></button>`;
  }

  function enhanceProvinceTraining() {
    if (!GameV4?.selectedProvince) return;
    const province = GameV4.provinces[GameV4.selectedProvince];
    const actions = document.querySelector('#inspectorContent .province-actions');
    if (!province || !actions || actions.dataset.v422TrainingEnhanced === province.id) return;
    actions.dataset.v422TrainingEnhanced = province.id;
    actions.querySelectorAll('[data-train]').forEach(button => button.remove());

    const launcher = document.createElement('button');
    launcher.className = 'v422-training-launcher';
    launcher.textContent = '训练与部署部队…';
    actions.appendChild(launcher);

    const picker = document.createElement('div');
    picker.className = 'v422-training-picker hidden';
    picker.innerHTML = `<header><b>${province.name} · 选择师编制</b><button data-close-v422-training>×</button></header><div class="v422-template-grid">${Object.entries(GameV4.currentCountry().divisionTemplates).map(([key, template]) => trainingButton(key, template, province.id)).join('')}</div>`;
    actions.parentElement.appendChild(picker);
    launcher.onclick = () => picker.classList.toggle('hidden');
    picker.querySelector('[data-close-v422-training]').onclick = () => picker.classList.add('hidden');
    picker.querySelectorAll('[data-v422-train]').forEach(button => button.onclick = () => {
      const key = button.dataset.v422Train;
      const eligibility = GameV4.getTrainingEligibility(province.id, key);
      if (!eligibility.ok) return showToast(eligibility.reason, 'bad');
      const ok = GameV4.queueTraining(province.id, key);
      showToast(ok ? GameV4.lastActionResult.reason : GameV4.lastActionResult?.reason || '训练失败', ok ? 'good' : 'bad');
      if (ok) { picker.classList.add('hidden'); MapV4.selectProvince(province.id, false); }
    });

    actions.querySelectorAll('[data-build]').forEach(button => {
      if (button.dataset.build === 'dockyard') { button.textContent = button.textContent.replace('海军船坞', '海军船坞（造舰）'); button.title = '工业设施：增加国家舰船生产能力，不负责舰队停泊和补给'; }
      if (button.dataset.build === 'navalBase') { button.textContent = button.textContent.replace('海军基地', '海军基地（泊港）'); button.title = '港口设施：负责舰队停泊、维修、海运补给和登陆出发，不生产舰船'; }
    });
  }

  function addCentralTrainingBlock(host) {
    if (host.querySelector('.v422-central-training')) return;
    const provinces = Object.values(GameV4.provinces).filter(province => province.controller === GameV4.player)
      .sort((a, b) => (Number(b.capital) - Number(a.capital)) || (b.infrastructure - a.infrastructure));
    const preferred = GameV4.selectedProvince && GameV4.provinces[GameV4.selectedProvince]?.controller === GameV4.player
      ? GameV4.selectedProvince : provinces[0]?.id;
    const block = document.createElement('section');
    block.className = 'v422-central-training';
    block.innerHTML = `<div class="subheading">训练与部署</div><div class="info-card"><p>省份训练入口与国家师编制完全统一。先选择部署省份，再选择步兵、摩托化、山地或装甲编制。</p><select data-v422-deploy-province>${provinces.map(province => `<option value="${province.id}" ${province.id === preferred ? 'selected' : ''}>${province.name} · 基础设施${province.infrastructure}</option>`).join('')}</select><div class="v422-template-grid" data-v422-central-grid></div></div>`;
    const reference = [...host.children].find(node => node.textContent?.includes('训练队列'));
    if (reference) host.insertBefore(block, reference); else host.appendChild(block);
    const select = block.querySelector('[data-v422-deploy-province]');
    const grid = block.querySelector('[data-v422-central-grid]');
    const render = () => {
      grid.innerHTML = Object.entries(GameV4.currentCountry().divisionTemplates).map(([key, template]) => trainingButton(key, template, select.value)).join('');
      grid.querySelectorAll('[data-v422-train]').forEach(button => button.onclick = () => {
        const key = button.dataset.v422Train;
        const eligibility = GameV4.getTrainingEligibility(select.value, key);
        if (!eligibility.ok) return showToast(eligibility.reason, 'bad');
        const ok = GameV4.queueTraining(select.value, key);
        showToast(ok ? GameV4.lastActionResult.reason : GameV4.lastActionResult?.reason || '训练失败', ok ? 'good' : 'bad');
        if (ok) document.querySelector('[data-panel="army"]')?.click();
      });
    };
    select.onchange = render;
    render();
  }

  function addNavalDistinction(host, mode) {
    if (host.querySelector('.v422-naval-distinction')) return;
    const note = document.createElement('div');
    note.className = 'v422-naval-distinction';
    note.innerHTML = `<div><b>海军船坞</b><span>工业设施</span><p>负责建造驱逐舰、巡洋舰、潜艇、战列舰和航母；数量决定可分配到造舰生产线的船坞。</p></div><div><b>海军基地</b><span>港口设施</span><p>负责舰队驻泊、维修、燃料与补给、运输船集结和登陆行动出发；不会增加舰船产量。</p></div>${mode === 'navy' ? '<small>舰队处于“港内待命”时，会根据母港海军基地等级恢复战备。</small>' : ''}`;
    host.insertBefore(note, host.firstChild);
  }

  function addOperationalPanelControls(host, panel) {
    if (host.querySelector('.v422-operational-controls')) return;
    const controls = document.createElement('div');
    controls.className = 'v422-operational-controls';
    const branchName = panel === 'army' ? '陆军' : panel === 'air' ? '空军' : '海军';
    controls.innerHTML = `<b>${branchName}地图指挥</b><span>在地图上显示该军种的实际编组位置，不显示大型数量兵牌。</span><button data-v422-show-branch="${panel}">转到${branchName}作战视图</button>`;
    host.insertBefore(controls, host.firstChild);
    controls.querySelector('button').onclick = () => {
      branch = panel;
      document.getElementById('closePanel')?.click();
      document.querySelectorAll('[data-military-branch]').forEach(button => button.classList.toggle('active', button.dataset.militaryBranch === panel));
      renderOperationalMarkers(true);
    };
  }

  function enhanceSystemPanel() {
    if (!GameV4) return;
    const host = document.getElementById('panelContent');
    const title = document.getElementById('panelTitle')?.textContent || '';
    if (!host) return;
    if (title.includes('陆军')) { addCentralTrainingBlock(host); addOperationalPanelControls(host, 'army'); }
    if (title.includes('空军')) addOperationalPanelControls(host, 'air');
    if (title.includes('海军舰队')) { addNavalDistinction(host, 'navy'); addOperationalPanelControls(host, 'navy'); }
    if (title.includes('海军船坞')) addNavalDistinction(host, 'shipyard');
  }

  function installObservers() {
    const inspector = document.getElementById('inspectorContent');
    if (inspector && !inspector.__v422Observed) {
      inspector.__v422Observed = true;
      new MutationObserver(() => {
        clearTimeout(inspectorTimer);
        inspectorTimer = setTimeout(enhanceProvinceTraining, 90);
      }).observe(inspector, { childList: true, subtree: false });
    }
    const panel = document.getElementById('panelContent');
    if (panel && !panel.__v422Observed) {
      panel.__v422Observed = true;
      new MutationObserver(() => {
        clearTimeout(panelTimer);
        panelTimer = setTimeout(enhanceSystemPanel, 110);
      }).observe(panel, { childList: true, subtree: false });
    }
    const world = document.getElementById('mapWorld');
    if (world && !world.__v422Observed) {
      world.__v422Observed = true;
      new MutationObserver(() => {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => renderOperationalMarkers(true), 120);
      }).observe(world, { attributes: true, attributeFilter: ['transform'] });
    }
  }

  ensureNumericCounterControl();
  suppressNumericCounterDOM();
  ensureBranchBar();
  ensureOperationalLayer();
  installObservers();
  setInterval(() => {
    if (!GameV4) return;
    const preferred = GameV4.ensureMilitaryUI().operationalBranch;
    if (preferred && preferred !== branch) branch = preferred;
    renderOperationalMarkers(false);
    enhanceProvinceTraining();
    enhanceSystemPanel();
  }, 1200);
})();
