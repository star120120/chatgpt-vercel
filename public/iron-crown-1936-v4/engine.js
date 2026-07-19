'use strict';

class IronCrownV4 {
  constructor(player = 'GER', difficulty = 'normal') {
    this.version = V4_VERSION;
    this.player = player;
    this.difficulty = difficulty;
    this.date = '1936-01-01';
    this.day = 1;
    this.speed = 0;
    this.worldTension = 4;
    this.countries = {};
    this.provinces = {};
    this.relations = {};
    this.treaties = {};
    this.alliances = {};
    this.puppets = {};
    this.wars = {};
    this.fronts = [];
    this.log = [];
    this.events = {};
    this.selectedProvince = null;
    this.initCountries();
    this.initRelations();
    this.initProvinces();
    this.distributeNationalAssets();
    this.createInitialForces();
    this.logEvent(`你开始领导${this.countries[player].name}。`, 'good');
  }

  initCountries() {
    for (const [code, base] of Object.entries(COUNTRY_DEFS)) {
      const country = deepClone(base);
      country.code = code;
      country.alive = true;
      country.pp = 90;
      country.commandPower = 40;
      country.adminPoints = country.admin;
      country.stability = code === 'GER' ? 66 : code === 'USSR' ? 55 : 68;
      country.warSupport = code === 'GER' ? 55 : code === 'USSR' ? 63 : 40;
      country.availableManpower = country.manpower;
      country.casualties = 0;
      country.consumerGoodsRatio = 0.25;
      country.tradeCivUsed = 0;
      country.imports = Object.fromEntries(Object.keys(RESOURCE_NAMES).map(key => [key, 0]));
      country.stockpile = this.initialStockpile(country);
      country.production = this.initialProduction(country);
      country.shipProduction = this.initialShipProduction(country);
      country.construction = [];
      country.training = [];
      country.research = Array.from({ length: country.researchSlots }, (_, slot) => ({ slot, tech: null, progress: 0 }));
      country.technologies = [];
      country.activePolicy = null;
      country.policyProgress = 0;
      country.completedPolicies = [];
      country.modifiers = { construction: 0, mil_output: 0, admin_gain: 0, supply: 0, joint_ops: 0 };
      country.generals = country.generals.map((name, index) => ({
        id: `${code}-general-${index}`,
        name,
        skill: clamp(Math.round(seeded(`${code}:${name}:skill`, 2, 5)), 1, 5),
        attack: clamp(Math.round(seeded(`${code}:${name}:attack`, 1, 5)), 1, 5),
        defense: clamp(Math.round(seeded(`${code}:${name}:defense`, 1, 5)), 1, 5),
        logistics: clamp(Math.round(seeded(`${code}:${name}:logistics`, 1, 5)), 1, 5),
        planning: clamp(Math.round(seeded(`${code}:${name}:planning`, 1, 5)), 1, 5),
        assignedFront: null,
      }));
      country.divisionTemplates = deepClone(DIVISION_TEMPLATES);
      country.airWings = this.initialAirWings(country);
      country.fleets = this.initialFleets(country);
      country.convoys = Math.max(30, Math.round(country.dockyard * 12));
      country.coreProjects = [];
      if (this.difficulty === 'easy' && code === this.player) {
        country.availableManpower += 180;
        country.pp += 80;
        country.adminPoints += 60;
        country.stability += 5;
      }
      if (this.difficulty === 'hard' && code !== this.player) {
        country.availableManpower *= 1.15;
        country.mil += 2;
        country.warSupport += 5;
      }
      this.countries[code] = country;
    }
  }

  initialStockpile(country) {
    const army = country.army;
    return {
      infantry_equipment: army * 8500 + 120000,
      support_equipment: army * 600 + 8000,
      artillery: army * 45 + 900,
      anti_tank: army * 8 + 120,
      truck: army * 380 + 4500,
      light_tank: Math.round(country.mil * 20 + 180),
      medium_tank: 0,
      heavy_tank: 0,
      fighter: Math.round(country.air * 0.62),
      cas: Math.round(country.air * 0.18),
      tactical_bomber: Math.round(country.air * 0.15),
      strategic_bomber: Math.round(country.air * 0.05),
      destroyer: Math.round(country.navy * 0.36),
      light_cruiser: Math.round(country.navy * 0.12),
      heavy_cruiser: Math.round(country.navy * 0.08),
      submarine: Math.round(country.navy * 0.28),
      battleship: Math.round(country.navy * 0.11),
      carrier: Math.round(country.navy * 0.05),
      fuel: country.fuel ? country.fuel * 1000 : 350000,
    };
  }

  initialProduction(country) {
    const plan = [
      ['infantry_equipment', 0.32], ['support_equipment', 0.11], ['artillery', 0.14], ['truck', 0.09],
      ['light_tank', 0.13], ['fighter', 0.12], ['cas', 0.06], ['tactical_bomber', 0.03],
    ];
    let remaining = country.mil;
    const lines = plan.map(([item, ratio], index) => {
      const assigned = Math.min(10, Math.max(index === 0 ? 1 : 0, Math.round(country.mil * ratio)));
      remaining -= assigned;
      return { id: `${country.code}-line-${index}`, item, factories: assigned, efficiency: item === 'infantry_equipment' ? 0.42 : 0.28, efficiencyCap: 0.75, output: 0 };
    });
    while (remaining > 0) {
      const line = lines.find(item => item.factories < 10);
      if (!line) break;
      line.factories += 1;
      remaining -= 1;
    }
    while (remaining < 0) {
      const line = [...lines].sort((a, b) => b.factories - a.factories).find(item => item.factories > 0);
      if (!line) break;
      line.factories -= 1;
      remaining += 1;
    }
    return lines;
  }

  initialShipProduction(country) {
    if (!country.dockyard) return [];
    const items = ['destroyer', 'submarine', 'light_cruiser', 'battleship'];
    const lines = items.map((item, index) => ({ id: `${country.code}-dock-${index}`, item, dockyards: 0, efficiency: 0.3, progress: 0, completed: 0 }));
    let remaining = country.dockyard;
    let cursor = 0;
    while (remaining > 0) {
      const line = lines[cursor % lines.length];
      if (line.dockyards < 10) { line.dockyards += 1; remaining -= 1; }
      cursor += 1;
      if (cursor > 100) break;
    }
    return lines;
  }

  initialAirWings(country) {
    const total = country.air;
    if (!total) return [];
    return [
      { id: `${country.code}-air-1`, name: '第1战斗机联队', type: 'fighter', aircraft: Math.round(total * 0.5), mission: '待命', region: null, efficiency: 0.75 },
      { id: `${country.code}-air-2`, name: '第1近距支援联队', type: 'cas', aircraft: Math.round(total * 0.2), mission: '待命', region: null, efficiency: 0.7 },
      { id: `${country.code}-air-3`, name: '第1轰炸机联队', type: 'tactical_bomber', aircraft: Math.round(total * 0.3), mission: '待命', region: null, efficiency: 0.68 },
    ].filter(wing => wing.aircraft > 0);
  }

