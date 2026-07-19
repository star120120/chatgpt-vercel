'use strict';

const MapV4 = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const VIEW_W = 1600;
  const VIEW_H = 1000;
  const GEO_BOUNDS = [-25, 33, 55, 72];
  const countries = new Map();
  const provinces = new Map();
  const countryProvinceIds = new Map();
  const isoData = new Map();
  const handlers = { select: null, status: null };
  let svg;
  let world;
  let defs;
  let countryLayer;
  let provinceLayer;
  let borderLayer;
  let labelLayer;
  let unitLayer;
  let frontLayer;
  let game = null;
  let selectedProvince = null;
  let mapMode = 'political';
  let autoFocus = true;
  let showLabels = true;
  let view = { x: 0, y: 0, k: 1 };
  let pointers = new Map();
  let dragStart = null;
  let pinchStart = null;

  const svgEl = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };

  const mercatorY = lat => Math.log(Math.tan(Math.PI / 4 + clamp(lat, GEO_BOUNDS[1], GEO_BOUNDS[3]) * Math.PI / 360));
  const minMY = mercatorY(GEO_BOUNDS[1]);
  const maxMY = mercatorY(GEO_BOUNDS[3]);
  const project = ([lon, lat]) => [
    ((lon - GEO_BOUNDS[0]) / (GEO_BOUNDS[2] - GEO_BOUNDS[0])) * VIEW_W,
    VIEW_H - ((mercatorY(lat) - minMY) / (maxMY - minMY)) * VIEW_H,
  ];

  function normalizeGeometry(geometry) {
    if (!geometry) return geometry;
    if (geometry.type === 'Surface') return { type: 'Polygon', coordinates: geometry.coordinates };
    if (geometry.type === 'MultiSurface') {
      if (Array.isArray(geometry.geometries)) {
        return {
          type: 'MultiPolygon',
          coordinates: geometry.geometries
            .map(normalizeGeometry)
            .filter(Boolean)
            .map(item => item.coordinates),
        };
      }
      return { type: 'MultiPolygon', coordinates: geometry.coordinates || [] };
    }
    if (geometry.type === 'GeometryCollection') {
      return {
        type: 'GeometryCollection',
        geometries: (geometry.geometries || []).map(normalizeGeometry),
      };
    }
    return geometry;
  }

  function walkGeometry(geometry, callback) {
    if (!geometry) return;
    const g = normalizeGeometry(geometry);
    if (g.type === 'Polygon') g.coordinates.forEach(ring => ring.forEach(callback));
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => poly.forEach(ring => ring.forEach(callback)));
    else if (g.type === 'GeometryCollection') g.geometries.forEach(item => walkGeometry(item, callback));
  }

  function geometryBBox(geometry) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    walkGeometry(geometry, ([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    return [minX, minY, maxX, maxY];
  }

  function mergeBBoxes(boxes) {
    return [
      Math.min(...boxes.map(box => box[0])),
      Math.min(...boxes.map(box => box[1])),
      Math.max(...boxes.map(box => box[2])),
      Math.max(...boxes.map(box => box[3])),
    ];
  }

  function ringPath(ring) {
    if (!ring?.length) return '';
    return `M${ring.map(point => project(point).map(value => value.toFixed(1)).join(',')).join('L')}Z`;
  }

  function geometryPath(geometry) {
    const g = normalizeGeometry(geometry);
    if (!g) return '';
    if (g.type === 'Polygon') return g.coordinates.map(ringPath).join('');
    if (g.type === 'MultiPolygon') return g.coordinates.map(poly => poly.map(ringPath).join('')).join('');
    if (g.type === 'GeometryCollection') return g.geometries.map(geometryPath).join('');
    return '';
  }

  function pointInRing([x, y], ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i];
      const b = ring[j];
      const intersects = ((a[1] > y) !== (b[1] > y)) && x < ((b[0] - a[0]) * (y - a[1])) / ((b[1] - a[1]) || 1e-12) + a[0];
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function pointInGeometry(point, geometry) {
    const g = normalizeGeometry(geometry);
    if (!g) return false;
    if (g.type === 'Polygon') return pointInRing(point, g.coordinates[0]) && !g.coordinates.slice(1).some(ring => pointInRing(point, ring));
    if (g.type === 'MultiPolygon') return g.coordinates.some(poly => pointInGeometry(point, { type: 'Polygon', coordinates: poly }));
    if (g.type === 'GeometryCollection') return g.geometries.some(item => pointInGeometry(point, item));
    return false;
  }

  function representativePoint(geometry) {
    const box = geometryBBox(geometry);
    const center = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    if (pointInGeometry(center, geometry)) return center;
    let result = center;
    let index = 0;
    walkGeometry(geometry, point => {
      if (index % 20 === 0 && pointInGeometry(point, geometry)) result = point;
      index += 1;
    });
    return result;
  }

  function historicalName(feature) {
    const props = feature.properties || {};
    return String(props.NAME || props.name || props.SUBJECTO || '').trim();
  }

  function countryCodeForFeature(feature) {
    const lower = historicalName(feature).toLowerCase();
    if (lower.includes('east prussia')) return 'GER';
    if (lower.includes('danzig')) return null;
    if (lower.includes('soviet') || lower === 'russia' || lower.includes('russian empire') || ['ukraine', 'belarus', 'white russia', 'georgia', 'armenia', 'azerbaijan'].includes(lower)) return 'USSR';
    if (lower.includes('yugoslav')) return 'YUG';
    if (lower.includes('czechoslov')) return 'CZE';
    if (lower.includes('united kingdom') || lower.includes('great britain') || lower.includes('british empire')) return 'UK';
    if (lower.includes('irish free')) return 'IRL';
    if (lower.includes('spanish state')) return 'ESP';
    if (lower.includes('swiss confederation')) return 'CHE';
    for (const [code, country] of Object.entries(COUNTRY_DEFS)) {
      if (country.aliases.some(alias => alias.toLowerCase() === lower)) return code;
    }
    return null;
  }

  async function fetchJSON(url) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`${url} 返回 ${response.status}`);
    return response.json();
  }

  async function loadWithConcurrency(items, worker, limit = 6) {
    const result = [];
    let cursor = 0;
    async function runner() {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        result[index] = await worker(items[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
    return result;
  }

  function status(text, progress) {
    handlers.status?.(text, progress);
  }

  async function loadAll() {
    status('载入1930年代欧洲国界', 0.02);
    const historical = await fetchJSON(`${MAP_BASE}/world_1930.geojson`);
    for (const feature of historical.features || []) {
      const code = countryCodeForFeature(feature);
      if (!code || !COUNTRY_DEFS[code]) continue;
      feature.geometry = normalizeGeometry(feature.geometry);
      const box = geometryBBox(feature.geometry);
      if (box[2] < GEO_BOUNDS[0] || box[0] > GEO_BOUNDS[2] || box[3] < GEO_BOUNDS[1] || box[1] > GEO_BOUNDS[3]) continue;
      if (!countries.has(code)) countries.set(code, { code, features: [], bbox: box });
      const country = countries.get(code);
      country.features.push(feature);
      country.bbox = mergeBBoxes(country.features.map(item => geometryBBox(item.geometry)));
    }
    renderCountries();

    status('读取行政区清单', 0.08);
    const manifestText = await fetch(`${MAP_BASE}/adm1-manifest.txt`, { cache: 'force-cache' }).then(response => {
      if (!response.ok) throw new Error(`行政区清单返回 ${response.status}`);
      return response.text();
    });
    const manifest = manifestText.split(/\s+/).filter(Boolean);
    await loadWithConcurrency(manifest, async (iso, index) => {
      try {
        const data = await fetchJSON(`${MAP_BASE}/adm1/${iso}.geojson`);
        data.features = (data.features || []).map(feature => ({ ...feature, geometry: normalizeGeometry(feature.geometry) }));
        isoData.set(iso, data);
      } catch (error) {
        console.warn('行政区载入失败', iso, error);
      }
      status(`载入欧洲行政区 ${index + 1}/${manifest.length}`, 0.08 + ((index + 1) / manifest.length) * 0.78);
    }, 7);

    buildAllProvinces();
    buildAdjacency();
    renderAllProvinces();
    status('地图与行政区载入完成', 1);
    return { countries, provinces };
  }

  function countryContains(code, point) {
    const country = countries.get(code);
    return country?.features.some(feature => pointInGeometry(point, feature.geometry));
  }

  function featureName(feature) {
    const props = feature.properties || {};
    return String(props.shapeName || props.NAME_1 || props.name || props.NAME || '');
  }

  function samplePoints(geometry) {
    const points = [representativePoint(geometry)];
    let index = 0;
    walkGeometry(geometry, point => {
      if (index % 28 === 0 && points.length < 32) points.push(point);
      index += 1;
    });
    return points;
  }

  function inferTerrain([lon, lat], sourceName) {
    const lower = sourceName.toLowerCase();
    if (/berlin|hamburg|paris|london|madrid|moscow|roma|rome|warsaw|wien|vienna|budapest|prague|brussels|amsterdam|istanbul|bucharest/.test(lower)) return 'urban';
    if ((lon > 5 && lon < 17 && lat > 44 && lat < 49.8) || (lon > 18 && lon < 30 && lat > 41 && lat < 49) || (lon > -4 && lon < 4 && lat > 41 && lat < 44.5) || (lon > 7 && lon < 15 && lat > 58)) return 'mountain';
    if (lon > 23 && lon < 31 && lat > 50 && lat < 55) return 'marsh';
    if (lat > 55 || (lon > 24 && lat > 48)) return 'forest';
    if (lat < 39 && lon > 25) return 'desert';
    if (/hill|highland|bohem|bayern|bavaria|aragon|tirol|alps/.test(lower)) return 'hills';
    return 'plains';
  }

  function buildAllProvinces() {
    provinces.clear();
    countryProvinceIds.clear();
    for (const [code, countryDef] of Object.entries(COUNTRY_DEFS)) {
      if (!countries.has(code)) continue;
      const ids = [];
      let regionalIndex = 1;
      for (const iso of countryDef.iso) {
        const data = isoData.get(iso);
        if (!data) continue;
        for (const feature of data.features || []) {
          const center = samplePoints(feature.geometry).find(point => countryContains(code, point));
          if (!center) continue;
          const sourceName = featureName(feature);
          const displayName = REGION_TRANSLATIONS[sourceName] || `${countryDef.short}第${regionalIndex}行政区`;
          const id = `${code}:${iso}:${feature.properties?.shapeID || hash(`${sourceName}:${JSON.stringify(geometryBBox(feature.geometry))}`)}`;
          if (provinces.has(id)) continue;
          const box = geometryBBox(feature.geometry);
          const province = {
            id,
            owner: code,
            controller: code,
            sourceName,
            name: displayName,
            geometry: feature.geometry,
            bbox: box,
            center,
            terrain: inferTerrain(center, sourceName),
            area: Math.max(0.01, (box[2] - box[0]) * (box[3] - box[1])),
            neighbors: [],
            coastal: false,
          };
          provinces.set(id, province);
          ids.push(id);
          regionalIndex += 1;
        }
      }
      if (!ids.length) {
        const feature = countries.get(code).features[0];
        const id = `${code}:核心区`;
        provinces.set(id, {
          id,
          owner: code,
          controller: code,
          sourceName: '',
          name: `${countryDef.short}核心区`,
          geometry: feature.geometry,
          bbox: geometryBBox(feature.geometry),
          center: representativePoint(feature.geometry),
          terrain: 'plains',
          area: 1,
          neighbors: [],
          coastal: false,
        });
        ids.push(id);
      }
      countryProvinceIds.set(code, ids);
    }
  }

  function buildAdjacency() {
    const list = [...provinces.values()];
    const projected = new Map(list.map(province => [province.id, project(province.center)]));
    const historicalNeighbors = {
      GER: ['FRA', 'POL', 'CZE', 'AUT', 'NLD', 'BEL', 'DEN', 'CHE', 'LUX'],
      FRA: ['GER', 'BEL', 'LUX', 'CHE', 'ITA', 'ESP'], UK: ['IRL'], USSR: ['POL', 'FIN', 'EST', 'LAT', 'LTU', 'ROM', 'TUR'],
      ITA: ['FRA', 'CHE', 'AUT', 'YUG'], POL: ['GER', 'CZE', 'LTU', 'USSR', 'ROM'], ESP: ['POR', 'FRA'], TUR: ['GRE', 'BUL', 'USSR'],
      CZE: ['GER', 'POL', 'AUT', 'HUN', 'ROM'], AUT: ['GER', 'CZE', 'HUN', 'YUG', 'ITA', 'CHE'], HUN: ['AUT', 'CZE', 'ROM', 'YUG'],
      ROM: ['POL', 'CZE', 'HUN', 'YUG', 'BUL', 'USSR'], YUG: ['ITA', 'AUT', 'HUN', 'ROM', 'BUL', 'GRE', 'ALB'], GRE: ['YUG', 'BUL', 'TUR'],
      BEL: ['FRA', 'GER', 'NLD', 'LUX'], NLD: ['BEL', 'GER'], CHE: ['FRA', 'GER', 'AUT', 'ITA'], POR: ['ESP'], BUL: ['ROM', 'YUG', 'GRE', 'TUR'],
      FIN: ['SWE', 'NOR', 'USSR'], SWE: ['NOR', 'FIN', 'DEN'], NOR: ['SWE', 'FIN'], DEN: ['GER', 'SWE'], EST: ['LAT', 'USSR'], LAT: ['EST', 'LTU', 'USSR'], LTU: ['LAT', 'POL', 'USSR'], IRL: ['UK'],
    };
    for (const province of list) {
      const point = projected.get(province.id);
      const candidates = list
        .filter(other => other.id !== province.id)
        .map(other => ({
          id: other.id,
          owner: other.owner,
          distance: Math.hypot(projected.get(other.id)[0] - point[0], projected.get(other.id)[1] - point[1]),
        }))
        .sort((a, b) => a.distance - b.distance);
      const same = candidates.filter(item => item.owner === province.owner).slice(0, 5);
      const cross = candidates.filter(item => historicalNeighbors[province.owner]?.includes(item.owner)).slice(0, 3);
      province.neighbors = [...new Set([...same, ...cross].filter(item => item.distance < 150).map(item => item.id))];
    }
    for (const province of list) {
      for (const neighborId of province.neighbors) {
        const neighbor = provinces.get(neighborId);
        if (neighbor && !neighbor.neighbors.includes(province.id)) neighbor.neighbors.push(province.id);
      }
    }
  }

  function renderCountries() {
    defs.innerHTML = '';
    countryLayer.innerHTML = '';
    borderLayer.innerHTML = '';
    for (const [code, country] of countries) {
      const d = country.features.map(feature => geometryPath(feature.geometry)).join('');
      const clip = svgEl('clipPath', { id: `clip-${code}` });
      clip.appendChild(svgEl('path', { d }));
      defs.appendChild(clip);
      const base = svgEl('path', { d, class: 'country-base', 'data-code': code });
      base.style.fill = COUNTRY_DEFS[code].color;
      countryLayer.appendChild(base);
      borderLayer.appendChild(svgEl('path', { d, class: 'country-border', 'data-code': code }));
    }
  }

  function renderAllProvinces() {
    provinceLayer.innerHTML = '';
    labelLayer.innerHTML = '';
    for (const province of provinces.values()) {
      const path = svgEl('path', {
        d: geometryPath(province.geometry),
        class: 'province-shape',
        'data-id': province.id,
        'clip-path': `url(#clip-${province.owner})`,
      });
      path.addEventListener('click', event => {
        event.stopPropagation();
        selectProvince(province.id, autoFocus);
      });
      provinceLayer.appendChild(path);
      const [x, y] = project(province.center);
      const label = svgEl('text', { x, y, class: 'province-label', 'data-id': province.id });
      label.textContent = province.name;
      labelLayer.appendChild(label);
    }
    updateStyles();
    updateLabelVisibility();
  }

  function provinceColor(province) {
    const state = game?.provinces?.[province.id];
    const controller = state?.controller || province.controller || province.owner;
    if (mapMode === 'terrain') {
      return { plains: '#9ca46f', forest: '#5b7c58', hills: '#8e8164', mountain: '#777777', urban: '#827e79', marsh: '#57766a', desert: '#b9a16d', jungle: '#486c51' }[province.terrain];
    }
    if (mapMode === 'supply' && game) {
      const ratio = game.provinceSupplyRatio(province.id);
      return ratio > 0.8 ? '#4f9b6d' : ratio > 0.5 ? '#b49b52' : '#b64f58';
    }
    if (mapMode === 'industry' && game) {
      const industry = (state?.civ || 0) + (state?.mil || 0) + (state?.dockyard || 0);
      return industry >= 7 ? '#dfb64f' : industry >= 4 ? '#a58c51' : industry >= 2 ? '#657486' : '#3b4d5f';
    }
    if (mapMode === 'administration' && game) {
      const development = state?.development || 1;
      return development >= 7 ? '#6ab47d' : development >= 4 ? '#8ba469' : '#8b7562';
    }
    if (mapMode === 'fronts' && game) {
      if (game.fronts.some(front => front.target === province.id)) return '#b9555b';
      if (game.fronts.some(front => front.source === province.id)) return '#5d9b72';
    }
    const base = COUNTRY_DEFS[controller]?.color || '#777';
    const rgb = base.match(/[a-f\d]{2}/gi)?.map(value => parseInt(value, 16));
    if (!rgb) return base;
    const variance = ((hash(province.id) % 13) - 6) / 100;
    return `rgb(${rgb.map(value => clamp(Math.round(value * (1 + variance)), 0, 255)).join(',')})`;
  }

  function updateStyles() {
    document.querySelectorAll('.province-shape').forEach(node => {
      const province = provinces.get(node.dataset.id);
      node.style.fill = provinceColor(province);
      node.classList.toggle('selected', node.dataset.id === selectedProvince);
    });
  }

  function updateLabelVisibility() {
    labelLayer.classList.toggle('labels-hidden', !showLabels || view.k < 1.55);
    labelLayer.classList.toggle('labels-dense', view.k < 2.25);
  }

  function selectProvince(id, focus = false) {
    if (!provinces.has(id)) return;
    selectedProvince = id;
    updateStyles();
    if (focus) focusProvince(id, 2.15);
    handlers.select?.(id);
  }

  function focusProvince(id, maxZoom = 2.8) {
    const province = provinces.get(id);
    if (!province) return;
    focusBBox(province.bbox, maxZoom);
  }

  function focusCountry(code) {
    const country = countries.get(code);
    if (country) focusBBox(country.bbox, 1.9);
  }

  function focusBBox(box, maxZoom) {
    const a = project([box[0], box[1]]);
    const b = project([box[2], box[3]]);
    const x = Math.min(a[0], b[0]);
    const y = Math.min(a[1], b[1]);
    const width = Math.max(20, Math.abs(b[0] - a[0]));
    const height = Math.max(20, Math.abs(b[1] - a[1]));
    const k = clamp(Math.min(VIEW_W / width, VIEW_H / height) * 0.52, 1, maxZoom);
    animateView({ x: VIEW_W / 2 - (x + width / 2) * k, y: VIEW_H / 2 - (y + height / 2) * k, k });
  }

  function animateView(target) {
    const start = { ...view };
    const startTime = performance.now();
    const step = now => {
      const progress = clamp((now - startTime) / 280, 0, 1);
      const ease = 1 - (1 - progress) ** 3;
      view = {
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease,
        k: start.k + (target.k - start.k) * ease,
      };
      applyView();
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function applyView() {
    world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    updateLabelVisibility();
    renderUnits();
  }

  function resetView() {
    animateView({ x: 0, y: 0, k: 1 });
  }

  function renderUnits() {
    unitLayer.innerHTML = '';
    if (!game) return;
    if (view.k < 1.18) {
      for (const [code, country] of Object.entries(game.countries)) {
        const count = game.totalDivisions(code);
        if (!count || !countries.has(code)) continue;
        const point = project(COUNTRY_DEFS[code].capital);
        createCounter(point, count, code, null, true);
      }
      return;
    }
    for (const province of provinces.values()) {
      const count = game.provinces[province.id]?.divisions.length || 0;
      if (!count) continue;
      createCounter(project(province.center), count, game.provinces[province.id].controller, province.id, false);
    }
  }

  function createCounter([x, y], count, owner, provinceId, aggregate) {
    const group = svgEl('g', { class: `unit-counter ${aggregate ? 'aggregate' : ''}`, 'data-province': provinceId || '' });
    const width = aggregate ? 34 : 28;
    const height = aggregate ? 20 : 18;
    group.appendChild(svgEl('rect', { x: x - width / 2, y: y + 5, width, height, rx: 4 }));
    const text = svgEl('text', { x, y: y + (aggregate ? 19 : 18) });
    text.textContent = count > 99 ? '99+' : count;
    group.appendChild(text);
    group.style.setProperty('--counter-color', COUNTRY_DEFS[owner]?.color || '#788');
    if (provinceId) group.addEventListener('click', event => { event.stopPropagation(); selectProvince(provinceId, false); });
    unitLayer.appendChild(group);
  }

  function renderFronts() {
    frontLayer.innerHTML = '';
    if (!game) return;
    for (const front of game.fronts) {
      const source = provinces.get(front.source);
      const target = provinces.get(front.target);
      if (!source || !target) continue;
      const a = project(source.center);
      const b = project(target.center);
      const line = svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: `front-line ${front.active ? 'active' : ''}` });
      frontLayer.appendChild(line);
      const midX = (a[0] + b[0]) / 2;
      const midY = (a[1] + b[1]) / 2;
      const badge = svgEl('g', { class: 'front-progress' });
      badge.appendChild(svgEl('rect', { x: midX - 22, y: midY - 11, width: 44, height: 22, rx: 6 }));
      const label = svgEl('text', { x: midX, y: midY + 4 });
      label.textContent = `${Math.round(front.progress)}%`;
      badge.appendChild(label);
      frontLayer.appendChild(badge);
    }
  }

  function setupGestures() {
    svg.addEventListener('pointerdown', event => {
      svg.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pointers.size === 1) dragStart = { x: event.clientX, y: event.clientY, view: { ...view } };
      if (pointers.size === 2) {
        const values = [...pointers.values()];
        pinchStart = {
          distance: Math.hypot(values[0][0] - values[1][0], values[0][1] - values[1][1]),
          view: { ...view },
        };
      }
    });
    svg.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pointers.size === 1 && dragStart) {
        view.x = dragStart.view.x + event.clientX - dragStart.x;
        view.y = dragStart.view.y + event.clientY - dragStart.y;
        applyView();
      } else if (pointers.size === 2 && pinchStart) {
        const values = [...pointers.values()];
        const distance = Math.hypot(values[0][0] - values[1][0], values[0][1] - values[1][1]);
        const nextK = clamp(pinchStart.view.k * distance / pinchStart.distance, 0.72, 5.5);
        const ratio = nextK / pinchStart.view.k;
        view = {
          k: nextK,
          x: VIEW_W / 2 - (VIEW_W / 2 - pinchStart.view.x) * ratio,
          y: VIEW_H / 2 - (VIEW_H / 2 - pinchStart.view.y) * ratio,
        };
        applyView();
      }
    });
    const endPointer = event => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (!pointers.size) dragStart = null;
    };
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    svg.addEventListener('wheel', event => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mapX = ((event.clientX - rect.left) / rect.width) * VIEW_W;
      const mapY = ((event.clientY - rect.top) / rect.height) * VIEW_H;
      const nextK = clamp(view.k * (event.deltaY > 0 ? 0.88 : 1.14), 0.72, 5.5);
      const ratio = nextK / view.k;
      view = { k: nextK, x: mapX - (mapX - view.x) * ratio, y: mapY - (mapY - view.y) * ratio };
      applyView();
    }, { passive: false });
  }

  function init(options = {}) {
    handlers.select = options.onSelect || null;
    handlers.status = options.onStatus || null;
    svg = document.getElementById('strategyMap');
    world = document.getElementById('mapWorld');
    defs = svg.querySelector('defs');
    countryLayer = document.getElementById('countryLayer');
    provinceLayer = document.getElementById('provinceLayer');
    frontLayer = document.getElementById('frontLayer');
    borderLayer = document.getElementById('borderLayer');
    labelLayer = document.getElementById('labelLayer');
    unitLayer = document.getElementById('unitLayer');
    setupGestures();
  }

  function setGame(nextGame) {
    game = nextGame;
    updateStyles();
    renderUnits();
    renderFronts();
  }

  function setMode(mode) {
    mapMode = mode;
    updateStyles();
    renderFronts();
  }

  return {
    init,
    loadAll,
    setGame,
    setMode,
    selectProvince,
    focusProvince,
    focusCountry,
    resetView,
    setAutoFocus: value => { autoFocus = Boolean(value); },
    setShowLabels: value => { showLabels = Boolean(value); updateLabelVisibility(); },
    getProvince: id => provinces.get(id),
    getProvinces: () => provinces,
    getCountryProvinceIds: code => countryProvinceIds.get(code) || [],
    renderUnits,
    renderFronts,
    updateStyles,
    project,
    getZoom: () => view.k,
  };
})();
