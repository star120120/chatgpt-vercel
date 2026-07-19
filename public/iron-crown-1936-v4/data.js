'use strict';

const V4_VERSION = '4.0.0-beta.1';
const MAP_BASE = '../iron-crown-1936-v3/geo';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const deepClone = value => JSON.parse(JSON.stringify(value));
const fmt = value => Math.round(value).toLocaleString('zh-CN');
const fmtK = value => `${Math.round(value)}K`;
const hash = text => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const seeded = (seed, min = 0, max = 1) => min + ((hash(seed) % 100000) / 100000) * (max - min);

const COUNTRY_DEFS = {
  GER: { name: '德意志国', short: '德国', color: '#7f897f', capital: [13.405, 52.52], iso: ['DEU', 'POL'], aliases: ['Germany', 'German Empire', 'German Reich', 'East Prussia'], ideology: '威权主义', population: 67, manpower: 800, civ: 38, mil: 27, dockyard: 8, admin: 65, researchSlots: 3, army: 41, air: 1450, navy: 55, resources: { steel: 84, aluminium: 12, rubber: 0, oil: 3, tungsten: 5, chromium: 2 }, generals: ['曼施坦因', '古德里安', '龙德施泰特', '博克'] },
  FRA: { name: '法兰西共和国', short: '法国', color: '#5c82b5', capital: [2.3522, 48.8566], iso: ['FRA'], aliases: ['France', 'French Republic'], ideology: '民主主义', population: 41.5, manpower: 610, civ: 31, mil: 19, dockyard: 12, admin: 72, researchSlots: 3, army: 44, air: 1200, navy: 70, resources: { steel: 48, aluminium: 36, rubber: 0, oil: 1, tungsten: 4, chromium: 1 }, generals: ['甘末林', '魏刚', '戴高乐', '朱安'] },
  UK: { name: '大不列颠及北爱尔兰联合王国', short: '英国', color: '#b56b6b', capital: [-0.1276, 51.5072], iso: ['GBR'], aliases: ['United Kingdom', 'Great Britain', 'British Empire'], ideology: '民主主义', population: 47, manpower: 420, civ: 42, mil: 18, dockyard: 28, admin: 78, researchSlots: 4, army: 18, air: 1750, navy: 150, resources: { steel: 25, aluminium: 18, rubber: 4, oil: 2, tungsten: 2, chromium: 1 }, generals: ['蒙哥马利', '亚历山大', '韦维尔', '艾恩赛德'] },
  USSR: { name: '苏维埃社会主义共和国联盟', short: '苏联', color: '#b94d4d', capital: [37.6173, 55.7558], iso: ['RUS', 'UKR', 'BLR', 'GEO', 'ARM', 'AZE'], aliases: ['Soviet Union', 'USSR', 'Russia', 'Russian Empire', 'Ukraine', 'Belarus', 'Georgia', 'Armenia', 'Azerbaijan'], ideology: '共产主义', population: 168, manpower: 2300, civ: 48, mil: 40, dockyard: 10, admin: 62, researchSlots: 3, army: 100, air: 3200, navy: 60, resources: { steel: 160, aluminium: 42, rubber: 0, oil: 82, tungsten: 22, chromium: 18 }, generals: ['朱可夫', '科涅夫', '罗科索夫斯基', '铁木辛哥'] },
  ITA: { name: '意大利王国', short: '意大利', color: '#6d9a73', capital: [12.4964, 41.9028], iso: ['ITA'], aliases: ['Italy', 'Kingdom of Italy'], ideology: '威权主义', population: 43, manpower: 720, civ: 23, mil: 17, dockyard: 15, admin: 58, researchSlots: 3, army: 40, air: 1200, navy: 95, resources: { steel: 18, aluminium: 10, rubber: 0, oil: 0, tungsten: 3, chromium: 1 }, generals: ['巴多格里奥', '格拉齐亚尼', '梅塞', '巴尔博'] },
  POL: { name: '波兰共和国', short: '波兰', color: '#d4aeb7', capital: [21.0122, 52.2297], iso: ['POL'], aliases: ['Poland', 'Polish Republic'], ideology: '威权民主', population: 35.1, manpower: 670, civ: 18, mil: 13, dockyard: 3, admin: 60, researchSlots: 2, army: 31, air: 700, navy: 20, resources: { steel: 26, aluminium: 3, rubber: 0, oil: 4, tungsten: 1, chromium: 0 }, generals: ['雷兹-希米格维', '库特热巴', '安德斯', '西科尔斯基'] },
  ESP: { name: '西班牙共和国', short: '西班牙', color: '#ca9f4d', capital: [-3.7038, 40.4168], iso: ['ESP'], aliases: ['Spain', 'Spanish State', 'Spanish Republic'], ideology: '民主主义', population: 24.6, manpower: 420, civ: 14, mil: 8, dockyard: 7, admin: 49, researchSlots: 2, army: 18, air: 430, navy: 35, resources: { steel: 16, aluminium: 5, rubber: 0, oil: 0, tungsten: 18, chromium: 0 }, generals: ['米亚哈', '罗霍', '莫拉', '弗朗哥'] },
  TUR: { name: '土耳其共和国', short: '土耳其', color: '#aa5a55', capital: [32.8597, 39.9334], iso: ['TUR'], aliases: ['Turkey', 'Turkish Republic'], ideology: '共和主义', population: 16.2, manpower: 410, civ: 12, mil: 7, dockyard: 5, admin: 55, researchSlots: 2, army: 20, air: 350, navy: 25, resources: { steel: 14, aluminium: 2, rubber: 0, oil: 1, tungsten: 2, chromium: 24 }, generals: ['恰克马克', '奥尔拜', '奥尔贡', '亚尔钦'] },
  CZE: { name: '捷克斯洛伐克共和国', short: '捷克斯洛伐克', color: '#789b80', capital: [14.4378, 50.0755], iso: ['CZE', 'SVK'], aliases: ['Czechoslovakia'], ideology: '民主主义', population: 15.3, manpower: 350, civ: 18, mil: 12, dockyard: 0, admin: 68, researchSlots: 3, army: 18, air: 420, navy: 0, resources: { steel: 30, aluminium: 4, rubber: 0, oil: 0, tungsten: 3, chromium: 1 }, generals: ['克赖奇', '英格尔', '卢扎'], },
  AUT: { name: '奥地利联邦国', short: '奥地利', color: '#b56d70', capital: [16.3738, 48.2082], iso: ['AUT'], aliases: ['Austria'], ideology: '威权主义', population: 6.8, manpower: 120, civ: 8, mil: 5, dockyard: 0, admin: 61, researchSlots: 2, army: 7, air: 120, navy: 0, resources: { steel: 6, aluminium: 3, rubber: 0, oil: 0, tungsten: 2, chromium: 0 }, generals: ['延绍夫斯基', '拜尔'], },
  HUN: { name: '匈牙利王国', short: '匈牙利', color: '#9b8068', capital: [19.0402, 47.4979], iso: ['HUN'], aliases: ['Hungary', 'Kingdom of Hungary'], ideology: '摄政王国', population: 9, manpower: 190, civ: 9, mil: 6, dockyard: 0, admin: 56, researchSlots: 2, army: 9, air: 180, navy: 0, resources: { steel: 5, aluminium: 8, rubber: 0, oil: 3, tungsten: 2, chromium: 0 }, generals: ['洪沃德', '索姆鲍特海伊'], },
  ROM: { name: '罗马尼亚王国', short: '罗马尼亚', color: '#c2a94d', capital: [26.1025, 44.4268], iso: ['ROU', 'MDA'], aliases: ['Romania', 'Kingdom of Romania'], ideology: '君主制', population: 19.9, manpower: 410, civ: 14, mil: 9, dockyard: 2, admin: 54, researchSlots: 2, army: 15, air: 360, navy: 10, resources: { steel: 10, aluminium: 2, rubber: 0, oil: 38, tungsten: 0, chromium: 0 }, generals: ['安东内斯库', '杜米特雷斯库'], },
  YUG: { name: '南斯拉夫王国', short: '南斯拉夫', color: '#778e79', capital: [20.4489, 44.7866], iso: ['SRB', 'HRV', 'SVN', 'BIH', 'MKD', 'MNE'], aliases: ['Yugoslavia', 'Kingdom of Yugoslavia'], ideology: '君主制', population: 15.8, manpower: 330, civ: 12, mil: 7, dockyard: 2, admin: 50, researchSlots: 2, army: 16, air: 250, navy: 18, resources: { steel: 12, aluminium: 9, rubber: 0, oil: 0, tungsten: 1, chromium: 9 }, generals: ['西莫维奇', '内迪奇'], },
  GRE: { name: '希腊王国', short: '希腊', color: '#6b91bd', capital: [23.7275, 37.9838], iso: ['GRC'], aliases: ['Greece', 'Kingdom of Greece'], ideology: '君主制', population: 7.1, manpower: 190, civ: 8, mil: 5, dockyard: 3, admin: 52, researchSlots: 2, army: 10, air: 140, navy: 18, resources: { steel: 3, aluminium: 6, rubber: 0, oil: 0, tungsten: 0, chromium: 8 }, generals: ['帕帕戈斯', '齐米卡利斯'], },
  BEL: { name: '比利时王国', short: '比利时', color: '#b99450', capital: [4.3517, 50.8503], iso: ['BEL'], aliases: ['Belgium', 'Kingdom of Belgium'], ideology: '民主主义', population: 8.3, manpower: 150, civ: 11, mil: 6, dockyard: 1, admin: 70, researchSlots: 2, army: 8, air: 120, navy: 4, resources: { steel: 18, aluminium: 0, rubber: 0, oil: 0, tungsten: 0, chromium: 0 }, generals: ['范奥弗斯特拉滕', '米沙埃利斯'], },
  NLD: { name: '荷兰王国', short: '荷兰', color: '#ca8352', capital: [4.9041, 52.3676], iso: ['NLD'], aliases: ['Netherlands', 'Kingdom of the Netherlands'], ideology: '民主主义', population: 8.5, manpower: 140, civ: 12, mil: 5, dockyard: 4, admin: 74, researchSlots: 2, army: 7, air: 110, navy: 25, resources: { steel: 3, aluminium: 1, rubber: 8, oil: 6, tungsten: 0, chromium: 0 }, generals: ['温克尔曼', '赫尔弗里希'], },
  CHE: { name: '瑞士联邦', short: '瑞士', color: '#b46767', capital: [7.4474, 46.948], iso: ['CHE'], aliases: ['Switzerland', 'Swiss Confederation'], ideology: '民主主义', population: 4.2, manpower: 150, civ: 9, mil: 5, dockyard: 0, admin: 85, researchSlots: 3, army: 8, air: 90, navy: 0, resources: { steel: 2, aluminium: 4, rubber: 0, oil: 0, tungsten: 0, chromium: 0 }, generals: ['吉桑', '维勒'], },
  POR: { name: '葡萄牙共和国', short: '葡萄牙', color: '#5f8b71', capital: [-9.1393, 38.7223], iso: ['PRT'], aliases: ['Portugal', 'Portuguese Republic'], ideology: '威权主义', population: 7.3, manpower: 150, civ: 8, mil: 4, dockyard: 3, admin: 62, researchSlots: 2, army: 6, air: 100, navy: 18, resources: { steel: 3, aluminium: 0, rubber: 0, oil: 0, tungsten: 18, chromium: 0 }, generals: ['卡莫纳', '圣托斯'], },
  BUL: { name: '保加利亚王国', short: '保加利亚', color: '#71905e', capital: [23.3219, 42.6977], iso: ['BGR'], aliases: ['Bulgaria', 'Kingdom of Bulgaria'], ideology: '君主制', population: 6.1, manpower: 145, civ: 7, mil: 4, dockyard: 1, admin: 53, researchSlots: 2, army: 7, air: 100, navy: 5, resources: { steel: 2, aluminium: 1, rubber: 0, oil: 0, tungsten: 1, chromium: 2 }, generals: ['卢科夫', '米霍夫'], },
  FIN: { name: '芬兰共和国', short: '芬兰', color: '#8ba5bd', capital: [24.9384, 60.1699], iso: ['FIN'], aliases: ['Finland', 'Finnish Republic'], ideology: '民主主义', population: 3.6, manpower: 140, civ: 7, mil: 5, dockyard: 1, admin: 73, researchSlots: 2, army: 8, air: 160, navy: 12, resources: { steel: 7, aluminium: 0, rubber: 0, oil: 0, tungsten: 0, chromium: 4 }, generals: ['曼纳海姆', '海因里希斯'], },
  SWE: { name: '瑞典王国', short: '瑞典', color: '#c2aa59', capital: [18.0686, 59.3293], iso: ['SWE'], aliases: ['Sweden', 'Kingdom of Sweden'], ideology: '民主主义', population: 6.3, manpower: 130, civ: 12, mil: 7, dockyard: 3, admin: 82, researchSlots: 3, army: 7, air: 190, navy: 30, resources: { steel: 48, aluminium: 0, rubber: 0, oil: 0, tungsten: 8, chromium: 5 }, generals: ['尤恩格', '西尔弗斯基尔德'], },
  NOR: { name: '挪威王国', short: '挪威', color: '#7791a8', capital: [10.7522, 59.9139], iso: ['NOR'], aliases: ['Norway', 'Kingdom of Norway'], ideology: '民主主义', population: 2.9, manpower: 70, civ: 6, mil: 3, dockyard: 2, admin: 76, researchSlots: 2, army: 4, air: 70, navy: 15, resources: { steel: 6, aluminium: 12, rubber: 0, oil: 0, tungsten: 0, chromium: 0 }, generals: ['鲁格', '迪森'], },
  DEN: { name: '丹麦王国', short: '丹麦', color: '#a96c6d', capital: [12.5683, 55.6761], iso: ['DNK'], aliases: ['Denmark', 'Kingdom of Denmark'], ideology: '民主主义', population: 3.7, manpower: 70, civ: 7, mil: 3, dockyard: 2, admin: 78, researchSlots: 2, army: 4, air: 60, navy: 12, resources: { steel: 1, aluminium: 0, rubber: 0, oil: 0, tungsten: 0, chromium: 0 }, generals: ['普里奥尔', '雷希策'], },
  EST: { name: '爱沙尼亚共和国', short: '爱沙尼亚', color: '#7f98a7', capital: [24.7536, 59.437], iso: ['EST'], aliases: ['Estonia'], ideology: '威权民主', population: 1.1, manpower: 45, civ: 3, mil: 2, dockyard: 0, admin: 59, researchSlots: 1, army: 3, air: 30, navy: 4, resources: { steel: 1, aluminium: 0, rubber: 0, oil: 5, tungsten: 0, chromium: 0 }, generals: ['莱多纳', '雷克'], },
  LAT: { name: '拉脱维亚共和国', short: '拉脱维亚', color: '#9a6d77', capital: [24.1052, 56.9496], iso: ['LVA'], aliases: ['Latvia'], ideology: '威权民主', population: 2, manpower: 65, civ: 4, mil: 2, dockyard: 0, admin: 57, researchSlots: 1, army: 4, air: 35, navy: 4, resources: { steel: 1, aluminium: 0, rubber: 0, oil: 0, tungsten: 0, chromium: 0 }, generals: ['巴洛迪斯', '贝尔基斯'], },
  LTU: { name: '立陶宛共和国', short: '立陶宛', color: '#9b8e59', capital: [25.2797, 54.6872], iso: ['LTU'], aliases: ['Lithuania'], ideology: '威权民主', population: 2.5, manpower: 75, civ: 4, mil: 2, dockyard: 0, admin: 56, researchSlots: 1, army: 4, air: 35, navy: 3, resources: { steel: 1, aluminium: 0, rubber: 0, oil: 0, tungsten: 0, chromium: 0 }, generals: ['拉什蒂基斯', '雷克莱蒂斯'], },
  IRL: { name: '爱尔兰自由邦', short: '爱尔兰', color: '#5b9272', capital: [-6.2603, 53.3498], iso: ['IRL'], aliases: ['Ireland', 'Irish Free State'], ideology: '民主主义', population: 3, manpower: 60, civ: 5, mil: 2, dockyard: 0, admin: 69, researchSlots: 1, army: 2, air: 20, navy: 1, resources: { steel: 0, aluminium: 0, rubber: 0, oil: 0, tungsten: 0, chromium: 0 }, generals: ['布伦南', '麦克纳利'], },
  ALB: { name: '阿尔巴尼亚王国', short: '阿尔巴尼亚', color: '#8e756c', capital: [19.8187, 41.3275], iso: ['ALB'], aliases: ['Albania'], ideology: '君主制', population: 1, manpower: 35, civ: 2, mil: 1, dockyard: 0, admin: 42, researchSlots: 1, army: 2, air: 10, navy: 1, resources: { steel: 1, aluminium: 0, rubber: 0, oil: 2, tungsten: 0, chromium: 3 }, generals: ['阿拉尼蒂', '佩尔梅蒂'], },
  LUX: { name: '卢森堡大公国', short: '卢森堡', color: '#83a4b8', capital: [6.1319, 49.6116], iso: ['LUX'], aliases: ['Luxembourg'], ideology: '民主主义', population: 0.3, manpower: 8, civ: 2, mil: 0, dockyard: 0, admin: 75, researchSlots: 1, army: 0, air: 0, navy: 0, resources: { steel: 4, aluminium: 0, rubber: 0, oil: 0, tungsten: 0, chromium: 0 }, generals: ['斯佩勒'], },
};

