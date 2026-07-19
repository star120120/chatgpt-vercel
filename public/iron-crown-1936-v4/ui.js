'use strict';

(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const PANEL_TITLES = {
    country: '国家总览', politics: '政策与决议', research: '科技研究', production: '军用工厂与装备生产',
    shipyard: '海军船坞与舰船建造', construction: '国家建设', army: '陆军、编制与战线', air: '空军任务',
    navy: '海军舰队', logistics: '后勤、资源与贸易', diplomacy: '外交与国际关系', administration: '行政与省份治理', log: '历史日志',
  };
  const BUILDING_NAMES = { civ: '民用工厂', mil: '军用工厂', dockyard: '海军船坞', infrastructure: '基础设施', rail: '铁路', fort: '陆上要塞', airBase: '空军基地', navalBase: '海军基地', supplyHub: '补给枢纽' };
  const AIR_MISSIONS = ['待命', '制空权', '近距支援', '战略轰炸'];
  const NAVAL_MISSIONS = ['港内待命', '巡逻', '打击舰队', '护航', '袭击运输线'];
  const SEA_ZONES = ['北海', '波罗的海', '英吉利海峡', '北大西洋', '西地中海', '东地中海', '黑海'];
  const SUPPORT_COMPANIES = ['工兵连', '侦察连', '医疗连', '后勤连', '维修连', '炮兵支援连'];

  let selectedCountry = 'GER';
  let selectedProvince = null;
  let selectedDivisions = new Set();
  let orderMode = null;
  let currentPanel = null;
  let researchCategory = 'industry';
  let researchSlot = 0;
  let lastFrame = performance.now();
  let timeAccumulator = 0;

  function bootStatus(text, progress) {
    $('#bootText').textContent = text;
    $('#bootDetail').textContent = text;
    $('#bootProgress').style.width = `${clamp(progress, 0, 1) * 100}%`;
  }

  async function boot() {
    MapV4.init({ onSelect: handleProvinceSelect, onStatus: bootStatus });
    try {
      await MapV4.loadAll();
      renderCountryGrid();
      $('#bootScreen').classList.add('hidden');
      $('#startScreen').classList.remove('hidden');
      requestAnimationFrame(gameLoop);
    } catch (error) {
      console.error(error);
      $('#bootText').textContent = '地图载入失败';
      $('#bootDetail').textContent = `${error.message}。请刷新页面重试。`;
    }
  }

  function renderCountryGrid() {
    $('#countryGrid').innerHTML = PLAYABLE.map(code => {
      const country = COUNTRY_DEFS[code];
      return `<button class="country-card ${selectedCountry === code ? 'active' : ''}" data-country="${code}" style="--country:${country.color}">
        <b>${country.short}</b><em>${country.ideology}</em>
        <span>人口 ${country.population.toFixed(1)}M · 陆军 ${country.army}师<br>民用/军用/船坞 ${country.civ}/${country.mil}/${country.dockyard}</span>
      </button>`;
    }).join('');
    $$('[data-country]').forEach(button => {
      button.onclick = () => { selectedCountry = button.dataset.country; renderCountryGrid(); };
    });
  }

  function startNewGame() {
    GameV4 = new IronCrownV4(selectedCountry, $('#difficultySelect').value);
    MapV4.setAutoFocus($('#startAutoFocus').checked);
    $('#autoFocusToggle').checked = $('#startAutoFocus').checked;
    showGame();
    const capital = Object.values(GameV4.provinces).find(province => province.controller === selectedCountry && province.capital) || Object.values(GameV4.provinces).find(province => province.controller === selectedCountry);
    if (capital) { MapV4.selectProvince(capital.id, false); MapV4.resetView(); }
  }

  function loadGame() {
    const loaded = IronCrownV4.load();
    if (!loaded) return toast('没有找到V4存档', 'bad');
    GameV4 = loaded;
    selectedCountry = loaded.player;
    showGame();
    const capital = Object.values(GameV4.provinces).find(province => province.controller === loaded.player && province.capital) || Object.values(GameV4.provinces).find(province => province.controller === loaded.player);
    if (capital) { MapV4.selectProvince(capital.id, false); MapV4.resetView(); }
    toast('V4存档已经读取', 'good');
  }

  function showGame() {
    $('#startScreen').classList.add('hidden');
    $('#gameScreen').classList.remove('hidden');
    MapV4.setGame(GameV4);
    GameV4.setSpeed(0);
    setSpeedUI(0);
    renderAll();
  }

  function gameLoop(now) {
    const delta = now - lastFrame;
    lastFrame = now;
    if (GameV4?.speed > 0) {
      const interval = { 1: 900, 2: 330, 4: 95 }[GameV4.speed] || 900;
      timeAccumulator += delta;
      let advanced = 0;
      while (timeAccumulator >= interval && advanced < 6) {
        GameV4.advanceDay();
        timeAccumulator -= interval;
        advanced += 1;
      }
      if (advanced) renderContinuousUpdate();
    }
    requestAnimationFrame(gameLoop);
  }

  function renderContinuousUpdate() {
    renderTopbar();
    renderInspector();
    MapV4.updateStyles();
    MapV4.renderUnits();
    MapV4.renderFronts();
    if (currentPanel) renderPanel(currentPanel);
  }

  function renderAll() {
    if (!GameV4) return;
    renderTopbar();
    renderInspector();
    MapV4.setGame(GameV4);
    if (currentPanel) renderPanel(currentPanel);
  }

  function renderTopbar() {
    const country = GameV4.currentCountry();
    const summary = GameV4.nationalSummary(GameV4.player);
    $('#countryColor').style.background = country.color;
    $('#topCountry').textContent = country.short;
    $('#topIdeology').textContent = country.ideology;
    $('#topPP').textContent = Math.round(country.pp);
    $('#topAdmin').textContent = Math.round(country.adminPoints);
    $('#topCommand').textContent = Math.round(country.commandPower);
    $('#topManpower').textContent = fmtK(country.availableManpower);
    $('#topCiv').textContent = summary.civ;
    $('#topMil').textContent = summary.mil;
    $('#topDock').textContent = summary.dockyard;
    $('#topFuel').textContent = fmtK(country.stockpile.fuel / 1000);
    $('#topTension').textContent = `${Math.round(GameV4.worldTension)}%`;
    $('#topDate').textContent = GameV4.dateLabel();
    const speedText = GameV4.speed === 0 ? '已暂停' : GameV4.speed === 1 ? '正常速度' : `${GameV4.speed}倍速度`;
    $('#topDay').textContent = `第${GameV4.day}天 · ${speedText}`;
    $('#runningLabel').textContent = speedText;
    $('#bottomStability').textContent = `${Math.round(country.stability)}%`;
    $('#bottomWar').textContent = `${Math.round(country.warSupport)}%`;
    $('#stabilityBar').style.width = `${clamp(country.stability, 0, 100)}%`;
    $('#warBar').style.width = `${clamp(country.warSupport, 0, 100)}%`;
  }

  function setSpeedUI(speed) {
    GameV4?.setSpeed(speed);
    $$('.speed-button').forEach(button => button.classList.toggle('active', Number(button.dataset.speed) === speed));
    renderTopbar();
  }

  function handleProvinceSelect(id) {
    if (!GameV4) return;
    if (orderMode) {
      if (orderMode.type === 'move') executeMove(id);
      if (orderMode.type === 'front') prepareFront(id);
      return;
    }
    selectedProvince = id;
    GameV4.selectedProvince = id;
    selectedDivisions.clear();
    renderInspector();
    updateSelectionBar();
    if (innerWidth <= 1250) $('#inspector').classList.add('open');
  }

  function renderInspector() {
    const host = $('#inspectorContent');
    const province = selectedProvince && GameV4?.provinces[selectedProvince];
    const mapProvince = selectedProvince && MapV4.getProvince(selectedProvince);
    if (!province || !mapProvince) {
      host.innerHTML = '<div class="empty-state"><b>请选择省份</b><span>地图已完整载入。点选地区可查看发展度、工业、资源、补给、天气和驻军。</span></div>';
      return;
    }
    const country = GameV4.countries[province.controller];
    const supply = GameV4.provinceSupplyRatio(province.id);
    const weather = GameV4.weatherForProvince(province.id);
    const resources = Object.entries(province.resources).filter(([, amount]) => amount > 0).map(([key, amount]) => `${RESOURCE_NAMES[key]} ${amount}`).join('、') || '无战略资源';
    const relatedFront = GameV4.fronts.find(front => front.source === province.id || front.target === province.id);
    host.innerHTML = `
      <div class="province-card">
        <h2>${province.name}${province.capital ? ' ★' : ''}</h2>
        <p>${country.name} · ${TERRAIN[province.terrain].name} · <span class="weather-badge">${WEATHER_NAMES[weather]}</span></p>
        <div class="province-grid">
          <div><small>发展度</small><b>${province.development}/10</b></div>
          <div><small>人口</small><b>${province.population.toFixed(2)}M</b></div>
          <div><small>核心状态</small><b>${province.core ? '核心省份' : `${Math.round(province.coreProgress)}%`}</b></div>
          <div><small>民用/军用/船坞</small><b>${province.civ}/${province.mil}/${province.dockyard}</b></div>
          <div><small>基础设施/铁路</small><b>${province.infrastructure}/${province.rail}</b></div>
          <div><small>补给</small><b>${Math.round(supply * 100)}%</b></div>
          <div><small>要塞/机场/港口</small><b>${province.fort}/${province.airBase}/${province.navalBase}</b></div>
          <div><small>驻军</small><b>${province.divisions.length}师</b></div>
          <div><small>资源</small><b>${resources}</b></div>
        </div>
      </div>
      ${relatedFront ? `<div class="inspector-section"><h3>战线状态</h3><div class="front-card ${relatedFront.active ? 'active' : ''}"><div class="row"><b>${GameV4.provinces[relatedFront.source].name} → ${GameV4.provinces[relatedFront.target].name}</b><span>${Math.round(relatedFront.progress)}%</span></div><div class="progress"><i style="width:${clamp((relatedFront.progress + 100) / 2, 0, 100)}%"></i></div><span>${relatedFront.active ? '正在交战' : `计划加成 ${Math.round(relatedFront.planning)}%`}</span></div></div>` : ''}
      <div class="inspector-section"><h3>驻军编成</h3>${province.divisions.length ? province.divisions.map(division => divisionCard(division, province.controller === GameV4.player)).join('') : '<div class="empty-state small"><span>本省没有正规部队。</span></div>'}</div>
      <div class="inspector-section"><h3>省份行动</h3><div class="province-actions">
        <button data-build="civ" ${province.controller === GameV4.player ? '' : 'disabled'}>建民用工厂</button>
        <button data-build="mil" ${province.controller === GameV4.player ? '' : 'disabled'}>建军用工厂</button>
        <button data-build="dockyard" ${province.controller === GameV4.player ? '' : 'disabled'}>建海军船坞</button>
        <button data-build="infrastructure" ${province.controller === GameV4.player ? '' : 'disabled'}>基础设施</button>
        <button data-build="rail" ${province.controller === GameV4.player ? '' : 'disabled'}>铁路</button>
        <button data-build="supplyHub" ${province.controller === GameV4.player ? '' : 'disabled'}>补给枢纽</button>
        <button data-train="infantry" ${province.controller === GameV4.player ? '' : 'disabled'}>训练步兵师</button>
        <button data-train="light_armor" ${province.controller === GameV4.player ? '' : 'disabled'}>训练轻装甲师</button>
      </div></div>`;
    host.querySelectorAll('[data-division]').forEach(input => {
      input.onchange = () => {
        if (input.checked) selectedDivisions.add(input.dataset.division);
        else selectedDivisions.delete(input.dataset.division);
        updateSelectionBar();
      };
    });
    host.querySelectorAll('[data-build]').forEach(button => {
      button.onclick = () => {
        GameV4.queueConstruction(province.id, button.dataset.build) ? toast(`已加入${BUILDING_NAMES[button.dataset.build]}建设队列`, 'good') : toast('建设槽已满或条件不足', 'bad');
        renderAll();
      };
    });
    host.querySelectorAll('[data-train]').forEach(button => {
      button.onclick = () => {
        GameV4.queueTraining(province.id, button.dataset.train) ? toast('已加入部队训练队列', 'good') : toast('人力或条件不足', 'bad');
        renderAll();
      };
    });
  }

  function divisionCard(division, selectable) {
    const template = GameV4.countries[division.owner].divisionTemplates[division.templateKey];
    const assigned = division.assignedFront ? ' · 已编入战线' : '';
    return `<label class="division-card">
      <input class="division-check" type="checkbox" data-division="${division.id}" ${selectable && !division.assignedFront ? '' : 'disabled'} ${selectedDivisions.has(division.id) ? 'checked' : ''}>
      <div><div class="division-head"><b>${division.name}</b><span>${template.name}${assigned}</span></div>
      <div class="division-meta"><span>宽度 ${template.width}</span><span>兵力 ${(template.manpower * division.strength / 100 / 1000).toFixed(1)}K</span><span>装备 ${Math.round(division.equipment)}%</span><span>组织 ${Math.round(division.organization)}%</span></div>
      <div class="dual-bars"><div class="mini-bar"><i style="width:${division.strength}%"></i></div><div class="mini-bar org"><i style="width:${division.organization}%"></i></div></div></div>
    </label>`;
  }

  function updateSelectionBar() {
    const count = selectedDivisions.size;
    $('#selectionBar').classList.toggle('hidden', count === 0);
    $('#selectedCount').textContent = `${count}个师`;
  }

  function beginOrder(type) {
    if (!selectedProvince || !selectedDivisions.size) return;
    orderMode = { type, source: selectedProvince, divisions: [...selectedDivisions] };
    $('#frontHint').classList.remove('hidden');
    $('#frontHint').textContent = type === 'move' ? '请选择相邻的己方省份进行战略调动' : '请选择相邻的敌方省份建立战线；占领将通过连续战斗逐日推进';
  }

  function clearSelection() {
    selectedDivisions.clear();
    orderMode = null;
    $('#frontHint').classList.add('hidden');
    updateSelectionBar();
    renderInspector();
  }

  function executeMove(targetId) {
    const success = GameV4.moveDivisions(orderMode.source, targetId, orderMode.divisions);
    if (success) toast('部队开始战略调动', 'good');
    else toast('目标必须是相邻的己方省份', 'bad');
    clearSelection();
    selectedProvince = targetId;
    renderAll();
  }

  function prepareFront(targetId) {
    const source = GameV4.provinces[orderMode.source];
    const target = GameV4.provinces[targetId];
    if (!source || !target || source.controller !== GameV4.player || target.controller === GameV4.player || !source.neighbors.includes(targetId)) {
      toast('目标必须是相邻敌方省份', 'bad');
      return;
    }
    if (!GameV4.isAtWar(GameV4.player, target.controller)) {
      toast(`尚未与${GameV4.countries[target.controller].short}交战`, 'bad');
      return;
    }
    const generals = GameV4.currentCountry().generals;
    showModal(`<h2>建立战线</h2><p>${source.name} → ${target.name}，投入${orderMode.divisions.length}个师。请选择将领；战线建立后先积累计划加成，再开始进攻。</p>
      ${generals.map(general => `<button class="modal-choice" data-general="${general.id}" ${general.assignedFront ? 'disabled' : ''}><b>${general.name} · 技能${general.skill}</b><br><small>进攻${general.attack} 防御${general.defense} 后勤${general.logistics} 计划${general.planning}</small></button>`).join('')}
      <button class="modal-choice" data-general=""><b>不指派将领</b></button>`);
    $$('[data-general]').forEach(button => {
      button.onclick = () => {
        const front = GameV4.createFront(orderMode.source, targetId, orderMode.divisions, button.dataset.general || null);
        hideModal();
        if (front) { toast('战线已经建立，正在积累计划加成', 'good'); MapV4.setMode('fronts'); setMapModeUI('fronts'); }
        else toast('无法建立战线', 'bad');
        clearSelection();
        renderAll();
      };
    });
  }

  function openPanel(type) {
    currentPanel = type;
    $('#panelTitle').textContent = PANEL_TITLES[type];
    $('#systemPanel').classList.remove('hidden');
    $$('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.panel === type));
    renderPanel(type);
  }

  function closePanel() {
    currentPanel = null;
    $('#systemPanel').classList.add('hidden');
    $$('.nav-button').forEach(button => button.classList.remove('active'));
  }

  function renderPanel(type) {
    if (!GameV4) return;
    const host = $('#panelContent');
    if (type === 'country') renderCountryPanel(host);
    if (type === 'politics') renderPoliticsPanel(host);
    if (type === 'research') renderResearchPanel(host);
    if (type === 'production') renderProductionPanel(host);
    if (type === 'shipyard') renderShipyardPanel(host);
    if (type === 'construction') renderConstructionPanel(host);
    if (type === 'army') renderArmyPanel(host);
    if (type === 'air') renderAirPanel(host);
    if (type === 'navy') renderNavyPanel(host);
    if (type === 'logistics') renderLogisticsPanel(host);
    if (type === 'diplomacy') renderDiplomacyPanel(host);
    if (type === 'administration') renderAdministrationPanel(host);
    if (type === 'log') renderLogPanel(host);
  }

  function renderCountryPanel(host) {
    const country = GameV4.currentCountry();
    const summary = GameV4.nationalSummary(GameV4.player);
    const consumer = Math.ceil(summary.civ * country.consumerGoodsRatio);
    host.innerHTML = `<div class="dashboard-grid">
      <div class="info-card"><h3>人口与动员</h3><div class="metric">${country.population.toFixed(1)}M</div><p>可用人力 ${fmtK(country.availableManpower)} · 现役 ${fmtK(summary.armyManpower)} · 伤亡 ${fmt(country.casualties)}</p></div>
      <div class="info-card"><h3>国家工业</h3><div class="metric">${summary.civ + summary.mil + summary.dockyard}</div><p>民用 ${summary.civ} · 军用 ${summary.mil} · 船坞 ${summary.dockyard}</p></div>
      <div class="info-card"><h3>民用工厂用途</h3><div class="metric">${Math.max(0, summary.civ - consumer - country.tradeCivUsed)}</div><p>消费品 ${consumer} · 贸易 ${country.tradeCivUsed} · 剩余用于建设</p></div>
      <div class="info-card"><h3>国家状态</h3><div class="metric">${Math.round(country.stability)}%</div><p>战争支持 ${Math.round(country.warSupport)}% · 世界紧张度 ${Math.round(GameV4.worldTension)}%</p></div>
    </div>
    <div class="subheading">国家运行机制</div>
    <div class="dashboard-grid three">
      <div class="info-card"><h4>连续时间</h4><p>生产、科研、建设、贸易、补给、组织度与战线每天自动结算。</p></div>
      <div class="info-card"><h4>工业分工</h4><p>民用工厂承担建筑、进口和消费品；军用工厂生产陆空装备；海军船坞建造舰船。</p></div>
      <div class="info-card"><h4>逐省战争</h4><p>战线受宽度、地形、天气、将领、空军和补给影响，进度达到100%后才逐省推进。</p></div>
    </div>`;
  }

  function renderPoliticsPanel(host) {
    const country = GameV4.currentCountry();
    const active = POLICIES.find(policy => policy.id === country.activePolicy);
    host.innerHTML = `${active ? `<div class="info-card"><h3>当前政策：${active.name}</h3><p>${active.effect}</p><div class="progress"><i style="width:${country.policyProgress / active.days * 100}%"></i></div><p>${Math.round(country.policyProgress)}/${active.days}天</p></div>` : '<div class="info-card"><p>当前没有推进中的政策。政策方向是长期国家能力的主要来源；历史事件只提供环境变化和短期修正。</p></div>'}
      <div class="subheading">政策方针</div><div class="policy-grid">${POLICIES.map(policy => `<div class="policy-card ${country.activePolicy === policy.id ? 'active' : ''}"><b>${policy.name}</b><span>${policy.effect} · ${policy.days}天 · ${policy.cost}政治点</span><button class="small-button" data-policy="${policy.id}" ${country.activePolicy || country.completedPolicies.includes(policy.id) ? 'disabled' : ''}>${country.completedPolicies.includes(policy.id) ? '已完成' : '开始推进'}</button></div>`).join('')}</div>
      <div class="subheading">国家决议</div><div class="decision-grid">${DECISIONS.filter(decision => ['propaganda', 'stability_program'].includes(decision.id)).map(decision => `<div class="decision-card"><div><b>${decision.name}</b><span>${decision.effect} · ${decision.pp}政治点 ${decision.admin ? `· ${decision.admin}行政点` : ''}</span></div><button data-decision="${decision.id}">执行</button></div>`).join('')}</div>`;
    host.querySelectorAll('[data-policy]').forEach(button => button.onclick = () => { GameV4.startPolicy(button.dataset.policy) ? toast('政策开始推进', 'good') : toast('政治点数不足或已有政策进行中', 'bad'); renderAll(); });
    host.querySelectorAll('[data-decision]').forEach(button => button.onclick = () => { GameV4.executeDecision(button.dataset.decision, selectedProvince) ? toast('决议已经执行', 'good') : toast('点数或条件不足', 'bad'); renderAll(); });
  }

  function renderResearchPanel(host) {
    const country = GameV4.currentCountry();
    const year = GameV4.currentDate().getUTCFullYear();
    host.innerHTML = `<div class="dashboard-grid">${country.research.map((slot, index) => {
      const tech = slot.tech && Object.values(RESEARCH_TREE).flat().find(item => item.id === slot.tech);
      return `<button class="research-card ${researchSlot === index ? 'active' : ''}" data-slot="${index}"><b>科研槽${index + 1}</b><span>${tech ? tech.name : '空闲'}</span>${tech ? `<div class="progress"><i style="width:${slot.progress / tech.cost * 100}%"></i></div><span>${Math.round(slot.progress)}/${tech.cost}科研点</span>` : ''}</button>`;
    }).join('')}</div>
    <div class="category-tabs">${Object.keys(RESEARCH_TREE).map(category => `<button data-category="${category}" class="${researchCategory === category ? 'active' : ''}">${{ industry: '工业', army: '陆军', air: '空军', navy: '海军', doctrine: '学说' }[category]}</button>`).join('')}</div>
    <div class="research-grid">${RESEARCH_TREE[researchCategory].map(tech => {
      const completed = country.technologies.includes(tech.id);
      const occupied = country.research.some(slot => slot.tech === tech.id);
      const locked = tech.requires && !country.technologies.includes(tech.requires);
      return `<div class="research-card ${completed ? 'active' : ''}"><b>${tech.name} · ${tech.year}</b><span>${tech.effect}${tech.year > year ? ` · 超前${tech.year - year}年` : ''}</span><button class="small-button" data-tech="${tech.id}" ${completed || occupied || locked ? 'disabled' : ''}>${completed ? '已完成' : locked ? '前置未完成' : '研究'}</button></div>`;
    }).join('')}</div>`;
    host.querySelectorAll('[data-slot]').forEach(button => button.onclick = () => { researchSlot = Number(button.dataset.slot); renderResearchPanel(host); });
    host.querySelectorAll('[data-category]').forEach(button => button.onclick = () => { researchCategory = button.dataset.category; renderResearchPanel(host); });
    host.querySelectorAll('[data-tech]').forEach(button => button.onclick = () => { GameV4.startResearch(researchSlot, button.dataset.tech) ? toast('科研项目已经启动', 'good') : toast('科研槽占用或前置未完成', 'bad'); renderAll(); });
  }

  function renderProductionPanel(host) {
    const country = GameV4.currentCountry();
    const used = country.production.reduce((sum, line) => sum + line.factories, 0);
    const balance = GameV4.resourceBalance(GameV4.player);
    host.innerHTML = `<div class="info-card"><p>军用工厂分配 ${used}/${country.mil}。每条生产线最多10座军用工厂；效率随连续生产逐日提升，换线或撤厂会损失效率。</p></div>
      ${country.production.map(line => {
        const equipment = LAND_EQUIPMENT[line.item];
        const resources = Object.entries(equipment.resources).map(([key, amount]) => `${RESOURCE_NAMES[key]} ${amount * line.factories}`).join(' · ');
        return `<div class="production-line"><div class="line-title"><b>${equipment.name}</b><span>库存 ${fmt(country.stockpile[line.item] || 0)} · 月产约 ${fmt(GameV4.productionOutput(GameV4.player, line, 30))}</span></div><div class="stepper"><button data-land-line="${line.id}" data-delta="-1">−</button><b>${line.factories}/10</b><button data-land-line="${line.id}" data-delta="1">＋</button></div><div><small>效率 ${Math.round(line.efficiency * 100)}%</small><div class="efficiency"><i style="width:${line.efficiency / line.efficiencyCap * 100}%"></i></div></div><div><small>${resources || '无资源需求'}</small></div></div>`;
      }).join('')}
      <div class="subheading">新建生产线</div><div class="equipment-grid">${Object.entries(LAND_EQUIPMENT).map(([key, equipment]) => `<button class="small-button" data-add-land="${key}">${equipment.category} · ${equipment.name}</button>`).join('')}</div>
      <div class="subheading">资源缺口</div><div class="equipment-grid">${Object.entries(balance).map(([key, value]) => `<div class="resource-card"><b>${RESOURCE_NAMES[key]}</b><div class="metric ${value.balance < 0 ? 'bad' : ''}">${value.balance >= 0 ? '+' : ''}${value.balance}</div><span>可用${value.available} · 使用${value.used}</span></div>`).join('')}</div>`;
    host.querySelectorAll('[data-land-line]').forEach(button => button.onclick = () => { GameV4.changeProduction(button.dataset.landLine, Number(button.dataset.delta)) || toast('生产线最多10座工厂，或已无空闲军工厂', 'bad'); renderAll(); });
    host.querySelectorAll('[data-add-land]').forEach(button => button.onclick = () => { GameV4.addProductionLine(button.dataset.addLand); renderAll(); });
  }

  function renderShipyardPanel(host) {
    const country = GameV4.currentCountry();
    const used = country.shipProduction.reduce((sum, line) => sum + line.dockyards, 0);
    host.innerHTML = `<div class="info-card"><p>海军船坞分配 ${used}/${country.dockyard}。每条舰船生产线最多10座船坞，进度达到100%后下水1艘舰船。</p></div>
      ${country.shipProduction.length ? country.shipProduction.map(line => {
        const equipment = NAVAL_EQUIPMENT[line.item];
        return `<div class="production-line"><div class="line-title"><b>${equipment.name}</b><span>现有 ${fmt(country.stockpile[line.item] || 0)}艘 · 已下水${line.completed}艘</span></div><div class="stepper"><button data-ship-line="${line.id}" data-delta="-1">−</button><b>${line.dockyards}/10</b><button data-ship-line="${line.id}" data-delta="1">＋</button></div><div><small>建造进度 ${Math.round(line.progress * 100)}%</small><div class="progress"><i style="width:${line.progress * 100}%"></i></div></div><div><small>${Object.entries(equipment.resources).map(([key, amount]) => `${RESOURCE_NAMES[key]} ${amount * line.dockyards}`).join(' · ')}</small></div></div>`;
      }).join('') : '<div class="empty-state small"><span>该国没有海军船坞生产线。</span></div>'}
      <div class="subheading">新增舰船生产线</div><div class="equipment-grid">${Object.entries(NAVAL_EQUIPMENT).map(([key, equipment]) => `<button class="small-button" data-add-ship="${key}">${equipment.name}</button>`).join('')}</div>`;
    host.querySelectorAll('[data-ship-line]').forEach(button => button.onclick = () => { GameV4.changeShipProduction(button.dataset.shipLine, Number(button.dataset.delta)) || toast('生产线最多10座船坞，或已无空闲船坞', 'bad'); renderAll(); });
    host.querySelectorAll('[data-add-ship]').forEach(button => button.onclick = () => { GameV4.addShipLine(button.dataset.addShip); renderAll(); });
  }

  function renderConstructionPanel(host) {
    const country = GameV4.currentCountry();
    const summary = GameV4.nationalSummary(GameV4.player);
    const consumer = Math.ceil(summary.civ * country.consumerGoodsRatio);
    const available = Math.max(0, summary.civ - consumer - country.tradeCivUsed);
    host.innerHTML = `<div class="dashboard-grid three"><div class="info-card"><h3>民用工厂</h3><div class="metric">${summary.civ}</div><p>消费品占用${consumer}</p></div><div class="info-card"><h3>贸易占用</h3><div class="metric">${country.tradeCivUsed}</div><p>进口战略资源</p></div><div class="info-card"><h3>可用于建设</h3><div class="metric">${available}</div><p>共同推进${country.construction.length}个项目</p></div></div>
      <div class="subheading">建设队列</div>${country.construction.length ? country.construction.map(project => `<div class="construction-item"><div class="row"><b>${GameV4.provinces[project.provinceId]?.name} · ${BUILDING_NAMES[project.type]}</b><span>${Math.round(project.progress)}/${project.cost}</span></div><div class="progress"><i style="width:${project.progress / project.cost * 100}%"></i></div></div>`).join('') : '<div class="empty-state small"><span>在地图中选择省份添加民用工厂、军用工厂、船坞、铁路、补给枢纽等项目。</span></div>'}`;
  }

  function renderArmyPanel(host) {
    const country = GameV4.currentCountry();
    host.innerHTML = `<div class="dashboard-grid three"><div class="info-card"><h3>陆军师</h3><div class="metric">${GameV4.totalDivisions(GameV4.player)}</div><p>训练队列 ${country.training.length}</p></div><div class="info-card"><h3>指挥点数</h3><div class="metric">${Math.round(country.commandPower)}</div><p>修改师编制和支援连需要指挥点数</p></div><div class="info-card"><h3>现有战线</h3><div class="metric">${GameV4.fronts.filter(front => front.attacker === GameV4.player).length}</div><p>逐日结算计划、宽度、补给与战斗</p></div></div>
      <div class="subheading">将领</div><div class="general-grid">${country.generals.map(general => `<div class="general-card ${general.assignedFront ? 'active' : ''}"><b>${general.name} · 技能${general.skill}</b><span>进攻${general.attack} · 防御${general.defense} · 后勤${general.logistics} · 计划${general.planning}</span><span>${general.assignedFront ? '已指挥战线' : '可用'}</span></div>`).join('')}</div>
      <div class="subheading">师编制</div><div class="template-grid">${Object.entries(country.divisionTemplates).map(([key, template]) => `<div class="template-card"><b>${template.name}</b><span>战场宽度 ${template.width} · 人力 ${(template.manpower / 1000).toFixed(1)}K · 攻击${template.attack} · 防御${template.defense}</span><div class="template-battalions">${Object.entries(template.battalions).map(([battalion, count]) => `<span class="chip">${battalion}:${count}<button data-template="${key}" data-battalion="${battalion}" data-delta="-1">−</button><button data-template="${key}" data-battalion="${battalion}" data-delta="1">＋</button></span>`).join('')}</div><span>支援连：${template.support.join('、') || '无'}</span><div class="category-tabs">${SUPPORT_COMPANIES.map(company => `<button data-support-template="${key}" data-company="${company}" class="${template.support.includes(company) ? 'active' : ''}">${company}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="subheading">战线</div>${GameV4.fronts.filter(front => front.attacker === GameV4.player).length ? GameV4.fronts.filter(front => front.attacker === GameV4.player).map(front => {
        const general = country.generals.find(item => item.id === front.generalId);
        return `<div class="front-card ${front.active ? 'active' : ''}"><div class="row"><b>${GameV4.provinces[front.source]?.name} → ${GameV4.provinces[front.target]?.name}</b><span>${Math.round(front.progress)}%</span></div><span>${front.divisions.length}个师 · 将领 ${general?.name || '未指派'} · 计划 ${Math.round(front.planning)}% · 宽度 ${GameV4.frontCombatWidth(front)}</span><div class="progress"><i style="width:${clamp((front.progress + 100) / 2, 0, 100)}%"></i></div>${front.lastReport ? `<span>战力 ${front.lastReport.attackPower}/${front.lastReport.defense} · ${WEATHER_NAMES[front.lastReport.weather]}</span>` : ''}<div class="front-actions"><button data-front-toggle="${front.id}" data-active="${front.active ? '0' : '1'}">${front.active ? '暂停进攻' : '开始进攻'}</button><button data-front-map="${front.target}">查看目标</button><button data-front-delete="${front.id}">解散战线</button></div></div>`;
      }).join('') : '<div class="empty-state small"><span>在地图中选择己方省份的部队，然后点击“建立战线”，再选择相邻敌方省份。</span></div>'}
      <div class="subheading">训练队列</div>${country.training.map(item => `<div class="construction-item"><div class="row"><b>${country.divisionTemplates[item.templateKey].name} · ${GameV4.provinces[item.provinceId]?.name}</b><span>${item.progress}/${item.days}天</span></div><div class="progress"><i style="width:${item.progress / item.days * 100}%"></i></div></div>`).join('') || '<div class="empty-state small"><span>没有训练中的部队。</span></div>'}`;
    host.querySelectorAll('[data-template]').forEach(button => button.onclick = () => { GameV4.modifyTemplate(button.dataset.template, button.dataset.battalion, Number(button.dataset.delta)) ? toast('师编制已调整', 'good') : toast('指挥点数不足或宽度超限', 'bad'); renderAll(); });
    host.querySelectorAll('[data-support-template]').forEach(button => button.onclick = () => { GameV4.toggleSupport(button.dataset.supportTemplate, button.dataset.company) ? toast('支援连已调整', 'good') : toast('指挥点数不足或支援连已满', 'bad'); renderAll(); });
    host.querySelectorAll('[data-front-toggle]').forEach(button => button.onclick = () => { GameV4.toggleFront(button.dataset.frontToggle, button.dataset.active === '1'); renderAll(); });
    host.querySelectorAll('[data-front-map]').forEach(button => button.onclick = () => { closePanel(); MapV4.selectProvince(button.dataset.frontMap, true); });
    host.querySelectorAll('[data-front-delete]').forEach(button => button.onclick = () => { GameV4.deleteFront(button.dataset.frontDelete); renderAll(); });
  }

  function renderAirPanel(host) {
    const country = GameV4.currentCountry();
    const frontOptions = GameV4.fronts.filter(front => front.attacker === GameV4.player).map(front => `<option value="${front.target}">${GameV4.provinces[front.target]?.name}战区</option>`).join('');
    host.innerHTML = `<div class="info-card"><p>空军任务持续消耗燃料。制空权降低敌方效率，近距支援直接增强地面战线，战略轰炸降低敌方工业和基础设施。</p></div><div class="mission-grid">${country.airWings.map(wing => `<div class="mission-card"><b>${wing.name}</b><span>${LAND_EQUIPMENT[wing.type]?.name || wing.type} · ${fmt(wing.aircraft)}架 · 效率${Math.round(wing.efficiency * 100)}%</span><select data-air-mission="${wing.id}">${AIR_MISSIONS.map(mission => `<option ${wing.mission === mission ? 'selected' : ''}>${mission}</option>`).join('')}</select><select data-air-region="${wing.id}"><option value="全国" ${wing.region === '全国' ? 'selected' : ''}>全国空域</option>${frontOptions}</select></div>`).join('')}</div>`;
    host.querySelectorAll('[data-air-mission]').forEach(select => select.onchange = () => { const region = host.querySelector(`[data-air-region="${select.dataset.airMission}"]`).value; GameV4.assignAirMission(select.dataset.airMission, select.value, region); renderAll(); });
    host.querySelectorAll('[data-air-region]').forEach(select => select.onchange = () => { const mission = host.querySelector(`[data-air-mission="${select.dataset.airRegion}"]`).value; GameV4.assignAirMission(select.dataset.airRegion, mission, select.value); renderAll(); });
  }

  function renderNavyPanel(host) {
    const country = GameV4.currentCountry();
    host.innerHTML = `<div class="info-card"><p>舰队任务持续消耗燃料。巡逻负责发现敌舰，打击舰队负责决战，护航保护运输船队，潜艇和水面舰可袭击运输线。</p></div><div class="mission-grid">${country.fleets.length ? country.fleets.map(fleet => `<div class="mission-card"><b>${fleet.name}</b><span>战备${Math.round(fleet.readiness)}% · ${Object.entries(fleet.ships).filter(([, amount]) => amount > 0).map(([type, amount]) => `${NAVAL_EQUIPMENT[type].name}${amount}`).join('、')}</span><select data-fleet-mission="${fleet.id}">${NAVAL_MISSIONS.map(mission => `<option ${fleet.mission === mission ? 'selected' : ''}>${mission}</option>`).join('')}</select><select data-fleet-zone="${fleet.id}"><option value="">未指定海域</option>${SEA_ZONES.map(zone => `<option ${fleet.zone === zone ? 'selected' : ''}>${zone}</option>`).join('')}</select></div>`).join('') : '<div class="empty-state small"><span>该国没有可用舰队。</span></div>'}</div>`;
    host.querySelectorAll('[data-fleet-mission]').forEach(select => select.onchange = () => { const zone = host.querySelector(`[data-fleet-zone="${select.dataset.fleetMission}"]`).value; GameV4.assignFleetMission(select.dataset.fleetMission, select.value, zone); renderAll(); });
    host.querySelectorAll('[data-fleet-zone]').forEach(select => select.onchange = () => { const mission = host.querySelector(`[data-fleet-mission="${select.dataset.fleetZone}"]`).value; GameV4.assignFleetMission(select.dataset.fleetZone, mission, select.value); renderAll(); });
  }

  function renderLogisticsPanel(host) {
    const country = GameV4.currentCountry();
    const balance = GameV4.resourceBalance(GameV4.player);
    const provinces = Object.values(GameV4.provinces).filter(province => province.controller === GameV4.player);
    const lowSupply = provinces.filter(province => GameV4.provinceSupplyRatio(province.id) < 0.55);
    host.innerHTML = `<div class="dashboard-grid three"><div class="info-card"><h3>燃料</h3><div class="metric">${fmtK(country.stockpile.fuel / 1000)}</div><p>陆军装甲、空军和舰队任务持续消耗</p></div><div class="info-card"><h3>运输船队</h3><div class="metric">${country.convoys}</div><p>海外补给和贸易依赖运输船队</p></div><div class="info-card"><h3>低补给省份</h3><div class="metric ${lowSupply.length ? 'bad' : ''}">${lowSupply.length}</div><p>${lowSupply.slice(0, 3).map(province => province.name).join('、') || '当前补给正常'}</p></div></div>
      <div class="subheading">装备库存</div><div class="equipment-grid">${Object.entries({ ...LAND_EQUIPMENT, ...NAVAL_EQUIPMENT }).map(([key, equipment]) => `<div class="info-card"><h4>${equipment.name}</h4><div class="metric">${fmt(country.stockpile[key] || 0)}</div></div>`).join('')}</div>
      <div class="subheading">资源与贸易</div><div class="equipment-grid">${Object.entries(balance).map(([key, value]) => `<div class="resource-card"><b>${RESOURCE_NAMES[key]}</b><div class="metric ${value.balance < 0 ? 'bad' : ''}">${value.balance >= 0 ? '+' : ''}${value.balance}</div><span>本土和进口 ${value.available} · 工业需求 ${value.used} · 当前进口 ${country.imports[key]}</span><div class="resource-actions"><button data-resource="${key}" data-block="-1" ${country.imports[key] <= 0 ? 'disabled' : ''}>减少8</button><button data-resource="${key}" data-block="1">进口8</button></div></div>`).join('')}</div>`;
    host.querySelectorAll('[data-resource]').forEach(button => button.onclick = () => { GameV4.adjustImport(button.dataset.resource, Number(button.dataset.block)) ? toast('贸易合同已调整', 'good') : toast('没有足够空闲民用工厂', 'bad'); renderAll(); });
  }

  function renderDiplomacyPanel(host) {
    host.innerHTML = `<div class="info-card"><p>外交选项包括关系改善、条约、联盟、宣战、建立附庸和吞并附庸。附庸需要降低自治度后才能行政吞并。</p></div>${Object.entries(GameV4.countries).filter(([code, country]) => code !== GameV4.player && country.alive).map(([code, country]) => {
      const war = GameV4.isAtWar(GameV4.player, code);
      const treaty = GameV4.treaties[GameV4.pair(GameV4.player, code)];
      const alliance = GameV4.alliances[GameV4.pair(GameV4.player, code)];
      const puppet = GameV4.puppets[code];
      return `<div class="diplomacy-row"><div class="country-dot" style="background:${country.color}"></div><div><div class="diplomacy-name">${country.name}</div><div class="diplomacy-meta">关系 ${Math.round(GameV4.relation(GameV4.player, code))} · ${war ? `交战中，占领${Math.round(GameV4.occupationRatio(GameV4.player, code) * 100)}%` : puppet ? `附庸，自治度${Math.round(puppet.autonomy)}%` : alliance ? '同盟国' : treaty ? treaty.type : '和平'}</div></div><div class="diplomacy-actions"><button data-dip="map" data-code="${code}">地图</button><button data-dip="improve" data-code="${code}" ${war ? 'disabled' : ''}>改善</button><button data-dip="treaty" data-code="${code}" ${war || treaty ? 'disabled' : ''}>条约</button><button data-dip="alliance" data-code="${code}" ${war || alliance ? 'disabled' : ''}>联盟</button>${war ? `<button data-dip="puppet" data-code="${code}">建立附庸</button>` : puppet ? `<button data-dip="annex" data-code="${code}">吞并</button>` : `<button data-dip="war" data-code="${code}" ${treaty ? 'disabled' : ''}>宣战</button>`}</div></div>`;
    }).join('')}`;
    host.querySelectorAll('[data-dip]').forEach(button => button.onclick = () => {
      const action = button.dataset.dip;
      const code = button.dataset.code;
      if (action === 'map') { closePanel(); MapV4.focusCountry(code); return; }
      let success = false;
      if (action === 'improve') success = GameV4.improveRelations(code);
      if (action === 'treaty') success = GameV4.signTreaty(code);
      if (action === 'alliance') success = GameV4.formAlliance(code);
      if (action === 'war') success = GameV4.declareWar(code);
      if (action === 'puppet') success = GameV4.createPuppet(code);
      if (action === 'annex') success = GameV4.annexPuppet(code);
      toast(success ? '外交行动已经执行' : '条件、关系或点数不足', success ? 'good' : 'bad');
      renderAll();
    });
  }

  function renderAdministrationPanel(host) {
    const country = GameV4.currentCountry();
    const province = selectedProvince && GameV4.provinces[selectedProvince];
    host.innerHTML = `<div class="dashboard-grid three"><div class="info-card"><h3>行政点数</h3><div class="metric">${Math.round(country.adminPoints)}</div><p>用于发展省份、核心化、铁路和稳定计划</p></div><div class="info-card"><h3>省份总数</h3><div class="metric">${Object.values(GameV4.provinces).filter(item => item.controller === GameV4.player).length}</div><p>非核心省份的资源、工业和人力效率较低</p></div><div class="info-card"><h3>核心化项目</h3><div class="metric">${country.coreProjects.length}</div><p>控制中断会取消项目</p></div></div>
      <div class="subheading">所选省份</div>${province ? `<div class="province-card"><h2>${province.name}</h2><p>发展度${province.development} · ${province.core ? '核心省份' : `核心化${Math.round(province.coreProgress)}%`} · 地方稳定${Math.round(province.localStability)}%</p></div><div class="decision-grid">${DECISIONS.filter(decision => ['develop_core', 'make_core', 'rail_emergency'].includes(decision.id)).map(decision => `<div class="decision-card"><div><b>${decision.name}</b><span>${decision.effect} · ${decision.pp}政治点 · ${decision.admin}行政点</span></div><button data-admin-decision="${decision.id}">${decision.id === 'make_core' && province.core ? '已是核心' : '执行'}</button></div>`).join('')}</div>` : '<div class="empty-state small"><span>先在地图中选择省份。</span></div>'}
      <div class="subheading">核心化进度</div>${country.coreProjects.map(project => `<div class="construction-item"><div class="row"><b>${GameV4.provinces[project.provinceId]?.name}</b><span>${Math.round(project.progress)}%</span></div><div class="progress"><i style="width:${project.progress}%"></i></div></div>`).join('') || '<div class="empty-state small"><span>没有推进中的核心化项目。</span></div>'}`;
    host.querySelectorAll('[data-admin-decision]').forEach(button => button.onclick = () => { GameV4.executeDecision(button.dataset.adminDecision, selectedProvince) ? toast('行政行动已经执行', 'good') : toast('行政点数、政治点数或条件不足', 'bad'); renderAll(); });
  }

  function renderLogPanel(host) {
    host.innerHTML = GameV4.log.map(entry => `<div class="log-entry ${entry.type}"><time>${entry.date}</time>${entry.text}</div>`).join('') || '<div class="empty-state"><span>暂无历史记录。</span></div>';
  }

  function setMapModeUI(mode) {
    $$('.map-mode').forEach(button => button.classList.toggle('active', button.dataset.mapMode === mode));
  }

  function showModal(html) { $('#modalBox').innerHTML = html; $('#modalBackdrop').classList.remove('hidden'); }
  function hideModal() { $('#modalBackdrop').classList.add('hidden'); }
  function toast(text, type = '') {
    const node = $('#toast');
    node.textContent = text;
    node.className = `toast ${type}`;
    clearTimeout(window.__v4Toast);
    window.__v4Toast = setTimeout(() => node.classList.add('hidden'), 1900);
  }

  $('#newBtn').onclick = startNewGame;
  $('#loadBtn').onclick = loadGame;
  $('#countryButton').onclick = () => openPanel('country');
  $('#saveBtn').onclick = () => { const ok = GameV4.save(); toast(ok ? '游戏已保存' : '保存失败', ok ? 'good' : 'bad'); };
  $$('.speed-button').forEach(button => button.onclick = () => setSpeedUI(Number(button.dataset.speed)));
  $$('.nav-button').forEach(button => button.onclick = () => openPanel(button.dataset.panel));
  $('#closePanel').onclick = closePanel;
  $('#closeInspector').onclick = () => $('#inspector').classList.remove('open');
  $('#resetViewBtn').onclick = MapV4.resetView;
  $('#autoFocusToggle').onchange = event => MapV4.setAutoFocus(event.target.checked);
  $('#labelToggle').onchange = event => MapV4.setShowLabels(event.target.checked);
  $$('.map-mode').forEach(button => button.onclick = () => { MapV4.setMode(button.dataset.mapMode); setMapModeUI(button.dataset.mapMode); });
  $('#moveBtn').onclick = () => beginOrder('move');
  $('#frontBtn').onclick = () => beginOrder('front');
  $('#clearBtn').onclick = clearSelection;
  $('#modalBackdrop').onclick = event => { if (event.target.id === 'modalBackdrop') hideModal(); };
  window.addEventListener('resize', () => { if (innerWidth > 1250) $('#inspector').classList.remove('open'); });

  boot();
})();
