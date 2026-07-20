'use strict';

/** V4.3 expanded period-appropriate research and policy space. */
(() => {
  const addUnique = (target, items) => {
    const ids = new Set(target.map(item => item.id));
    for (const item of items) if (!ids.has(item.id)) target.push(item);
  };

  addUnique(RESEARCH_TREE.industry, [
    { id: 'construction_2', name: '改进建筑工程', year: 1937, cost: 165, requires: 'construction_1', effect: '建设速度 +10%', tier: 2 },
    { id: 'machine_tools_3', name: '先进机床', year: 1938, cost: 205, requires: 'machine_tools_2', effect: '军工产出与生产效率增长 +8%', tier: 3 },
    { id: 'resource_extraction_2', name: '改进资源开采', year: 1938, cost: 190, requires: 'resource_extraction_1', effect: '资源产出 +10%', tier: 2 },
    { id: 'dispersed_industry_1', name: '分散式工业 I', year: 1936, cost: 150, requires: 'machine_tools_1', effect: '工业抗轰炸与生产保持能力 +8%', tier: 1 },
    { id: 'concentrated_industry_1', name: '集中式工业 I', year: 1936, cost: 150, requires: 'machine_tools_1', effect: '军工产出 +8%', tier: 1 },
    { id: 'synthetic_oil_1', name: '合成燃料工艺', year: 1937, cost: 185, requires: 'resource_extraction_1', effect: '石油和橡胶短缺惩罚降低', tier: 2 },
    { id: 'mechanical_computing', name: '机械计算设备', year: 1936, cost: 150, effect: '科研速度 +5%', tier: 1 },
    { id: 'electronic_computing', name: '电子计算原型', year: 1940, cost: 260, requires: 'mechanical_computing', effect: '科研速度 +8%', tier: 3 },
  ]);

  addUnique(RESEARCH_TREE.army, [
    { id: 'infantry_weapons_2', name: '步兵装备 II', year: 1938, cost: 175, requires: 'infantry_weapons_1', effect: '步兵攻防 +10%', tier: 2 },
    { id: 'artillery_2', name: '改进火炮 II', year: 1938, cost: 185, requires: 'artillery_1', effect: '火炮攻击 +10%', tier: 2 },
    { id: 'anti_tank_1', name: '战防炮体系', year: 1936, cost: 145, effect: '对装甲目标攻击 +8%', tier: 1 },
    { id: 'engineer_company_1', name: '野战工兵体系', year: 1936, cost: 140, requires: 'support_company_1', effect: '渡河、要塞和堑壕作战 +8%', tier: 1 },
    { id: 'logistics_company_1', name: '师级后勤体系', year: 1937, cost: 165, requires: 'support_company_1', effect: '陆军补给消耗 -8%', tier: 2 },
    { id: 'motorization_1', name: '陆军摩托化', year: 1936, cost: 155, effect: '摩托化部队速度和调动效率 +8%', tier: 1 },
    { id: 'light_tank_chassis_2', name: '改进轻型坦克底盘', year: 1937, cost: 175, effect: '轻型装甲突破 +10%', tier: 2 },
    { id: 'heavy_tank_chassis', name: '重型坦克底盘', year: 1939, cost: 230, requires: 'medium_tank_chassis', effect: '解锁重型装甲技术路线', tier: 3 },
  ]);

  addUnique(RESEARCH_TREE.air, [
    { id: 'fighter_2', name: '单翼战斗机 II', year: 1938, cost: 185, requires: 'fighter_1', effect: '制空效率 +10%', tier: 2 },
    { id: 'cas_2', name: '近距支援机 II', year: 1938, cost: 190, requires: 'cas_1', effect: '地面支援 +12%', tier: 2 },
    { id: 'tactical_bomber_1', name: '战术轰炸体系', year: 1936, cost: 155, effect: '战术轰炸效率 +8%', tier: 1 },
    { id: 'strategic_bomber_1', name: '远程战略轰炸', year: 1937, cost: 185, requires: 'tactical_bomber_1', effect: '战略轰炸效率 +10%', tier: 2 },
    { id: 'radar_2', name: '地面雷达网', year: 1938, cost: 190, requires: 'radar_1', effect: '空情预警与拦截效率 +10%', tier: 2 },
    { id: 'air_command_1', name: '统一空军指挥', year: 1936, cost: 165, effect: '航空联队任务效率 +8%', tier: 1 },
    { id: 'naval_air_coordination', name: '海空协同作战', year: 1938, cost: 205, requires: 'air_command_1', effect: '海上侦察和舰队支援 +10%', tier: 2 },
  ]);

  addUnique(RESEARCH_TREE.navy, [
    { id: 'convoy_escort_1', name: '船团护航体系', year: 1936, cost: 150, requires: 'destroyer_1', effect: '运输船护航效率 +12%', tier: 1 },
    { id: 'submarine_2', name: '远洋潜艇 II', year: 1938, cost: 185, requires: 'submarine_1', effect: '运输线袭击效率 +12%', tier: 2 },
    { id: 'cruiser_1', name: '现代巡洋舰设计', year: 1936, cost: 165, effect: '巡洋舰作战效率 +8%', tier: 1 },
    { id: 'capital_ship_1', name: '主力舰火控', year: 1937, cost: 190, requires: 'cruiser_1', effect: '主力舰命中和生存能力 +10%', tier: 2 },
    { id: 'naval_radar_1', name: '舰载雷达', year: 1939, cost: 220, requires: 'radar_1', effect: '舰队发现与夜战效率 +12%', tier: 3 },
    { id: 'amphibious_operations_1', name: '两栖作战筹划', year: 1937, cost: 180, requires: 'convoy_escort_1', effect: '登陆计划速度与上限 +10%', tier: 2 },
    { id: 'carrier_2', name: '航母航空群运用', year: 1939, cost: 225, requires: 'carrier_1', effect: '舰载航空效率 +12%', tier: 3 },
  ]);

  addUnique(RESEARCH_TREE.doctrine, [
    { id: 'mobile_warfare_2', name: '纵深机动作战', year: 1938, cost: 225, requires: 'mobile_warfare', effect: '装甲突破与计划速度 +10%', tier: 2 },
    { id: 'superior_firepower_2', name: '协调火力支援', year: 1938, cost: 225, requires: 'superior_firepower', effect: '火炮与支援连攻击 +10%', tier: 2 },
    { id: 'grand_battleplan_2', name: '完善战役筹划', year: 1938, cost: 225, requires: 'grand_battleplan', effect: '计划上限和堑壕加成 +10%', tier: 2 },
    { id: 'mass_assault_2', name: '纵深战役理论', year: 1938, cost: 225, requires: 'mass_assault', effect: '补给与增援效率 +10%', tier: 2 },
    { id: 'combined_arms_1', name: '诸兵种合成', year: 1937, cost: 190, requires: 'support_company_1', effect: '步兵、装甲和空军协同 +8%', tier: 2 },
    { id: 'operational_logistics_1', name: '战役后勤学说', year: 1937, cost: 185, effect: '补给吞吐与战略调动 +8%', tier: 2 },
  ]);

  addUnique(POLICIES, [
    { id: 'economic_mobilization', name: '经济动员法案', category: '经济', days: 120, cost: 75, effect: '消费品占用降低，建设效率提高', key: 'construction', effects: { consumerGoodsRatio: -0.04, stability: -1 } },
    { id: 'partial_mobilization', name: '部分动员', category: '动员', days: 105, cost: 80, effect: '扩大可用人力并提高军工产出', key: 'mil_output', effects: { manpower: 120, warSupport: 2 } },
    { id: 'extended_conscription', name: '延长兵役期', category: '动员', days: 110, cost: 85, effect: '显著扩大可用人力，轻微降低稳定度', key: 'admin_gain', effects: { manpower: 220, stability: -2 } },
    { id: 'officer_corps_reform', name: '军官团改革', category: '军事', days: 135, cost: 90, effect: '提高指挥点数恢复与战线计划能力', key: 'supply', effects: { commandPower: 25 } },
    { id: 'motorization_program', name: '陆军摩托化计划', category: '军事', days: 145, cost: 90, effect: '卡车生产、调动与陆军后勤改善', key: 'supply', effects: { stockpile: { truck: 800 } } },
    { id: 'air_defense_command', name: '国土防空司令部', category: '空军', days: 130, cost: 85, effect: '空情预警和本土拦截效率提高', key: 'joint_ops', effects: { airEfficiency: 0.08 } },
    { id: 'radar_network_program', name: '国家雷达网计划', category: '空军', days: 160, cost: 100, effect: '提高预警能力并增强空军侦察', key: 'joint_ops', effects: { radar: 1 } },
    { id: 'naval_rearmament', name: '海军再武装计划', category: '海军', days: 170, cost: 105, effect: '提高造舰和舰队战备恢复效率', key: 'joint_ops', effects: { navalReadiness: 0.08 } },
    { id: 'convoy_command', name: '运输与护航司令部', category: '海军', days: 120, cost: 80, effect: '增加运输船并改善海外补给', key: 'supply', effects: { convoys: 30 } },
    { id: 'intelligence_service', name: '扩建情报机关', category: '情报', days: 140, cost: 90, effect: '提高敌军、舰队和登陆行动预警', key: 'admin_gain', effects: { intelligence: 0.1 } },
    { id: 'civil_defense', name: '民防与防空准备', category: '内政', days: 115, cost: 65, effect: '提高稳定度和工业抗轰炸能力', key: 'construction', effects: { stability: 4 } },
    { id: 'war_economy', name: '战时经济体制', category: '经济', days: 150, cost: 120, effect: '大幅提高军工产出，降低消费品占用', key: 'mil_output', effects: { consumerGoodsRatio: -0.08, stability: -3, warSupport: 4 }, condition: 'war_or_tension_50' },
  ]);

  const TECH_EXTRA_MODIFIERS = Object.freeze({
    mil_output: { machine_tools_3: 0.08, concentrated_industry_1: 0.08 },
    construction: { construction_2: 0.10, dispersed_industry_1: 0.04 },
    resource: { resource_extraction_2: 0.10 },
    efficiency: { machine_tools_3: 0.10, dispersed_industry_1: 0.06 },
    infantry: { infantry_weapons_2: 0.10, engineer_company_1: 0.04, combined_arms_1: 0.05 },
    artillery: { artillery_2: 0.10, anti_tank_1: 0.05, superior_firepower_2: 0.05 },
    air: { fighter_2: 0.10, cas_2: 0.06, radar_2: 0.05, air_command_1: 0.08, naval_air_coordination: 0.05 },
    navy: { convoy_escort_1: 0.08, submarine_2: 0.08, cruiser_1: 0.06, naval_radar_1: 0.08, carrier_2: 0.08 },
  });

  const proto = IronCrownV4.prototype;
  const oldTechModifier = proto.techModifier;
  proto.techModifier = function techModifierV43(code, key) {
    let value = oldTechModifier.call(this, code, key);
    const technologies = this.countries[code]?.technologies || [];
    for (const [techId, amount] of Object.entries(TECH_EXTRA_MODIFIERS[key] || {})) if (technologies.includes(techId)) value += amount;
    return value;
  };

  const oldStartPolicy = proto.startPolicy;
  proto.startPolicy = function startPolicyV43(policyId) {
    const policy = POLICIES.find(item => item.id === policyId);
    if (policy?.condition === 'war_or_tension_50') {
      const atWar = Object.values(this.wars).some(war => war.attacker === this.player || war.defender === this.player);
      if (!atWar && this.worldTension < 50) {
        this.lastActionResult = { ok: false, reason: '❌ 战时经济要求处于战争状态，或世界紧张度达到50%' };
        return false;
      }
    }
    const result = oldStartPolicy.call(this, policyId);
    this.lastActionResult = result ? { ok: true, reason: `✅ 已开始推进${policy?.name || '政策'}` } : { ok: false, reason: '❌ 政治点数不足、政策已完成或已有政策推进中' };
    return result;
  };

  const oldProcessPolicy = proto.processPolicy;
  proto.processPolicy = function processPolicyV43(code) {
    const country = this.countries[code];
    const before = new Set(country.completedPolicies);
    oldProcessPolicy.call(this, code);
    for (const policyId of country.completedPolicies) {
      if (before.has(policyId)) continue;
      const policy = POLICIES.find(item => item.id === policyId);
      const effects = policy?.effects || {};
      if ('consumerGoodsRatio' in effects) country.consumerGoodsRatio = clamp(country.consumerGoodsRatio + effects.consumerGoodsRatio, 0.05, 0.6);
      if ('stability' in effects) country.stability = clamp(country.stability + effects.stability, 0, 100);
      if ('warSupport' in effects) country.warSupport = clamp(country.warSupport + effects.warSupport, 0, 100);
      if ('manpower' in effects) country.availableManpower += effects.manpower;
      if ('commandPower' in effects) country.commandPower = clamp(country.commandPower + effects.commandPower, 0, 100);
      if ('convoys' in effects) country.convoys += effects.convoys;
      if (effects.stockpile) for (const [item, amount] of Object.entries(effects.stockpile)) country.stockpile[item] = (country.stockpile[item] || 0) + amount;
      country.strategicModifiers ??= { intelligence: 0, radar: 0, airEfficiency: 0, navalReadiness: 0 };
      for (const key of ['intelligence', 'radar', 'airEfficiency', 'navalReadiness']) if (key in effects) country.strategicModifiers[key] = (country.strategicModifiers[key] || 0) + effects[key];
      country.recon ??= { naval: 0.25, air: 0.25, radar: 0 };
      if (effects.radar) country.recon.radar += effects.radar;
      if (effects.intelligence) { country.recon.naval += effects.intelligence; country.recon.air += effects.intelligence; }
    }
  };

  const oldProcessResearch = proto.processResearch;
  proto.processResearch = function processResearchV43(code) {
    const country = this.countries[code];
    const speed = (country.technologies.includes('mechanical_computing') ? 0.05 : 0) + (country.technologies.includes('electronic_computing') ? 0.08 : 0);
    if (speed > 0) for (const slot of country.research) if (slot.tech) slot.progress += speed;
    oldProcessResearch.call(this, code);
  };

  const oldProductionResourceFactor = proto.productionResourceFactor;
  proto.productionResourceFactor = function productionResourceFactorV43(code, equipment, assigned) {
    let factor = oldProductionResourceFactor.call(this, code, equipment, assigned);
    if (this.countries[code]?.technologies.includes('synthetic_oil_1') && (equipment.resources.oil || equipment.resources.rubber)) factor = Math.max(factor, 0.55);
    return factor;
  };
})();