const PLAYABLE = ['GER', 'FRA', 'UK', 'USSR', 'ITA', 'POL', 'ESP', 'TUR'];

const REGION_TRANSLATIONS = {
  England: '英格兰', Scotland: '苏格兰', Wales: '威尔士', 'Northern Ireland': '北爱尔兰',
  Berlin: '柏林', Hamburg: '汉堡', Bremen: '不来梅', Bayern: '巴伐利亚', Bavaria: '巴伐利亚', Hessen: '黑森', Saxony: '萨克森', Sachsen: '萨克森', Brandenburg: '勃兰登堡', Thüringen: '图林根', Thuringia: '图林根', 'Schleswig-Holstein': '石勒苏益格-荷尔斯泰因', 'Nordrhein-Westfalen': '北莱茵-威斯特法伦', 'Baden-Württemberg': '巴登-符腾堡', Niedersachsen: '下萨克森', 'Mecklenburg-Vorpommern': '梅克伦堡-前波美拉尼亚', Saarland: '萨尔', 'Rheinland-Pfalz': '莱茵兰-普法尔茨',
  Bretagne: '布列塔尼', Normandie: '诺曼底', 'Île-de-France': '法兰西岛', 'Hauts-de-France': '上法兰西', 'Grand Est': '大东部', 'Pays de la Loire': '卢瓦尔河地区', 'Centre-Val de Loire': '中央-卢瓦尔河谷', 'Bourgogne-Franche-Comté': '勃艮第-弗朗什-孔泰', 'Nouvelle-Aquitaine': '新阿基坦', Occitanie: '奥克西塔尼', 'Auvergne-Rhône-Alpes': '奥弗涅-罗讷-阿尔卑斯', "Provence-Alpes-Côte d'Azur": '普罗旺斯-阿尔卑斯-蓝色海岸', Corse: '科西嘉',
  Lombardia: '伦巴第', Piemonte: '皮埃蒙特', Veneto: '威尼托', Toscana: '托斯卡纳', Lazio: '拉齐奥', Sicilia: '西西里', Sardegna: '撒丁', Campania: '坎帕尼亚', Liguria: '利古里亚', 'Emilia-Romagna': '艾米利亚-罗马涅',
  Cataluña: '加泰罗尼亚', Catalunya: '加泰罗尼亚', Andalucía: '安达卢西亚', Galicia: '加利西亚', Madrid: '马德里', Aragón: '阿拉贡', Valencia: '瓦伦西亚', 'Castilla y León': '卡斯蒂利亚-莱昂', 'Castilla-La Mancha': '卡斯蒂利亚-拉曼恰',
  Mazowieckie: '马佐夫舍', Małopolskie: '小波兰', Wielkopolskie: '大波兰', Śląskie: '西里西亚', Pomorskie: '波美拉尼亚', 'Zachodniopomorskie': '西波美拉尼亚', Lubuskie: '卢布斯卡', Łódzkie: '罗兹', Lubelskie: '卢布林', Podlaskie: '波德拉谢', Podkarpackie: '喀尔巴阡山省',
  Wien: '维也纳', Tirol: '蒂罗尔', Vorarlberg: '福拉尔贝格', Salzburg: '萨尔茨堡', Steiermark: '施蒂利亚', Kärnten: '克恩顿',
  Moscow: '莫斯科', Moskva: '莫斯科', Kyiv: '基辅', Kiev: '基辅', Minsk: '明斯克', Leningrad: '列宁格勒', Kaliningrad: '加里宁格勒',
};

