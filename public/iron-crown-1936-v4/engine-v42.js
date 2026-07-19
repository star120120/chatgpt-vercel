'use strict';

/** V4.2: continuous clock, dynamic historical crises, naval invasions and operational warning. */
(() => {
  const proto = IronCrownV4.prototype;
  const oldInitCountries = proto.initCountries;
  proto.initCountries = function initCountriesV42() {
    oldInitCountries.call(this);
    this.ruleVersion = '4.2.0-beta.1';
    this.clock = { desiredSpeed: 1, lastAdvanceAt: Date.now(), stalledTicks: 0 };
    this.dynamicEvents = {};
    this.expeditions = [];
    this.intelligenceAlerts = [];
    this.airOperations = [];
    this.navalOperations = [];
    this.civilWars = {};
    for (const country of Object.values(this.countries)) {
      country.transportCapacity = Math.max(2, Math.round(country.convoys / 12));
      country.navalInvasionCapacity = country.code === 'UK' ? 10 : country.code === 'JAP' ? 8 : Math.max(2, Math.round(country.dockyard / 3));
      country.recon = { naval: 0.25, air: 0.25, radar: 0 };
      country.volunteerLimit = 2;
    }
  };

  const oldSetSpeed = proto.setSpeed;
  proto.setSpeed = function setSpeedV42(speed) {
    oldSetSpeed.call(this, speed);
    this.clock ??= { desiredSpeed: 1, lastAdvanceAt: Date.now(), stalledTicks: 0 };
    this.clock.desiredSpeed = this.speed;
    return this.speed;
  };

  const oldAdvanceDay = proto.advanceDay;
  proto.advanceDay = function advanceDayV42() {
    oldAdvanceDay.call(this);
    this.clock ??= { desiredSpeed: this.speed || 1, lastAdvanceAt: Date.now(), stalledTicks: 0 };
    this.clock.lastAdvanceAt = Date.now();
    this.clock.stalledTicks = 0;
    this.processDynamicHistoricalEvents();
    this.processExpeditions();
    this.processOperationalDetection();
  };

  proto.pushAlert = function pushAlert(type, text, provinceId = null, severity = 'info') {
    this.intelligenceAlerts ??= [];
    this.intelligenceAlerts.unshift({ id: `alert-${this.day}-${Math.random()}`, date: this.date, type, text, provinceId, severity, read: false });
    this.intelligenceAlerts = this.intelligenceAlerts.slice(0, 80);
    this.logEvent(text, severity === 'danger' ? 'bad' : severity === 'success' ? 'good' : '');
  };

  proto.startSpanishCivilWar = function startSpanishCivilWar() {
    if (this.civilWars?.spain) return;
    const spanish = Object.values(this.provinces).filter(p => p.owner === 'ESP');
    if (spanish.length < 4) return;
    const sorted = [...spanish].sort((a, b) => (MapV4.getProvince(a.id)?.center[0] || 0) - (MapV4.getProvince(b.id)?.center[0] || 0));
    const nationalistIds = new Set(sorted.filter((_, i) => i % 3 === 0 || i > sorted.length * 0.7).map(p => p.id));
    this.civilWars.spain = {
      id: 'spanish-civil-war', name: '西班牙内战', start: this.date, phase: '战线形成',
      republican: { code: 'ESP', support: 50, foreignAid: {} },
      nationalist: { code: 'SPA_N', name: '西班牙国民军', support: 46, foreignAid: {} },
      frontline: [], resolved: false,
    };
    for (const province of spanish) {
      province.civilWarSide = nationalistIds.has(province.id) ? 'nationalist' : 'republican';
      province.controller = province.civilWarSide === 'nationalist' ? 'ESP_N' : 'ESP';
    }
    for (const province of spanish) {
      for (const n of province.neighbors) {
        const other = this.provinces[n];
        if (other?.owner === 'ESP' && other.civilWarSide !== province.civilWarSide) {
          this.civilWars.spain.frontline.push({ source: province.id, target: other.id, pressure: 0 });
        }
      }
    }
    this.worldTension = clamp(this.worldTension + 4, 0, 100);
    this.pushAlert('历史事件', '西班牙内战爆发：共和国与国民军形成动态战线，各国可提供志愿军、装备或空军支援。', null, 'danger');
  };

  proto.supportSpanishFaction = function supportSpanishFaction(countryId, side, packageType = 'equipment') {
    const war = this.civilWars?.spain;
    const country = this.countries[countryId];
    if (!war || war.resolved || !country) return { ok: false, reason: '西班牙内战尚未开始或已经结束' };
    const faction = side === 'nationalist' ? war.nationalist : war.republican;
    faction.foreignAid[countryId] ??= { equipment: 0, air: 0, volunteers: 0 };
    if (packageType === 'equipment') {
      if ((country.stockpile.infantry_equipment || 0) < 5000) return { ok: false, reason: '步兵装备库存不足5000' };
      country.stockpile.infantry_equipment -= 5000;
      faction.foreignAid[countryId].equipment += 5000;
      faction.support += 3;
    } else if (packageType === 'air') {
      if ((country.stockpile.fighter || 0) < 50) return { ok: false, reason: '战斗机库存不足50架' };
      country.stockpile.fighter -= 50;
      faction.foreignAid[countryId].air += 50;
      faction.support += 4;
    } else if (packageType === 'volunteers') {
      if (faction.foreignAid[countryId].volunteers >= country.volunteerLimit) return { ok: false, reason: '志愿军上限已满' };
      faction.foreignAid[countryId].volunteers += 1;
      faction.support += 5;
    }
    this.worldTension = clamp(this.worldTension + 0.5, 0, 100);
    this.pushAlert('外交介入', `${country.short}向西班牙${side === 'nationalist' ? '国民军' : '共和国'}提供${packageType === 'equipment' ? '装备援助' : packageType === 'air' ? '航空支援' : '志愿军'}。`, null, 'info');
    return { ok: true };
  };

  proto.processSpanishCivilWar = function processSpanishCivilWar() {
    const war = this.civilWars?.spain;
    if (!war || war.resolved || this.day % 3 !== 0) return;
    const fronts = war.frontline.filter(f => this.provinces[f.source] && this.provinces[f.target]);
    if (!fronts.length) return;
    for (const front of fronts.slice(0, 8)) {
      const a = this.provinces[front.source];
      const b = this.provinces[front.target];
      if (!a || !b || a.civilWarSide === b.civilWarSide) continue;
      const factionA = a.civilWarSide === 'nationalist' ? war.nationalist : war.republican;
      const factionB = b.civilWarSide === 'nationalist' ? war.nationalist : war.republican;
      const terrainA = TERRAIN[a.terrain]?.defense || 0;
      const terrainB = TERRAIN[b.terrain]?.defense || 0;
      const powerA = factionA.support * (1 + terrainA) * seeded(`${this.date}:${a.id}:scw`, 0.82, 1.18);
      const powerB = factionB.support * (1 + terrainB) * seeded(`${this.date}:${b.id}:scw`, 0.82, 1.18);
      front.pressure = clamp(front.pressure + (powerA - powerB) / 24, -100, 100);
      if (front.pressure >= 100) {
        b.civilWarSide = a.civilWarSide;
        b.controller = a.civilWarSide === 'nationalist' ? 'ESP_N' : 'ESP';
        front.pressure = 0;
        this.pushAlert('西班牙战报', `${a.name}方向部队攻占${b.name}。`, b.id, 'danger');
      } else if (front.pressure <= -100) {
        a.civilWarSide = b.civilWarSide;
        a.controller = b.civilWarSide === 'nationalist' ? 'ESP_N' : 'ESP';
        front.pressure = 0;
        this.pushAlert('西班牙战报', `${b.name}方向部队攻占${a.name}。`, a.id, 'danger');
      }
    }
    const spanish = Object.values(this.provinces).filter(p => p.owner === 'ESP');
    const nationalist = spanish.filter(p => p.civilWarSide === 'nationalist').length;
    const republican = spanish.length - nationalist;
    if (!nationalist || !republican) {
      war.resolved = true;
      war.winner = nationalist ? 'nationalist' : 'republican';
      this.pushAlert('历史事件', `西班牙内战结束：${nationalist ? '国民军' : '共和国'}取得胜利。`, null, 'success');
    }
  };

  proto.processDynamicHistoricalEvents = function processDynamicHistoricalEvents() {
    this.dynamicEvents ??= {};
    if (this.date >= '1936-07-18' && !this.dynamicEvents.spanishCivilWar) {
      this.dynamicEvents.spanishCivilWar = true;
      this.startSpanishCivilWar();
    }
    this.processSpanishCivilWar();
    const events = [
      ['1936-03-07', 'rhineland-crisis', '莱茵兰再军事化危机', '德国在莱茵兰采取行动，法国与英国可以选择施压、制裁或克制。'],
      ['1937-07-07', 'sino-japanese-war', '卢沟桥事变', '东亚战争升级，列强可以提供贷款、装备与志愿航空队。'],
      ['1938-03-12', 'anschluss-crisis', '德奥合并危机', '奥地利主权危机开始，外交施压、政变与军事威慑共同影响结果。'],
      ['1938-09-01', 'sudeten-crisis', '苏台德危机', '德国、捷克斯洛伐克、法国与英国进入持续外交博弈。'],
      ['1939-03-15', 'czech-collapse', '捷克斯洛伐克危机', '中欧秩序面临瓦解，周边国家可能提出领土与安全要求。'],
      ['1939-08-23', 'molotov-ribbentrop', '德苏互不侵犯谈判', '德国与苏联可能达成互不侵犯及秘密势力范围安排。'],
    ];
    for (const [date, id, title, text] of events) {
      if (this.date >= date && !this.dynamicEvents[id]) {
        this.dynamicEvents[id] = { id, title, text, start: this.date, stage: 1, pressure: 0, participants: [], resolved: false };
        this.pushAlert('历史事件', `${title}：${text}`, null, 'info');
      }
    }
  };

  proto.createNavalOperation = function createNavalOperation(countryId, config) {
    const country = this.countries[countryId];
    if (!country) return { ok: false, reason: '国家不存在' };
    const source = this.provinces[config.sourceProvinceId];
    const target = this.provinces[config.targetProvinceId];
    const divisionIds = config.divisionIds || [];
    if (!source || !target || source.controller !== countryId) return { ok: false, reason: '出发港口无效' };
    if (!source.isCoastal || !target.isCoastal) return { ok: false, reason: '跨海登陆要求出发地与目标均为沿海省份' };
    if (source.navalBase < 1) return { ok: false, reason: '出发省份没有海军基地' };
    if (divisionIds.length > country.navalInvasionCapacity) return { ok: false, reason: `登陆能力不足，当前上限${country.navalInvasionCapacity}个师` };
    if (country.convoys < divisionIds.length * 8) return { ok: false, reason: '运输船队不足' };
    const fleets = (config.fleetIds || []).map(id => country.fleets.find(f => f.id === id)).filter(Boolean);
    const wings = (config.airWingIds || []).map(id => country.airWings.find(w => w.id === id)).filter(Boolean);
    const op = {
      id: `naval-op-${Date.now()}-${Math.random()}`, type: 'naval-invasion', countryId,
      sourceProvinceId: source.id, targetProvinceId: target.id, divisionIds,
      fleetIds: fleets.map(f => f.id), airWingIds: wings.map(w => w.id),
      seaZone: config.seaZone || '英吉利海峡', planning: 0, progress: 0, detected: false,
      active: false, status: '计划中', created: this.date,
    };
    this.expeditions.push(op);
    return { ok: true, operation: op };
  };

  proto.operationSeaControl = function operationSeaControl(op) {
    const country = this.countries[op.countryId];
    const fleets = op.fleetIds.map(id => country.fleets.find(f => f.id === id)).filter(Boolean);
    const wings = op.airWingIds.map(id => country.airWings.find(w => w.id === id)).filter(Boolean);
    const naval = fleets.reduce((sum, f) => sum + Object.values(f.ships).reduce((a, b) => a + b, 0) * f.readiness / 100, 0);
    const air = wings.reduce((sum, w) => sum + w.aircraft * w.efficiency / 40, 0);
    const enemy = Object.entries(this.countries).filter(([code]) => this.isAtWar(op.countryId, code)).reduce((sum, [, c]) => sum + c.fleets.filter(f => f.zone === op.seaZone && f.mission !== '港内待命').reduce((s, f) => s + Object.values(f.ships).reduce((a, b) => a + b, 0) * f.readiness / 100, 0), 0);
    return clamp((naval + air * 0.45) / Math.max(1, naval + air * 0.45 + enemy), 0, 1);
  };

  proto.processExpeditions = function processExpeditions() {
    for (const op of this.expeditions || []) {
      if (op.status === '完成' || op.status === '失败') continue;
      const control = this.operationSeaControl(op);
      if (!op.active) {
        op.planning = clamp(op.planning + 0.8 + control * 0.7, 0, 100);
        if (op.planning >= 70 && control >= 0.5) { op.active = true; op.status = '航渡中'; this.pushAlert('登陆作战', `${this.countries[op.countryId].short}的登陆编队驶向${this.provinces[op.targetProvinceId]?.name}。`, op.targetProvinceId, 'danger'); }
        continue;
      }
      if (control < 0.35) { op.progress -= 3; op.detected = true; }
      else op.progress += 2 + control * 4;
      if (op.progress <= -30) { op.status = '失败'; this.pushAlert('登陆作战', `${this.provinces[op.targetProvinceId]?.name}登陆行动因制海权不足而失败。`, op.targetProvinceId, 'danger'); }
      if (op.progress >= 100) {
        const source = this.provinces[op.sourceProvinceId];
        const target = this.provinces[op.targetProvinceId];
        const moving = source.divisions.filter(d => op.divisionIds.includes(d.id));
        const defense = target.divisions.length + target.fort * 0.6;
        const attack = moving.length * (0.7 + control) + op.airWingIds.length * 0.6;
        if (attack > Math.max(1, defense * 1.15)) {
          source.divisions = source.divisions.filter(d => !op.divisionIds.includes(d.id));
          target.divisions.push(...moving);
          target.controller = op.countryId;
          op.status = '完成';
          this.pushAlert('登陆作战', `${this.countries[op.countryId].short}在${target.name}建立滩头阵地。`, target.id, 'success');
        } else {
          moving.forEach(d => { d.organization = Math.max(5, d.organization - 35); d.strength = Math.max(10, d.strength - 12); });
          op.status = '失败';
          this.pushAlert('登陆作战', `${target.name}守军击退登陆，进攻部队遭受严重损失。`, target.id, 'danger');
        }
      }
    }
  };

  proto.splitFleet = function splitFleet(countryId, fleetId, shipSelection, newName = '分遣舰队') {
    const country = this.countries[countryId];
    const fleet = country?.fleets.find(f => f.id === fleetId);
    if (!fleet) return { ok: false, reason: '舰队不存在' };
    const ships = {};
    for (const [type, requested] of Object.entries(shipSelection || {})) {
      const amount = clamp(Math.floor(requested), 0, fleet.ships[type] || 0);
      ships[type] = amount;
      fleet.ships[type] -= amount;
    }
    if (!Object.values(ships).some(v => v > 0)) return { ok: false, reason: '没有选择舰船' };
    const created = { id: `${countryId}-fleet-${Date.now()}`, name: newName, mission: '港内待命', zone: null, readiness: fleet.readiness, ships };
    country.fleets.push(created);
    return { ok: true, fleet: created };
  };

  proto.splitAirWing = function splitAirWing(countryId, wingId, aircraft, newName = '分遣航空联队') {
    const country = this.countries[countryId];
    const wing = country?.airWings.find(w => w.id === wingId);
    const amount = Math.floor(aircraft);
    if (!wing || amount < 10 || amount >= wing.aircraft) return { ok: false, reason: '拆分数量无效' };
    wing.aircraft -= amount;
    const created = { ...wing, id: `${countryId}-air-${Date.now()}`, name: newName, aircraft: amount, mission: '待命', region: null };
    country.airWings.push(created);
    return { ok: true, wing: created };
  };

  proto.processOperationalDetection = function processOperationalDetection() {
    if (this.day % 2 !== 0) return;
    for (const op of this.expeditions || []) {
      if (!op.active || op.detected) continue;
      for (const [enemyCode, enemy] of Object.entries(this.countries)) {
        if (!this.isAtWar(op.countryId, enemyCode)) continue;
        const patrol = enemy.fleets.filter(f => f.zone === op.seaZone && f.mission === '巡逻').length;
        const airRecon = enemy.airWings.filter(w => w.region === op.seaZone && w.mission === '制空权').reduce((s, w) => s + w.aircraft, 0);
        const radar = enemy.recon?.radar || 0;
        const chance = clamp(0.08 + patrol * 0.18 + airRecon / 2500 + radar * 0.08, 0.05, 0.9);
        if (seeded(`${this.date}:${op.id}:${enemyCode}:detect`) < chance) {
          op.detected = true;
          this.pushAlert('作战预警', `侦察部门发现${this.countries[op.countryId].short}可能正在${op.seaZone}组织登陆行动。`, op.targetProvinceId, 'danger');
        }
      }
    }
  };
})();