  initialFleets(country) {
    if (!country.navy) return [];
    return [{
      id: `${country.code}-fleet-1`,
      name: '主力舰队',
      mission: '港内待命',
      zone: null,
      readiness: 85,
      ships: {
        destroyer: Math.round(country.navy * 0.36),
        light_cruiser: Math.round(country.navy * 0.12),
        heavy_cruiser: Math.round(country.navy * 0.08),
        submarine: Math.round(country.navy * 0.28),
        battleship: Math.round(country.navy * 0.11),
        carrier: Math.round(country.navy * 0.05),
      },
    }];
  }

  initRelations() {
    const codes = Object.keys(COUNTRY_DEFS);
    for (let i = 0; i < codes.length; i += 1) {
      for (let j = i + 1; j < codes.length; j += 1) {
        const a = codes[i];
        const b = codes[j];
        const hostilePairs = [['GER', 'FRA'], ['GER', 'UK'], ['GER', 'POL'], ['GER', 'USSR'], ['USSR', 'POL'], ['ITA', 'FRA']];
        const friendlyPairs = [['FRA', 'UK'], ['GER', 'ITA'], ['POL', 'FRA'], ['POL', 'UK'], ['CZE', 'FRA']];
        const hostile = hostilePairs.some(pair => pair.includes(a) && pair.includes(b));
        const friendly = friendlyPairs.some(pair => pair.includes(a) && pair.includes(b));
        this.relations[this.pair(a, b)] = Math.round(seeded(`${a}:${b}`, -8, 8) + (hostile ? -35 : 0) + (friendly ? 25 : 0));
      }
    }
  }

  initProvinces() {
    for (const [id, mapProvince] of MapV4.getProvinces()) {
      this.provinces[id] = {
        id,
        name: mapProvince.name,
        owner: mapProvince.owner,
        controller: mapProvince.owner,
        terrain: mapProvince.terrain,
        neighbors: [...mapProvince.neighbors],
        population: 0,
        development: 1,
        core: true,
        coreProgress: 100,
        localStability: 70,
        civ: 0,
        mil: 0,
        dockyard: 0,
        infrastructure: 3,
        rail: 1,
        supplyHub: 0,
        navalBase: 0,
        airBase: 0,
        fort: 0,
        resources: Object.fromEntries(Object.keys(RESOURCE_NAMES).map(key => [key, 0])),
        divisions: [],
        constructionSlots: 4,
        victoryPoints: 0,
        damage: 0,
      };
    }
  }

  distributeNationalAssets() {
    for (const [code, country] of Object.entries(this.countries)) {
      const ids = MapV4.getCountryProvinceIds(code).filter(id => this.provinces[id]);
      if (!ids.length) continue;
      const mapProvinces = ids.map(id => MapV4.getProvince(id));
      const weights = mapProvinces.map(province => Math.max(0.15, Math.pow(province.area, 0.4) * seeded(`${province.id}:weight`, 0.75, 1.25) * (province.terrain === 'urban' ? 2 : 1)));
      const totalWeight = weights.reduce((sum, value) => sum + value, 0);
      const distribute = (total, key) => {
        const values = weights.map(weight => Math.floor(total * weight / totalWeight));
        let remaining = total - values.reduce((sum, value) => sum + value, 0);
        let cursor = 0;
        while (remaining > 0) { values[cursor % values.length] += 1; cursor += 1; remaining -= 1; }
        ids.forEach((id, index) => { this.provinces[id][key] = values[index]; });
      };
      distribute(country.civ, 'civ');
      distribute(country.mil, 'mil');
      distribute(country.dockyard, 'dockyard');
      ids.forEach((id, index) => {
        const province = this.provinces[id];
        const mapProvince = mapProvinces[index];
        province.population = +(country.population * weights[index] / totalWeight).toFixed(2);
        province.development = clamp(Math.round(2 + province.population * 0.7 + seeded(`${id}:dev`, 0, 3)), 1, 10);
        province.infrastructure = clamp(Math.round(2 + province.development * 0.6 + seeded(`${id}:infra`, 0, 2)), 1, 10);
        province.rail = clamp(Math.round(province.infrastructure / 2.7), 1, 5);
        province.airBase = province.terrain === 'urban' || seeded(`${id}:airbase`) > 0.78 ? 1 : 0;
        province.navalBase = mapProvince.center[0] < -2 || mapProvince.center[0] > 20 || seeded(`${id}:naval`) > 0.88 ? Math.min(3, province.dockyard + 1) : 0;
        province.victoryPoints = province.terrain === 'urban' ? clamp(Math.round(province.population * 2.4), 3, 22) : clamp(Math.round(province.population * 0.6), 0, 8);
        this.assignProvinceResources(province, code);
      });
      const capital = this.nearestProvince(code, country.capital);
      if (capital) {
        capital.capital = true;
        capital.supplyHub = 1;
        capital.infrastructure = Math.max(8, capital.infrastructure);
        capital.rail = Math.max(3, capital.rail);
        capital.victoryPoints = Math.max(30, capital.victoryPoints);
      }
    }
  }

  assignProvinceResources(province, code) {
    const national = this.countries[code].resources;
    for (const resource of Object.keys(RESOURCE_NAMES)) {
      if (!national[resource]) continue;
      const chance = resource === 'steel' ? 0.48 : resource === 'oil' ? 0.28 : 0.22;
      if (seeded(`${province.id}:${resource}`) > 1 - chance) {
        province.resources[resource] = Math.max(1, Math.round(national[resource] * seeded(`${province.id}:${resource}:share`, 0.06, 0.22)));
      }
    }
  }

  nearestProvince(code, coordinate) {
    let best = null;
    let bestDistance = Infinity;
    for (const id of MapV4.getCountryProvinceIds(code)) {
      const mapProvince = MapV4.getProvince(id);
      if (!mapProvince || !this.provinces[id]) continue;
      const distance = Math.hypot(mapProvince.center[0] - coordinate[0], mapProvince.center[1] - coordinate[1]);
      if (distance < bestDistance) { bestDistance = distance; best = this.provinces[id]; }
    }
    return best;
  }

  createInitialForces() {
    for (const [code, country] of Object.entries(this.countries)) {
      const owned = Object.values(this.provinces).filter(province => province.controller === code);
      if (!owned.length) continue;
      const border = owned.filter(province => province.neighbors.some(id => this.provinces[id] && this.provinces[id].owner !== code));
      const pool = border.length ? border : owned;
      let divisionNumber = 1;
      for (let index = 0; index < country.army; index += 1) {
        const type = index < Math.max(1, Math.round(country.army * 0.08)) ? 'light_armor' : index < Math.round(country.army * 0.14) ? 'motorized' : 'infantry';
        const province = pool[(index * 3 + divisionNumber) % pool.length];
        province.divisions.push(this.makeDivision(code, type, divisionNumber));
        divisionNumber += 1;
      }
    }
  }

  makeDivision(owner, templateKey, number) {
    const template = this.countries[owner].divisionTemplates[templateKey] || DIVISION_TEMPLATES.infantry;
    return {
      id: `${owner}-division-${number}-${Math.random().toString(36).slice(2, 7)}`,
      owner,
      name: `第${number}${template.name}`,
      templateKey,
      strength: 100,
      organization: clamp(Math.round(seeded(`${owner}:${number}:org`, 68, 92)), 40, 100),
      equipment: clamp(Math.round(seeded(`${owner}:${number}:equip`, 82, 100)), 40, 100),
      experience: seeded(`${owner}:${number}:exp`, 0, 22),
      entrenchment: 0,
      assignedFront: null,
    };
  }