const RESOURCE_NAMES = { steel: '钢铁', aluminium: '铝', rubber: '橡胶', oil: '石油', tungsten: '钨', chromium: '铬' };

const LAND_EQUIPMENT = {
  infantry_equipment: { name: '步兵装备', category: '陆军', base: 115, resources: { steel: 2 } },
  support_equipment: { name: '支援装备', category: '陆军', base: 24, resources: { steel: 1, aluminium: 1 } },
  artillery: { name: '牵引火炮', category: '陆军', base: 8, resources: { steel: 3, tungsten: 1 } },
  anti_tank: { name: '反坦克炮', category: '陆军', base: 5, resources: { steel: 2, tungsten: 2 } },
  truck: { name: '军用卡车', category: '陆军', base: 22, resources: { steel: 1, rubber: 1, oil: 1 } },
  light_tank: { name: '轻型坦克', category: '装甲', base: 4.8, resources: { steel: 3, oil: 1 } },
  medium_tank: { name: '中型坦克', category: '装甲', base: 2.9, resources: { steel: 4, tungsten: 1, oil: 1 } },
  heavy_tank: { name: '重型坦克', category: '装甲', base: 1.5, resources: { steel: 5, chromium: 2, oil: 1 } },
  fighter: { name: '战斗机', category: '空军', base: 3.1, resources: { aluminium: 3, rubber: 1, oil: 1 } },
  cas: { name: '近距支援机', category: '空军', base: 2.5, resources: { aluminium: 3, rubber: 1, oil: 1 } },
  tactical_bomber: { name: '战术轰炸机', category: '空军', base: 1.7, resources: { aluminium: 4, rubber: 1, oil: 1 } },
  strategic_bomber: { name: '战略轰炸机', category: '空军', base: 0.9, resources: { aluminium: 5, rubber: 2, oil: 1 } },
};

