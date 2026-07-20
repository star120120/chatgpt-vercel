'use strict';

/** V4.3 operational UX: number-free war map, sea-zone awareness and deeper policy/research navigation. */
(() => {
  if (window.__IRON_V43_UX_ACTIVE__) return;
  window.__IRON_V43_UX_ACTIVE__ = true;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let combatSignature = '';
  let politicsCategory = '全部';
  let enhancementTimer = null;
  let snapshotPatched = false;

  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function ensureSnapshotPatch() {
    if (snapshotPatched || typeof IronCrownV4 === 'undefined') return;
    const proto = IronCrownV4.prototype;
    if (typeof proto.militaryOperationalSnapshot !== 'function') return;
    const original = proto.militaryOperationalSnapshot;
    proto.militaryOperationalSnapshot = function militaryOperationalSnapshotV43(code = this.player) {
      const result = original.call(this, code);
      const zones = Object.fromEntries((window.IRON_SEA_ZONES_V43 || []).map(zone => [zone.id, zone.center]));
      for (const fleet of result.navy || []) if (fleet.zone && !fleet.coordinate) fleet.coordinate = zones[fleet.zone] || null;
      return result;
    };
    snapshotPatched = true;
  }

  function ensureCombatLayer() {
    const world = document.getElementById('mapWorld');
    if (!world) return null;
    let layer = document.getElementById('combatVisualLayer');
    if (!layer) {
      layer = svgEl('g', { id: 'combatVisualLayer', class: 'combat-visual-layer' });
      const operational = document.getElementById('operationalLayer');
      if (operational) world.insertBefore(layer, operational);
      else world.appendChild(layer);
    }
    return layer;
  }

  function atWar(game, a, b) {
    return a !== b && game.isAtWar(a, b);
  }

  function midpoint(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  function addCombatMarker(layer, coordinate, kind, symbol, title, onClick) {
    const [x, y] = MapV4.project(coordinate);
    const scale = 1 / Math.max(1, MapV4.getZoom());
    const group = svgEl('g', { class: `combat-marker ${kind}`, transform: `translate(${x} ${y}) scale(${scale})` });
    group.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 8 }));
    const text = svgEl('text', { x: 0, y: 3.3 });
    text.textContent = symbol;
    group.appendChild(text);
    const tooltip = svgEl('title');
    tooltip.textContent = title;
    group.appendChild(tooltip);
    if (onClick) group.addEventListener('click', event => { event.stopPropagation(); onClick(); });
    layer.appendChild(group);
  }

  function renderLandCombat(layer, game) {
    for (const front of game.fronts || []) {
      if (!front.active) continue;
      const source = MapV4.getProvince(front.source);
      const target = MapV4.getProvince(front.target);
      if (!source || !target) continue;
      const point = midpoint(source.center, target.center);
      const attacker = game.countries[front.attacker]?.short || front.attacker;
      const defender = game.countries[front.defender]?.short || front.defender;
      const phase = front.progress > 55 ? '突破阶段' : front.progress > 10 ? '进攻展开' : front.progress > -35 ? '持续交战' : '进攻受挫';
      addCombatMarker(layer, point, 'land-combat', '⚔', `${attacker}与${defender}在${target.name}方向交战 · ${phase}`, () => MapV4.selectProvince(front.target, false));
    }
  }

  function renderAirCombat(layer, game) {
    const wars = Object.values(game.wars || {});
    const zones = new Map();
    for (const war of wars) {
      const a = game.countries[war.attacker];
      const b = game.countries[war.defender];
      if (!a || !b) continue;
      const activeA = (a.airWings || []).filter(wing => wing.mission !== '待命' && wing.region && wing.region !== '全国');
      const activeB = (b.airWings || []).filter(wing => wing.mission !== '待命' && wing.region && wing.region !== '全国');
      for (const wingA of activeA) {
        for (const wingB of activeB) {
          if (wingA.region !== wingB.region) continue;
          const key = `${wingA.region}:${war.attacker}:${war.defender}`;
          if (!zones.has(key)) zones.set(key, { region: wingA.region, a: 0, b: 0, attacker: war.attacker, defender: war.defender });
          zones.get(key).a += wingA.aircraft * wingA.efficiency;
          zones.get(key).b += wingB.aircraft * wingB.efficiency;
        }
      }
    }
    const seaById = Object.fromEntries((window.IRON_SEA_ZONES_V43 || []).map(zone => [zone.id, zone]));
    for (const battle of zones.values()) {
      const province = MapV4.getProvince(battle.region);
      const coordinate = province?.center || seaById[battle.region]?.center;
      if (!coordinate) continue;
      const balance = battle.a > battle.b * 1.25 ? `${game.countries[battle.attacker].short}占优` : battle.b > battle.a * 1.25 ? `${game.countries[battle.defender].short}占优` : '制空权争夺中';
      addCombatMarker(layer, coordinate, 'air-combat', '✦', `${battle.region}空战 · ${balance}`, () => document.querySelector('[data-panel="air"]')?.click());
    }
  }

  function renderNavalCombat(layer, game) {
    const zoneMap = Object.fromEntries((window.IRON_SEA_ZONES_V43 || []).map(zone => [zone.id, zone]));
    const zones = new Map();
    for (const [code, country] of Object.entries(game.countries || {})) {
      for (const fleet of country.fleets || []) {
        if (!fleet.zone || fleet.mission === '港内待命') continue;
        if (!zones.has(fleet.zone)) zones.set(fleet.zone, []);
        zones.get(fleet.zone).push({ code, fleet });
      }
    }
    for (const [zoneId, fleets] of zones) {
      let conflict = null;
      for (let i = 0; i < fleets.length && !conflict; i += 1) {
        for (let j = i + 1; j < fleets.length; j += 1) {
          if (atWar(game, fleets[i].code, fleets[j].code)) { conflict = [fleets[i], fleets[j]]; break; }
        }
      }
      if (!conflict || !zoneMap[zoneId]) continue;
      const [a, b] = conflict;
      addCombatMarker(layer, zoneMap[zoneId].center, 'naval-combat', '≈', `${zoneId}海战 · ${game.countries[a.code].short}舰队与${game.countries[b.code].short}舰队接触`, () => document.querySelector('[data-panel="navy"]')?.click());
    }
  }

  function combatStateSignature(game) {
    const fronts = (game.fronts || []).filter(front => front.active).map(front => `${front.id}:${Math.round(front.progress / 10)}`).join('|');
    const air = Object.entries(game.countries || {}).flatMap(([code, country]) => (country.airWings || []).map(wing => `${code}:${wing.id}:${wing.mission}:${wing.region}`)).join('|');
    const navy = Object.entries(game.countries || {}).flatMap(([code, country]) => (country.fleets || []).map(fleet => `${code}:${fleet.id}:${fleet.mission}:${fleet.zone}`)).join('|');
    return `${game.day}|${fronts}|${air}|${navy}|${MapV4.getZoom().toFixed(2)}`;
  }

  function renderCombatVisuals(force = false) {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    const layer = ensureCombatLayer();
    if (!layer) return;
    const signature = combatStateSignature(GameV4);
    if (!force && signature === combatSignature) return;
    combatSignature = signature;
    layer.replaceChildren();
    renderLandCombat(layer, GameV4);
    renderAirCombat(layer, GameV4);
    renderNavalCombat(layer, GameV4);
  }

  function extendNavyZoneOptions(host) {
    const zones = window.IRON_SEA_ZONES_V43 || [];
    host.querySelectorAll('[data-fleet-zone]').forEach(select => {
      for (const zone of zones) {
        if ([...select.options].some(option => option.value === zone.id)) continue;
        const option = document.createElement('option');
        option.value = zone.id;
        option.textContent = zone.id;
        if (GameV4?.currentCountry().fleets.find(fleet => fleet.id === select.dataset.fleetZone)?.zone === zone.id) option.selected = true;
        select.appendChild(option);
      }
    });
  }

  function extendAirZoneOptions(host) {
    const zones = window.IRON_SEA_ZONES_V43 || [];
    host.querySelectorAll('[data-air-region]').forEach(select => {
      const separator = document.createElement('option');
      if (![...select.options].some(option => option.value === '__sea__')) {
        separator.value = '__sea__'; separator.textContent = '—— 海上空域 ——'; separator.disabled = true; select.appendChild(separator);
      }
      for (const zone of zones) {
        if ([...select.options].some(option => option.value === zone.id)) continue;
        const option = document.createElement('option');
        option.value = zone.id; option.textContent = zone.id;
        if (GameV4?.currentCountry().airWings.find(wing => wing.id === select.dataset.airRegion)?.region === zone.id) option.selected = true;
        select.appendChild(option);
      }
    });
  }

  function enhancePolitics(host) {
    if (host.dataset.v43Politics === 'true') return;
    host.dataset.v43Politics = 'true';
    const heading = [...host.querySelectorAll('.subheading')].find(node => node.textContent.includes('政策方针'));
    if (!heading) return;
    const categories = ['全部', ...new Set(POLICIES.map(policy => policy.category || '国家'))];
    const tabs = document.createElement('div');
    tabs.className = 'v43-policy-tabs';
    tabs.innerHTML = categories.map(category => `<button data-v43-policy-category="${category}" class="${category === politicsCategory ? 'active' : ''}">${category}</button>`).join('');
    heading.after(tabs);
    const apply = () => {
      host.querySelectorAll('.policy-card').forEach(card => {
        const id = card.querySelector('[data-policy]')?.dataset.policy;
        const policy = POLICIES.find(item => item.id === id);
        const category = policy?.category || '国家';
        card.dataset.category = category;
        card.classList.toggle('v43-filtered', politicsCategory !== '全部' && category !== politicsCategory);
        if (policy?.condition && !card.querySelector('.v43-condition')) {
          const condition = document.createElement('small');
          condition.className = 'v43-condition';
          condition.textContent = policy.condition === 'war_or_tension_50' ? '条件：战争中或世界紧张度≥50%' : policy.condition;
          card.appendChild(condition);
        }
      });
      tabs.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.v43PolicyCategory === politicsCategory));
    };
    tabs.querySelectorAll('button').forEach(button => button.onclick = () => { politicsCategory = button.dataset.v43PolicyCategory; apply(); });
    apply();
  }

  function enhanceResearch(host) {
    if (host.dataset.v43Research === 'true') return;
    host.dataset.v43Research = 'true';
    const cards = [...host.querySelectorAll('.research-grid .research-card')];
    for (const card of cards) {
      const techId = card.querySelector('[data-tech]')?.dataset.tech;
      const tech = Object.values(RESEARCH_TREE).flat().find(item => item.id === techId);
      if (!tech) continue;
      card.dataset.tier = String(tech.tier || 1);
      if (!card.querySelector('.v43-tech-meta')) {
        const meta = document.createElement('small');
        meta.className = 'v43-tech-meta';
        meta.textContent = `阶段 ${tech.tier || 1}${tech.requires ? ` · 前置：${Object.values(RESEARCH_TREE).flat().find(item => item.id === tech.requires)?.name || tech.requires}` : ''}`;
        card.insertBefore(meta, card.querySelector('button'));
      }
    }
    const grid = host.querySelector('.research-grid');
    if (grid && !grid.previousElementSibling?.classList.contains('v43-research-summary')) {
      const country = GameV4.currentCountry();
      const categoryButtons = [...host.querySelectorAll('[data-category]')];
      const active = categoryButtons.find(button => button.classList.contains('active'))?.dataset.category || 'industry';
      const total = RESEARCH_TREE[active]?.length || 0;
      const completed = RESEARCH_TREE[active]?.filter(tech => country.technologies.includes(tech.id)).length || 0;
      const summary = document.createElement('div');
      summary.className = 'v43-research-summary';
      summary.innerHTML = `<b>技术路线进度 ${completed}/${total}</b><span>科技按1936—1940年代际展开，超前研究仍会受到时间惩罚。</span>`;
      grid.before(summary);
    }
  }

  function addBorderSourceBadge() {
    const stage = document.querySelector('.map-stage');
    if (!stage || document.getElementById('borderSourceBadge')) return;
    const badge = document.createElement('div');
    badge.id = 'borderSourceBadge';
    badge.className = 'v43-border-source';
    badge.textContent = window.__IRON_BORDER_SOURCE__ || '1936历史国界';
    stage.appendChild(badge);
  }

  function enhancePanels() {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    const panel = document.getElementById('systemPanel');
    if (!panel || panel.classList.contains('hidden')) return;
    const host = document.getElementById('panelContent');
    const title = document.getElementById('panelTitle')?.textContent || '';
    if (title.includes('政策')) enhancePolitics(host);
    if (title.includes('科技')) enhanceResearch(host);
    if (title.includes('海军舰队')) extendNavyZoneOptions(host);
    if (title.includes('空军')) extendAirZoneOptions(host);
  }

  const panelHost = document.getElementById('panelContent');
  if (panelHost) {
    new MutationObserver(() => {
      panelHost.dataset.v43Politics = 'false';
      panelHost.dataset.v43Research = 'false';
      clearTimeout(enhancementTimer);
      enhancementTimer = setTimeout(enhancePanels, 80);
    }).observe(panelHost, { childList: true, subtree: false });
  }
  const mapWorld = document.getElementById('mapWorld');
  if (mapWorld) new MutationObserver(() => renderCombatVisuals(true)).observe(mapWorld, { attributes: true, attributeFilter: ['transform'] });

  setInterval(() => {
    ensureSnapshotPatch();
    addBorderSourceBadge();
    enhancePanels();
    renderCombatVisuals(false);
    document.querySelectorAll('#frontLayer .front-progress').forEach(node => node.remove());
  }, 1200);
})();
