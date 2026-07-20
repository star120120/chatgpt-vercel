'use strict';

/** V4.2.2 military integration: unified training, operational snapshots and naval infrastructure roles. */
(() => {
  const proto = IronCrownV4.prototype;

  const SEA_ZONE_COORDINATES = Object.freeze({
    '北海': [3.2, 56.5],
    '波罗的海': [17.5, 57.4],
    '英吉利海峡': [-0.8, 50.3],
    '北大西洋': [-15.0, 52.5],
    '西地中海': [5.0, 38.5],
    '东地中海': [23.0, 35.8],
    '黑海': [32.0, 43.2],
  });
  window.IRON_SEA_ZONE_COORDINATES = SEA_ZONE_COORDINATES;

  const previousInitCountries = proto.initCountries;
  proto.initCountries = function initCountriesV422() {
    previousInitCountries.call(this);
    this.ruleVersion = '4.2.2-stable.1';
    this.militaryUI = {
      numericCounters: false,
      operationalBranch: 'army',
      showFriendly: true,
      showFrontlineEnemy: true,
    };
  };

  proto.ensureMilitaryUI = function ensureMilitaryUI() {
    this.militaryUI ??= {
      numericCounters: false,
      operationalBranch: 'army',
      showFriendly: true,
      showFrontlineEnemy: true,
    };
    return this.militaryUI;
  };

  proto.trainingEquipmentAvailability = function trainingEquipmentAvailability(code, templateKey) {
    const country = this.countries[code];
    const template = country?.divisionTemplates?.[templateKey];
    if (!country || !template) return { ratio: 0, missing: ['无效编制'], available: {} };
    const reserved = {};
    for (const queued of country.training || []) {
      const queuedTemplate = country.divisionTemplates[queued.templateKey];
      if (!queuedTemplate) continue;
      for (const [item, amount] of Object.entries(queuedTemplate.equipment)) {
        reserved[item] = (reserved[item] || 0) + amount;
      }
    }
    let ratio = 1;
    const missing = [];
    const available = {};
    for (const [item, required] of Object.entries(template.equipment)) {
      const free = Math.max(0, (country.stockpile[item] || 0) - (reserved[item] || 0));
      available[item] = free;
      const itemRatio = free / Math.max(1, required);
      ratio = Math.min(ratio, itemRatio);
      if (itemRatio < 1) missing.push(`${LAND_EQUIPMENT[item]?.name || item} ${Math.round(free)}/${required}`);
    }
    return { ratio, missing, available };
  };

  proto.templateUnlockStatus = function templateUnlockStatus(code, templateKey) {
    const country = this.countries[code];
    if (!country?.divisionTemplates?.[templateKey]) return { unlocked: false, reason: '编制不存在' };
    if (templateKey === 'medium_armor' && !country.technologies.includes('medium_tank_chassis')) {
      return { unlocked: false, reason: '需要完成“中型坦克底盘”科研' };
    }
    if (templateKey === 'light_armor' && (country.stockpile.light_tank || 0) < 80) {
      return { unlocked: false, reason: '轻型坦克储备不足80辆' };
    }
    if (templateKey === 'motorized' && (country.stockpile.truck || 0) < 500) {
      return { unlocked: false, reason: '军用卡车储备不足500辆' };
    }
    return { unlocked: true, reason: '编制可用' };
  };

  proto.getTrainingEligibility = function getTrainingEligibility(provinceId, templateKey, actor = this.player) {
    const province = this.provinces[provinceId];
    const country = this.countries[actor];
    const template = country?.divisionTemplates?.[templateKey];
    if (!province || !country || !template) return { ok: false, code: 'INVALID', reason: '❌ 省份或师编制无效' };
    if (province.controller !== actor) return { ok: false, code: 'NOT_CONTROLLED', reason: '❌ 只能在本国控制区训练部队' };
    const unlock = this.templateUnlockStatus(actor, templateKey);
    if (!unlock.unlocked) return { ok: false, code: 'LOCKED', reason: `❌ ${unlock.reason}` };
    if (country.availableManpower < template.manpower / 1000) {
      return { ok: false, code: 'NO_MANPOWER', reason: `❌ 可用人力不足：需要${(template.manpower / 1000).toFixed(1)}K` };
    }
    if ((country.training || []).length >= 12) return { ok: false, code: 'QUEUE_FULL', reason: '❌ 全国训练队列已达到12个师' };
    const equipment = this.trainingEquipmentAvailability(actor, templateKey);
    if (equipment.ratio < 0.45) {
      return { ok: false, code: 'NO_EQUIPMENT', reason: `❌ 装备不足：${equipment.missing.slice(0, 3).join('、')}` };
    }
    return {
      ok: true,
      code: 'OK',
      reason: equipment.ratio < 1 ? `✅ 可以训练，但预计初始装备率${Math.round(equipment.ratio * 100)}%` : `✅ 可以训练${template.name}`,
      equipmentRatio: Math.min(1, equipment.ratio),
    };
  };

  const previousQueueTraining = proto.queueTraining;
  proto.queueTraining = function queueTrainingV422(provinceId, templateKey) {
    const eligibility = this.getTrainingEligibility(provinceId, templateKey, this.player);
    this.lastActionResult = eligibility;
    if (!eligibility.ok) return false;
    const result = previousQueueTraining.call(this, provinceId, templateKey);
    this.lastActionResult = result
      ? { ok: true, code: 'QUEUED', reason: `✅ ${this.currentCountry().divisionTemplates[templateKey].name}已加入训练队列` }
      : { ok: false, code: 'FAILED', reason: '❌ 无法加入训练队列' };
    return result;
  };

  proto.divisionOperationalType = function divisionOperationalType(division) {
    if (!division) return 'infantry';
    if (division.templateKey === 'motorized') return 'motorized';
    if (division.templateKey === 'mountain') return 'mountain';
    if (division.templateKey.includes('armor')) return 'armor';
    return 'infantry';
  };

  proto.findBestNavalBase = function findBestNavalBase(code) {
    return Object.values(this.provinces)
      .filter(province => province.controller === code && province.isCoastal && province.navalBase > 0)
      .sort((a, b) => (b.navalBase - a.navalBase) || (b.infrastructure - a.infrastructure))[0] || null;
  };

  proto.ensureFleetHomePorts = function ensureFleetHomePorts(code) {
    const country = this.countries[code];
    if (!country) return;
    const fallback = this.findBestNavalBase(code);
    for (const fleet of country.fleets || []) {
      const current = fleet.homePort && this.provinces[fleet.homePort];
      if (!current || current.controller !== code || !current.isCoastal || current.navalBase < 1) {
        fleet.homePort = fallback?.id || null;
      }
    }
  };

  proto.navalBaseRole = function navalBaseRole(provinceId) {
    const province = this.provinces[provinceId];
    if (!province) return null;
    return {
      level: province.navalBase,
      berthCapacity: province.navalBase * 12,
      repairRate: province.navalBase * 0.45 + province.infrastructure * 0.08,
      supplyThroughput: province.navalBase * 5,
      invasionSource: Boolean(province.isCoastal && province.navalBase > 0),
      producesShips: false,
    };
  };

  proto.dockyardRole = function dockyardRole(provinceId) {
    const province = this.provinces[provinceId];
    if (!province) return null;
    return {
      count: province.dockyard,
      nationalProductionCapacity: province.dockyard,
      producesShips: true,
      repairsOrSuppliesFleets: false,
    };
  };

  const previousAssignFleetMission = proto.assignFleetMission;
  proto.assignFleetMission = function assignFleetMissionV422(fleetId, mission, zone) {
    this.ensureFleetHomePorts(this.player);
    if (mission !== '港内待命' && !zone) {
      this.lastActionResult = { ok: false, reason: '❌ 舰队出动必须指定海域' };
      return false;
    }
    const result = previousAssignFleetMission.call(this, fleetId, mission, mission === '港内待命' ? null : zone);
    this.lastActionResult = result ? { ok: true, reason: '✅ 舰队任务已更新' } : { ok: false, reason: '❌ 舰队任务更新失败' };
    return result;
  };

  const previousProcessNavalAndAir = proto.processNavalAndAir;
  proto.processNavalAndAir = function processNavalAndAirV422() {
    previousProcessNavalAndAir.call(this);
    if (this.day % 3 !== 0) return;
    for (const [code, country] of Object.entries(this.countries)) {
      this.ensureFleetHomePorts(code);
      for (const fleet of country.fleets || []) {
        if (fleet.mission !== '港内待命' || !fleet.homePort) continue;
        const base = this.provinces[fleet.homePort];
        if (!base) continue;
        const role = this.navalBaseRole(base.id);
        fleet.readiness = clamp(fleet.readiness + role.repairRate, 0, 100);
      }
    }
  };

  proto.militaryOperationalSnapshot = function militaryOperationalSnapshot(code = this.player) {
    this.ensureFleetHomePorts(code);
    const country = this.countries[code];
    if (!country) return { army: [], enemyArmy: [], air: [], navy: [] };
    const army = [];
    const enemyArmy = [];
    for (const province of Object.values(this.provinces)) {
      if (!province.divisions.length) continue;
      if (province.controller === code) {
        const types = [...new Set(province.divisions.map(division => this.divisionOperationalType(division)))];
        army.push({
          provinceId: province.id,
          name: province.name,
          types,
          divisions: province.divisions.map(division => ({ id: division.id, name: division.name, type: this.divisionOperationalType(division), organization: division.organization, strength: division.strength })),
        });
      } else {
        const visible = province.neighbors.some(id => this.provinces[id]?.controller === code)
          || this.fronts.some(front => front.attacker === code && front.target === province.id);
        if (visible) enemyArmy.push({ provinceId: province.id, name: province.name, estimated: true });
      }
    }

    const capital = Object.values(this.provinces).find(province => province.controller === code && province.capital)
      || Object.values(this.provinces).find(province => province.controller === code);
    const air = (country.airWings || []).map(wing => ({
      id: wing.id,
      name: wing.name,
      type: wing.type,
      aircraft: wing.aircraft,
      mission: wing.mission,
      region: wing.region,
      provinceId: wing.region && this.provinces[wing.region] ? wing.region : capital?.id || null,
      efficiency: wing.efficiency,
    }));
    const navy = (country.fleets || []).map(fleet => ({
      id: fleet.id,
      name: fleet.name,
      mission: fleet.mission,
      zone: fleet.zone,
      readiness: fleet.readiness,
      homePort: fleet.homePort,
      coordinate: fleet.zone ? SEA_ZONE_COORDINATES[fleet.zone] : null,
      provinceId: fleet.zone ? null : fleet.homePort,
      ships: { ...fleet.ships },
    }));
    return { army, enemyArmy, air, navy };
  };

  const previousLoad = IronCrownV4.load;
  IronCrownV4.load = function loadV422() {
    const loaded = previousLoad.call(this);
    if (!loaded) return null;
    loaded.ensureMilitaryUI();
    return loaded;
  };
})();