const NAVAL_EQUIPMENT = {
  destroyer: { name: '驱逐舰', category: '海军', base: 0.055, resources: { steel: 3, oil: 1 } },
  light_cruiser: { name: '轻巡洋舰', category: '海军', base: 0.025, resources: { steel: 5, aluminium: 1, oil: 1 } },
  heavy_cruiser: { name: '重巡洋舰', category: '海军', base: 0.016, resources: { steel: 7, chromium: 1, oil: 1 } },
  submarine: { name: '潜艇', category: '海军', base: 0.045, resources: { steel: 3, oil: 1 } },
  battleship: { name: '战列舰', category: '海军', base: 0.006, resources: { steel: 10, chromium: 3, oil: 2 } },
  carrier: { name: '航空母舰', category: '海军', base: 0.004, resources: { steel: 9, aluminium: 3, chromium: 2, oil: 2 } },
};

const DIVISION_TEMPLATES = {
  infantry: { name: '标准步兵师', battalions: { infantry: 9, artillery: 1 }, support: ['工兵连', '侦察连', '炮兵支援连'], manpower: 12000, width: 21, attack: 32, defense: 48, breakthrough: 10, speed: 4, supply: 1.25, fuel: 0, equipment: { infantry_equipment: 9000, support_equipment: 650, artillery: 48, truck: 180 } },
  motorized: { name: '摩托化步兵师', battalions: { motorized: 9, artillery: 1 }, support: ['工兵连', '侦察连', '后勤连'], manpower: 12000, width: 21, attack: 42, defense: 37, breakthrough: 27, speed: 8, supply: 2.05, fuel: 11, equipment: { infantry_equipment: 8500, support_equipment: 700, artillery: 48, truck: 1250 } },
  light_armor: { name: '轻型装甲师', battalions: { light_tank: 5, motorized: 4 }, support: ['工兵连', '侦察连', '维修连', '后勤连'], manpower: 10500, width: 22, attack: 58, defense: 31, breakthrough: 68, speed: 9, supply: 3, fuel: 25, equipment: { infantry_equipment: 4000, support_equipment: 850, truck: 900, light_tank: 280 } },
  medium_armor: { name: '中型装甲师', battalions: { medium_tank: 6, motorized: 3 }, support: ['工兵连', '侦察连', '维修连', '后勤连'], manpower: 10800, width: 24, attack: 76, defense: 38, breakthrough: 92, speed: 8, supply: 3.6, fuel: 31, equipment: { infantry_equipment: 3600, support_equipment: 900, truck: 850, medium_tank: 300 } },
  mountain: { name: '山地步兵师', battalions: { mountain: 9 }, support: ['工兵连', '侦察连', '医疗连'], manpower: 11000, width: 18, attack: 35, defense: 55, breakthrough: 13, speed: 4, supply: 1.05, fuel: 0, equipment: { infantry_equipment: 8300, support_equipment: 620, artillery: 24, truck: 120 } },
};

