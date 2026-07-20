'use strict';

/**
 * V4.3 map architecture.
 * - International borders: CShapes polygons valid in 1936 when the public service is reachable.
 * - Strategic regions: larger country-specific clusters, unioned and clipped inside historical borders.
 * - Small states: one or a few usable regions; no forced ADM1 fragmentation.
 */
(() => {
  const originalLoadAll = MapV4.loadAll.bind(MapV4);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CSHAPES_1936 = 'https://services1.arcgis.com/DIcffHalFljSYvfk/arcgis/rest/services/%C3%98ving_5_2_WFL1/FeatureServer/4/query?where=gwsyear%3C%3D1936%20AND%20gweyear%3E%3D1936&outFields=cntry_name%2Cgwsyear%2Cgweyear&returnGeometry=true&outSR=4326&f=geojson&resultRecordCount=1000';

  const REGION_ANCHORS = Object.freeze({
    GER: [
      ['石勒苏益格-荷尔斯泰因', 9.8, 54.4], ['汉诺威', 9.7, 52.4], ['莱茵-鲁尔', 7.2, 51.3],
      ['莱茵-萨尔', 7.0, 49.7], ['柏林-勃兰登堡', 13.4, 52.4], ['梅克伦堡-波美拉尼亚', 12.7, 53.7],
      ['萨克森', 13.2, 51.0], ['图林根', 11.0, 50.9], ['巴登-符腾堡', 9.0, 48.5],
      ['巴伐利亚', 11.5, 48.8], ['西里西亚', 17.0, 51.1], ['东普鲁士', 20.6, 54.2],
    ],
    FRA: [
      ['法兰西岛', 2.4, 48.8], ['诺曼底', 0.1, 49.1], ['布列塔尼', -3.1, 48.1], ['法兰西北部', 2.7, 50.2],
      ['阿尔萨斯-洛林', 6.5, 48.5], ['卢瓦尔河流域', 0.6, 47.1], ['勃艮第', 4.7, 47.0],
      ['阿基坦', -0.5, 44.7], ['奥弗涅-罗讷', 4.6, 45.5], ['朗格多克', 3.0, 43.7], ['普罗旺斯', 6.2, 43.8],
    ],
    UK: [
      ['英格兰东南部', 0.2, 51.4], ['英格兰西南部', -3.1, 50.9], ['英格兰中部', -1.5, 52.6],
      ['英格兰北部', -1.8, 54.7], ['威尔士', -3.6, 52.3], ['苏格兰低地', -3.8, 55.9],
      ['苏格兰高地', -4.7, 57.4], ['北爱尔兰', -6.7, 54.7],
    ],
    USSR: [
      ['白俄罗斯西部', 26.0, 53.5], ['白俄罗斯东部', 29.0, 53.7], ['乌克兰西部', 25.5, 49.0],
      ['基辅地区', 30.5, 50.3], ['乌克兰南部', 31.0, 47.0], ['敖德萨与黑海沿岸', 29.8, 45.8],
      ['列宁格勒地区', 30.3, 59.5], ['莫斯科地区', 37.5, 55.7], ['斯摩棱斯克', 32.0, 54.8],
      ['俄罗斯中部', 41.0, 54.0], ['顿河地区', 40.0, 48.5], ['高加索北部', 43.0, 44.0],
      ['外高加索', 45.0, 41.5], ['伏尔加西部', 47.0, 54.5],
    ],
    ITA: [
      ['皮埃蒙特-利古里亚', 8.2, 44.7], ['伦巴第', 9.7, 45.5], ['威尼托', 12.0, 45.5],
      ['艾米利亚-罗马涅', 11.1, 44.5], ['托斯卡纳', 11.1, 43.3], ['拉齐奥', 12.5, 41.9],
      ['意大利南部', 15.5, 40.3], ['西西里', 14.1, 37.5], ['撒丁', 9.0, 40.0],
    ],
    POL: [
      ['波美拉利亚', 18.2, 54.0], ['大波兰', 16.8, 52.3], ['马佐夫舍', 21.0, 52.3],
      ['小波兰', 20.1, 50.2], ['卢布林', 23.0, 51.1], ['波列西亚', 25.0, 52.2],
      ['沃里尼亚', 26.0, 50.3], ['东加利西亚', 24.0, 49.2], ['维尔诺地区', 25.3, 54.5],
    ],
    ESP: [
      ['加利西亚', -8.1, 42.8], ['卡斯蒂利亚-莱昂', -5.0, 41.7], ['马德里与新卡斯蒂利亚', -3.6, 40.1],
      ['巴斯克-纳瓦拉', -1.8, 42.8], ['阿拉贡-加泰罗尼亚', 0.8, 41.5], ['瓦伦西亚', -0.4, 39.4],
      ['埃斯特雷马杜拉', -6.2, 39.0], ['安达卢西亚', -4.7, 37.3],
    ],
    TUR: [
      ['东色雷斯', 28.7, 41.1], ['马尔马拉', 29.0, 39.8], ['爱琴海沿岸', 27.5, 38.2],
      ['安纳托利亚中部', 33.0, 39.0], ['黑海西部', 32.5, 41.2], ['黑海东部', 39.0, 40.8],
      ['安纳托利亚南部', 35.0, 37.2], ['安纳托利亚东部', 42.0, 39.0],
    ],
    CZE: [
      ['波希米亚', 14.2, 49.9], ['摩拉维亚', 17.0, 49.2], ['斯洛伐克西部', 18.4, 48.5],
      ['斯洛伐克东部', 21.2, 48.8], ['喀尔巴阡鲁塞尼亚', 23.2, 48.4],
    ],
    ROM: [
      ['特兰西瓦尼亚', 24.3, 46.5], ['巴纳特-克里沙纳', 21.8, 46.0], ['瓦拉几亚', 25.2, 44.4],
      ['摩尔达维亚-比萨拉比亚', 28.0, 47.2], ['多布罗加', 28.5, 44.4],
    ],
    YUG: [
      ['斯洛文尼亚-克罗地亚北部', 15.3, 46.0], ['克罗地亚沿海', 15.5, 44.2], ['波斯尼亚', 17.8, 44.1],
      ['塞尔维亚', 20.8, 44.2], ['黑山-科索沃', 20.3, 42.4], ['马其顿', 21.7, 41.5],
    ],
    GRE: [['马其顿-色雷斯', 23.5, 40.7], ['伊庇鲁斯-色萨利', 21.8, 39.3], ['希腊中部', 23.4, 38.2], ['伯罗奔尼撒', 22.4, 37.2], ['爱琴海诸岛', 25.5, 37.5]],
    AUT: [['下奥地利-维也纳', 16.1, 48.2], ['上奥地利-萨尔茨堡', 13.3, 47.8], ['施蒂利亚-克恩顿', 14.6, 46.8], ['蒂罗尔-福拉尔贝格', 10.5, 47.2]],
    HUN: [['匈牙利西部', 17.2, 47.2], ['布达佩斯与中部', 19.1, 47.3], ['匈牙利东部', 21.2, 47.1], ['匈牙利南部', 19.2, 46.2]],
    BEL: [['佛兰德', 4.1, 51.0], ['布鲁塞尔-布拉班特', 4.5, 50.8], ['瓦隆', 5.2, 50.2]],
    NLD: [['荷兰西部', 4.5, 52.2], ['荷兰北部', 5.8, 53.1], ['荷兰东部', 6.3, 52.2], ['荷兰南部', 5.3, 51.4]],
    CHE: [['瑞士高原西部', 6.8, 46.8], ['瑞士高原东部', 8.5, 47.2], ['瑞士阿尔卑斯', 8.1, 46.3], ['提契诺', 8.9, 46.0]],
    POR: [['葡萄牙北部', -8.1, 41.3], ['葡萄牙中部', -8.1, 39.9], ['里斯本', -9.1, 38.7], ['阿连特茹-阿尔加维', -7.8, 37.8]],
    BUL: [['保加利亚西部', 23.1, 42.6], ['保加利亚中部', 25.3, 42.7], ['黑海沿岸', 27.5, 42.6], ['保加利亚南部', 25.1, 41.8]],
    FIN: [['芬兰南部', 24.8, 60.8], ['芬兰西部', 22.5, 63.0], ['芬兰中部', 26.0, 63.5], ['芬兰东部', 29.0, 63.0], ['芬兰北部', 26.0, 67.0]],
    SWE: [['斯科讷', 13.5, 56.2], ['约塔兰', 14.5, 57.7], ['斯韦阿兰', 16.0, 59.5], ['瑞典中部', 16.0, 62.0], ['诺尔兰', 19.0, 66.0]],
    NOR: [['挪威东南部', 10.5, 59.8], ['挪威西部', 6.0, 61.5], ['特伦德拉格', 11.0, 63.5], ['诺尔兰', 14.0, 66.0], ['特罗姆斯-芬马克', 23.0, 69.0]],
    DEN: [['日德兰', 9.3, 56.2], ['丹麦群岛', 11.8, 55.5]],
    IRL: [['爱尔兰自由邦', -8.0, 53.3]],
    EST: [['爱沙尼亚', 25.6, 58.6]],
    LAT: [['拉脱维亚', 24.6, 57.0]],
    LTU: [['立陶宛', 24.0, 55.2]],
    LUX: [['卢森堡', 6.13, 49.8]],
  });

  const COUNTRY_NEIGHBORS = Object.freeze({
    GER: ['FRA', 'POL', 'CZE', 'AUT', 'NLD', 'BEL', 'DEN', 'CHE', 'LUX'],
    FRA: ['GER', 'BEL', 'LUX', 'CHE', 'ITA', 'ESP'], UK: ['IRL'],
    USSR: ['POL', 'FIN', 'EST', 'LAT', 'LTU', 'ROM', 'TUR'], ITA: ['FRA', 'CHE', 'AUT', 'YUG'],
    POL: ['GER', 'CZE', 'LTU', 'USSR', 'ROM'], ESP: ['POR', 'FRA'], TUR: ['GRE', 'BUL', 'USSR'],
    CZE: ['GER', 'POL', 'AUT', 'HUN', 'ROM'], AUT: ['GER', 'CZE', 'HUN', 'YUG', 'ITA', 'CHE'],
    HUN: ['AUT', 'CZE', 'ROM', 'YUG'], ROM: ['POL', 'CZE', 'HUN', 'YUG', 'BUL', 'USSR'],
    YUG: ['ITA', 'AUT', 'HUN', 'ROM', 'BUL', 'GRE'], GRE: ['YUG', 'BUL', 'TUR'],
    BEL: ['FRA', 'GER', 'NLD', 'LUX'], NLD: ['BEL', 'GER'], CHE: ['FRA', 'GER', 'AUT', 'ITA'],
    POR: ['ESP'], BUL: ['ROM', 'YUG', 'GRE', 'TUR'], FIN: ['SWE', 'NOR', 'USSR'],
    SWE: ['NOR', 'FIN', 'DEN'], NOR: ['SWE', 'FIN'], DEN: ['GER', 'SWE'],
    EST: ['LAT', 'USSR'], LAT: ['EST', 'LTU', 'USSR'], LTU: ['LAT', 'POL', 'USSR'], IRL: ['UK'], LUX: ['BEL', 'FRA', 'GER'],
  });

  const SEA_ZONE_DEFS = Object.freeze([
    { id: '北大西洋', center: [-14, 51.5], polygon: [[-25, 43], [-7, 43], [-7, 58], [-25, 62]] },
    { id: '挪威海', center: [2, 64.5], polygon: [[-8, 58], [10, 58], [17, 71], [-12, 72]] },
    { id: '北海', center: [3.5, 56], polygon: [[-4, 51], [9, 51], [10, 61], [-4, 61]] },
    { id: '英吉利海峡', center: [-1.2, 50.1], polygon: [[-6, 48.4], [2.5, 49], [2.5, 51.4], [-6, 51.1]] },
    { id: '波罗的海', center: [18, 57], polygon: [[9.5, 53.5], [30, 53.5], [30, 66], [15, 66], [9.5, 58]] },
    { id: '西地中海', center: [4.5, 39], polygon: [[-5, 35], [11, 35], [12, 44], [-1, 44]] },
    { id: '中地中海', center: [15.5, 37], polygon: [[10, 30], [21, 30], [22, 42], [10, 42]] },
    { id: '东地中海', center: [27, 35], polygon: [[20, 30], [37, 30], [37, 41], [20, 41]] },
    { id: '黑海', center: [33, 43], polygon: [[27, 40], [42, 40], [42, 47], [27, 47]] },
  ]);
  window.IRON_SEA_ZONES_V43 = SEA_ZONE_DEFS;
  if (typeof SEA_ZONES !== 'undefined') {
    for (const zone of SEA_ZONE_DEFS) if (!SEA_ZONES.includes(zone.id)) SEA_ZONES.push(zone.id);
  }

  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function walkGeometry(geometry, callback) {
    if (!geometry) return;
    if (geometry.type === 'Polygon') geometry.coordinates.forEach(ring => ring.forEach(callback));
    else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(poly => poly.forEach(ring => ring.forEach(callback)));
    else if (geometry.type === 'GeometryCollection') (geometry.geometries || []).forEach(item => walkGeometry(item, callback));
  }

  function bbox(geometry) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    walkGeometry(geometry, ([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
    return [minX, minY, maxX, maxY];
  }

  function ringPath(ring) {
    if (!ring?.length) return '';
    return `M${ring.map(point => MapV4.project(point).map(value => value.toFixed(1)).join(',')).join('L')}Z`;
  }

  function geometryPath(geometry) {
    if (!geometry) return '';
    if (geometry.type === 'Polygon') return geometry.coordinates.map(ringPath).join('');
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(poly => poly.map(ringPath).join('')).join('');
    if (geometry.type === 'GeometryCollection') return (geometry.geometries || []).map(geometryPath).join('');
    return '';
  }

  function toMultiPolygon(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return [geometry.coordinates];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates;
    if (geometry.type === 'GeometryCollection') return (geometry.geometries || []).flatMap(toMultiPolygon);
    return [];
  }

  function mergeGeometry(geometries, countryGeometries = []) {
    const fallback = { type: 'GeometryCollection', geometries };
    if (!window.polygonClipping) return fallback;
    try {
      const inputs = geometries.map(toMultiPolygon).filter(item => item.length);
      if (!inputs.length) return fallback;
      let unioned = polygonClipping.union(...inputs);
      const countryInputs = countryGeometries.map(toMultiPolygon).filter(item => item.length);
      if (countryInputs.length) {
        const countryUnion = polygonClipping.union(...countryInputs);
        const clipped = polygonClipping.intersection(unioned, countryUnion);
        if (clipped?.length) unioned = clipped;
      }
      return { type: 'MultiPolygon', coordinates: unioned };
    } catch (error) {
      console.warn('战略区域多边形合并失败，使用兼容几何集合', error);
      return fallback;
    }
  }

  function cshapeCode(name) {
    const lower = String(name || '').trim().toLowerCase();
    const special = {
      'soviet union': 'USSR', 'russia': 'USSR', 'united kingdom': 'UK', 'great britain': 'UK',
      'czechoslovakia': 'CZE', 'yugoslavia': 'YUG', 'irish free state': 'IRL', 'ireland': 'IRL',
      'switzerland': 'CHE', 'romania': 'ROM', 'germany': 'GER', 'poland': 'POL', 'austria': 'AUT',
      'hungary': 'HUN', 'netherlands': 'NLD', 'belgium': 'BEL', 'luxembourg': 'LUX',
    };
    if (special[lower]) return special[lower];
    for (const [code, country] of Object.entries(COUNTRY_DEFS)) {
      if (country.name.toLowerCase() === lower || country.short.toLowerCase() === lower || country.aliases.some(alias => alias.toLowerCase() === lower)) return code;
    }
    return null;
  }

  async function replaceCountriesWith1936CShapes(countries) {
    try {
      const response = await fetch(CSHAPES_1936, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`CShapes服务返回${response.status}`);
      const data = await response.json();
      const next = new Map();
      for (const feature of data.features || []) {
        const code = cshapeCode(feature.properties?.cntry_name);
        if (!code || !COUNTRY_DEFS[code]) continue;
        const box = bbox(feature.geometry);
        if (box[2] < -25 || box[0] > 55 || box[3] < 33 || box[1] > 72) continue;
        if (!next.has(code)) next.set(code, { code, features: [], bbox: box, source: 'CShapes-1936' });
        const country = next.get(code);
        country.features.push(feature);
        const boxes = country.features.map(item => bbox(item.geometry));
        country.bbox = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
      }
      if (next.size < 18) throw new Error(`仅匹配到${next.size}个欧洲国家`);
      countries.clear();
      for (const [code, country] of next) countries.set(code, country);
      window.__IRON_BORDER_SOURCE__ = 'CShapes 1936';
    } catch (error) {
      window.__IRON_BORDER_SOURCE__ = '本地1930年代历史底图（CShapes服务不可用）';
      console.warn('无法载入CShapes 1936，保留本地历史国界', error);
    }
  }

  function autoAnchors(code, originals) {
    if (!originals.length) return [];
    if (originals.length <= 4) {
      const center = originals.reduce((sum, province) => [sum[0] + province.center[0], sum[1] + province.center[1]], [0, 0]).map(value => value / originals.length);
      return [[COUNTRY_DEFS[code]?.short || code, center[0], center[1]]];
    }
    const xs = originals.map(p => p.center[0]); const ys = originals.map(p => p.center[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const short = COUNTRY_DEFS[code]?.short || code;
    return [[`${short}西部`, minX + (maxX - minX) * 0.25, (minY + maxY) / 2], [`${short}中部`, (minX + maxX) / 2, (minY + maxY) / 2], [`${short}东部`, minX + (maxX - minX) * 0.75, (minY + maxY) / 2]];
  }

  function distance(a, b) {
    const midLat = (a[1] + b[1]) * Math.PI / 360;
    return Math.hypot((a[0] - b[0]) * Math.cos(midLat), a[1] - b[1]);
  }

  function rebuildStrategicRegions(result) {
    const provinces = result.provinces;
    const countries = result.countries;
    const next = new Map();

    for (const code of Object.keys(COUNTRY_DEFS)) {
      const originalIds = [...MapV4.getCountryProvinceIds(code)];
      const originals = originalIds.map(id => provinces.get(id)).filter(Boolean);
      if (!originals.length || !countries.has(code)) continue;
      const anchors = REGION_ANCHORS[code] || autoAnchors(code, originals);
      const groups = anchors.map(([name, lon, lat], index) => ({ name, center: [lon, lat], index, members: [] }));
      for (const province of originals) {
        let best = groups[0]; let bestDistance = Infinity;
        for (const group of groups) {
          const d = distance(province.center, group.center);
          if (d < bestDistance) { best = group; bestDistance = d; }
        }
        best.members.push(province);
      }
      const countryGeometries = countries.get(code).features.map(feature => feature.geometry);
      const newIds = [];
      for (const group of groups.filter(item => item.members.length)) {
        const geometry = mergeGeometry(group.members.map(item => item.geometry), countryGeometries);
        const id = `${code}:strategic:${group.index}`;
        const box = bbox(geometry);
        const area = group.members.reduce((sum, item) => sum + (item.area || 0), 0);
        next.set(id, {
          id, owner: code, controller: code, sourceName: group.name, name: group.name,
          geometry, bbox: box, center: group.center, terrain: group.members.sort((a, b) => (b.area || 0) - (a.area || 0))[0]?.terrain || 'plains',
          area: Math.max(0.05, area), neighbors: [], coastal: group.members.some(item => item.coastal), mergedFrom: group.members.map(item => item.id),
        });
        newIds.push(id);
      }
      const liveIds = MapV4.getCountryProvinceIds(code);
      liveIds.splice(0, liveIds.length, ...newIds);
    }

    provinces.clear();
    for (const [id, province] of next) provinces.set(id, province);
    rebuildAdjacency(provinces);
  }

  function rebuildAdjacency(provinces) {
    const byCountry = new Map();
    for (const province of provinces.values()) {
      province.neighbors = [];
      if (!byCountry.has(province.owner)) byCountry.set(province.owner, []);
      byCountry.get(province.owner).push(province);
    }
    for (const list of byCountry.values()) {
      for (const province of list) {
        const nearest = list.filter(item => item.id !== province.id).sort((a, b) => distance(province.center, a.center) - distance(province.center, b.center)).slice(0, Math.min(3, list.length - 1));
        for (const other of nearest) connect(province, other);
      }
    }
    const done = new Set();
    for (const [aCode, neighbors] of Object.entries(COUNTRY_NEIGHBORS)) {
      for (const bCode of neighbors) {
        const pair = [aCode, bCode].sort().join('|');
        if (done.has(pair)) continue;
        done.add(pair);
        const aRegions = byCountry.get(aCode) || []; const bRegions = byCountry.get(bCode) || [];
        const candidates = [];
        for (const a of aRegions) for (const b of bRegions) candidates.push({ a, b, d: distance(a.center, b.center) });
        candidates.sort((x, y) => x.d - y.d);
        for (const candidate of candidates.slice(0, Math.min(2, candidates.length))) connect(candidate.a, candidate.b);
      }
    }
  }

  function connect(a, b) {
    if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
    if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
  }

  function redraw(result) {
    const svg = document.getElementById('strategyMap');
    const defs = svg.querySelector('defs');
    const countryLayer = document.getElementById('countryLayer');
    const provinceLayer = document.getElementById('provinceLayer');
    const borderLayer = document.getElementById('borderLayer');
    const labelLayer = document.getElementById('labelLayer');
    defs.innerHTML = '';
    countryLayer.innerHTML = '';
    provinceLayer.innerHTML = '';
    borderLayer.innerHTML = '';
    labelLayer.innerHTML = '';

    for (const [code, country] of result.countries) {
      const d = country.features.map(feature => geometryPath(feature.geometry)).join('');
      const clip = svgEl('clipPath', { id: `clip-${code}` });
      clip.appendChild(svgEl('path', { d }));
      defs.appendChild(clip);
      const base = svgEl('path', { d, class: 'country-base', 'data-code': code });
      base.style.fill = COUNTRY_DEFS[code]?.color || '#777';
      countryLayer.appendChild(base);
      borderLayer.appendChild(svgEl('path', { d, class: 'country-border-mask', 'data-code': code }));
      borderLayer.appendChild(svgEl('path', { d, class: 'country-border', 'data-code': code }));
    }

    for (const province of result.provinces.values()) {
      const path = svgEl('path', { d: geometryPath(province.geometry), class: 'province-shape strategic-region', 'data-id': province.id, 'clip-path': `url(#clip-${province.owner})` });
      path.addEventListener('click', event => { event.stopPropagation(); MapV4.selectProvince(province.id, false); });
      provinceLayer.appendChild(path);
      const [x, y] = MapV4.project(province.center);
      const label = svgEl('text', { x, y, class: 'province-label strategic-label', 'data-id': province.id });
      label.textContent = province.name;
      labelLayer.appendChild(label);
    }
    renderSeaZones();
    MapV4.updateStyles();
  }

  function renderSeaZones() {
    const world = document.getElementById('mapWorld');
    const countryLayer = document.getElementById('countryLayer');
    document.getElementById('seaZoneLayer')?.remove();
    const layer = svgEl('g', { id: 'seaZoneLayer', class: 'sea-zone-layer' });
    for (const zone of SEA_ZONE_DEFS) {
      const path = svgEl('path', { d: ringPath([...zone.polygon, zone.polygon[0]]), class: 'sea-zone-shape', 'data-zone': zone.id });
      layer.appendChild(path);
      const [x, y] = MapV4.project(zone.center);
      const label = svgEl('text', { x, y, class: 'sea-zone-label', 'data-zone': zone.id });
      label.textContent = zone.id;
      layer.appendChild(label);
    }
    world.insertBefore(layer, countryLayer);
  }

  MapV4.loadAll = async function loadAllV43() {
    const result = await originalLoadAll();
    await replaceCountriesWith1936CShapes(result.countries);
    rebuildStrategicRegions(result);
    redraw(result);
    return result;
  };
})();
