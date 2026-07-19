'use strict';

/**
 * Iron Crown V4.1 mechanics extension.
 * The extension deliberately patches the V4 prototype instead of duplicating the whole engine.
 */
(() => {
  const proto = IronCrownV4.prototype;

  const originalInitCountries = proto.initCountries;
  proto.initCountries = function initCountriesV41() {
    originalInitCountries.call(this);
    this.battleEvents = [];
    this.actionEvents = [];
    this.ruleVersion = V41_VERSION;
    for (const [code, country] of Object.entries(this.countries)) {
      country.ai = { state: '和平建设', target: null, lastRedeployDay: 0, lastAttackDay: 0 };
      country.shortages = {};
      country.shortageSignature = '';
      country.stockpile.fuel = {
        GER: 180000, ITA: 115000, UK: 520000, FRA: 360000, USSR: 720000, POL: 115000,
      }[code] ?? country.stockpile.fuel;
    }
  };

  const originalInitProvinces = proto.initProvinces;
  proto.initProvinces = function initProvincesV41() {
    originalInitProvinces.call(this);
    for (const [id, province] of Object.entries(this.provinces)) {
      const mapProvince = MapV4.getProvince(id);
      province.isCoastal = detectCoastalProvince(mapProvince);
      province.specialRole = null;
      province.specialBonuses = {};
      province.attritionReport = null;
      province.supplyReport = null;
      if (mapProvince) {
        mapProvince.coastal = province.isCoastal;
        mapProvince.isCoastal = province.isCoastal;
      }
    }
  };

  const originalDistributeNationalAssets = proto.distributeNationalAssets;
  proto.distributeNationalAssets = function distributeNationalAssetsV41() {
    originalDistributeNationalAssets.call(this);
    for (const [code, country] of Object.entries(this.countries)) {
      country.construction = (country.construction || []).filter(project => {
        const province = this.provinces[project.provinceId];
        const rule = BUILDING_RULES[project.type];
        return province && rule && (!rule.requiresCoast || province.isCoastal) && Number(province[project.type] || 0) < rule.maxLevel;
      });
    }
    this.enforceCoastalIndustry();
    this.applyHistoricalGermanSetup();
  };

  proto.enforceCoastalIndustry = function enforceCoastalIndustry() {
    for (const [code, country] of Object.entries(this.countries)) {
      const owned = Object.values(this.provinces).filter(province => province.owner === code);
      const coastal = owned.filter(province => province.isCoastal);
      const dockyards = COUNTRY_DEFS[code]?.dockyard || 0;
      for (const province of owned) {
        province.dockyard = 0;
        if (!province.isCoastal) province.navalBase = 0;
      }
      if (!coastal.length) {
        country.dockyard = 0;
        continue;
      }
      for (let index = 0; index < dockyards; index += 1) {
        const province = coastal[index % coastal.length];
        province.dockyard += 1;
        province.navalBase = Math.max(province.navalBase, 1);
      }
      country.dockyard = dockyards;
    }
  };

  proto.applyHistoricalGermanSetup = function applyHistoricalGermanSetup() {
    const german = Object.values(this.provinces).filter(province => province.owner === 'GER');
    if (!german.length) return;
    for (const province of german) {
      province.resources = Object.fromEntries(Object.keys(RESOURCE_NAMES).map(resource => [resource, 0]));
      province.specialRole = null;
      province.specialBonuses = {};
      const mapProvince = MapV4.getProvince(province.id);
      const label = `${province.name} ${mapProvince?.sourceName || ''}`;
      const profile = Object.values(GERMAN_REGION_PROFILE).find(item => item.match.test(label));
      if (profile) {
        Object.assign(province.resources, profile.resources);
        province.specialRole = profile.role;
        province.specialBonuses = { ...profile.bonuses };
      }
    }

    const ensureProfile = (key, coordinate) => {
      const profile = GERMAN_REGION_PROFILE[key];
      if (german.some(province => province.specialRole === profile.role)) return;
      const fallback = this.nearestProvince('GER', coordinate);
      if (!fallback) return;
      Object.assign(fallback.resources, profile.resources);
      fallback.specialRole = profile.role;
      fallback.specialBonuses = { ...profile.bonuses };
    };
    ensureProfile('berlin', [13.405, 52.52]);
    ensureProfile('ruhr', [7.15, 51.48]);
    ensureProfile('silesia', [17.0, 51.1]);

    // Berlin is a political/research center, never a raw-material province.
    const berlin = german.find(province => /柏林|berlin/i.test(`${province.name} ${MapV4.getProvince(province.id)?.sourceName || ''}`));
    if (berlin) {
      berlin.resources = Object.fromEntries(Object.keys(RESOURCE_NAMES).map(resource => [resource, 0]));
      berlin.specialRole = GERMAN_REGION_PROFILE.berlin.role;
      berlin.specialBonuses = { ...GERMAN_REGION_PROFILE.berlin.bonuses };
    }
  };

  proto.controlledProvinceBonuses = function controlledProvinceBonuses(code) {
    const result = { ppDaily: 0, researchSpeed: 0, militaryOutput: 0, construction: 0 };
    for (const province of Object.values(this.provinces)) {
      if (province.controller !== code) continue;
      for (const [key, value] of Object.entries(province.specialBonuses || {})) result[key] = (result[key] || 0) + value;
    }
    return result;
  };

  proto.queuedBuildingCount = function queuedBuildingCount(country, provinceId, type) {
    return country.construction.filter(project => project.provinceId === provinceId && project.type === type).length;
  };

  proto.getConstructionEligibility = function getConstructionEligibility(provinceId, type, actor = this.player) {
    const province = this.provinces[provinceId];
    const country = this.countries[actor];
    const rule = BUILDING_RULES[type];
    if (!province || !country || !rule) return { ok: false, code: 'INVALID', reason: '❌ 无效的省份或建筑类型' };
    if (province.controller !== actor) return { ok: false, code: 'NOT_CONTROLLED', reason: '❌ 只能在本国控制的省份建设' };
    if (rule.requiresCoast && !province.isCoastal) return { ok: false, code: 'INLAND', reason: `❌ 内陆省份无法建造${rule.name}` };
    const current = Number(province[type] || 0);
    const queued = this.queuedBuildingCount(country, provinceId, type);
    if (current + queued >= rule.maxLevel) return { ok: false, code: 'MAX_LEVEL', reason: `❌ ${rule.name}已达到等级上限 ${rule.maxLevel}` };
    if (rule.usesSlots) {
      const queuedFactories = country.construction.filter(project => project.provinceId === provinceId && ['civ', 'mil', 'dockyard'].includes(project.type)).length;
      const used = province.civ + province.mil + province.dockyard + queuedFactories;
      const maxSlots = province.constructionSlots + province.development;
      if (used >= maxSlots) return { ok: false, code: 'NO_SLOT', reason: `❌ 建设槽已满（${used}/${maxSlots}）` };
    }
    return { ok: true, code: 'OK', reason: `✅ 可以建造${rule.name}`, maxLevel: rule.maxLevel };
  };

  const originalQueueConstruction = proto.queueConstruction;
  proto.queueConstruction = function queueConstructionV41(provinceId, type) {
    const eligibility = this.getConstructionEligibility(provinceId, type, this.player);
    this.lastActionResult = eligibility;
    if (!eligibility.ok) return false;
    return originalQueueConstruction.call(this, provinceId, type);
  };


  proto.getDecisionEligibility = function getDecisionEligibility(decisionId, provinceId = null) {
    const country = this.currentCountry();
    const decision = DECISIONS.find(item => item.id === decisionId);
    const province = provinceId ? this.provinces[provinceId] : null;
    if (!decision) return { ok: false, code: 'INVALID', reason: '❌ 无效的国家决议' };
    if (country.pp < decision.pp) return { ok: false, code: 'NO_PP', reason: `❌ 政治点数不足：需要 ${decision.pp}，当前 ${Math.floor(country.pp)}` };
    if (country.adminPoints < decision.admin) return { ok: false, code: 'NO_ADMIN', reason: `❌ 行政点数不足：需要 ${decision.admin}，当前 ${Math.floor(country.adminPoints)}` };
    if (['develop_core', 'make_core', 'rail_emergency'].includes(decisionId) && (!province || province.controller !== this.player)) {
      return { ok: false, code: 'NO_PROVINCE', reason: '❌ 请先选择一个本国控制的省份' };
    }
    if (decisionId === 'make_core' && province?.core) return { ok: false, code: 'ALREADY_CORE', reason: '❌ 该省份已经是核心省份' };
    if (decisionId === 'make_core' && country.coreProjects.some(item => item.provinceId === provinceId)) return { ok: false, code: 'CORE_RUNNING', reason: '❌ 该省份正在推进核心化' };
    if (decisionId === 'rail_emergency') return this.getConstructionEligibility(provinceId, 'rail', this.player);
    return { ok: true, code: 'OK', reason: '✅ 可以执行该决议' };
  };

  proto.getPolicyEligibility = function getPolicyEligibility(policyId) {
    const country = this.currentCountry();
    const policy = POLICIES.find(item => item.id === policyId);
    if (!policy) return { ok: false, code: 'INVALID', reason: '❌ 无效的政策方针' };
    if (country.activePolicy) return { ok: false, code: 'POLICY_RUNNING', reason: '❌ 已有政策正在推进' };
    if (country.completedPolicies.includes(policyId)) return { ok: false, code: 'COMPLETED', reason: '✅ 该政策已经完成' };
    if (country.pp < policy.cost) return { ok: false, code: 'NO_PP', reason: `❌ 政治点数不足：需要 ${policy.cost}，当前 ${Math.floor(country.pp)}` };
    return { ok: true, code: 'OK', reason: '✅ 可以推进该政策' };
  };

  const originalExecuteDecision = proto.executeDecision;
  proto.executeDecision = function executeDecisionV41(decisionId, provinceId = null) {
    const eligibility = this.getDecisionEligibility(decisionId, provinceId);
    this.lastActionResult = eligibility;
    if (!eligibility.ok) return false;
    return originalExecuteDecision.call(this, decisionId, provinceId);
  };

  proto.railNodeCapacity = function railNodeCapacity(province) {
    return Math.max(1, province.rail * 8 + province.infrastructure * 1.5 + province.supplyHub * 14 + (province.capital ? 12 : 0) - province.damage * 0.08);
  };

  /** Maximin path: chooses the route whose weakest railway node has the highest throughput. */

  const originalStartPolicy = proto.startPolicy;
  proto.startPolicy = function startPolicyV41(policyId) {
    const eligibility = this.getPolicyEligibility(policyId);
    this.lastActionResult = eligibility;
    if (!eligibility.ok) return false;
    return originalStartPolicy.call(this, policyId);
  };

  const originalProcessConstruction = proto.processConstruction;
  proto.processConstruction = function processConstructionV41(code) {
    const country = this.countries[code];
    country.construction = country.construction.filter(project => {
      const province = this.provinces[project.provinceId];
      const rule = BUILDING_RULES[project.type];
      if (!province || !rule) return false;
      if (rule.requiresCoast && !province.isCoastal) return false;
      if (Number(province[project.type] || 0) >= rule.maxLevel) return false;
      return true;
    });
    return originalProcessConstruction.call(this, code);
  };

  proto.calculateSupplyFlow = function calculateSupplyFlow(countryId, targetProvinceId) {
    const target = this.provinces[targetProvinceId];
    const capital = Object.values(this.provinces).find(province => province.controller === countryId && province.capital);
    if (!target || !capital || target.controller !== countryId) {
      return { connected: false, path: [], bottleneckRail: 0, flow: 0, reason: '首都或目标省份不可用' };
    }
    if (capital.id === target.id) {
      return { connected: true, path: [capital.id], bottleneckRail: capital.rail, flow: this.railNodeCapacity(capital), reason: '首都直供' };
    }

    const capacity = new Map([[capital.id, Infinity]]);
    const previous = new Map();
    const unvisited = new Set(Object.values(this.provinces).filter(province => province.controller === countryId).map(province => province.id));
    while (unvisited.size) {
      let currentId = null;
      let best = -1;
      for (const id of unvisited) {
        const value = capacity.get(id) ?? -1;
        if (value > best) { best = value; currentId = id; }
      }
      if (!currentId || best < 0) break;
      unvisited.delete(currentId);
      if (currentId === target.id) break;
      const current = this.provinces[currentId];
      for (const neighborId of current.neighbors) {
        const neighbor = this.provinces[neighborId];
        if (!neighbor || neighbor.controller !== countryId || !unvisited.has(neighborId)) continue;
        const candidate = Math.min(best, this.railNodeCapacity(neighbor));
        if (candidate > (capacity.get(neighborId) ?? -1)) {
          capacity.set(neighborId, candidate);
          previous.set(neighborId, currentId);
        }
      }
    }

    if (!capacity.has(target.id)) {
      const navalFlow = target.isCoastal && target.navalBase > 0 ? target.navalBase * 5 + Math.min(10, this.countries[countryId].convoys / 20) : 0;
      return { connected: false, path: [], bottleneckRail: 0, flow: navalFlow, reason: navalFlow ? '依靠海运临时补给' : '补给线中断' };
    }
    const path = [];
    let cursor = target.id;
    while (cursor) {
      path.unshift(cursor);
      if (cursor === capital.id) break;
      cursor = previous.get(cursor);
    }
    const bottleneckRail = Math.min(...path.map(id => this.provinces[id].rail));
    return { connected: true, path, bottleneckRail, flow: capacity.get(target.id), reason: `铁路瓶颈等级 ${bottleneckRail}` };
  };

  const originalProvinceSupplyCapacity = proto.provinceSupplyCapacity;
  proto.provinceSupplyCapacity = function provinceSupplyCapacityV41(provinceId) {
    const province = this.provinces[provinceId];
    if (!province) return 0;
    const localCapacity = originalProvinceSupplyCapacity.call(this, provinceId);
    const flow = this.calculateSupplyFlow(province.controller, provinceId);
    province.supplyReport = flow;
    if (province.capital) return localCapacity;
    return Math.max(0.5, Math.min(localCapacity, flow.flow || 0.5));
  };

  proto.calculateResourcePenalties = function calculateResourcePenalties(code) {
    const available = this.availableResources(code);
    const penalties = {
      oil: available.oil > 0 ? 1 : 0.58,
      aluminium: available.aluminium > 0 ? 1 : 0.48,
      rubber: available.rubber > 0 ? 1 : 0.62,
      steel: available.steel > 0 ? 1 : 0.5,
      movement: available.oil > 0 ? 1 : 0.62,
      airEfficiency: available.aluminium > 0 ? 1 : 0.68,
    };
    return penalties;
  };

  proto.productionShortageFactor = function productionShortageFactor(code, item) {
    const penalties = this.calculateResourcePenalties(code);
    let factor = penalties.steel;
    if (/tank|truck|fighter|cas|bomber/.test(item)) factor = Math.min(factor, penalties.oil);
    if (/fighter|cas|bomber/.test(item)) factor = Math.min(factor, penalties.aluminium, penalties.rubber);
    if (/truck/.test(item)) factor = Math.min(factor, penalties.rubber);
    return factor;
  };

  const originalProductionOutput = proto.productionOutput;
  proto.productionOutput = function productionOutputV41(code, line, days = 1) {
    const regional = this.controlledProvinceBonuses(code).militaryOutput || 0;
    return originalProductionOutput.call(this, code, line, days) * this.productionShortageFactor(code, line.item) * (1 + regional);
  };

  const originalNavalOutput = proto.navalOutput;
  proto.navalOutput = function navalOutputV41(code, line, days = 1) {
    const penalties = this.calculateResourcePenalties(code);
    return originalNavalOutput.call(this, code, line, days) * Math.min(penalties.steel, penalties.oil);
  };

  const originalDivisionPower = proto.divisionPower;
  proto.divisionPower = function divisionPowerV41(division, provinceId, attack, generalId) {
    let power = originalDivisionPower.call(this, division, provinceId, attack, generalId);
    const penalties = this.calculateResourcePenalties(division.owner);
    const template = this.countries[division.owner].divisionTemplates[division.templateKey];
    if (template.fuel > 0) power *= penalties.movement;
    return power;
  };

  const originalMoveDivisions = proto.moveDivisions;
  proto.moveDivisions = function moveDivisionsV41(sourceId, targetId, divisionIds) {
    const success = originalMoveDivisions.call(this, sourceId, targetId, divisionIds);
    if (!success) return false;
    const mobility = this.calculateResourcePenalties(this.player).movement;
    if (mobility < 1) {
      for (const id of divisionIds) {
        const found = this.findDivision(id);
        if (found) found.division.organization = clamp(found.division.organization - (1 - mobility) * 18, 0, 100);
      }
    }
    return true;
  };

  proto.applyStrategicShortageEffects = function applyStrategicShortageEffects(code) {
    const country = this.countries[code];
    const available = this.availableResources(code);
    const shortages = {
      oil: available.oil <= 0,
      aluminium: available.aluminium <= 0,
      rubber: available.rubber <= 0,
      steel: available.steel <= 0,
    };
    country.shortages = shortages;
    const signature = Object.entries(shortages).filter(([, active]) => active).map(([key]) => key).sort().join('|');
    if (signature !== country.shortageSignature) {
      if (signature) {
        const names = signature.split('|').map(key => RESOURCE_NAMES[key]).join('、');
        this.logEvent(`${country.short}出现战略资源短缺：${names}。生产与机动作战效率下降。`, code === this.player ? 'bad' : '');
      } else if (country.shortageSignature) {
        this.logEvent(`${country.short}的核心战略资源供应恢复。`, code === this.player ? 'good' : '');
      }
      country.shortageSignature = signature;
    }
  };

  proto.applyProvinceAttrition = function applyProvinceAttrition(code) {
    for (const province of Object.values(this.provinces).filter(item => item.controller === code && item.divisions.length)) {
      const supply = this.provinceSupplyRatio(province.id);
      const terrainRisk = { plains: 0, urban: 0, hills: 0.008, forest: 0.015, mountain: 0.035, marsh: 0.045, jungle: 0.05, desert: 0.03 }[province.terrain] || 0;
      const weather = this.weatherForProvince(province.id);
      const weatherRisk = { clear: 0, rain: 0.006, mud: 0.025, snow: 0.015, blizzard: 0.045 }[weather] || 0;
      const comfort = Math.max(2, Math.floor(TERRAIN[province.terrain].width / 20));
      const stackRisk = Math.max(0, province.divisions.length - comfort) / comfort * 0.035;
      const supplyRisk = supply < 0.3 ? (0.3 - supply) * 0.45 + 0.035 : supply < 0.5 ? (0.5 - supply) * 0.08 : 0;
      const totalRisk = terrainRisk + weatherRisk + stackRisk + supplyRisk;
      province.attritionReport = { supply, terrainRisk, weatherRisk, stackRisk, totalRisk, weather };
      if (totalRisk <= 0.012) continue;
      for (const division of province.divisions) {
        const dailyStrengthLoss = clamp(totalRisk * seeded(`${division.id}:${this.date}:attrition`, 0.7, 1.25), 0, 0.22);
        const organizationLoss = clamp(totalRisk * 22, 0.15, 3.2);
        division.strength = clamp(division.strength - dailyStrengthLoss, 0, 100);
        division.equipment = clamp(division.equipment - dailyStrengthLoss * 1.25, 0, 100);
        division.organization = clamp(division.organization - organizationLoss, 0, 100);
      }
    }
  };

  const originalProcessResearch = proto.processResearch;
  proto.processResearch = function processResearchV41(code) {
    originalProcessResearch.call(this, code);
    const bonus = this.controlledProvinceBonuses(code).researchSpeed || 0;
    if (!bonus) return;
    for (const slot of this.countries[code].research) if (slot.tech) slot.progress += bonus;
  };

  const originalProcessCountryDay = proto.processCountryDay;
  proto.processCountryDay = function processCountryDayV41(code) {
    originalProcessCountryDay.call(this, code);
    const country = this.countries[code];
    const bonuses = this.controlledProvinceBonuses(code);
    country.pp += bonuses.ppDaily || 0;
    this.applyStrategicShortageEffects(code);
    this.applyProvinceAttrition(code);
  };


  const originalDeleteFront = proto.deleteFront;
  proto.deleteFront = function deleteFrontV41(frontId) {
    const front = this.fronts.find(item => item.id === frontId);
    const result = originalDeleteFront.call(this, frontId);
    if (result && front?.generalId) {
      const general = this.countries[front.attacker]?.generals.find(item => item.id === front.generalId);
      if (general) general.assignedFront = null;
    }
    return result;
  };

  proto.effectiveDivisionStrength = function effectiveDivisionStrength(province, onlyUnassigned = false) {
    return province.divisions
      .filter(division => !onlyUnassigned || !division.assignedFront)
      .reduce((sum, division) => sum + (division.strength / 100) * (division.organization / 100) * (division.equipment / 100), 0);
  };

  proto.findControlledPath = function findControlledPath(countryId, startId, targetId) {
    if (startId === targetId) return [startId];
    const queue = [startId];
    const previous = new Map();
    const seen = new Set([startId]);
    while (queue.length) {
      const current = queue.shift();
      for (const neighborId of this.provinces[current]?.neighbors || []) {
        const neighbor = this.provinces[neighborId];
        if (!neighbor || neighbor.controller !== countryId || seen.has(neighborId)) continue;
        seen.add(neighborId);
        previous.set(neighborId, current);
        if (neighborId === targetId) {
          const path = [targetId];
          let cursor = targetId;
          while (cursor !== startId) { cursor = previous.get(cursor); path.unshift(cursor); }
          return path;
        }
        queue.push(neighborId);
      }
    }
    return [];
  };

  proto.executeWarAI = function executeWarAI(countryId) {
    const country = this.countries[countryId];
    if (!country || countryId === this.player || !country.alive) return;
    const enemies = Object.values(this.wars)
      .map(war => war.attacker === countryId ? war.defender : war.defender === countryId ? war.attacker : null)
      .filter(Boolean);
    if (!enemies.length) { country.ai.state = '和平建设'; country.ai.target = null; return; }
    country.ai.state = '前线集结';
    country.ai.target = enemies[0];

    const frontline = Object.values(this.provinces).filter(province => province.controller === countryId && province.neighbors.some(id => enemies.includes(this.provinces[id]?.controller)));
    if (!frontline.length) { country.ai.state = '战略机动'; return; }

    // Pull one unassigned rear division one province closer to the nearest frontline each weekly AI tick.
    const rear = Object.values(this.provinces)
      .filter(province => province.controller === countryId && !frontline.includes(province) && province.divisions.some(division => !division.assignedFront))
      .sort((a, b) => b.divisions.length - a.divisions.length);
    let redeployed = 0;
    for (const source of rear) {
      if (redeployed >= 3) break;
      let bestPath = [];
      for (const destination of frontline) {
        const path = this.findControlledPath(countryId, source.id, destination.id);
        if (path.length && (!bestPath.length || path.length < bestPath.length)) bestPath = path;
      }
      if (bestPath.length < 2) continue;
      const division = source.divisions.find(item => !item.assignedFront);
      if (!division) continue;
      const next = this.provinces[bestPath[1]];
      source.divisions = source.divisions.filter(item => item.id !== division.id);
      next.divisions.push(division);
      division.organization = clamp(division.organization - 8 / this.calculateResourcePenalties(countryId).movement, 0, 100);
      division.entrenchment = 0;
      redeployed += 1;
    }
    if (redeployed) country.ai.lastRedeployDay = this.day;

    // Attack only with a clear local superiority, instead of creating suicidal fronts everywhere.
    country.ai.state = '战力评估';
    let attacks = 0;
    for (const source of frontline.sort((a, b) => this.effectiveDivisionStrength(b, true) - this.effectiveDivisionStrength(a, true))) {
      if (attacks >= 2) break;
      const targets = source.neighbors.map(id => this.provinces[id]).filter(target => target && enemies.includes(target.controller));
      for (const target of targets.sort((a, b) => a.victoryPoints - b.victoryPoints)) {
        const own = this.effectiveDivisionStrength(source, true);
        const enemy = Math.max(0.35, this.effectiveDivisionStrength(target));
        const ratio = own / enemy;
        if (ratio < 1.5) continue;
        if (this.fronts.some(front => front.attacker === countryId && (front.source === source.id || front.target === target.id))) continue;
        const divisions = source.divisions.filter(division => !division.assignedFront).slice(0, Math.max(1, Math.min(6, Math.ceil(enemy * 1.7))));
        const general = country.generals.find(item => !item.assignedFront);
        const front = this.createFrontFor(countryId, source.id, target.id, divisions.map(division => division.id), general?.id || null, true);
        if (front) {
          front.aiStrengthRatio = ratio;
          attacks += 1;
          country.ai.state = '组织进攻';
          country.ai.lastAttackDay = this.day;
        }
        break;
      }
    }
    if (!attacks && redeployed) country.ai.state = '前线增援';
    else if (!attacks) country.ai.state = '固守待机';
  };

  const originalCreateFrontFor = proto.createFrontFor;
  proto.createFrontFor = function createFrontForV41(attacker, sourceId, targetId, divisionIds, generalId, active = false) {
    if (attacker !== this.player && active) {
      const source = this.provinces[sourceId];
      const target = this.provinces[targetId];
      if (!source || !target) return false;
      const selected = source.divisions.filter(division => divisionIds.includes(division.id) && !division.assignedFront);
      const own = selected.reduce((sum, division) => sum + (division.strength / 100) * (division.organization / 100) * (division.equipment / 100), 0);
      const enemy = Math.max(0.35, this.effectiveDivisionStrength(target));
      if (own / enemy < 1.5) return false;
    }
    return originalCreateFrontFor.call(this, attacker, sourceId, targetId, divisionIds, generalId, active);
  };

  const originalProcessAI = proto.processAI;
  proto.processAI = function processAIV41() {
    originalProcessAI.call(this);
    for (const code of Object.keys(this.countries)) this.executeWarAI(code);
  };

  proto.projectBattleCoordinate = function projectBattleCoordinate(provinceId) {
    const mapProvince = MapV4.getProvince(provinceId);
    if (!mapProvince) return { x: 800, y: 500 };
    const [lon, lat] = mapProvince.center;
    const bounds = [-25, 33, 55, 72];
    const mercator = value => Math.log(Math.tan(Math.PI / 4 + clamp(value, bounds[1], bounds[3]) * Math.PI / 360));
    const minY = mercator(bounds[1]);
    const maxY = mercator(bounds[3]);
    return {
      x: ((lon - bounds[0]) / (bounds[2] - bounds[0])) * 1600,
      y: 1000 - ((mercator(lat) - minY) / (maxY - minY)) * 1000,
    };
  };

  proto.emitBattleEvent = function emitBattleEvent(provinceId, text, result = 'battle') {
    const point = this.projectBattleCoordinate(provinceId);
    const event = {
      id: `battle-event-${this.day}-${Math.random().toString(36).slice(2, 8)}`,
      provinceId,
      x: point.x,
      y: point.y,
      text,
      result,
      day: this.day,
      createdAt: Date.now(),
      ttl: 4200,
    };
    this.battleEvents ??= [];
    this.battleEvents.push(event);
    this.battleEvents = this.battleEvents.slice(-40);
    return event;
  };

  const originalResolveFrontDay = proto.resolveFrontDay;
  proto.resolveFrontDay = function resolveFrontDayV41(front) {
    const targetId = front.target;
    const previousController = this.provinces[targetId]?.controller;
    const previousProgress = front.progress;
    originalResolveFrontDay.call(this, front);
    const target = this.provinces[targetId];
    if (!target) return;
    if (target.controller !== previousController) {
      const attackerName = this.countries[front.attacker]?.short || front.attacker;
      this.emitBattleEvent(targetId, `💥 ${attackerName}攻占${target.name}`, 'victory');
    } else if (!front.active && front.progress <= -60 && previousProgress > -60) {
      this.emitBattleEvent(targetId, `🛡️ ${target.name}守军击退攻势`, 'defeat');
    } else if (front.lastReport && front.daysFought % 5 === 0) {
      const report = front.lastReport;
      this.emitBattleEvent(targetId, `⚔️ ${target.name}交战：${fmt(report.attackerCasualties)} / ${fmt(report.defenderCasualties)}伤亡`, 'battle');
    }
  };

  proto.migrateV41 = function migrateV41() {
    this.ruleVersion = V41_VERSION;
    this.battleEvents ??= [];
    this.actionEvents ??= [];
    for (const [code, country] of Object.entries(this.countries)) {
      country.ai ??= { state: '和平建设', target: null, lastRedeployDay: 0, lastAttackDay: 0 };
      country.shortages ??= {};
      country.shortageSignature ??= '';
      country.imports.coal ??= 0;
      country.imports.iron ??= 0;
    }
    for (const [id, province] of Object.entries(this.provinces)) {
      province.isCoastal = province.isCoastal ?? detectCoastalProvince(MapV4.getProvince(id));
      province.specialRole ??= null;
      province.specialBonuses ??= {};
      province.attritionReport ??= null;
      province.supplyReport ??= null;
    }
    for (const [code, country] of Object.entries(this.countries)) {
      country.construction = (country.construction || []).filter(project => {
        const province = this.provinces[project.provinceId];
        const rule = BUILDING_RULES[project.type];
        return province && rule && (!rule.requiresCoast || province.isCoastal) && Number(province[project.type] || 0) < rule.maxLevel;
      });
    }
    this.enforceCoastalIndustry();
    this.applyHistoricalGermanSetup();
    return this;
  };

  const originalLoad = IronCrownV4.load.bind(IronCrownV4);
  IronCrownV4.load = function loadV41() {
    const game = originalLoad();
    return game ? game.migrateV41() : null;
  };
})();