const TERRAIN = {
  plains: { name: '平原', width: 90, attack: 0, defense: 0, supply: 1 },
  forest: { name: '森林', width: 72, attack: -0.14, defense: 0.14, supply: 0.9 },
  hills: { name: '丘陵', width: 66, attack: -0.18, defense: 0.18, supply: 0.86 },
  mountain: { name: '山地', width: 50, attack: -0.35, defense: 0.38, supply: 0.7 },
  urban: { name: '城市', width: 80, attack: -0.22, defense: 0.3, supply: 1.1 },
  marsh: { name: '沼泽', width: 56, attack: -0.3, defense: 0.22, supply: 0.65 },
  desert: { name: '荒漠', width: 80, attack: -0.08, defense: 0.02, supply: 0.75 },
  jungle: { name: '丛林', width: 54, attack: -0.28, defense: 0.24, supply: 0.62 },
};

const RESEARCH_TREE = {
  industry: [
    { id: 'machine_tools_1', name: '基础机床', year: 1936, cost: 120, effect: '生产效率上限 +10%' },
    { id: 'construction_1', name: '建筑技术 I', year: 1936, cost: 130, effect: '建设速度 +10%' },
    { id: 'resource_extraction_1', name: '资源开采 I', year: 1936, cost: 130, effect: '资源产出 +10%' },
    { id: 'machine_tools_2', name: '改进机床', year: 1937, cost: 165, requires: 'machine_tools_1', effect: '生产效率增长 +10%' },
  ],
  army: [
    { id: 'infantry_weapons_1', name: '改进型步兵装备', year: 1936, cost: 120, effect: '步兵攻防 +8%' },
    { id: 'artillery_1', name: '改进型火炮', year: 1936, cost: 135, effect: '火炮攻击 +10%' },
    { id: 'support_company_1', name: '专业支援连', year: 1936, cost: 140, effect: '组织度与补给效率 +5%' },
    { id: 'medium_tank_chassis', name: '中型坦克底盘', year: 1938, cost: 195, requires: 'infantry_weapons_1', effect: '解锁中型装甲师' },
  ],
  air: [
    { id: 'fighter_1', name: '战斗机改进', year: 1936, cost: 135, effect: '制空效率 +8%' },
    { id: 'cas_1', name: '近距支援学说', year: 1936, cost: 145, effect: '地面支援 +10%' },
    { id: 'radar_1', name: '无线电探测', year: 1936, cost: 150, effect: '空情侦察 +10%' },
  ],
  navy: [
    { id: 'destroyer_1', name: '现代驱逐舰', year: 1936, cost: 135, effect: '护航效率 +10%' },
    { id: 'submarine_1', name: '远洋潜艇', year: 1936, cost: 145, effect: '袭击运输线 +10%' },
    { id: 'carrier_1', name: '航母作战理论', year: 1937, cost: 180, effect: '舰载航空效率 +12%' },
  ],
  doctrine: [
    { id: 'mobile_warfare', name: '机动作战', year: 1936, cost: 185, effect: '装甲突破 +12%' },
    { id: 'superior_firepower', name: '优势火力', year: 1936, cost: 185, effect: '火炮攻击 +12%' },
    { id: 'grand_battleplan', name: '大战略计划', year: 1936, cost: 185, effect: '堑壕与计划加成 +10%' },
    { id: 'mass_assault', name: '大规模突击', year: 1936, cost: 185, effect: '补给消耗 -8%' },
  ],
};

