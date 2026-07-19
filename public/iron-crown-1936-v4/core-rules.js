'use strict';

/**
 * V4.1 core rules: historical names, geographic restrictions and balance constants.
 * Loaded after data.js and before the map boots.
 */
const V41_VERSION = '4.1.0-beta.1';

const HISTORICAL_REGION_TRANSLATIONS = {
  // Germany and former German territories
  Berlin: '柏林首都区', Hamburg: '汉堡自由市', Bremen: '不来梅自由市',
  'Nordrhein-Westfalen': '莱茵-鲁尔工业区', 'Rheinland-Pfalz': '莱茵省', Saarland: '萨尔工业区',
  Niedersachsen: '汉诺威', 'Schleswig-Holstein': '石勒苏益格-荷尔斯泰因',
  'Mecklenburg-Vorpommern': '梅克伦堡与前波美拉尼亚', Brandenburg: '勃兰登堡',
  Sachsen: '萨克森', Saxony: '萨克森', Thüringen: '图林根', Thuringia: '图林根',
  Bayern: '巴伐利亚', Bavaria: '巴伐利亚', Hessen: '黑森',
  'Baden-Württemberg': '巴登与符腾堡',
  'Warmińsko-Mazurskie': '东普鲁士', 'Warminsko-Mazurskie': '东普鲁士',
  Dolnośląskie: '下西里西亚', Dolnoslaskie: '下西里西亚',
  Opolskie: '奥波伦西里西亚', Śląskie: '上西里西亚', Slaskie: '上西里西亚',
  Pomorskie: '波美拉尼亚', Zachodniopomorskie: '西波美拉尼亚',

  // Czechoslovakia: map modern ADM1 names into recognizable historical regions.
  Praha: '布拉格', 'Hlavní město Praha': '布拉格', Středočeský: '中波希米亚',
  'Středočeský kraj': '中波希米亚', Jihočeský: '南波希米亚', 'Jihočeský kraj': '南波希米亚',
  Plzeňský: '比尔森', 'Plzeňský kraj': '比尔森', Karlovarský: '卡尔斯巴德',
  'Karlovarský kraj': '卡尔斯巴德', Ústecký: '苏台德北部', 'Ústecký kraj': '苏台德北部',
  Liberecký: '苏台德东北部', 'Liberecký kraj': '苏台德东北部',
  Královéhradecký: '东波希米亚', Pardubický: '东波希米亚', Vysočina: '波希米亚-摩拉维亚高地',
  Jihomoravský: '南摩拉维亚', 'Jihomoravský kraj': '南摩拉维亚',
  Olomoucký: '中摩拉维亚', Zlínský: '东摩拉维亚', Moravskoslezský: '摩拉维亚-西里西亚',
  Bratislavský: '布拉迪斯拉发', Trnavský: '斯洛伐克西部', Trenčiansky: '斯洛伐克西北部',
  Nitriansky: '尼特拉', Žilinský: '斯洛伐克北部', Banskobystrický: '斯洛伐克中部',
  Prešovský: '斯洛伐克东部', Košický: '科希策',

  // Austria
  Wien: '维也纳', Niederösterreich: '下奥地利', Oberösterreich: '上奥地利',
  Burgenland: '布尔根兰', Steiermark: '施蒂利亚', Kärnten: '克恩顿', Salzburg: '萨尔茨堡',
  Tirol: '蒂罗尔', Vorarlberg: '福拉尔贝格',

  // Netherlands
  Zeeland: '泽兰省', 'Noord-Holland': '北荷兰省', 'Zuid-Holland': '南荷兰省',
  Friesland: '弗里斯兰省', Groningen: '格罗宁根省', Drenthe: '德伦特省',
  Overijssel: '上艾瑟尔省', Gelderland: '海尔德兰省', Utrecht: '乌得勒支省',
  'Noord-Brabant': '北布拉班特省', Limburg: '林堡省', Flevoland: '须德海圩田区',

  // Belgium
  Vlaanderen: '佛兰德', 'Vlaams Gewest': '佛兰德', Wallonie: '瓦隆', 'Région wallonne': '瓦隆',
  Bruxelles: '布鲁塞尔', 'Brussels Hoofdstedelijk Gewest': '布鲁塞尔',
  Antwerpen: '安特卫普', 'West-Vlaanderen': '西佛兰德', 'Oost-Vlaanderen': '东佛兰德',
  Hainaut: '埃诺', Liège: '列日', Namur: '那慕尔', Luxembourg: '卢森堡省', Brabant: '布拉班特',

  // Poland and borderlands
  Mazowieckie: '马佐夫舍', Małopolskie: '小波兰', Malopolskie: '小波兰',
  Wielkopolskie: '大波兰', Łódzkie: '罗兹', Lodzkie: '罗兹', Lubelskie: '卢布林',
  Podlaskie: '波德拉谢', Podkarpackie: '东加利西亚', 'Kujawsko-Pomorskie': '库亚维-波美拉尼亚',
  Świętokrzyskie: '圣十字地区', Swietokrzyskie: '圣十字地区',

  // France: replace modern mega-regions with historically readable geography.
  'Hauts-de-France': '法兰西北部', 'Grand Est': '阿尔萨斯-洛林与香槟',
  'Bourgogne-Franche-Comté': '勃艮第-弗朗什-孔泰',
  'Auvergne-Rhône-Alpes': '奥弗涅-罗讷-阿尔卑斯',
  'Centre-Val de Loire': '中央-卢瓦尔河谷', 'Pays de la Loire': '卢瓦尔河地区',
  'Nouvelle-Aquitaine': '阿基坦与利穆赞', Occitanie: '朗格多克-奥克西塔尼',
  "Provence-Alpes-Côte d'Azur": '普罗旺斯',

  // United Kingdom
  England: '英格兰', Scotland: '苏格兰', Wales: '威尔士', 'Northern Ireland': '北爱尔兰',
};
Object.assign(REGION_TRANSLATIONS, HISTORICAL_REGION_TRANSLATIONS);

