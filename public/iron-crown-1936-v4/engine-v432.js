'use strict';

/**
 * V4.3.2 operational warfare.
 * Regions no longer change controller instantly. Combat moves through contact,
 * battle, breakthrough and occupation phases, with retreat and supply checks.
 */
(() => {
  const proto = IronCrownV4.prototype;

  const PHASE_LABELS = Object.freeze({
    planning: '战役准备',
    contact: '接敌展开',
    battle: '持续激战',
    breakthrough: '防线突破',
    occupation: '争夺控制权',
    repulsed: '攻势受挫',
    occupied: '完成占领',
  });

  const isCombatReady = division => division && division.strength >= 5 && division.organization >= 3 && division.equipment >= 3;
  const activeStrength = divisions => divisions.reduce((sum, division) => sum + Math.max(0, division.strength), 0);

  proto.ensureOperationalWarState = function ensureOperationalWarState() {
    this.operationalWar ??= {
      provinces: {},
      reports: [],
      retreats: [],
      migratedAt: this.date,
    };
    this.operationalWar.provinces ??= {};
    this.operationalWar.reports ??= [];
    this.operationalWar.retreats ??= [];

    for (const province of Object.values(this.provinces)) {
      if (province.owner === province.controller) continue;
      this.operationalWar.provinces[province.id] ??= {
        provinceId: province.id,
        owner: province.owner,
        controller: province.controller,
        previousController: province.owner,
        attacker: province.controller,
        defender: province.owner,
        phase: 'occupied',
        control: 100,
        started: null,
        completed: null,
        legacy: true,
        note: '旧存档中已处于外国占领状态，缺少此前逐日战斗记录。',
      };
    }
    return this.operationalWar;
  };

  proto.recordOperationalReport = function recordOperationalReport(report) {
    const state = this.ensureOperationalWarState();
    state.reports.unshift({ id: `war-report-${Date.now()}-${Math.random()}`, date: this.date, ...report });
    state.reports = state.reports.slice(0, 80);
  };

  proto.releaseFrontAssignments = function releaseFrontAssignments(front) {
    for (const id of front.divisions || []) {
      const found = this.findDivision(id);
      if (found && found.division.assignedFront === front.id) found.division.assignedFront = null;
    }
    const general = this.countries[front.attacker]?.generals?.find(item => item.id === front.generalId);
    if (general?.assignedFront === front.id) general.assignedFront = null;
  };

  proto.deleteFront = function deleteFrontV432(frontId) {
    const index = this.fronts.findIndex(item => item.id === frontId);
    if (index < 0) return false;
    const [front] = this.fronts.splice(index, 1);
    this.releaseFrontAssignments(front);
    return true;
  };

  const previousCreateFrontFor = proto.createFrontFor;
  proto.createFrontFor = function createFrontForV432(attacker, sourceId, targetId, divisionIds, generalId, active = false) {
    const front = previousCreateFrontFor.call(this, attacker, sourceId, targetId, divisionIds, generalId, active);
    if (!front) return front;
    front.phase = active ? 'contact' : 'planning';
    front.occupationProgress = 0;
    front.phaseDays = 0;
    front.initialDefender = front.defender;
    front.initialTarget = targetId;
    front.attackerCasualties = 0;
    front.defenderCasualties = 0;
    front.continueAdvance = false;
    return front;
  };

  proto.frontPhaseLabel = function frontPhaseLabel(front) {
    return PHASE_LABELS[front?.phase] || '战况不明';
  };

  proto.findCapitalProvince = function findCapitalProvince(code) {
    return Object.values(this.provinces).find(province => province.controller === code && province.capital)
      || Object.values(this.provinces).find(province => province.controller === code);
  };

  proto.hasControlledLandRoute = function hasControlledLandRoute(code, provinceId) {
    const capital = this.findCapitalProvince(code);
    const target = this.provinces[provinceId];
    if (!capital || !target || target.controller !== code) return false;
    if (capital.id === target.id) return true;
    const queue = [capital.id];
    const visited = new Set(queue);
    while (queue.length) {
      const current = this.provinces[queue.shift()];
      if (!current) continue;
      for (const neighborId of current.neighbors) {
        if (visited.has(neighborId)) continue;
        const neighbor = this.provinces[neighborId];
        if (!neighbor || neighbor.controller !== code) continue;
        if (neighborId === provinceId) return true;
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
    return false;
  };

  proto.strategicSeaZoneForProvince = function strategicSeaZoneForProvince(province) {
    const name = `${province?.name || ''} ${province?.sourceName || ''}`;
    if (/东普鲁士|波美拉|石勒苏益格|梅克伦堡|立陶宛|拉脱维亚|爱沙尼亚|芬兰南部|瑞典/.test(name)) return '波罗的海';
    if (/荷兰|佛兰德|诺曼底|英格兰东|英格兰北|丹麦|挪威/.test(name)) return '北海';
    if (/英格兰南|布列塔尼/.test(name)) return '英吉利海峡';
    if (/葡萄牙|爱尔兰|加利西亚|阿基坦/.test(name)) return '北大西洋';
    if (/黑海|多布罗加|敖德萨|东色雷斯/.test(name)) return '黑海';
    if (/意大利|希腊|阿尔巴尼亚|克罗地亚沿海|爱琴海|马尔马拉|西班牙|普罗旺斯/.test(name)) return '地中海';
    return null;
  };

  proto.enemyNavalPressure = function enemyNavalPressure(code, zone) {
    if (!zone) return 0;
    let pressure = 0;
    for (const [otherCode, country] of Object.entries(this.countries)) {
      if (!this.isAtWar(code, otherCode)) continue;
      for (const fleet of country.fleets || []) {
        if (fleet.zone !== zone || fleet.mission === '港内待命') continue;
        const ships = Object.values(fleet.ships || {}).reduce((sum, amount) => sum + amount, 0);
        pressure += ships * (fleet.readiness || 0) / 100;
      }
    }
    return pressure;
  };

  proto.operationalSupplyStatus = function operationalSupplyStatus(code, provinceId) {
    const province = this.provinces[provinceId];
    if (!province) return { route: 'none', ratio: 0.15, label: '无补给路线' };
    const localRatio = this.provinceSupplyRatio(provinceId);
    if (this.hasControlledLandRoute(code, provinceId)) {
      return { route: 'land', ratio: localRatio, label: '首都—铁路陆路补给' };
    }
    const coastal = Boolean(province.isCoastal || province.coastal || province.navalBase > 0);
    const zone = this.strategicSeaZoneForProvince(province);
    const country = this.countries[code];
    if (coastal && zone && (country?.convoys || 0) >= 8) {
      const pressure = this.enemyNavalPressure(code, zone);
      const escort = (country.fleets || []).filter(fleet => fleet.zone === zone && ['护航', '巡逻', '打击舰队'].includes(fleet.mission))
        .reduce((sum, fleet) => sum + Object.values(fleet.ships || {}).reduce((a, b) => a + b, 0) * (fleet.readiness || 0) / 100, 0);
      const navalFactor = clamp(0.72 + escort / 100 - pressure / 120, 0.3, 0.9);
      return { route: 'sea', ratio: Math.min(localRatio, navalFactor), label: `${zone}海运补给`, zone, pressure, escort };
    }
    return { route: 'isolated', ratio: Math.min(localRatio, 0.28), label: '孤立地区：补给线被切断' };
  };

  proto.combatPoolsForFront = function combatPoolsForFront(front) {
    const source = this.provinces[front.source];
    const target = this.provinces[front.target];
    if (!source || !target) return { attackers: [], defenders: [], width: 0 };
    const width = this.frontCombatWidth(front);
    const attackerPool = (front.divisions || []).map(id => this.findDivision(id)).filter(Boolean)
      .filter(found => found.province.id === source.id || found.province.id === target.id)
      .map(found => found.division).filter(isCombatReady).sort((a, b) => b.organization - a.organization);
    const defenderPool = target.divisions.filter(isCombatReady).sort((a, b) => b.organization - a.organization);
    let usedWidth = 0;
    const attackers = [];
    for (const division of attackerPool) {
      const template = this.countries[division.owner].divisionTemplates[division.templateKey];
      if (usedWidth + template.width <= width || !attackers.length) { attackers.push(division); usedWidth += template.width; }
    }
    usedWidth = 0;
    const defenders = [];
    for (const division of defenderPool) {
      const template = this.countries[division.owner].divisionTemplates[division.templateKey];
      if (usedWidth + template.width <= width || !defenders.length) { defenders.push(division); usedWidth += template.width; }
    }
    return { attackers, defenders, width };
  };

  proto.beginOccupationPhase = function beginOccupationPhase(front, attackPower, defensePower) {
    const target = this.provinces[front.target];
    const state = this.ensureOperationalWarState();
    front.phase = 'breakthrough';
    front.phaseDays = 0;
    front.occupationProgress = Math.max(8, front.occupationProgress || 0);
    state.provinces[target.id] = {
      provinceId: target.id,
      owner: target.owner,
      controller: target.controller,
      previousController: target.controller,
      attacker: front.attacker,
      defender: target.controller,
      phase: 'breakthrough',
      control: front.occupationProgress,
      started: this.date,
      completed: null,
      source: front.source,
      frontId: front.id,
      attackPower: Math.round(attackPower),
      defensePower: Math.round(defensePower),
    };
    this.recordOperationalReport({
      type: 'breakthrough',
      provinceId: target.id,
      frontId: front.id,
      title: `${this.countries[front.attacker].short}突破${target.name}外围防线`,
      text: '守军正在撤向纵深，区域尚未正式易手。',
    });
    this.pushAlert?.('战线突破', `${target.name}进入控制权争夺阶段，地区尚未被正式占领。`, target.id, 'danger');
  };

  proto.resolveOccupationDay = function resolveOccupationDay(front) {
    const source = this.provinces[front.source];
    const target = this.provinces[front.target];
    if (!source || !target || target.controller === front.attacker) { this.deleteFront(front.id); return; }
    const pools = this.combatPoolsForFront(front);
    if (!pools.attackers.length) {
      front.phase = 'repulsed';
      front.active = false;
      front.progress = -40;
      front.occupationProgress = Math.max(0, (front.occupationProgress || 0) - 15);
      return;
    }
    const attackerSupply = this.operationalSupplyStatus(front.attacker, source.id);
    const defenderSupply = this.operationalSupplyStatus(target.controller, target.id);
    const attackPower = pools.attackers.reduce((sum, division) => sum + this.divisionPower(division, source.id, true, front.generalId), 0) * attackerSupply.ratio;
    const defensePower = pools.defenders.reduce((sum, division) => sum + this.divisionPower(division, target.id, false, null), 0) * defenderSupply.ratio;
    const resistance = Math.max(6, defensePower + target.fort * 3);
    const ratio = attackPower / resistance;
    front.phaseDays += 1;
    front.phase = front.phaseDays <= 2 ? 'breakthrough' : 'occupation';
    const baseGain = 5.5 + Math.min(5, pools.attackers.length * 0.8);
    const ratioGain = clamp((ratio - 0.55) * 8, -6, 10);
    const supplyGain = (attackerSupply.ratio - 0.5) * 8 - (defenderSupply.ratio - 0.5) * 4;
    const defenderPresence = pools.defenders.length ? Math.min(6, pools.defenders.length * 1.2) : 0;
    const dailyGain = clamp(baseGain + ratioGain + supplyGain - defenderPresence, -8, 18);
    front.occupationProgress = clamp((front.occupationProgress || 0) + dailyGain, 0, 100);

    const attackerLossRate = clamp(0.045 / Math.max(0.6, ratio), 0.02, 0.11);
    const defenderLossRate = clamp(0.055 * Math.max(0.6, ratio), 0.025, 0.14);
    const attackerCasualties = this.applyCombatLosses(pools.attackers, attackerLossRate, front.attacker);
    const defenderCasualties = this.applyCombatLosses(pools.defenders, defenderLossRate, target.controller);
    front.attackerCasualties = (front.attackerCasualties || 0) + attackerCasualties;
    front.defenderCasualties = (front.defenderCasualties || 0) + defenderCasualties;
    pools.attackers.forEach(division => { division.organization = clamp(division.organization - clamp(2.4 / Math.max(0.65, ratio), 1.2, 5), 0, 100); });
    pools.defenders.forEach(division => { division.organization = clamp(division.organization - clamp(2.8 * Math.max(0.65, ratio), 1.4, 6), 0, 100); });

    const state = this.ensureOperationalWarState().provinces[target.id];
    if (state) {
      state.phase = front.phase;
      state.control = front.occupationProgress;
      state.attackPower = Math.round(attackPower);
      state.defensePower = Math.round(defensePower);
      state.attackerSupply = attackerSupply;
      state.defenderSupply = defenderSupply;
      state.days = front.phaseDays;
    }
    front.lastReport = {
      phase: front.phase,
      attackPower: Math.round(attackPower),
      defensePower: Math.round(defensePower),
      attackerCasualties,
      defenderCasualties,
      attackerSupply,
      defenderSupply,
      occupationProgress: front.occupationProgress,
      width: pools.width,
      weather: this.weatherForProvince(target.id),
    };

    if (front.occupationProgress >= 100 && front.phaseDays >= 4) this.completeOperationalOccupation(front);
    else if (front.occupationProgress <= 0 && front.phaseDays >= 3) {
      front.phase = 'repulsed';
      front.active = false;
      front.progress = -55;
      delete this.ensureOperationalWarState().provinces[target.id];
      this.recordOperationalReport({ type: 'repulsed', provinceId: target.id, frontId: front.id, title: `${target.name}突破口被封闭`, text: '进攻部队未能建立稳定控制区，攻势停止。' });
    }
  };

  proto.resolveFrontDay = function resolveFrontDayV432(front) {
    const source = this.provinces[front.source];
    const target = this.provinces[front.target];
    if (!source || !target || target.controller === front.attacker || !this.isAtWar(front.attacker, target.controller)) { this.deleteFront(front.id); return; }
    front.phase ??= 'contact';
    front.phaseDays ??= 0;
    front.occupationProgress ??= 0;
    if (front.phase === 'breakthrough' || front.phase === 'occupation') return this.resolveOccupationDay(front);

    const pools = this.combatPoolsForFront(front);
    if (!pools.attackers.length) { front.active = false; front.phase = 'repulsed'; return; }
    const attackerSupply = this.operationalSupplyStatus(front.attacker, source.id);
    const defenderSupply = this.operationalSupplyStatus(target.controller, target.id);
    const attackPower = pools.attackers.reduce((sum, division) => sum + this.divisionPower(division, source.id, true, front.generalId), 0) * attackerSupply.ratio;
    const defensePower = (pools.defenders.reduce((sum, division) => sum + this.divisionPower(division, target.id, false, null), 0) || 8 + target.fort * 4) * defenderSupply.ratio;
    const ratio = attackPower / Math.max(1, defensePower);
    front.daysFought += 1;
    front.phaseDays += 1;
    front.phase = front.daysFought <= 2 ? 'contact' : 'battle';
    front.progress = clamp(front.progress + (ratio - 1) * 3.2 + front.planning * 0.009, -100, 100);
    front.planning = Math.max(0, front.planning - 0.28);
    const attackerLossRate = clamp(0.065 / Math.max(0.5, ratio), 0.025, 0.18);
    const defenderLossRate = clamp(0.068 * ratio, 0.028, 0.2);
    const attackerCasualties = this.applyCombatLosses(pools.attackers, attackerLossRate, front.attacker);
    const defenderCasualties = this.applyCombatLosses(pools.defenders, defenderLossRate, target.controller);
    front.attackerCasualties = (front.attackerCasualties || 0) + attackerCasualties;
    front.defenderCasualties = (front.defenderCasualties || 0) + defenderCasualties;
    pools.attackers.forEach(division => { division.organization = clamp(division.organization - clamp(3.8 / Math.max(0.65, ratio), 1.8, 7), 0, 100); });
    pools.defenders.forEach(division => { division.organization = clamp(division.organization - clamp(3.6 * ratio, 1.8, 8), 0, 100); });
    front.lastReport = {
      phase: front.phase,
      attackPower: Math.round(attackPower),
      defensePower: Math.round(defensePower),
      attackerCasualties,
      defenderCasualties,
      attackerSupply,
      defenderSupply,
      width: pools.width,
      weather: this.weatherForProvince(target.id),
    };

    const defendersHolding = target.divisions.some(isCombatReady);
    if (front.progress >= 82 || !defendersHolding) this.beginOccupationPhase(front, attackPower, defensePower);
    else if (front.progress <= -90 || !pools.attackers.some(isCombatReady)) {
      front.active = false;
      front.phase = 'repulsed';
      front.progress = -55;
      this.recordOperationalReport({ type: 'repulsed', provinceId: target.id, frontId: front.id, title: `${source.name}方向攻势被击退`, text: `进攻持续${front.daysFought}天后停止。` });
      this.logEvent(`${source.name}方向的攻势被击退。`, 'bad');
    }
  };

  proto.findRetreatProvince = function findRetreatProvince(defender, target, source) {
    return target.neighbors.map(id => this.provinces[id])
      .filter(province => province && province.controller === defender && province.id !== source.id)
      .sort((a, b) => {
        const aSupply = this.operationalSupplyStatus(defender, a.id).ratio;
        const bSupply = this.operationalSupplyStatus(defender, b.id).ratio;
        return (bSupply - aSupply) || (b.infrastructure - a.infrastructure);
      })[0] || null;
  };

  proto.completeOperationalOccupation = function completeOperationalOccupation(front) {
    const source = this.provinces[front.source];
    const target = this.provinces[front.target];
    if (!source || !target) return;
    const previousController = target.controller;
    const retreat = this.findRetreatProvince(previousController, target, source);
    const survivingDefenders = target.divisions.filter(division => division.strength >= 5);
    const shatteredDefenders = target.divisions.filter(division => division.strength < 5);
    if (retreat) {
      for (const division of survivingDefenders) {
        division.organization = Math.min(division.organization, 18);
        division.entrenchment = 0;
        retreat.divisions.push(division);
      }
      this.ensureOperationalWarState().retreats.unshift({
        date: this.date,
        from: target.id,
        to: retreat.id,
        controller: previousController,
        divisions: survivingDefenders.length,
      });
    } else {
      const capturedManpower = survivingDefenders.reduce((sum, division) => {
        const template = this.countries[division.owner]?.divisionTemplates?.[division.templateKey];
        return sum + (template?.manpower || 0) * division.strength / 100;
      }, 0);
      this.countries[previousController].casualties += Math.round(capturedManpower * 0.35);
      this.recordOperationalReport({ type: 'encirclement', provinceId: target.id, frontId: front.id, title: `${target.name}守军失去撤退路线`, text: `${survivingDefenders.length}个师被迫投降或解散。` });
    }
    target.divisions = [];

    const moving = (front.divisions || []).map(id => this.findDivision(id)).filter(Boolean)
      .filter(found => found.division.strength >= 5);
    for (const found of moving) {
      found.province.divisions = found.province.divisions.filter(division => division.id !== found.division.id);
      found.division.organization = Math.min(found.division.organization, 35);
      found.division.entrenchment = 0;
      target.divisions.push(found.division);
    }

    target.controller = front.attacker;
    target.core = target.owner === front.attacker;
    target.localStability = Math.max(20, target.localStability - 12);
    target.damage = clamp(target.damage + 6 + front.daysFought * 0.25, 0, 100);
    const state = this.ensureOperationalWarState().provinces[target.id] || {};
    Object.assign(state, {
      provinceId: target.id,
      owner: target.owner,
      controller: front.attacker,
      previousController,
      attacker: front.attacker,
      defender: previousController,
      phase: 'occupied',
      control: 100,
      completed: this.date,
      days: front.daysFought + front.phaseDays,
      attackerCasualties: front.attackerCasualties || 0,
      defenderCasualties: front.defenderCasualties || 0,
      legacy: false,
      note: retreat ? `守军撤往${retreat.name}` : '守军无安全撤退路线',
    });
    this.ensureOperationalWarState().provinces[target.id] = state;

    this.recordOperationalReport({
      type: 'occupation',
      provinceId: target.id,
      frontId: front.id,
      title: `${this.countries[front.attacker].short}占领${target.name}`,
      text: `${this.frontPhaseLabel(front)}完成；${retreat ? `守军撤往${retreat.name}` : '守军被包围或解散'}。`,
      attacker: front.attacker,
      defender: previousController,
    });
    this.logEvent(`${this.countries[front.attacker].short}经过${front.daysFought + front.phaseDays}天作战后占领${target.name}。`, 'good');
    this.pushAlert?.('区域易手', `${target.name}已由${this.countries[front.attacker].short}控制。${retreat ? `守军撤往${retreat.name}。` : '守军没有安全撤退路线。'}`, target.id, 'danger');

    front.phase = 'occupied';
    front.active = false;
    front.progress = 100;
    front.occupationProgress = 100;
    this.releaseFrontAssignments(front);
    this.recalculateFactories(front.attacker);
    this.recalculateFactories(previousController);
  };

  proto.processShatteredDivisions = function processShatteredDivisions(code) {
    const country = this.countries[code];
    if (!country) return;
    country.reconstitutionPool ??= [];
    for (const province of Object.values(this.provinces)) {
      const shattered = province.divisions.filter(division => division.owner === code && division.strength < 3);
      if (!shattered.length) continue;
      for (const division of shattered) {
        if (division.assignedFront) {
          const front = this.fronts.find(item => item.id === division.assignedFront);
          if (front) front.divisions = front.divisions.filter(id => id !== division.id);
        }
        country.reconstitutionPool.push({
          id: division.id,
          name: division.name,
          templateKey: division.templateKey,
          date: this.date,
          provinceId: province.id,
          reason: '战斗损失过大，撤销番号并转入重建名册',
        });
      }
      province.divisions = province.divisions.filter(division => !shattered.includes(division));
      if (code === this.player) this.logEvent(`${province.name}的${shattered.length}个严重减员师撤销战斗序列，转入重建名册。`, 'bad');
    }
    country.reconstitutionPool = country.reconstitutionPool.slice(-40);
  };

  const previousProcessCountryDay = proto.processCountryDay;
  proto.processCountryDay = function processCountryDayV432(code) {
    previousProcessCountryDay.call(this, code);
    this.processShatteredDivisions(code);
  };

  proto.getProvinceBattleState = function getProvinceBattleState(provinceId) {
    const state = this.ensureOperationalWarState();
    const province = this.provinces[provinceId];
    if (!province) return null;
    const front = this.fronts.find(item => item.source === provinceId || item.target === provinceId);
    const occupation = state.provinces[provinceId] || null;
    if (!front && !occupation) return null;
    const targetFront = front?.target === provinceId ? front : null;
    return {
      province,
      front,
      occupation,
      phase: targetFront?.phase || occupation?.phase || front?.phase || 'planning',
      phaseLabel: this.frontPhaseLabel(targetFront || front || occupation),
      attacker: targetFront?.attacker || occupation?.attacker || front?.attacker,
      defender: targetFront?.defender || occupation?.defender || front?.defender,
      control: targetFront ? (targetFront.phase === 'occupation' || targetFront.phase === 'breakthrough' ? targetFront.occupationProgress : clamp((targetFront.progress + 100) / 2, 0, 100)) : occupation?.control,
      days: targetFront ? targetFront.daysFought + targetFront.phaseDays : occupation?.days,
      lastReport: targetFront?.lastReport || null,
    };
  };

  const previousInitCountries = proto.initCountries;
  proto.initCountries = function initCountriesV432() {
    previousInitCountries.call(this);
    this.ruleVersion = '4.3.2-operational-war.1';
    this.ensureOperationalWarState();
  };

  const previousLoad = IronCrownV4.load;
  IronCrownV4.load = function loadV432() {
    const loaded = previousLoad.call(this);
    if (!loaded) return null;
    loaded.ensureOperationalWarState();
    for (const front of loaded.fronts || []) {
      front.phase ??= front.active ? 'battle' : 'planning';
      front.phaseDays ??= 0;
      front.occupationProgress ??= 0;
      front.attackerCasualties ??= 0;
      front.defenderCasualties ??= 0;
      front.continueAdvance = false;
    }
    for (const code of Object.keys(loaded.countries)) loaded.processShatteredDivisions(code);
    return loaded;
  };
})();