const POLICIES = [
  { id: 'industrial_plan', name: '国家工业计划', days: 120, cost: 70, effect: '民用工厂建设速度 +12%', key: 'construction' },
  { id: 'rearmament', name: '全面军备计划', days: 150, cost: 95, effect: '军用工厂产出 +10%', key: 'mil_output' },
  { id: 'administrative_reform', name: '行政体系改革', days: 100, cost: 60, effect: '行政点数增长 +20%', key: 'admin_gain' },
  { id: 'logistics_command', name: '国家后勤总署', days: 120, cost: 80, effect: '补给吞吐 +12%', key: 'supply' },
  { id: 'air_navy_coordination', name: '海空联合委员会', days: 140, cost: 90, effect: '海空任务效率 +10%', key: 'joint_ops' },
];

const DECISIONS = [
  { id: 'propaganda', name: '全国宣传动员', pp: 35, admin: 0, effect: '战争支持 +6%，稳定度 -1%' },
  { id: 'develop_core', name: '重点地区开发', pp: 20, admin: 35, effect: '所选省份发展度 +1' },
  { id: 'make_core', name: '推进核心化', pp: 50, admin: 80, effect: '提高非核心省份核心化进度' },
  { id: 'rail_emergency', name: '紧急铁路建设', pp: 25, admin: 30, effect: '所选省份铁路 +1' },
  { id: 'stability_program', name: '社会稳定计划', pp: 40, admin: 25, effect: '稳定度 +5%' },
];

const WEATHER_NAMES = { clear: '晴朗', rain: '降雨', mud: '泥泞', snow: '降雪', blizzard: '暴风雪' };
