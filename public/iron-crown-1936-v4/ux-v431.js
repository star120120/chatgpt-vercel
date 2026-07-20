'use strict';

/** V4.3.1 stable UI: non-duplicating policy filters, event decisions, civil-war map and country desk. */
(() => {
  if (window.__IRON_V431_UX_ACTIVE__) return;
  window.__IRON_V431_UX_ACTIVE__ = true;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let lastEventSignature = '';
  let lastPendingSignature = '';
  let countryDeskCode = null;
  let selectedPolicyCategory = '全部';

  const svgEl = (tag, attrs = {}) => {
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
    showToast.timer = setTimeout(() => node.classList.add('hidden'), 2600);
  }

  function ensureStrategicCenter() {
    if (!document.getElementById('v431StrategicCenter')) {
      const center = document.createElement('section');
      center.id = 'v431StrategicCenter';
      center.className = 'v431-strategic-center hidden';
      center.innerHTML = '<header><div><small>外交、情报与历史事件</small><b>战略事件中心</b></div><button data-v431-close-events>×</button></header><div id="v431StrategicBody"></div>';
      document.body.appendChild(center);
      center.querySelector('[data-v431-close-events]').onclick = () => center.classList.add('hidden');
    }
    if (!document.getElementById('v431DecisionButton')) {
      const button = document.createElement('button');
      button.id = 'v431DecisionButton';
      button.className = 'v431-decision-button hidden';
      button.textContent = '战略事件';
      document.body.appendChild(button);
      button.onclick = () => {
        const center = document.getElementById('v431StrategicCenter');
        center.classList.toggle('hidden');
        renderStrategicCenter(true);
      };
    }
  }

  function eventSignature(game) {
    const timeline = game?.ensureStrategicTimeline?.();
    if (!timeline) return '';
    return `${game.date}|${timeline.pending.map(event => `${event.id}:${event.deadline}`).join(',')}|${timeline.history.slice(0, 5).map(item => `${item.eventId}:${item.choice}`).join(',')}`;
  }

  function renderStrategicCenter(force = false) {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    ensureStrategicCenter();
    const timeline = GameV4.ensureStrategicTimeline();
    const signature = eventSignature(GameV4);
    const pendingCount = timeline.pending.length;
    const button = document.getElementById('v431DecisionButton');
    button.classList.remove('hidden');
    button.textContent = pendingCount ? `待决策 ${pendingCount}` : '战略事件';
    button.classList.toggle('urgent', pendingCount > 0);
    const center = document.getElementById('v431StrategicCenter');
    if (center.classList.contains('hidden') && !force) return;
    if (!force && signature === lastEventSignature) return;
    lastEventSignature = signature;

    const upcoming = GameV4.getStrategicMapEvents().filter(event => event.state === 'warning');
    const body = document.getElementById('v431StrategicBody');
    body.innerHTML = `${timeline.pending.length ? `<section class="v431-event-section"><h3>等待国家决策</h3>${timeline.pending.map(event => `<article class="v431-event-card urgent"><div class="v431-event-heading"><div><small>${event.triggered} · 截止${event.deadline}</small><h2>${event.title}</h2></div><span>${event.participant ? '直接参与国' : '国际观察国'}</span></div><p>${event.summary}</p><div class="v431-impact-note">不作选择将在截止日自动采用默认方案；事件期间时间已暂停。</div><div class="v431-choice-grid">${event.choices.map(choice => `<button data-v431-event="${event.id}" data-v431-choice="${choice.id}" class="${choice.default ? 'recommended' : ''}"><b>${choice.title}${choice.default ? ' · 默认' : ''}</b><span>${choice.description}</span><small>${choice.effect}</small></button>`).join('')}</div></article>`).join('')}</section>` : '<section class="v431-event-section"><div class="v431-empty"><b>当前没有必须立即处理的事件</b><span>临近危机会提前30天、14天、7天或3天发出预警。</span></div></section>'}${upcoming.length ? `<section class="v431-event-section"><h3>即将到来的危机</h3>${upcoming.map(event => `<button class="v431-upcoming" data-v431-map-event="${event.id.replace('warning-', '')}"><b>${event.title}</b><span>${event.text}</span></button>`).join('')}</section>` : ''}<section class="v431-event-section"><h3>最近决策结果</h3>${timeline.history.slice(0, 8).map(item => `<article class="v431-history"><time>${item.date}</time><div><b>${item.title} · ${item.choice}</b><span>${item.outcome}</span></div></article>`).join('') || '<p>尚无历史决策记录。</p>'}</section>`;

    body.querySelectorAll('[data-v431-event]').forEach(choiceButton => choiceButton.onclick = () => {
      const result = GameV4.resolveStrategicEvent(choiceButton.dataset.v431Event, choiceButton.dataset.v431Choice);
      showToast(result.ok ? result.outcome : result.reason, result.ok ? 'good' : 'bad');
      renderHistoricalMap(true);
      renderStrategicCenter(true);
    });
    body.querySelectorAll('[data-v431-map-event]').forEach(mapButton => mapButton.onclick = () => {
      const event = GameV4.getStrategicMapEvents().find(item => item.id.includes(mapButton.dataset.v431MapEvent));
      if (!event) return;
      const province = GameV4.nearestProvinceByCoordinate(event.location);
      if (province) { center.classList.add('hidden'); MapV4.selectProvince(province.id, true); }
    });
  }

  function ensureHistoricalLayer() {
    const world = document.getElementById('mapWorld');
    if (!world) return null;
    let layer = document.getElementById('historicalEventLayer');
    if (!layer) {
      layer = svgEl('g', { id: 'historicalEventLayer', class: 'historical-event-layer' });
      const operational = document.getElementById('operationalLayer');
      if (operational) world.insertBefore(layer, operational);
      else world.appendChild(layer);
    }
    return layer;
  }

  function addMapMarker(layer, event) {
    const [x, y] = MapV4.project(event.location);
    const scale = 1 / Math.max(1, MapV4.getZoom());
    const symbol = event.state === 'war' ? '⚔' : event.state === 'pending' ? '◆' : '!';
    const group = svgEl('g', { class: `v431-map-event ${event.state}`, transform: `translate(${x} ${y}) scale(${scale})` });
    group.appendChild(svgEl('circle', { cx: 0, cy: 0, r: event.state === 'war' ? 10 : 8 }));
    const text = svgEl('text', { x: 0, y: event.state === 'war' ? 4 : 3.5 });
    text.textContent = symbol;
    group.appendChild(text);
    const title = svgEl('title');
    title.textContent = `${event.title}：${event.text}`;
    group.appendChild(title);
    group.addEventListener('click', clickEvent => {
      clickEvent.stopPropagation();
      document.getElementById('v431StrategicCenter').classList.remove('hidden');
      renderStrategicCenter(true);
    });
    layer.appendChild(group);
  }

  function renderSpanishCivilWar(layer) {
    document.querySelectorAll('.province-shape').forEach(node => {
      node.classList.remove('spanish-republican', 'spanish-nationalist');
      const province = typeof GameV4 !== 'undefined' && GameV4?.provinces?.[node.dataset.id];
      if (province?.owner !== 'ESP' || !province.civilWarSide) return;
      node.classList.add(province.civilWarSide === 'nationalist' ? 'spanish-nationalist' : 'spanish-republican');
    });
    const war = typeof GameV4 !== 'undefined' && GameV4?.civilWars?.spain;
    if (!war || war.resolved) return;
    const drawn = new Set();
    for (const front of war.frontline || []) {
      const a = GameV4.provinces[front.source];
      const b = GameV4.provinces[front.target];
      if (!a || !b || a.civilWarSide === b.civilWarSide) continue;
      const key = [a.id, b.id].sort().join('|');
      if (drawn.has(key)) continue;
      drawn.add(key);
      const source = MapV4.getProvince(a.id)?.center;
      const target = MapV4.getProvince(b.id)?.center;
      if (!source || !target) continue;
      const [x1, y1] = MapV4.project(source);
      const [x2, y2] = MapV4.project(target);
      layer.appendChild(svgEl('line', { x1, y1, x2, y2, class: 'v431-civil-war-front' }));
    }
    const spanish = Object.values(GameV4.provinces).filter(province => province.owner === 'ESP' && province.civilWarSide);
    for (const side of ['republican', 'nationalist']) {
      const members = spanish.filter(province => province.civilWarSide === side).map(province => MapV4.getProvince(province.id)?.center).filter(Boolean);
      if (!members.length) continue;
      const center = members.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map(value => value / members.length);
      const [x, y] = MapV4.project(center);
      const label = svgEl('text', { x, y, class: `v431-civil-war-label ${side}` });
      label.textContent = side === 'republican' ? '西班牙共和国' : '西班牙国民军';
      layer.appendChild(label);
    }
  }

  function historicalMapSignature() {
    if (typeof GameV4 === 'undefined' || !GameV4) return '';
    const events = GameV4.getStrategicMapEvents().map(event => `${event.id}:${event.state}:${event.text}`).join('|');
    const spanish = Object.values(GameV4.provinces).filter(province => province.owner === 'ESP').map(province => `${province.id}:${province.civilWarSide || ''}`).join('|');
    return `${GameV4.date}|${events}|${spanish}|${MapV4.getZoom().toFixed(2)}`;
  }

  function renderHistoricalMap(force = false) {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    const layer = ensureHistoricalLayer();
    if (!layer) return;
    const signature = historicalMapSignature();
    if (!force && signature === lastPendingSignature) return;
    lastPendingSignature = signature;
    layer.replaceChildren();
    for (const event of GameV4.getStrategicMapEvents()) addMapMarker(layer, event);
    renderSpanishCivilWar(layer);
  }

  function ensureCountryDesk() {
    if (document.getElementById('v431CountryDesk')) return;
    const desk = document.createElement('section');
    desk.id = 'v431CountryDesk';
    desk.className = 'v431-country-desk hidden';
    desk.innerHTML = '<header><div><small>国家情报与双边行动</small><b id="v431CountryDeskTitle">国家</b></div><button data-v431-close-country>×</button></header><div id="v431CountryDeskBody"></div>';
    document.body.appendChild(desk);
    desk.querySelector('[data-v431-close-country]').onclick = () => desk.classList.add('hidden');
  }

  function availableTradeResources(profile) {
    return Object.entries(profile.resources || {}).filter(([, amount]) => amount >= 4).sort((a, b) => b[1] - a[1]);
  }

  function openCountryDesk(code) {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    ensureCountryDesk();
    countryDeskCode = code;
    const profile = GameV4.countryStrategicProfile(code);
    if (!profile) return;
    const own = code === GameV4.player;
    const resourceOptions = availableTradeResources(profile);
    document.getElementById('v431CountryDeskTitle').textContent = profile.name;
    const body = document.getElementById('v431CountryDeskBody');
    body.innerHTML = `<div class="v431-country-hero" style="--country:${profile.color}"><i></i><div><h2>${profile.name}</h2><p>${profile.ideology} · 人口${profile.population.toFixed(1)}M${own ? '' : ` · 双边关系${Math.round(profile.relations)}`}</p></div></div><div class="v431-country-metrics"><div><small>民用工厂</small><b>${profile.civ}</b></div><div><small>军用工厂</small><b>${profile.mil}</b></div><div><small>海军船坞</small><b>${profile.dockyard}</b></div><div><small>陆军师</small><b>${profile.divisions}</b></div><div><small>稳定度</small><b>${Math.round(profile.stability)}%</b></div><div><small>战争支持</small><b>${Math.round(profile.warSupport)}%</b></div></div><article class="v431-country-brief"><h3>国家概况</h3><p>${profile.overview}</p><h3>经济与资源</h3><p>${profile.economy}</p><h3>外交处境</h3><p>${profile.diplomacy}</p></article><div class="v431-resource-summary">${Object.entries(profile.resources).map(([key, amount]) => `<span class="${amount > 0 ? '' : 'empty'}">${RESOURCE_NAMES[key]} ${Math.round(amount)}</span>`).join('')}</div>${own ? '<div class="v431-own-country-note">这是玩家当前领导的国家。贸易和外交对象请从其他国家进入。</div>' : `<section class="v431-bilateral"><h3>双边操作</h3><div class="v431-desk-actions"><button data-v431-country-action="map">在地图中定位</button><button data-v431-country-action="improve">改善关系 · 20PP</button><button data-v431-country-action="treaty">互不侵犯条约 · 30PP</button><button data-v431-country-action="alliance">建立联盟 · 75PP</button><button data-v431-country-action="cooperation">经济合作 · 35PP</button><button data-v431-country-action="embargo" class="danger">贸易禁运 · 30PP</button><button data-v431-country-action="war" class="danger">宣战 · 50PP</button></div><div class="v431-trade-box"><label>从${profile.short}进口<select data-v431-trade-resource>${resourceOptions.map(([key, amount]) => `<option value="${key}">${RESOURCE_NAMES[key]} · 可供参考${Math.round(amount)}</option>`).join('') || '<option value="">暂无可出口资源</option>'}</select></label><button data-v431-country-action="trade" ${resourceOptions.length ? '' : 'disabled'}>签订8单位贸易合同</button><small>每8单位进口占用1座民用工厂；关系低于-40、战争或禁运状态下无法交易。</small></div></section>`}`;
    const desk = document.getElementById('v431CountryDesk');
    desk.classList.remove('hidden');
    body.querySelectorAll('[data-v431-country-action]').forEach(button => button.onclick = () => executeCountryAction(code, button.dataset.v431CountryAction));
  }

  function executeCountryAction(code, action) {
    let result = { ok: false, reason: '操作未执行' };
    if (action === 'map') {
      document.getElementById('v431CountryDesk').classList.add('hidden');
      MapV4.focusCountry(code);
      return;
    }
    if (action === 'improve') result = { ok: GameV4.improveRelations(code), reason: '关系或政治点条件不足' };
    if (action === 'treaty') result = { ok: GameV4.signTreaty(code), reason: '关系、政治点或战争状态不符合条约条件' };
    if (action === 'alliance') result = { ok: GameV4.formAlliance(code), reason: '关系需要达到55且需要75政治点' };
    if (action === 'war') result = { ok: GameV4.declareWar(code), reason: '条约、战争状态或政治点条件不允许宣战' };
    if (action === 'cooperation') result = GameV4.establishEconomicPartnership(code);
    if (action === 'embargo') result = GameV4.imposeTradeEmbargo(code);
    if (action === 'trade') {
      const resource = document.querySelector('[data-v431-trade-resource]')?.value;
      result = GameV4.signTradeDeal(code, resource, 1);
    }
    showToast(result.ok ? '国家行动已经执行' : result.reason, result.ok ? 'good' : 'bad');
    openCountryDesk(code);
  }

  function enhanceInspector() {
    if (typeof GameV4 === 'undefined' || !GameV4?.selectedProvince) return;
    const host = document.getElementById('inspectorContent');
    if (!host || host.querySelector('[data-v431-open-country]')) return;
    const province = GameV4.provinces[GameV4.selectedProvince];
    if (!province) return;
    const country = GameV4.countries[province.controller] || GameV4.countries[province.owner];
    if (!country) return;
    const card = host.querySelector('.province-card');
    if (!card) return;
    const button = document.createElement('button');
    button.className = 'v431-country-link';
    button.dataset.v431OpenCountry = province.controller;
    button.textContent = `查看${country.short}国家概况、贸易与外交`;
    button.onclick = () => openCountryDesk(province.controller);
    card.appendChild(button);
  }

  function enhanceCountryPanel(host) {
    if (host.querySelector('.v431-current-profile')) return;
    const profile = GameV4.countryStrategicProfile(GameV4.player);
    if (!profile) return;
    const card = document.createElement('article');
    card.className = 'v431-current-profile';
    card.innerHTML = `<div><small>1936国家背景</small><h2>${profile.name}</h2><p>${profile.overview}</p></div><div><b>经济重点</b><p>${profile.economy}</p><b>外交处境</b><p>${profile.diplomacy}</p></div>`;
    host.insertBefore(card, host.firstChild);
  }

  function enhanceDiplomacyPanel(host) {
    host.querySelectorAll('.diplomacy-row').forEach(row => {
      if (row.querySelector('[data-v431-country-details]')) return;
      const source = row.querySelector('[data-code]');
      if (!source) return;
      const code = source.dataset.code;
      const profile = GameV4.countryStrategicProfile(code);
      if (!profile) return;
      const meta = row.querySelector('.diplomacy-meta');
      if (meta && !row.querySelector('.v431-diplomacy-brief')) {
        const brief = document.createElement('div');
        brief.className = 'v431-diplomacy-brief';
        brief.textContent = profile.overview;
        meta.after(brief);
      }
      const actions = row.querySelector('.diplomacy-actions');
      if (actions) {
        const button = document.createElement('button');
        button.dataset.v431CountryDetails = code;
        button.textContent = '详情/贸易';
        button.onclick = () => openCountryDesk(code);
        actions.insertBefore(button, actions.firstChild);
      }
    });
  }

  function enhancePoliticsPanel(host) {
    if (host.querySelector('.v431-policy-tabs')) return;
    const heading = [...host.querySelectorAll('.subheading')].find(node => node.textContent.includes('政策方针'));
    const grid = heading?.nextElementSibling;
    if (!heading || !grid?.classList.contains('policy-grid')) return;
    const categories = ['全部', ...new Set(POLICIES.map(policy => policy.category || '国家'))];
    const tabs = document.createElement('div');
    tabs.className = 'v431-policy-tabs';
    tabs.innerHTML = categories.map(category => `<button data-v431-policy-category="${category}" class="${category === selectedPolicyCategory ? 'active' : ''}">${category}</button>`).join('');
    heading.after(tabs);
    const cards = [...grid.querySelectorAll('.policy-card')];
    cards.forEach(card => {
      const policyId = card.querySelector('[data-policy]')?.dataset.policy;
      const policy = POLICIES.find(item => item.id === policyId);
      const category = policy?.category || '国家';
      card.dataset.v431PolicyCategory = category;
      if (policy?.condition && !card.querySelector('.v431-policy-condition')) {
        const condition = document.createElement('small');
        condition.className = 'v431-policy-condition';
        condition.textContent = policy.condition === 'war_or_tension_50' ? '条件：战争中或世界紧张度≥50%' : `条件：${policy.condition}`;
        card.appendChild(condition);
      }
    });
    const apply = () => {
      cards.forEach(card => card.classList.toggle('v431-hidden-policy', selectedPolicyCategory !== '全部' && card.dataset.v431PolicyCategory !== selectedPolicyCategory));
      tabs.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.v431PolicyCategory === selectedPolicyCategory));
    };
    tabs.querySelectorAll('button').forEach(button => button.onclick = () => { selectedPolicyCategory = button.dataset.v431PolicyCategory; apply(); });
    apply();
  }

  function enhanceResearchPanel(host) {
    if (host.querySelector('.v431-research-progress')) return;
    const activeCategory = host.querySelector('[data-category].active')?.dataset.category || 'industry';
    const country = GameV4.currentCountry();
    const total = RESEARCH_TREE[activeCategory]?.length || 0;
    const completed = RESEARCH_TREE[activeCategory]?.filter(tech => country.technologies.includes(tech.id)).length || 0;
    const grid = host.querySelector('.research-grid');
    if (!grid) return;
    const summary = document.createElement('div');
    summary.className = 'v431-research-progress';
    summary.innerHTML = `<div><b>${completed}/${total}</b><span>本路线已完成</span></div><p>科研槽决定并行项目数量；前置科技、历史年份和计算技术共同影响研究速度。</p>`;
    grid.before(summary);
    grid.querySelectorAll('.research-card').forEach(card => {
      const techId = card.querySelector('[data-tech]')?.dataset.tech;
      const tech = Object.values(RESEARCH_TREE).flat().find(item => item.id === techId);
      if (!tech) return;
      card.dataset.tier = String(tech.tier || 1);
      if (tech.requires) {
        const requirement = Object.values(RESEARCH_TREE).flat().find(item => item.id === tech.requires)?.name || tech.requires;
        const meta = document.createElement('small');
        meta.className = 'v431-tech-requirement';
        meta.textContent = `前置：${requirement}`;
        card.insertBefore(meta, card.querySelector('button'));
      }
    });
  }

  function enhanceVisiblePanel() {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    const panel = document.getElementById('systemPanel');
    if (!panel || panel.classList.contains('hidden')) return;
    const host = document.getElementById('panelContent');
    const title = document.getElementById('panelTitle')?.textContent || '';
    if (title.includes('国家总览')) enhanceCountryPanel(host);
    if (title.includes('政策')) enhancePoliticsPanel(host);
    if (title.includes('科技')) enhanceResearchPanel(host);
    if (title.includes('外交')) enhanceDiplomacyPanel(host);
  }

  ensureStrategicCenter();
  ensureCountryDesk();
  const mapWorld = document.getElementById('mapWorld');
  if (mapWorld) new MutationObserver(() => renderHistoricalMap(true)).observe(mapWorld, { attributes: true, attributeFilter: ['transform'] });

  setInterval(() => {
    if (typeof GameV4 === 'undefined' || !GameV4) return;
    const timeline = GameV4.ensureStrategicTimeline();
    const pendingSignature = timeline.pending.map(event => event.id).join('|');
    if (pendingSignature && pendingSignature !== window.__IRON_LAST_AUTO_OPEN_EVENT__) {
      window.__IRON_LAST_AUTO_OPEN_EVENT__ = pendingSignature;
      document.getElementById('v431StrategicCenter').classList.remove('hidden');
      renderStrategicCenter(true);
    }
    renderStrategicCenter(false);
    renderHistoricalMap(false);
    enhanceInspector();
    enhanceVisiblePanel();
    if (countryDeskCode && !document.getElementById('v431CountryDesk').classList.contains('hidden')) openCountryDesk(countryDeskCode);
  }, 900);
})();
