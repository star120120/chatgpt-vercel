'use strict';

/**
 * Replace generated module-style region names after ADM1 data is loaded.
 * Exact historical aliases win; otherwise retain the source geographic name
 * rather than showing "国家第X行政区".
 */
(() => {
  const originalLoadAll = MapV4.loadAll.bind(MapV4);
  MapV4.loadAll = async function loadAllV41() {
    const result = await originalLoadAll();
    for (const province of result.provinces.values()) {
      const historical = REGION_TRANSLATIONS[province.sourceName];
      const isGenerated = /第\d+(?:战略州|行政区)/.test(province.name || '');
      if (historical) province.name = historical;
      else if (isGenerated && province.sourceName) province.name = province.sourceName;
      const label = document.querySelector(`.province-label[data-id="${CSS.escape(province.id)}"]`);
      if (label) label.textContent = province.name;
    }
    return result;
  };
})();
