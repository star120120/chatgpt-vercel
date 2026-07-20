'use strict';

/** V4.3.1 strategic timeline, event choices, country desk and economic diplomacy. */
(() => {
  COUNTRY_DEFS.ESP_N ??= {
    ...deepClone(COUNTRY_DEFS.ESP),
    name: '西班牙国民军', short: '国民军', color: '#9b7048', ideology: '国民主义',
    population: 0, manpower: 0, civ: 0, mil: 0, dockyard: 0, admin: 35, researchSlots: 1,
    army: 0, air: 0, navy: 0, resources: Object.fromEntries(Object.keys(RESOURCE_NAMES).map(key => [key, 0])),
    generals: ['弗朗哥', '莫拉', '瓦雷拉'], aliases: ['Nationalist Spain'], iso: [],
  };

  const COUNTRY_BRIEFS = Object.freeze({
    GER: { overview: '欧洲大陆最强工业国之一，正在突破凡尔赛体系限制。军工、机械和化学工业雄厚，但石油、橡胶和铝高度依赖进口或合成替代。', economy: '莱茵-鲁尔和西里西亚是煤钢核心；扩军速度快，但长期战争会受到燃料与外汇约束。', diplomacy: '与法国、英国和波兰关系紧张；与意大利存在接近空间；对奥地利和捷克斯洛伐克具有强烈战略诉求。' },
    FRA: { overview: '拥有庞大陆军、海外帝国和较强工业基础，但国内政治分裂、人口动员能力和进攻意愿受限。', economy: '工业集中在巴黎盆地、北部、洛林和罗讷地区，资源状况优于德国但仍需海上贸易。', diplomacy: '依靠与英国、波兰和小协约国的安全关系遏制德国，同时必须处理国内反战情绪。' },
    UK: { overview: '全球海权与殖民体系核心，皇家海军和商船队占据优势，本土陆军规模有限但具备远程投送能力。', economy: '金融、造船和贸易体系强大，工业与资源依赖全球海运航线，必须确保制海权和运输船安全。', diplomacy: '倾向维持欧洲均势和避免过早大陆战争，同时承担帝国防务和多方向海上压力。' },
    USSR: { overview: '领土、人口和资源储备巨大，正在快速工业化与扩军，但军官体系和组织效率受到政治清洗风险影响。', economy: '乌克兰、顿巴斯、伏尔加和高加索构成粮食、煤钢和石油支柱，基础设施跨度巨大。', diplomacy: '同时警惕德国、日本和西方国家，倾向利用条约、缓冲国和意识形态援助争取战略纵深。' },
    ITA: { overview: '地中海地区的重要强国，拥有规模可观的陆海空军，但装备质量、工业能力和战略资源不足。', economy: '北意大利工业较集中，石油、煤炭和优质钢材依赖进口，长期高强度战争承受能力有限。', diplomacy: '寻求在地中海、巴尔干和非洲扩大影响，可在英法与德国之间进行战略选择。' },
    POL: { overview: '位于德国和苏联之间的区域强国，陆军规模较大，但边境过长、工业和空军现代化程度有限。', economy: '上西里西亚、华沙和中央工业区是工业基础，东部地区交通与发展水平较低。', diplomacy: '依靠法国和英国保障，同时必须在对德、对苏关系与周边领土争议之间保持平衡。' },
    ESP: { overview: '第二共和国政治极化严重，军队、地方力量和社会组织分裂，内战风险迅速上升。', economy: '工业集中在加泰罗尼亚、巴斯克和阿斯图里亚斯，农业和区域发展差距明显。', diplomacy: '德国、意大利和苏联可能介入；英法倾向不干涉，但国内外援将显著改变内战力量对比。' },
    TUR: { overview: '共和国改革仍在推进，控制黑海与地中海之间的海峡，陆军规模较大但机械化和工业基础有限。', economy: '以农业和初级工业为主，铬矿具有重要战略价值，铁路和东西部基础设施差距明显。', diplomacy: '在苏联、巴尔干国家、英国和意大利之间维持谨慎平衡，海峡安全是核心利益。' },
    CZE: { overview: '中欧工业与军工强国，拥有坚固边境防线和成熟装备工业，但战略纵深有限且民族结构复杂。', economy: '波希米亚和摩拉维亚工业高度发达，斯柯达体系提供重要军工产能。', diplomacy: '依赖法国和小协约体系，苏台德问题使其直接面对德国压力。' },
    AUT: { overview: '一战后形成的小型德语国家，政治独立受到德国压力，国内存在强烈合并派与威权政府矛盾。', economy: '维也纳和多瑙河地区拥有一定工业，但市场、资源和军力规模有限。', diplomacy: '独立主要依靠意大利和西方态度，德奥关系决定国家生存。' },
    ROM: { overview: '巴尔干人口与领土大国，拥有欧洲最重要的石油产区之一，但边境争议和国内政治不稳定。', economy: '普洛耶什蒂油田具有全球战略价值，农业占比高，工业和基础设施分布不均。', diplomacy: '同时面对苏联、匈牙利和保加利亚的领土压力，依赖法国体系但可能转向德国寻求安全。' },
    YUG: { overview: '由多个民族和历史地区构成的南斯拉夫王国，陆军规模较大但政治整合和交通条件薄弱。', economy: '矿产和农业资源较丰富，工业集中度较低，山区交通限制军事调动。', diplomacy: '在意大利、德国、小协约和巴尔干协约之间维持脆弱平衡。' },
    HUN: { overview: '致力于修订特里亚农条约的王国，军力受限制但正在秘密扩军。', economy: '农业基础较强，铝土和部分工业资源具有价值，但市场和出海口受限。', diplomacy: '与罗马尼亚、捷克斯洛伐克和南斯拉夫存在领土诉求，倾向接近德国和意大利。' },
    default: { overview: '欧洲主权国家，国内政治、工业能力与安全环境将受到1930年代国际危机持续影响。', economy: '经济发展取决于本土工业、战略资源、民用工厂和对外贸易通道。', diplomacy: '可通过贸易、改善关系、条约、联盟、制裁与战争塑造国家安全环境。' },
  });

  const STRATEGIC_TIMELINE = Object.freeze([
    { id: 'rhineland-crisis', date: '1936-03-07', title: '莱茵兰再军事化危机', location: [7.1, 50.7], participants: ['GER', 'FRA', 'UK'], warningDays: [30, 7], deadlineDays: 6, summary: '德国是否向莱茵兰部署军队，将检验凡尔赛—洛迦诺体系以及英法的干预意愿。' },
    { id: 'spanish-civil-war', date: '1936-07-18', title: '西班牙内战', location: [-3.7, 40.2], participants: ['ESP', 'GER', 'ITA', 'USSR', 'FRA', 'UK'], warningDays: [30, 7], deadlineDays: 10, summary: '共和国、军队叛乱集团和地方政治力量进入全面冲突，外国装备、航空兵与志愿军将改变战线。' },
    { id: 'anti-comintern', date: '1936-11-25', title: '反共产国际协定', location: [13.4, 52.5], participants: ['GER', 'ITA', 'USSR'], warningDays: [14], deadlineDays: 8, summary: '德国推动建立反共产主义外交协作，可能加深欧洲阵营化。' },
    { id: 'sino-japanese-war', date: '1937-07-07', title: '卢沟桥事变与东亚战争升级', location: [50.5, 46.0], participants: ['USSR', 'GER', 'UK', 'FRA', 'ITA'], warningDays: [14], deadlineDays: 10, summary: '中日冲突升级将影响全球贸易、军火援助和苏联远东安全。' },
    { id: 'anschluss-crisis', date: '1938-03-12', title: '德奥合并危机', location: [14.5, 47.6], participants: ['GER', 'AUT', 'ITA', 'FRA', 'UK'], warningDays: [30, 7], deadlineDays: 7, summary: '奥地利主权、德国压力与意大利态度将决定中欧力量平衡。' },
    { id: 'sudeten-crisis', date: '1938-09-20', title: '苏台德危机', location: [15.4, 50.0], participants: ['GER', 'CZE', 'FRA', 'UK', 'USSR'], warningDays: [30, 7], deadlineDays: 9, summary: '苏台德德意志人问题升级，捷克斯洛伐克边境工事与盟国承诺面临考验。' },
    { id: 'czech-collapse', date: '1939-03-15', title: '捷克斯洛伐克解体危机', location: [14.4, 50.1], participants: ['GER', 'CZE', 'HUN', 'POL', 'FRA', 'UK'], warningDays: [14], deadlineDays: 7, summary: '慕尼黑体系可能彻底崩溃，中欧领土与工业控制权重新分配。' },
    { id: 'molotov-ribbentrop', date: '1939-08-23', title: '德苏互不侵犯谈判', location: [28.0, 54.0], participants: ['GER', 'USSR', 'POL', 'UK', 'FRA'], warningDays: [14, 3], deadlineDays: 5, summary: '德国与苏联可能通过互不侵犯安排改变波兰和东欧的战略处境。' },
    { id: 'poland-crisis', date: '1939-09-01', title: '波兰危机', location: [20.5, 52.0], participants: ['GER', 'POL', 'UK', 'FRA', 'USSR'], warningDays: [7, 2], deadlineDays: 3, summary: '但泽、走廊和安全保障问题达到战争临界点。' },
  ]);

  const DAY_MS = 86400000;
  const dateValue = date => new Date(`${date}T00:00:00Z`).getTime();
  const daysUntil = (from, to) => Math.round((dateValue(to) - dateValue(from)) / DAY_MS);
  const addDays = (date, days) => new Date(dateValue(date) + days * DAY_MS).toISOString().slice(0, 10);

  const proto = IronCrownV4.prototype;
  const previousInitCountries = proto.initCountries;
  proto.initCountries = function initCountriesV431() {
    previousInitCountries.call(this);
    this.ruleVersion = '4.3.1-stable.1';
    this.strategicTimeline = { warned: {}, queued: {}, resolved: {}, pending: [], history: [], resumeSpeed: 1 };
    this.tradeAgreements = [];
    this.embargoes = {};
    this.economicPartnerships = {};
    for (const country of Object.values(this.countries)) {
      country.tradePartners ??= {};
      country.embargoes ??= {};
      country.strategicModifiers ??= { intelligence: 0, radar: 0, airEfficiency: 0, navalReadiness: 0 };
    }
  };

  proto.ensureStrategicTimeline = function ensureStrategicTimeline() {
    this.strategicTimeline ??= { warned: {}, queued: {}, resolved: {}, pending: [], history: [], resumeSpeed: 1 };
    this.strategicTimeline.warned ??= {};
    this.strategicTimeline.queued ??= {};
    this.strategicTimeline.resolved ??= {};
    this.strategicTimeline.pending ??= [];
    this.strategicTimeline.history ??= [];
    this.tradeAgreements ??= [];
    this.embargoes ??= {};
    this.economicPartnerships ??= {};
    return this.strategicTimeline;
  };

  proto.countryStrategicProfile = function countryStrategicProfile(code) {
    const country = this.countries[code];
    if (!country) return null;
    const brief = COUNTRY_BRIEFS[code] || COUNTRY_BRIEFS.default;
    const summary = this.nationalSummary(code);
    const resources = this.availableResources(code);
    return {
      code,
      name: country.name,
      short: country.short,
      ideology: country.ideology,
      color: country.color,
      overview: brief.overview,
      economy: brief.economy,
      diplomacy: brief.diplomacy,
      population: country.population,
      stability: country.stability,
      warSupport: country.warSupport,
      civ: summary.civ,
      mil: summary.mil,
      dockyard: summary.dockyard,
      divisions: summary.divisions,
      relations: code === this.player ? 100 : this.relation(this.player, code),
      atWar: code === this.player ? false : this.isAtWar(this.player, code),
      resources,
    };
  };

  proto.signTradeDeal = function signTradeDeal(targetCode, resource, blocks = 1) {
    this.ensureStrategicTimeline();
    const target = this.countries[targetCode];
    const country = this.currentCountry();
    const amountBlocks = clamp(Math.floor(blocks), 1, 3);
    if (!target || targetCode === this.player || !target.alive) return { ok: false, reason: '目标国家无效' };
    if (this.isAtWar(this.player, targetCode)) return { ok: false, reason: '交战国家之间无法签订贸易合同' };
    if (this.embargoes[this.pair(this.player, targetCode)]) return { ok: false, reason: '两国之间存在贸易禁运' };
    if (this.relation(this.player, targetCode) < -40) return { ok: false, reason: '双边关系过低，无法签订贸易合同' };
    if (!(resource in RESOURCE_NAMES)) return { ok: false, reason: '资源类型无效' };
    const targetSupply = this.availableResources(targetCode)[resource] || COUNTRY_DEFS[targetCode]?.resources?.[resource] || 0;
    if (targetSupply < 4) return { ok: false, reason: `${target.short}缺少可出口的${RESOURCE_NAMES[resource]}` };
    const adjusted = this.adjustImport(resource, amountBlocks);
    if (!adjusted) return { ok: false, reason: '没有足够空闲民用工厂承担进口' };
    const agreement = { id: `trade-${Date.now()}-${Math.random()}`, buyer: this.player, seller: targetCode, resource, amount: amountBlocks * 8, civ: amountBlocks, start: this.date };
    this.tradeAgreements.push(agreement);
    country.tradePartners[targetCode] = (country.tradePartners[targetCode] || 0) + agreement.amount;
    target.tradePartners[this.player] = (target.tradePartners[this.player] || 0) + agreement.amount;
    this.setRelation(this.player, targetCode, this.relation(this.player, targetCode) + 3);
    this.logEvent(`${country.short}与${target.short}签订${RESOURCE_NAMES[resource]}贸易合同。`, 'good');
    return { ok: true, agreement };
  };

  proto.cancelTradeDeal = function cancelTradeDeal(agreementId) {
    this.ensureStrategicTimeline();
    const index = this.tradeAgreements.findIndex(item => item.id === agreementId && item.buyer === this.player);
    if (index < 0) return { ok: false, reason: '贸易合同不存在' };
    const agreement = this.tradeAgreements[index];
    const country = this.currentCountry();
    country.imports[agreement.resource] = Math.max(0, (country.imports[agreement.resource] || 0) - agreement.amount);
    country.tradeCivUsed = Math.max(0, country.tradeCivUsed - agreement.civ);
    this.tradeAgreements.splice(index, 1);
    return { ok: true };
  };

  proto.establishEconomicPartnership = function establishEconomicPartnership(targetCode) {
    this.ensureStrategicTimeline();
    const country = this.currentCountry();
    const target = this.countries[targetCode];
    const pair = this.pair(this.player, targetCode);
    if (!target || targetCode === this.player || this.isAtWar(this.player, targetCode)) return { ok: false, reason: '当前无法开展经济合作' };
    if (country.pp < 35) return { ok: false, reason: '需要35政治点数' };
    if (this.relation(this.player, targetCode) < 0) return { ok: false, reason: '关系达到0以上才能开展经济合作' };
    if (this.economicPartnerships[pair]) return { ok: false, reason: '两国已经存在经济合作项目' };
    country.pp -= 35;
    country.modifiers.construction += 0.02;
    this.economicPartnerships[pair] = { start: this.date, expiresDay: this.day + 180, participants: [this.player, targetCode] };
    this.setRelation(this.player, targetCode, this.relation(this.player, targetCode) + 12);
    this.logEvent(`${country.short}与${target.short}启动为期180天的经济合作计划。`, 'good');
    return { ok: true };
  };

  proto.imposeTradeEmbargo = function imposeTradeEmbargo(targetCode) {
    this.ensureStrategicTimeline();
    const country = this.currentCountry();
    const target = this.countries[targetCode];
    const pair = this.pair(this.player, targetCode);
    if (!target || targetCode === this.player || this.isAtWar(this.player, targetCode)) return { ok: false, reason: '目标国家无效或已经处于战争状态' };
    if (country.pp < 30) return { ok: false, reason: '需要30政治点数' };
    if (this.embargoes[pair]) return { ok: false, reason: '贸易禁运已经生效' };
    country.pp -= 30;
    this.embargoes[pair] = { imposedBy: this.player, target: targetCode, start: this.date };
    const affected = this.tradeAgreements.filter(item => (item.buyer === this.player && item.seller === targetCode) || (item.buyer === targetCode && item.seller === this.player));
    for (const agreement of affected) {
      if (agreement.buyer === this.player) {
        country.imports[agreement.resource] = Math.max(0, country.imports[agreement.resource] - agreement.amount);
        country.tradeCivUsed = Math.max(0, country.tradeCivUsed - agreement.civ);
      }
    }
    this.tradeAgreements = this.tradeAgreements.filter(item => !affected.includes(item));
    this.setRelation(this.player, targetCode, this.relation(this.player, targetCode) - 25);
    this.worldTension = clamp(this.worldTension + 1, 0, 100);
    this.logEvent(`${country.short}对${target.short}实施贸易禁运。`, 'bad');
    return { ok: true };
  };

  proto.strategicEventChoices = function strategicEventChoices(eventId) {
    const player = this.player;
    const neutral = [{ id: 'observe', title: '保持观望', description: '不直接介入，避免立即承担政治和军事成本。', effect: '政治点 +5；局势按其他国家选择继续发展', default: true }];
    if (eventId === 'rhineland-crisis') {
      if (player === 'GER') return [
        { id: 'full-remilitarization', title: '全面进驻莱茵兰', description: '派遣正规部队进入非军事区，以既成事实挑战条约体系。', effect: '稳定度 +3，战争支持 +5，世界紧张度 +5；英法关系恶化' },
        { id: 'limited-deployment', title: '有限部署与外交试探', description: '仅部署少量部队，并通过外交渠道降低英法反应。', effect: '战争支持 +2，世界紧张度 +2；关系小幅恶化', default: true },
        { id: 'suspend-operation', title: '暂停行动', description: '避免军事冒险，但国内威望将受损。', effect: '政治点 +20，稳定度 -4；对法关系改善' },
      ];
      if (player === 'FRA' || player === 'UK') return [
        { id: 'ultimatum', title: '提出军事最后通牒', description: '要求德国撤军并准备有限动员。', effect: '政治点 -25，战争支持 +4，世界紧张度 +4；德方可能退让' },
        { id: 'sanctions', title: '协调经济制裁', description: '通过贸易、金融和外交压力回应德国行动。', effect: '政治点 -10，对德关系 -15；建立制裁记录', default: true },
        { id: 'diplomatic-protest', title: '外交抗议但不动员', description: '维持和平优先，只进行正式抗议。', effect: '政治点 +5，对德关系 -5' },
      ];
      return neutral;
    }
    if (eventId === 'spanish-civil-war') {
      if (player === 'GER' || player === 'ITA') return [
        { id: 'aid-nationalists-equipment', title: '援助国民军装备', description: '秘密提供步兵装备、顾问和运输支持。', effect: '消耗5000件步兵装备；国民军支持度 +3，紧张度上升', default: true },
        { id: 'aid-nationalists-air', title: '派遣航空支援', description: '提供战斗机和航空人员。', effect: '消耗50架战斗机；国民军支持度 +4' },
        { id: 'non-intervention', title: '不干涉', description: '避免介入伊比利亚战争。', effect: '稳定度 +1，政治点 +5' },
      ];
      if (player === 'USSR') return [
        { id: 'aid-republic-equipment', title: '援助共和国装备', description: '向共和国提供武器、顾问与物资。', effect: '消耗5000件步兵装备；共和国支持度 +3', default: true },
        { id: 'aid-republic-air', title: '派遣共和国航空支援', description: '提供战斗机、飞行员和训练人员。', effect: '消耗50架战斗机；共和国支持度 +4' },
        { id: 'non-intervention', title: '有限观望', description: '暂不承担海外干预成本。', effect: '政治点 +5' },
      ];
      if (player === 'FRA' || player === 'UK') return [
        { id: 'non-intervention', title: '推动不干涉协定', description: '限制公开援助，以避免欧洲战争扩大。', effect: '稳定度 +2；共和国得不到公开支持', default: true },
        { id: 'limited-republic-aid', title: '秘密援助共和国', description: '通过边境或第三国提供有限装备。', effect: '消耗3000件步兵装备；共和国支持度 +2，政治点 -10' },
        { id: 'open-support-republic', title: '公开支持共和国', description: '承担外交风险，提供航空和装备援助。', effect: '共和国支持度 +5，世界紧张度 +2，国内稳定度 -1' },
      ];
      if (player === 'ESP') return [
        { id: 'defend-republic', title: '共和国政府组织抵抗', description: '整合忠诚部队、工会和地方政府力量。', effect: '共和国支持度 +6，稳定度 -5，战争支持 +8', default: true },
        { id: 'seek-compromise', title: '尝试政治妥协', description: '争取中间派与部分军官，但可能失去动员时机。', effect: '共和国支持度 +1，国民军支持度 +1，政治点 +15' },
      ];
      return neutral;
    }
    if (eventId === 'anschluss-crisis' && player === 'GER') return [
      { id: 'force-union', title: '强力推动德奥合并', description: '通过政治压力和军事威慑要求奥地利接受合并。', effect: '世界紧张度 +6，战争支持 +4；对英法关系恶化', default: true },
      { id: 'negotiated-union', title: '推动公投与协商合并', description: '降低直接军事威胁，争取国际默认。', effect: '政治点 -20，世界紧张度 +3' },
      { id: 'respect-austrian-independence', title: '暂时尊重奥地利独立', description: '避免危机升级。', effect: '政治点 +10，稳定度 -2' },
    ];
    if (eventId === 'anschluss-crisis' && player === 'AUT') return [
      { id: 'resist-germany', title: '维护奥地利独立', description: '动员政府、军队并请求外国保障。', effect: '战争支持 +8，稳定度 -3，对德关系 -30' },
      { id: 'accept-union', title: '接受合并安排', description: '避免战争，但国家主权将终结。', effect: '事件进入德奥合并结果', default: true },
    ];
    if (eventId === 'sudeten-crisis') return [
      { id: 'firm-position', title: '采取强硬立场', description: '拒绝在边界和安全问题上进一步让步。', effect: '战争支持 +4，世界紧张度 +3；关系恶化' },
      { id: 'conference', title: '推动国际会议', description: '通过多国谈判换取短期和平。', effect: '政治点 -15，世界紧张度 -1', default: true },
      { id: 'avoid-involvement', title: '避免直接介入', description: '不承担立即军事义务。', effect: '稳定度 +1，盟友信任下降' },
    ];
    if (eventId === 'molotov-ribbentrop' && (player === 'GER' || player === 'USSR')) return [
      { id: 'sign-pact', title: '签署互不侵犯条约', description: '降低两线战争风险，并秘密讨论东欧势力范围。', effect: '德苏关系 +45，世界紧张度 +4；波兰关系恶化', default: true },
      { id: 'reject-pact', title: '拒绝秘密安排', description: '保留意识形态与战略对抗立场。', effect: '战争支持 +3，德苏关系 -15' },
    ];
    if (eventId === 'poland-crisis') return [
      { id: 'mobilize', title: '进入全面动员', description: '准备应对欧洲战争爆发。', effect: '战争支持 +6，可用人力 +80K，稳定度 -2', default: true },
      { id: 'last-negotiation', title: '进行最后外交谈判', description: '尝试以会议、保障或局部让步避免战争。', effect: '政治点 -20，世界紧张度 -1' },
      { id: 'remain-neutral', title: '维持中立姿态', description: '避免主动承担军事义务。', effect: '稳定度 +2，盟友关系可能下降' },
    ];
    return neutral;
  };

  proto.queueStrategicEvent = function queueStrategicEvent(definition) {
    const timeline = this.ensureStrategicTimeline();
    if (timeline.queued[definition.id] || timeline.resolved[definition.id]) return;
    const choices = this.strategicEventChoices(definition.id);
    const pending = {
      ...definition,
      triggered: this.date,
      deadline: addDays(this.date, definition.deadlineDays || 7),
      choices,
      participant: definition.participants.includes(this.player),
    };
    timeline.queued[definition.id] = true;
    timeline.pending.push(pending);
    timeline.resumeSpeed = this.speed || this.clock?.desiredSpeed || 1;
    this.__userPaused = true;
    this.setSpeed(0);
    this.pushAlert('待决策事件', `${definition.title}：${definition.summary}`, this.nearestProvinceByCoordinate?.(definition.location)?.id || null, 'danger');
  };

  proto.nearestProvinceByCoordinate = function nearestProvinceByCoordinate(coordinate) {
    let best = null;
    let bestDistance = Infinity;
    for (const province of Object.values(this.provinces)) {
      const center = MapV4.getProvince(province.id)?.center;
      if (!center) continue;
      const distance = (center[0] - coordinate[0]) ** 2 + (center[1] - coordinate[1]) ** 2;
      if (distance < bestDistance) { best = province; bestDistance = distance; }
    }
    return best;
  };

  proto.applyStrategicChoice = function applyStrategicChoice(eventId, choiceId) {
    const country = this.currentCountry();
    const relation = (target, delta) => { if (this.countries[target]) this.setRelation(this.player, target, this.relation(this.player, target) + delta); };
    const adjust = effects => {
      country.pp = Math.max(0, country.pp + (effects.pp || 0));
      country.adminPoints = Math.max(0, country.adminPoints + (effects.admin || 0));
      country.commandPower = clamp(country.commandPower + (effects.command || 0), 0, 100);
      country.stability = clamp(country.stability + (effects.stability || 0), 0, 100);
      country.warSupport = clamp(country.warSupport + (effects.warSupport || 0), 0, 100);
      country.availableManpower = Math.max(0, country.availableManpower + (effects.manpower || 0));
      this.worldTension = clamp(this.worldTension + (effects.tension || 0), 0, 100);
    };
    let outcome = '已采取行动。';

    if (eventId === 'rhineland-crisis') {
      if (choiceId === 'full-remilitarization') { adjust({ pp: -15, stability: 3, warSupport: 5, tension: 5 }); relation('FRA', -18); relation('UK', -10); outcome = '德国军队全面进驻莱茵兰，条约体系受到公开挑战。'; }
      if (choiceId === 'limited-deployment') { adjust({ pp: -5, warSupport: 2, tension: 2 }); relation('FRA', -8); relation('UK', -4); outcome = '德国采取有限部署，英法进行了抗议但未立即军事干预。'; }
      if (choiceId === 'suspend-operation') { adjust({ pp: 20, stability: -4, tension: -1 }); relation('FRA', 10); outcome = '行动被暂停，欧洲危机暂时降温，但德国政府威望受损。'; }
      if (choiceId === 'ultimatum') { adjust({ pp: -25, warSupport: 4, tension: 4 }); relation('GER', -20); const retreat = seeded(`${this.date}:${this.player}:rhineland-ultimatum`) > 0.42; if (retreat) { this.countries.GER.stability = clamp(this.countries.GER.stability - 3, 0, 100); outcome = '英法最后通牒迫使德国暂缓部分部署。'; } else outcome = '德国拒绝最后通牒，欧洲进入高度紧张状态。'; }
      if (choiceId === 'sanctions') { adjust({ pp: -10, tension: 1 }); relation('GER', -15); this.embargoes[this.pair(this.player, 'GER')] = { imposedBy: this.player, target: 'GER', start: this.date, event: eventId }; outcome = '针对德国的有限经济制裁开始实施。'; }
      if (choiceId === 'diplomatic-protest') { adjust({ pp: 5 }); relation('GER', -5); outcome = '政府发表外交抗议，但没有采取军事或经济行动。'; }
    }

    if (eventId === 'spanish-civil-war') {
      if (!this.civilWars?.spain) this.startSpanishCivilWar();
      if (this.civilWars?.spain) this.civilWars.spain.nationalist.code = 'ESP_N';
      if (choiceId === 'aid-nationalists-equipment') { const result = this.supportSpanishFaction(this.player, 'nationalist', 'equipment'); if (!result.ok) return result; outcome = '国民军获得外国步兵装备与顾问支援。'; }
      if (choiceId === 'aid-nationalists-air') { const result = this.supportSpanishFaction(this.player, 'nationalist', 'air'); if (!result.ok) return result; outcome = '国民军获得外国航空兵支援。'; }
      if (choiceId === 'aid-republic-equipment') { const result = this.supportSpanishFaction(this.player, 'republican', 'equipment'); if (!result.ok) return result; outcome = '共和国获得外国装备支援。'; }
      if (choiceId === 'aid-republic-air') { const result = this.supportSpanishFaction(this.player, 'republican', 'air'); if (!result.ok) return result; outcome = '共和国获得外国航空兵支援。'; }
      if (choiceId === 'limited-republic-aid') { if ((country.stockpile.infantry_equipment || 0) < 3000) return { ok: false, reason: '步兵装备不足3000件' }; country.stockpile.infantry_equipment -= 3000; this.civilWars.spain.republican.support += 2; adjust({ pp: -10, tension: 0.5 }); outcome = '有限装备通过非公开渠道抵达共和国控制区。'; }
      if (choiceId === 'open-support-republic') { this.civilWars.spain.republican.support += 5; adjust({ stability: -1, tension: 2 }); outcome = '公开援助使共和国力量增强，同时加剧欧洲阵营对立。'; }
      if (choiceId === 'defend-republic') { this.civilWars.spain.republican.support += 6; adjust({ stability: -5, warSupport: 8 }); outcome = '共和国政府完成初步动员，主要城市和忠诚部队开始组织防线。'; }
      if (choiceId === 'seek-compromise') { this.civilWars.spain.republican.support += 1; this.civilWars.spain.nationalist.support += 1; adjust({ pp: 15 }); outcome = '妥协尝试未能阻止全国性分裂，但部分中间力量暂时保持观望。'; }
      if (choiceId === 'non-intervention') { adjust({ stability: 1, pp: 5 }); outcome = '政府宣布不干涉西班牙内战。'; }
    }

    if (eventId === 'anschluss-crisis') {
      if (choiceId === 'force-union') { adjust({ warSupport: 4, tension: 6 }); relation('AUT', -30); relation('FRA', -12); relation('UK', -8); outcome = '德国以政治和军事压力推动奥地利合并。'; }
      if (choiceId === 'negotiated-union') { adjust({ pp: -20, tension: 3 }); relation('AUT', 10); outcome = '德国试图通过公投和协商形式实现合并。'; }
      if (choiceId === 'respect-austrian-independence') { adjust({ pp: 10, stability: -2 }); relation('AUT', 15); outcome = '奥地利独立暂时得到尊重。'; }
      if (choiceId === 'resist-germany') { adjust({ stability: -3, warSupport: 8 }); relation('GER', -30); outcome = '奥地利政府宣布维护国家独立并请求外部支持。'; }
      if (choiceId === 'accept-union') { country.alive = false; outcome = '奥地利政府接受合并安排，国家主权终结。'; }
    }

    if (eventId === 'sudeten-crisis') {
      if (choiceId === 'firm-position') { adjust({ warSupport: 4, tension: 3 }); relation(this.player === 'GER' ? 'CZE' : 'GER', -20); outcome = '各方采取强硬立场，边境部队进入高度戒备。'; }
      if (choiceId === 'conference') { adjust({ pp: -15, tension: -1 }); outcome = '多国会议开始，短期战争风险下降，但捷克斯洛伐克安全受到压力。'; }
      if (choiceId === 'avoid-involvement') { adjust({ stability: 1 }); outcome = '政府避免直接承担军事义务，盟友信任下降。'; }
    }

    if (eventId === 'molotov-ribbentrop') {
      if (choiceId === 'sign-pact') { adjust({ tension: 4 }); this.setRelation('GER', 'USSR', 45); this.treaties[this.pair('GER', 'USSR')] = { type: '互不侵犯条约', date: this.date, secretProtocol: true }; if (this.countries.POL) { this.setRelation('GER', 'POL', this.relation('GER', 'POL') - 15); this.setRelation('USSR', 'POL', this.relation('USSR', 'POL') - 15); } outcome = '德苏签署互不侵犯条约，并秘密划分东欧利益范围。'; }
      if (choiceId === 'reject-pact') { adjust({ warSupport: 3 }); this.setRelation('GER', 'USSR', this.relation('GER', 'USSR') - 15); outcome = '互不侵犯谈判破裂，德国与苏联继续相互戒备。'; }
    }

    if (eventId === 'poland-crisis') {
      if (choiceId === 'mobilize') { adjust({ manpower: 80, stability: -2, warSupport: 6, tension: 2 }); outcome = '全国动员令发布，欧洲战争风险急剧上升。'; }
      if (choiceId === 'last-negotiation') { adjust({ pp: -20, tension: -1 }); outcome = '最后外交谈判开始，但各方军事部署仍在继续。'; }
      if (choiceId === 'remain-neutral') { adjust({ stability: 2 }); outcome = '政府保持中立姿态，但盟友对其承诺产生怀疑。'; }
    }

    if (choiceId === 'observe') { adjust({ pp: 5 }); outcome = '政府保持观望，等待局势进一步明朗。'; }
    if (!outcome) outcome = '国家已经作出选择。';
    return { ok: true, outcome };
  };

  proto.resolveStrategicEvent = function resolveStrategicEvent(eventId, choiceId, automatic = false) {
    const timeline = this.ensureStrategicTimeline();
    const index = timeline.pending.findIndex(item => item.id === eventId);
    if (index < 0) return { ok: false, reason: '该事件当前不需要决策' };
    const pending = timeline.pending[index];
    const choice = pending.choices.find(item => item.id === choiceId);
    if (!choice) return { ok: false, reason: '事件选项无效' };
    const result = this.applyStrategicChoice(eventId, choiceId);
    if (!result.ok) return result;
    timeline.pending.splice(index, 1);
    timeline.resolved[eventId] = { date: this.date, choiceId, title: choice.title, outcome: result.outcome, automatic };
    timeline.history.unshift({ eventId, title: pending.title, date: this.date, choice: choice.title, outcome: result.outcome, automatic });
    this.logEvent(`${pending.title}——${choice.title}：${result.outcome}`, automatic ? '' : 'good');
    this.pushAlert('事件结果', `${pending.title}：${result.outcome}`, this.nearestProvinceByCoordinate(pending.location)?.id || null, automatic ? 'info' : 'success');
    if (!timeline.pending.length) {
      this.__userPaused = false;
      this.setSpeed(timeline.resumeSpeed || 1);
    }
    return { ok: true, outcome: result.outcome };
  };

  proto.processStrategicTimeline = function processStrategicTimeline() {
    const timeline = this.ensureStrategicTimeline();
    for (const definition of STRATEGIC_TIMELINE) {
      if (timeline.resolved[definition.id]) continue;
      const remaining = daysUntil(this.date, definition.date);
      for (const threshold of definition.warningDays || []) {
        const warningKey = `${definition.id}:${threshold}`;
        if (remaining <= threshold && remaining > 0 && !timeline.warned[warningKey]) {
          timeline.warned[warningKey] = true;
          this.pushAlert('事件预警', `${definition.title}预计在${remaining}天内进入关键阶段。可能影响：${definition.summary}`, this.nearestProvinceByCoordinate(definition.location)?.id || null, remaining <= 7 ? 'danger' : 'info');
        }
      }
      if (remaining <= 0 && !timeline.queued[definition.id]) this.queueStrategicEvent(definition);
    }
    for (const pending of [...timeline.pending]) {
      if (daysUntil(this.date, pending.deadline) < 0) {
        const fallback = pending.choices.find(choice => choice.default) || pending.choices[pending.choices.length - 1];
        this.resolveStrategicEvent(pending.id, fallback.id, true);
      }
    }
    for (const [pair, partnership] of Object.entries(this.economicPartnerships)) {
      if (this.day < partnership.expiresDay) continue;
      for (const code of partnership.participants || []) {
        const participant = this.countries[code];
        if (participant) participant.modifiers.construction = Math.max(0, participant.modifiers.construction - 0.02);
      }
      delete this.economicPartnerships[pair];
    }
  };

  proto.getStrategicMapEvents = function getStrategicMapEvents() {
    const timeline = this.ensureStrategicTimeline();
    const result = timeline.pending.map(event => ({ id: event.id, title: event.title, location: event.location, state: 'pending', text: `等待国家决策，截止${event.deadline}` }));
    for (const definition of STRATEGIC_TIMELINE) {
      const remaining = daysUntil(this.date, definition.date);
      if (remaining > 0 && remaining <= 30 && !timeline.resolved[definition.id]) result.push({ id: `warning-${definition.id}`, title: definition.title, location: definition.location, state: 'warning', text: `预计${remaining}天后进入关键阶段` });
    }
    if (this.civilWars?.spain && !this.civilWars.spain.resolved) result.push({ id: 'spanish-war-active', title: '西班牙内战', location: [-3.7, 40.2], state: 'war', text: '共和国与国民军控制区持续变化' });
    return result;
  };

  proto.processDynamicHistoricalEvents = function processDynamicHistoricalEventsV431() {
    this.dynamicEvents ??= {};
    if (this.date >= '1936-07-18' && !this.dynamicEvents.spanishCivilWar) {
      this.dynamicEvents.spanishCivilWar = true;
      this.startSpanishCivilWar();
      if (this.civilWars?.spain) this.civilWars.spain.nationalist.code = 'ESP_N';
    }
    this.processSpanishCivilWar();
    this.processStrategicTimeline();
  };

  const previousLoad = IronCrownV4.load;
  IronCrownV4.load = function loadV431() {
    const loaded = previousLoad.call(this);
    if (!loaded) return null;
    loaded.ensureStrategicTimeline();
    loaded.tradeAgreements ??= [];
    loaded.embargoes ??= {};
    loaded.economicPartnerships ??= {};
    for (const country of Object.values(loaded.countries)) {
      country.tradePartners ??= {};
      country.embargoes ??= {};
      country.strategicModifiers ??= { intelligence: 0, radar: 0, airEfficiency: 0, navalReadiness: 0 };
    }
    return loaded;
  };
})();