  pair(a, b) { return [a, b].sort().join('|'); }
  relation(a, b) { return this.relations[this.pair(a, b)] ?? 0; }
  setRelation(a, b, value) { this.relations[this.pair(a, b)] = clamp(value, -100, 100); }
  isAtWar(a, b) { return Boolean(this.wars[this.pair(a, b)]); }
  currentCountry() { return this.countries[this.player]; }
  currentDate() { return new Date(`${this.date}T00:00:00Z`); }
  dateLabel() { const date = this.currentDate(); return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`; }
  logEvent(text, type = '') { this.log.unshift({ date: this.date, text, type }); this.log = this.log.slice(0, 300); }

  totalDivisions(code) {
    return Object.values(this.provinces).filter(province => province.controller === code).reduce((sum, province) => sum + province.divisions.length, 0);
  }

  findDivision(id) {
    for (const province of Object.values(this.provinces)) {
      const division = province.divisions.find(item => item.id === id);
      if (division) return { division, province };
    }
    return null;
  }

  nationalSummary(code) {
    const country = this.countries[code];
    const provinces = Object.values(this.provinces).filter(province => province.controller === code);
    const divisions = provinces.flatMap(province => province.divisions);
    return {
      provinces: provinces.length,
      population: provinces.reduce((sum, province) => sum + province.population, 0),
      civ: provinces.reduce((sum, province) => sum + province.civ, 0),
      mil: provinces.reduce((sum, province) => sum + province.mil, 0),
      dockyard: provinces.reduce((sum, province) => sum + province.dockyard, 0),
      divisions: divisions.length,
      armyManpower: Math.round(divisions.reduce((sum, division) => sum + this.countries[division.owner].divisionTemplates[division.templateKey].manpower * division.strength / 100, 0) / 1000),
      casualties: country.casualties,
    };
  }

  recalculateFactories(code) {
    const summary = this.nationalSummary(code);
    const country = this.countries[code];
    country.civ = summary.civ;
    country.mil = summary.mil;
    country.dockyard = summary.dockyard;
  }

  availableResources(code) {
    const country = this.countries[code];
    const resources = Object.fromEntries(Object.keys(RESOURCE_NAMES).map(key => [key, country.imports[key] || 0]));
    for (const province of Object.values(this.provinces)) {
      if (province.controller !== code) continue;
      for (const [resource, amount] of Object.entries(province.resources)) resources[resource] += amount;
    }
    return resources;
  }

  resourceBalance(code) {
    const available = this.availableResources(code);
    const used = Object.fromEntries(Object.keys(RESOURCE_NAMES).map(key => [key, 0]));
    const country = this.countries[code];
    for (const line of country.production) {
      const equipment = LAND_EQUIPMENT[line.item];
      for (const [resource, perFactory] of Object.entries(equipment.resources)) used[resource] += perFactory * line.factories;
    }
    for (const line of country.shipProduction) {
      const equipment = NAVAL_EQUIPMENT[line.item];
      for (const [resource, perDockyard] of Object.entries(equipment.resources)) used[resource] += perDockyard * line.dockyards;
    }
    return Object.fromEntries(Object.keys(RESOURCE_NAMES).map(key => [key, { available: available[key], used: used[key], balance: available[key] - used[key] }]));
  }

  productionResourceFactor(code, equipment, assigned) {
    if (!assigned) return 1;
    const balance = this.resourceBalance(code);
    let factor = 1;
    for (const [resource, perFactory] of Object.entries(equipment.resources)) {
      const required = perFactory * assigned;
      if (required > 0 && balance[resource].balance < 0) factor = Math.min(factor, clamp(1 + balance[resource].balance / required, 0.25, 1));
    }
    return factor;
  }

  productionOutput(code, line, days = 1) {
    const country = this.countries[code];
    const equipment = LAND_EQUIPMENT[line.item];
    const resourceFactor = this.productionResourceFactor(code, equipment, line.factories);
    const modifier = 1 + country.modifiers.mil_output + this.techModifier(code, 'mil_output');
    return equipment.base * line.factories * (0.25 + 0.75 * line.efficiency) * resourceFactor * modifier * days / 30;
  }

  navalOutput(code, line, days = 1) {
    const country = this.countries[code];
    const equipment = NAVAL_EQUIPMENT[line.item];
    const resourceFactor = this.productionResourceFactor(code, equipment, line.dockyards);
    return equipment.base * line.dockyards * (0.3 + 0.7 * line.efficiency) * resourceFactor * (1 + country.modifiers.joint_ops * 0.5) * days / 30;
  }

  techModifier(code, key) {
    const technologies = this.countries[code].technologies;
    let value = 0;
    if (key === 'mil_output' && technologies.includes('machine_tools_1')) value += 0.06;
    if (key === 'construction' && technologies.includes('construction_1')) value += 0.1;
    if (key === 'resource' && technologies.includes('resource_extraction_1')) value += 0.1;
    if (key === 'efficiency' && technologies.includes('machine_tools_2')) value += 0.1;
    if (key === 'infantry' && technologies.includes('infantry_weapons_1')) value += 0.08;
    if (key === 'artillery' && technologies.includes('artillery_1')) value += 0.1;
    if (key === 'air' && technologies.includes('fighter_1')) value += 0.08;
    if (key === 'navy' && technologies.includes('destroyer_1')) value += 0.08;
    return value;
  }

  changeProduction(lineId, delta) {
    const country = this.currentCountry();
    const line = country.production.find(item => item.id === lineId);
    if (!line) return false;
    const used = country.production.reduce((sum, item) => sum + item.factories, 0);
    if (delta > 0 && (used >= country.mil || line.factories >= 10)) return false;
    line.factories = clamp(line.factories + delta, 0, 10);
    if (delta < 0) line.efficiency = Math.max(0.1, line.efficiency - 0.02);
    return true;
  }

  addProductionLine(item) {
    if (!LAND_EQUIPMENT[item]) return false;
    const country = this.currentCountry();
    country.production.push({ id: `${country.code}-line-${Date.now()}-${Math.random()}`, item, factories: 0, efficiency: 0.1, efficiencyCap: 0.75, output: 0 });
    return true;
  }

  changeShipProduction(lineId, delta) {
    const country = this.currentCountry();
    const line = country.shipProduction.find(item => item.id === lineId);
    if (!line) return false;
    const used = country.shipProduction.reduce((sum, item) => sum + item.dockyards, 0);
    if (delta > 0 && (used >= country.dockyard || line.dockyards >= 10)) return false;
    line.dockyards = clamp(line.dockyards + delta, 0, 10);
    return true;
  }

  addShipLine(item) {
    if (!NAVAL_EQUIPMENT[item]) return false;
    const country = this.currentCountry();
    country.shipProduction.push({ id: `${country.code}-dock-${Date.now()}-${Math.random()}`, item, dockyards: 0, efficiency: 0.1, progress: 0, completed: 0 });
    return true;
  }

  adjustImport(resource, blocks) {
    const country = this.currentCountry();
    const next = Math.max(0, country.imports[resource] + blocks * 8);
    const imports = { ...country.imports, [resource]: next };
    const civUsed = Object.values(imports).reduce((sum, amount) => sum + Math.ceil(amount / 8), 0);
    const maxAvailable = Math.max(0, country.civ - Math.ceil(country.civ * country.consumerGoodsRatio) - 1);
    if (civUsed > maxAvailable) return false;
    country.imports[resource] = next;
    country.tradeCivUsed = civUsed;
    return true;
  }

  constructionCost(type) {
    return { civ: 1080, mil: 1080, dockyard: 980, infrastructure: 620, rail: 550, fort: 420, airBase: 520, navalBase: 640, supplyHub: 800 }[type] || 0;
  }

  queueConstruction(provinceId, type) {
    const province = this.provinces[provinceId];
    const country = this.currentCountry();
    const cost = this.constructionCost(type);
    if (!province || province.controller !== this.player || !cost) return false;
    const buildingCount = province.civ + province.mil + province.dockyard + country.construction.filter(item => item.provinceId === provinceId && ['civ', 'mil', 'dockyard'].includes(item.type)).length;
    if (['civ', 'mil', 'dockyard'].includes(type) && buildingCount >= province.constructionSlots + province.development) return false;
    country.construction.push({ id: `construction-${Date.now()}-${Math.random()}`, provinceId, type, progress: 0, cost });
    return true;
  }

  queueTraining(provinceId, templateKey) {
    const province = this.provinces[provinceId];
    const country = this.currentCountry();
    const template = country.divisionTemplates[templateKey];
    if (!province || province.controller !== this.player || !template || country.availableManpower < template.manpower / 1000) return false;
    country.availableManpower -= template.manpower / 1000;
    const days = templateKey.includes('armor') ? 160 : templateKey === 'motorized' ? 125 : 95;
    country.training.push({ id: `training-${Date.now()}-${Math.random()}`, provinceId, templateKey, progress: 0, days });
    return true;
  }

  modifyTemplate(templateKey, battalion, delta) {
    const country = this.currentCountry();
    const template = country.divisionTemplates[templateKey];
    if (!template || country.commandPower < 5) return false;
    const next = Math.max(0, (template.battalions[battalion] || 0) + delta);
    const nextWidth = template.width + delta * 2;
    if (nextWidth < 8 || nextWidth > 40) return false;
    template.battalions[battalion] = next;
    template.width = nextWidth;
    template.manpower = Math.max(4000, template.manpower + delta * 1000);
    template.attack = Math.max(5, template.attack + delta * (battalion.includes('tank') ? 8 : battalion === 'artillery' ? 5 : 2));
    template.defense = Math.max(5, template.defense + delta * (battalion === 'infantry' ? 4 : 1));
    country.commandPower -= 5;
    return true;
  }

  toggleSupport(templateKey, company) {
    const country = this.currentCountry();
    const template = country.divisionTemplates[templateKey];
    if (!template || country.commandPower < 4) return false;
    const index = template.support.indexOf(company);
    if (index >= 0) template.support.splice(index, 1);
    else if (template.support.length < 5) template.support.push(company);
    else return false;
    country.commandPower -= 4;
    return true;
  }

  startResearch(slotIndex, techId) {
    const country = this.currentCountry();
    const slot = country.research[slotIndex];
    const tech = Object.values(RESEARCH_TREE).flat().find(item => item.id === techId);
    if (!slot || slot.tech || !tech || country.technologies.includes(techId) || (tech.requires && !country.technologies.includes(tech.requires))) return false;
    slot.tech = techId;
    slot.progress = 0;
    return true;
  }

  startPolicy(policyId) {
    const country = this.currentCountry();
    const policy = POLICIES.find(item => item.id === policyId);
    if (!policy || country.activePolicy || country.completedPolicies.includes(policyId) || country.pp < policy.cost) return false;
    country.pp -= policy.cost;
    country.activePolicy = policyId;
    country.policyProgress = 0;
    return true;
  }

  executeDecision(decisionId, provinceId = null) {
    const country = this.currentCountry();
    const decision = DECISIONS.find(item => item.id === decisionId);
    const province = provinceId ? this.provinces[provinceId] : null;
    if (!decision || country.pp < decision.pp || country.adminPoints < decision.admin) return false;
    if (['develop_core', 'make_core', 'rail_emergency'].includes(decisionId) && (!province || province.controller !== this.player)) return false;
    if (decisionId === 'make_core' && (province.core || country.coreProjects.some(item => item.provinceId === provinceId))) return false;
    country.pp -= decision.pp;
    country.adminPoints -= decision.admin;
    if (decisionId === 'propaganda') { country.warSupport = clamp(country.warSupport + 6, 0, 100); country.stability = clamp(country.stability - 1, 0, 100); }
    if (decisionId === 'develop_core') { province.development = clamp(province.development + 1, 1, 10); province.constructionSlots += 1; province.population += 0.05; }
    if (decisionId === 'make_core') {
      country.coreProjects.push({ provinceId, progress: province.coreProgress || 0 });
    }
    if (decisionId === 'rail_emergency') province.rail = clamp(province.rail + 1, 1, 5);
    if (decisionId === 'stability_program') country.stability = clamp(country.stability + 5, 0, 100);
    return true;
  }

  improveRelations(target) {
    const country = this.currentCountry();
    if (country.pp < 20 || this.isAtWar(this.player, target)) return false;
    country.pp -= 20;
    this.setRelation(this.player, target, this.relation(this.player, target) + 18);
    return true;
  }

  signTreaty(target, type = '互不侵犯条约') {
    const country = this.currentCountry();
    if (country.pp < 30 || this.relation(this.player, target) < 20 || this.isAtWar(this.player, target)) return false;
    country.pp -= 30;
    this.treaties[this.pair(this.player, target)] = { type, date: this.date };
    return true;
  }

  formAlliance(target) {
    const country = this.currentCountry();
    if (country.pp < 75 || this.relation(this.player, target) < 55 || this.isAtWar(this.player, target)) return false;
    country.pp -= 75;
    this.alliances[this.pair(this.player, target)] = { date: this.date };
    return true;
  }

  declareWar(target) {
    const country = this.currentCountry();
    if (country.pp < 50 || this.isAtWar(this.player, target) || this.treaties[this.pair(this.player, target)]) return false;
    country.pp -= 50;
    this.wars[this.pair(this.player, target)] = { attacker: this.player, defender: target, start: this.date };
    this.setRelation(this.player, target, -100);
    this.worldTension = clamp(this.worldTension + 12, 0, 100);
    this.logEvent(`${country.short}向${this.countries[target].short}宣战。`, 'bad');
    return true;
  }

  createPuppet(target) {
    if (!this.isAtWar(this.player, target) || this.occupationRatio(this.player, target) < 0.65) return false;
    this.puppets[target] = { master: this.player, autonomy: 60 };
    delete this.wars[this.pair(this.player, target)];
    this.logEvent(`${this.countries[target].short}成为${this.currentCountry().short}的附庸。`, 'good');
    return true;
  }

  annexPuppet(target) {
    const puppet = this.puppets[target];
    const country = this.currentCountry();
    if (!puppet || puppet.master !== this.player || puppet.autonomy > 10 || country.adminPoints < 120) return false;
    country.adminPoints -= 120;
    for (const province of Object.values(this.provinces)) {
      if (province.owner === target || province.controller === target) {
        province.owner = this.player;
        province.controller = this.player;
        province.core = false;
        province.coreProgress = 0;
      }
    }
    this.countries[target].alive = false;
    delete this.puppets[target];
    this.recalculateFactories(this.player);
    return true;
  }

  occupationRatio(attacker, defender) {
    const provinces = Object.values(this.provinces).filter(province => province.owner === defender);
    if (!provinces.length) return 0;
    return provinces.filter(province => province.controller === attacker).length / provinces.length;
  }

  assignAirMission(wingId, mission, region) {
    const wing = this.currentCountry().airWings.find(item => item.id === wingId);
    if (!wing) return false;
    wing.mission = mission;
    wing.region = region;
    return true;
  }

  assignFleetMission(fleetId, mission, zone) {
    const fleet = this.currentCountry().fleets.find(item => item.id === fleetId);
    if (!fleet) return false;
    fleet.mission = mission;
    fleet.zone = zone;
    return true;
  }

  setSpeed(speed) { this.speed = clamp(speed, 0, 4); }

  provinceSupplyCapacity(provinceId) {
    const province = this.provinces[provinceId];
    if (!province) return 0;
    const country = this.countries[province.controller];
    const base = 5 + province.infrastructure * 2.5 + province.rail * 3.2 + province.supplyHub * 15 + (province.capital ? 12 : 0) + province.navalBase * 2;
    const occupation = province.owner === province.controller ? 1 : 0.58;
    return Math.max(1, (base - province.damage * 0.08) * TERRAIN[province.terrain].supply * occupation * (1 + (country?.modifiers.supply || 0)));
  }

  provinceSupplyRatio(provinceId) {
    const province = this.provinces[provinceId];
    if (!province) return 0;
    const demand = province.divisions.reduce((sum, division) => {
      const template = this.countries[division.owner].divisionTemplates[division.templateKey];
      return sum + template.supply * division.strength / 100;
    }, 0);
    return demand ? clamp(this.provinceSupplyCapacity(provinceId) / demand, 0.15, 1) : 1;
  }

  weatherForProvince(provinceId) {
    const mapProvince = MapV4.getProvince(provinceId);
    const date = this.currentDate();
    if (!mapProvince) return 'clear';
    const lat = mapProvince.center[1];
    const month = date.getUTCMonth() + 1;
    const roll = seeded(`${this.date}:${provinceId}:weather`);
    if ((month <= 2 || month === 12) && lat > 52) return roll > 0.82 ? 'blizzard' : roll > 0.42 ? 'snow' : 'clear';
    if ((month === 3 || month === 4 || month === 10 || month === 11) && roll > 0.62) return 'mud';
    if (roll > 0.72) return 'rain';
    return 'clear';
  }

  weatherModifier(weather, attack = true) {
    const values = {
      clear: 1,
      rain: attack ? 0.9 : 0.96,
      mud: attack ? 0.72 : 0.9,
      snow: attack ? 0.82 : 0.95,
      blizzard: attack ? 0.62 : 0.82,
    };
    return values[weather] || 1;
  }

  generalBonus(code, generalId, mode) {
    const general = this.countries[code].generals.find(item => item.id === generalId);
    if (!general) return 1;
    const stat = mode === 'attack' ? general.attack : mode === 'defense' ? general.defense : general.logistics;
    return 1 + general.skill * 0.025 + stat * 0.018;
  }

  airSupportBonus(code, provinceId, mission) {
    const country = this.countries[code];
    const relevant = country.airWings.filter(wing => wing.mission === mission && (wing.region === provinceId || wing.region === '全国'));
    const aircraft = relevant.reduce((sum, wing) => sum + wing.aircraft * wing.efficiency, 0);
    return clamp(aircraft / 3500, 0, 0.22) * (1 + country.modifiers.joint_ops + this.techModifier(code, 'air'));
  }

  createFront(sourceId, targetId, divisionIds, generalId) {
    return this.createFrontFor(this.player, sourceId, targetId, divisionIds, generalId, false);
  }

  createFrontFor(attacker, sourceId, targetId, divisionIds, generalId, active = false) {
    const source = this.provinces[sourceId];
    const target = this.provinces[targetId];
    if (!source || !target || source.controller !== attacker || target.controller === attacker || !source.neighbors.includes(targetId) || !this.isAtWar(attacker, target.controller)) return false;
    const validDivisions = source.divisions.filter(division => divisionIds.includes(division.id) && !division.assignedFront);
    if (!validDivisions.length) return false;
    const general = this.countries[attacker].generals.find(item => item.id === generalId);
    const front = {
      id: `front-${Date.now()}-${Math.random()}`,
      attacker,
      defender: target.controller,
      source: sourceId,
      target: targetId,
      divisions: validDivisions.map(division => division.id),
      generalId: general?.id || null,
      progress: 0,
      planning: active ? 15 : 0,
      active,
      daysFought: 0,
      lastReport: null,
    };
    validDivisions.forEach(division => { division.assignedFront = front.id; });
    if (general) general.assignedFront = front.id;
    this.fronts.push(front);
    return front;
  }

  toggleFront(frontId, active) {
    const front = this.fronts.find(item => item.id === frontId && item.attacker === this.player);
    if (!front) return false;
    front.active = active;
    return true;
  }

  deleteFront(frontId) {
    const index = this.fronts.findIndex(item => item.id === frontId);
    if (index < 0) return false;
    const [front] = this.fronts.splice(index, 1);
    front.divisions.forEach(id => { const found = this.findDivision(id); if (found) found.division.assignedFront = null; });
    const general = this.currentCountry().generals.find(item => item.id === front.generalId);
    if (general) general.assignedFront = null;
    return true;
  }

  frontCombatWidth(front) {
    const target = this.provinces[front.target];
    const terrain = TERRAIN[target.terrain];
    const weather = this.weatherForProvince(front.target);
    const weatherFactor = weather === 'mud' || weather === 'blizzard' ? 0.82 : 1;
    return Math.round(terrain.width * weatherFactor);
  }

  divisionPower(division, provinceId, attack, generalId) {
    const country = this.countries[division.owner];
    const template = country.divisionTemplates[division.templateKey];
    const province = this.provinces[provinceId];
    const terrain = TERRAIN[province.terrain];
    const weather = this.weatherForProvince(provinceId);
    const supply = this.provinceSupplyRatio(provinceId);
    const base = attack ? template.attack + template.breakthrough * 0.25 : template.defense;
    let power = base * division.strength / 100 * division.organization / 100 * division.equipment / 100 * supply;
    power *= 1 + division.experience / 180;
    power *= attack ? 1 + terrain.attack : 1 + terrain.defense + province.fort * 0.07 + division.entrenchment / 180;
    power *= this.weatherModifier(weather, attack);
    power *= this.generalBonus(division.owner, generalId, attack ? 'attack' : 'defense');
    if (attack) power *= 1 + this.airSupportBonus(division.owner, provinceId, '近距支援');
    else power *= 1 + this.airSupportBonus(division.owner, provinceId, '制空权') * 0.4;
    if (division.templateKey.includes('armor')) power *= 1 + this.techModifier(division.owner, 'mil_output') * 0.4;
    else power *= 1 + this.techModifier(division.owner, 'infantry');
    return power;
  }

  resolveFrontDay(front) {
    const source = this.provinces[front.source];
    const target = this.provinces[front.target];
    if (!source || !target || target.controller === front.attacker || !this.isAtWar(front.attacker, target.controller)) { this.deleteFront(front.id); return; }
    const width = this.frontCombatWidth(front);
    const attackerPool = front.divisions.map(id => this.findDivision(id)).filter(Boolean).filter(found => found.province.id === source.id || found.province.id === target.id).map(found => found.division).sort((a, b) => b.organization - a.organization);
    const defenderPool = [...target.divisions].sort((a, b) => b.organization - a.organization);
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
    if (!attackers.length) { front.active = false; return; }
    const attackPower = attackers.reduce((sum, division) => sum + this.divisionPower(division, source.id, true, front.generalId), 0);
    const defensePower = defenders.reduce((sum, division) => sum + this.divisionPower(division, target.id, false, null), 0) || 8 + target.fort * 4;
    const ratio = attackPower / Math.max(1, defensePower);
    front.daysFought += 1;
    front.progress = clamp(front.progress + (ratio - 1) * 4.2 + front.planning * 0.012, -100, 100);
    front.planning = Math.max(0, front.planning - 0.35);
    const attackerLossRate = clamp(0.08 / Math.max(0.5, ratio), 0.035, 0.22);
    const defenderLossRate = clamp(0.08 * ratio, 0.035, 0.24);
    const attackerCasualties = this.applyCombatLosses(attackers, attackerLossRate, front.attacker);
    const defenderCasualties = this.applyCombatLosses(defenders, defenderLossRate, target.controller);
    attackers.forEach(division => { division.organization = clamp(division.organization - clamp(4.5 / Math.max(0.65, ratio), 2, 8), 0, 100); });
    defenders.forEach(division => { division.organization = clamp(division.organization - clamp(4.2 * ratio, 2, 9), 0, 100); });
    front.lastReport = { attackPower: Math.round(attackPower), defensePower: Math.round(defensePower), attackerCasualties, defenderCasualties, width, weather: this.weatherForProvince(target.id) };
    if (front.progress >= 100 || !target.divisions.some(division => division.strength > 10 && division.organization > 5)) this.advanceFront(front);
    else if (front.progress <= -100 || !attackers.some(division => division.strength > 10 && division.organization > 5)) {
      front.active = false;
      front.progress = -60;
      this.logEvent(`${this.provinces[front.source].name}方向的攻势被击退。`, 'bad');
    }
  }

  applyCombatLosses(divisions, rate, countryCode) {
    let casualties = 0;
    for (const division of divisions) {
      const template = this.countries[division.owner].divisionTemplates[division.templateKey];
      const loss = rate * seeded(`${division.id}:${this.date}:loss`, 0.7, 1.3);
      const manpowerLoss = Math.round(template.manpower * loss / 100);
      casualties += manpowerLoss;
      division.strength = clamp(division.strength - loss, 0, 100);
      division.equipment = clamp(division.equipment - loss * 0.7, 0, 100);
      division.experience = clamp(division.experience + 0.5, 0, 100);
    }
    this.countries[countryCode].casualties += casualties;
    return casualties;
  }

  advanceFront(front) {
    const source = this.provinces[front.source];
    const target = this.provinces[front.target];
    const previousController = target.controller;
    const retreat = target.neighbors.map(id => this.provinces[id]).find(province => province && province.controller === previousController && province.id !== source.id);
    if (retreat) retreat.divisions.push(...target.divisions.filter(division => division.organization > 0));
    target.divisions = [];
    const moving = front.divisions.map(id => this.findDivision(id)).filter(Boolean);
    for (const found of moving) {
      found.province.divisions = found.province.divisions.filter(division => division.id !== found.division.id);
      target.divisions.push(found.division);
    }
    target.controller = front.attacker;
    target.core = target.owner === front.attacker;
    target.localStability = Math.max(25, target.localStability - 15);
    const nextTarget = target.neighbors.map(id => this.provinces[id]).filter(province => province && province.controller === previousController).sort((a, b) => b.victoryPoints - a.victoryPoints)[0];
    this.logEvent(`${this.countries[front.attacker].short}占领${target.name}，战线继续推进。`, 'good');
    if (nextTarget) {
      front.source = target.id;
      front.target = nextTarget.id;
      front.progress = 10;
      front.planning = 0;
    } else {
      front.active = false;
      front.progress = 100;
    }
    this.recalculateFactories(front.attacker);
    this.recalculateFactories(previousController);
  }

  moveDivisions(sourceId, targetId, divisionIds) {
    const source = this.provinces[sourceId];
    const target = this.provinces[targetId];
    if (!source || !target || source.controller !== this.player || target.controller !== this.player || !source.neighbors.includes(targetId)) return false;
    const moving = source.divisions.filter(division => divisionIds.includes(division.id) && !division.assignedFront);
    if (!moving.length) return false;
    source.divisions = source.divisions.filter(division => !divisionIds.includes(division.id));
    target.divisions.push(...moving);
    moving.forEach(division => { division.organization = clamp(division.organization - 6, 0, 100); division.entrenchment = 0; });
    return true;
  }

  advanceDay() {
    const date = this.currentDate();
    date.setUTCDate(date.getUTCDate() + 1);
    this.date = date.toISOString().slice(0, 10);
    this.day += 1;
    for (const code of Object.keys(this.countries)) this.processCountryDay(code);
    for (const front of [...this.fronts]) {
      if (front.active) this.resolveFrontDay(front);
      else front.planning = clamp(front.planning + 0.45 + this.generalPlanningBonus(front), 0, 100);
    }
    this.processNavalAndAir();
    this.processHistoricalEvents();
    if (this.day % 7 === 0) this.processAI();
    if (this.day % 30 === 0) this.monthlyGovernance();
  }

  generalPlanningBonus(front) {
    const general = this.countries[front.attacker]?.generals.find(item => item.id === front.generalId);
    return general ? general.planning * 0.06 : 0;
  }

  processCountryDay(code) {
    const country = this.countries[code];
    if (!country.alive) return;
    country.pp += 0.42 + country.stability / 1000;
    country.commandPower = clamp(country.commandPower + 0.12, 0, 100);
    country.adminPoints = clamp(country.adminPoints + 0.25 * (1 + country.modifiers.admin_gain), 0, 500);
    const oil = this.availableResources(code).oil;
    const activeFuelUse = country.airWings.filter(wing => wing.mission !== '待命').reduce((sum, wing) => sum + wing.aircraft * 0.08, 0) + country.fleets.filter(fleet => fleet.mission !== '港内待命').reduce((sum, fleet) => sum + Object.values(fleet.ships).reduce((a, b) => a + b, 0) * 0.9, 0);
    country.stockpile.fuel = clamp(country.stockpile.fuel + oil * 65 - activeFuelUse, 0, 1000000);
    for (const line of country.production) {
      const amount = this.productionOutput(code, line, 1);
      country.stockpile[line.item] = (country.stockpile[line.item] || 0) + amount;
      line.output = amount;
      line.efficiencyCap = 0.75 + this.techModifier(code, 'efficiency');
      line.efficiency = clamp(line.efficiency + 0.0014 * (1 + this.techModifier(code, 'efficiency')), 0.1, line.efficiencyCap);
    }
    for (const line of country.shipProduction) {
      line.progress += this.navalOutput(code, line, 1);
      line.efficiency = clamp(line.efficiency + 0.001, 0.1, 0.75);
      while (line.progress >= 1) {
        line.progress -= 1;
        line.completed += 1;
        country.stockpile[line.item] = (country.stockpile[line.item] || 0) + 1;
      }
    }
    this.processResearch(code);
    this.processPolicy(code);
    this.processConstruction(code);
    this.processTraining(code);
    this.processCoreProjects(code);
    this.recoverDivisions(code);
  }

  processResearch(code) {
    const country = this.countries[code];
    const year = this.currentDate().getUTCFullYear();
    for (const slot of country.research) {
      if (!slot.tech) continue;
      const tech = Object.values(RESEARCH_TREE).flat().find(item => item.id === slot.tech);
      if (!tech) { slot.tech = null; slot.progress = 0; continue; }
      const aheadPenalty = Math.max(0, tech.year - year);
      slot.progress += 1 / (1 + aheadPenalty * 0.75);
      if (slot.progress >= tech.cost) {
        country.technologies.push(tech.id);
        slot.tech = null;
        slot.progress = 0;
        this.logEvent(`${country.short}完成科研：${tech.name}。`, code === this.player ? 'good' : '');
      }
    }
  }

  processPolicy(code) {
    const country = this.countries[code];
    if (!country.activePolicy) return;
    const policy = POLICIES.find(item => item.id === country.activePolicy);
    if (!policy) return;
    country.policyProgress += 1;
    if (country.policyProgress >= policy.days) {
      country.completedPolicies.push(policy.id);
      country.modifiers[policy.key] += policy.key === 'admin_gain' ? 0.2 : policy.key === 'joint_ops' ? 0.1 : 0.12;
      country.activePolicy = null;
      country.policyProgress = 0;
      this.logEvent(`${country.short}完成政策：${policy.name}。`, code === this.player ? 'good' : '');
    }
  }

  processConstruction(code) {
    const country = this.countries[code];
    if (!country.construction.length) return;
    const consumer = Math.ceil(country.civ * country.consumerGoodsRatio);
    const availableCiv = Math.max(0, country.civ - consumer - country.tradeCivUsed);
    const perProject = availableCiv * 5 * (1 + country.modifiers.construction + this.techModifier(code, 'construction')) / Math.max(1, country.construction.length) / 30;
    for (let index = country.construction.length - 1; index >= 0; index -= 1) {
      const project = country.construction[index];
      project.progress += perProject;
      if (project.progress < project.cost) continue;
      const province = this.provinces[project.provinceId];
      if (!province) { country.construction.splice(index, 1); continue; }
      if (project.type === 'civ') province.civ += 1;
      if (project.type === 'mil') province.mil += 1;
      if (project.type === 'dockyard') province.dockyard += 1;
      if (project.type === 'infrastructure') province.infrastructure = clamp(province.infrastructure + 1, 1, 10);
      if (project.type === 'rail') province.rail = clamp(province.rail + 1, 1, 5);
      if (project.type === 'fort') province.fort = clamp(province.fort + 1, 0, 10);
      if (project.type === 'airBase') province.airBase = clamp(province.airBase + 1, 0, 10);
      if (project.type === 'navalBase') province.navalBase = clamp(province.navalBase + 1, 0, 10);
      if (project.type === 'supplyHub') province.supplyHub = 1;
      country.construction.splice(index, 1);
      this.recalculateFactories(code);
    }
  }

  processTraining(code) {
    const country = this.countries[code];
    for (let index = country.training.length - 1; index >= 0; index -= 1) {
      const training = country.training[index];
      training.progress += 1;
      if (training.progress < training.days) continue;
      const template = country.divisionTemplates[training.templateKey];
      let equipmentRatio = 1;
      for (const [item, amount] of Object.entries(template.equipment)) equipmentRatio = Math.min(equipmentRatio, (country.stockpile[item] || 0) / amount);
      if (equipmentRatio < 0.45) { training.progress = training.days - 2; continue; }
      for (const [item, amount] of Object.entries(template.equipment)) country.stockpile[item] = Math.max(0, (country.stockpile[item] || 0) - amount * Math.min(1, equipmentRatio));
      const province = this.provinces[training.provinceId] || Object.values(this.provinces).find(item => item.controller === code);
      const division = this.makeDivision(code, training.templateKey, this.totalDivisions(code) + 1);
      division.equipment = equipmentRatio * 100;
      division.organization = 40;
      province.divisions.push(division);
      country.training.splice(index, 1);
    }
  }

  processCoreProjects(code) {
    const country = this.countries[code];
    for (let index = country.coreProjects.length - 1; index >= 0; index -= 1) {
      const project = country.coreProjects[index];
      const province = this.provinces[project.provinceId];
      if (!province || province.controller !== code) { country.coreProjects.splice(index, 1); continue; }
      project.progress += 0.45 * (1 + country.modifiers.admin_gain);
      province.coreProgress = project.progress;
      if (project.progress >= 100) {
        province.core = true;
        province.owner = code;
        province.coreProgress = 100;
        country.coreProjects.splice(index, 1);
        this.logEvent(`${province.name}完成核心化。`, code === this.player ? 'good' : '');
      }
    }
  }

  recoverDivisions(code) {
    const country = this.countries[code];
    for (const province of Object.values(this.provinces).filter(item => item.controller === code)) {
      const supply = this.provinceSupplyRatio(province.id);
      for (const division of province.divisions) {
        if (!division.assignedFront || !this.fronts.find(front => front.id === division.assignedFront)?.active) {
          division.organization = clamp(division.organization + 1.8 * supply, 0, 100);
          division.entrenchment = clamp(division.entrenchment + 0.45, 0, 30);
        }
        if (supply < 0.45) {
          division.strength = clamp(division.strength - 0.025, 0, 100);
          division.equipment = clamp(division.equipment - 0.04, 0, 100);
        } else if (division.strength < 100 && country.availableManpower > 0.02) {
          const reinforcement = Math.min(0.08, 100 - division.strength, country.availableManpower / 20);
          division.strength += reinforcement;
          country.availableManpower -= reinforcement * 0.02;
        }
      }
    }
  }

  processNavalAndAir() {
    if (this.day % 3 !== 0) return;
    for (const [code, country] of Object.entries(this.countries)) {
      for (const wing of country.airWings) {
        if (wing.mission === '待命') wing.efficiency = clamp(wing.efficiency + 0.01, 0.4, 1);
        else {
          const fuelNeed = wing.aircraft * 0.16;
          const fuelRatio = clamp(country.stockpile.fuel / Math.max(1, fuelNeed), 0.25, 1);
          country.stockpile.fuel = Math.max(0, country.stockpile.fuel - fuelNeed * 0.5);
          wing.efficiency = clamp(wing.efficiency + (fuelRatio - 0.75) * 0.02, 0.25, 1);
        }
      }
      for (const fleet of country.fleets) {
        if (fleet.mission === '港内待命') fleet.readiness = clamp(fleet.readiness + 1, 0, 100);
        else {
          const ships = Object.values(fleet.ships).reduce((sum, amount) => sum + amount, 0);
          const fuelNeed = ships * 6;
          const fuelRatio = clamp(country.stockpile.fuel / Math.max(1, fuelNeed), 0.2, 1);
          country.stockpile.fuel = Math.max(0, country.stockpile.fuel - fuelNeed * 0.4);
          fleet.readiness = clamp(fleet.readiness - (1 - fuelRatio) * 2 - 0.25, 20, 100);
        }
      }
    }
    this.resolveNavalEncounters();
  }

  resolveNavalEncounters() {
    const activeFleets = [];
    for (const [code, country] of Object.entries(this.countries)) for (const fleet of country.fleets) if (fleet.zone && fleet.mission !== '港内待命') activeFleets.push({ code, fleet });
    for (let i = 0; i < activeFleets.length; i += 1) {
      for (let j = i + 1; j < activeFleets.length; j += 1) {
        const a = activeFleets[i];
        const b = activeFleets[j];
        if (a.fleet.zone !== b.fleet.zone || !this.isAtWar(a.code, b.code)) continue;
        if (seeded(`${this.date}:${a.fleet.id}:${b.fleet.id}`) > 0.24) continue;
        const power = entry => Object.entries(entry.fleet.ships).reduce((sum, [type, amount]) => sum + amount * ({ destroyer: 1, light_cruiser: 2.4, heavy_cruiser: 4, submarine: 1.5, battleship: 8, carrier: 9 }[type] || 1), 0) * entry.fleet.readiness / 100;
        const aPower = power(a) * (1 + this.countries[a.code].modifiers.joint_ops);
        const bPower = power(b) * (1 + this.countries[b.code].modifiers.joint_ops);
        const loser = aPower >= bPower ? b : a;
        const type = Object.keys(loser.fleet.ships).filter(key => loser.fleet.ships[key] > 0).sort((x, y) => loser.fleet.ships[y] - loser.fleet.ships[x])[0];
        if (type) loser.fleet.ships[type] = Math.max(0, loser.fleet.ships[type] - 1);
        loser.fleet.readiness = clamp(loser.fleet.readiness - 12, 0, 100);
        this.logEvent(`${a.fleet.zone}发生海战，${this.countries[loser.code].short}损失1艘${NAVAL_EQUIPMENT[type]?.name || '舰船'}。`, this.player === loser.code ? 'bad' : '');
      }
    }
  }

  processHistoricalEvents() {
    const events = [
      ['1936-03-07', 'rhineland', '莱茵兰再军事化，欧洲紧张局势上升。', 3],
      ['1936-07-18', 'spanish_civil_war', '西班牙内战爆发，国内政策方向面临重大选择。', 4],
      ['1938-03-12', 'anschluss', '德奥合并危机改变中欧政治格局。', 6],
      ['1938-09-30', 'munich', '慕尼黑会议暂时避免战争，但地区矛盾进一步加深。', 5],
      ['1939-09-01', 'poland', '欧洲全面战争爆发。', 15],
    ];
    for (const [date, id, text, tension] of events) {
      if (this.date === date && !this.events[id]) {
        this.events[id] = true;
        this.worldTension = clamp(this.worldTension + tension, 0, 100);
        this.logEvent(text, 'bad');
      }
    }
  }

  processAI() {
    for (const [code, country] of Object.entries(this.countries)) {
      if (code === this.player || !country.alive) continue;
      for (const slot of country.research.filter(item => !item.tech)) {
        const candidates = Object.values(RESEARCH_TREE).flat().filter(tech => !country.technologies.includes(tech.id) && (!tech.requires || country.technologies.includes(tech.requires)));
        if (candidates.length) slot.tech = candidates[Math.floor(seeded(`${code}:${this.day}:${slot.slot}`, 0, candidates.length)) % candidates.length].id;
      }
      if (!country.activePolicy) {
        const policy = POLICIES.find(item => !country.completedPolicies.includes(item.id) && country.pp >= item.cost);
        if (policy) { country.pp -= policy.cost; country.activePolicy = policy.id; country.policyProgress = 0; }
      }
      if (country.training.length < 2 && country.availableManpower > 20 && seeded(`${code}:${this.day}:train`) > 0.68) {
        const province = Object.values(this.provinces).find(item => item.controller === code);
        if (province) {
          const templateKey = country.technologies.includes('medium_tank_chassis') && seeded(`${code}:${this.day}:tank`) > 0.8 ? 'medium_armor' : 'infantry';
          const template = country.divisionTemplates[templateKey];
          country.availableManpower -= template.manpower / 1000;
          country.training.push({ id: `ai-training-${Date.now()}-${Math.random()}`, provinceId: province.id, templateKey, progress: 0, days: templateKey.includes('armor') ? 160 : 95 });
        }
      }
      if (seeded(`${code}:${this.day}:build`) > 0.73) {
        const province = Object.values(this.provinces).filter(item => item.controller === code).sort((a, b) => b.development - a.development)[0];
        if (province) country.construction.push({ id: `ai-build-${Date.now()}-${Math.random()}`, provinceId: province.id, type: seeded(`${code}:${this.day}:type`) > 0.5 ? 'mil' : 'civ', progress: 0, cost: 1080 });
      }
      const enemies = Object.values(this.wars).map(war => war.attacker === code ? war.defender : war.defender === code ? war.attacker : null).filter(Boolean);
      for (const enemy of enemies) {
        if (this.fronts.some(front => front.attacker === code && front.defender === enemy)) continue;
        const source = Object.values(this.provinces).find(province => province.controller === code && province.divisions.some(division => !division.assignedFront) && province.neighbors.some(id => this.provinces[id]?.controller === enemy));
        if (!source) continue;
        const target = source.neighbors.map(id => this.provinces[id]).find(province => province?.controller === enemy);
        if (!target) continue;
        const divisionIds = source.divisions.filter(division => !division.assignedFront).slice(0, 5).map(division => division.id);
        const general = country.generals.find(item => !item.assignedFront);
        this.createFrontFor(code, source.id, target.id, divisionIds, general?.id || null, true);
      }
    }
  }

  monthlyGovernance() {
    for (const [target, puppet] of Object.entries(this.puppets)) puppet.autonomy = clamp(puppet.autonomy - 1.5, 0, 100);
    for (const country of Object.values(this.countries)) {
      country.stability = clamp(country.stability + (country.pp > 0 ? 0.2 : -0.2), 0, 100);
      country.availableManpower += country.population * 0.015;
    }
  }

  save() {
    try { localStorage.setItem('ironCrownV4', JSON.stringify(this)); return true; } catch { return false; }
  }

  static load() {
    try {
      const raw = localStorage.getItem('ironCrownV4');
      if (!raw) return null;
      return Object.assign(Object.create(IronCrownV4.prototype), JSON.parse(raw));
    } catch {
      return null;
    }
  }
}

let GameV4 = null;