// Raw materials shown in the map/economy layer. Iron ore and coal are separate from processed steel.
RESOURCE_NAMES.coal = '煤炭';
RESOURCE_NAMES.iron = '铁矿';
for (const country of Object.values(COUNTRY_DEFS)) {
  country.resources.coal ??= 0;
  country.resources.iron ??= 0;
}
Object.assign(COUNTRY_DEFS.GER.resources, {
  steel: 68,
  aluminium: 0,
  rubber: 0,
  oil: 0,
  tungsten: 3,
  chromium: 1,
  coal: 120,
  iron: 24,
});

const BUILDING_RULES = Object.freeze({
  civ: { name: '民用工厂', maxLevel: 12, usesSlots: true },
  mil: { name: '军用工厂', maxLevel: 12, usesSlots: true },
  dockyard: { name: '海军船坞', maxLevel: 10, usesSlots: true, requiresCoast: true },
  infrastructure: { name: '基础设施', maxLevel: 10 },
  rail: { name: '铁路', maxLevel: 5 },
  fort: { name: '陆上要塞', maxLevel: 10 },
  airBase: { name: '空军基地', maxLevel: 10 },
  navalBase: { name: '海军基地', maxLevel: 10, requiresCoast: true },
  supplyHub: { name: '补给枢纽', maxLevel: 1 },
});

const COASTAL_REGION_PATTERNS = [
  // Germany / Baltic / North Sea
  /schleswig|hamburg|bremen|niedersachsen|mecklenburg|vorpommern|pomorsk|pomeran|warmi|东普鲁士|波美拉尼亚|汉堡|不来梅|石勒苏益格/i,
  // UK and Ireland
  /england|scotland|wales|northern ireland|英格兰|苏格兰|威尔士|北爱尔兰/i,
  // Netherlands / Belgium
  /zeeland|noord-holland|zuid-holland|friesland|groningen|flevoland|antwerpen|west-vlaanderen|oost-vlaanderen|泽兰|北荷兰|南荷兰|弗里斯兰|格罗宁根|佛兰德/i,
  // France, Iberia, Italy
  /bretagne|normandie|hauts-de-france|pays de la loire|nouvelle-aquitaine|occitanie|provence|corse|galicia|asturias|cantabria|vasco|catalu|valencia|murcia|andaluc|algarve|lisboa|liguria|veneto|friuli|toscana|lazio|campania|puglia|calabria|sicil|sardegna/i,
  // Balkans / Nordics / Black Sea
  /dalmat|croat|sloven|montenegr|alban|greek|attica|macedon|thrace|istanbul|izmir|antalya|samsun|trabzon|constanța|dobru|varna|burgas|oslo|vestland|nordland|troms|stockholm|skåne|gotland|helsinki|uusimaa|turku|estonia|latvia|lithuania/i,
];

function detectCoastalProvince(mapProvince) {
  if (!mapProvince) return false;
  const label = `${mapProvince.sourceName || ''} ${mapProvince.name || ''}`;
  if (COASTAL_REGION_PATTERNS.some(pattern => pattern.test(label))) return true;
  const [lon, lat] = mapProvince.center || [0, 0];
  // Conservative geographic fallbacks. They intentionally avoid marking central Germany/Austria/Czechia coastal.
  if (mapProvince.owner === 'UK' || mapProvince.owner === 'IRL' || mapProvince.owner === 'DNK') return true;
  if (mapProvince.owner === 'NLD' && lon < 6.4) return true;
  if (mapProvince.owner === 'NOR' && lon < 22) return true;
  if (mapProvince.owner === 'ITA' && (lon < 10.2 || lon > 12.2 || lat < 42.2)) return true;
  return false;
}

const GERMAN_REGION_PROFILE = Object.freeze({
  berlin: {
    match: /berlin|柏林/i,
    resources: {},
    bonuses: { ppDaily: 0.08, researchSpeed: 0.05, militaryOutput: 0.05 },
    role: '政治与科研中心',
  },
  ruhr: {
    match: /nordrhein|westfalen|rheinland|鲁尔|莱茵省/i,
    resources: { coal: 62, iron: 13, steel: 38 },
    bonuses: { militaryOutput: 0.08, construction: 0.06 },
    role: '莱茵-鲁尔重工业核心',
  },
  saar: {
    match: /saar|萨尔/i,
    resources: { coal: 12, iron: 3, steel: 7 },
    bonuses: { militaryOutput: 0.03 },
    role: '萨尔煤钢工业区',
  },
  silesia: {
    match: /ślą|slask|siles|dolno|opol|西里西亚/i,
    resources: { coal: 32, iron: 8, steel: 18 },
    bonuses: { militaryOutput: 0.05 },
    role: '西里西亚煤钢工业区',
  },
  saxony: {
    match: /sachsen|saxony|萨克森/i,
    resources: { coal: 8, iron: 1, steel: 4 },
    bonuses: { researchSpeed: 0.02 },
    role: '萨克森机械与化学工业区',
  },
});
