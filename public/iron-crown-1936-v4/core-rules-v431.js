'use strict';

/** V4.3.1 geographic compatibility for the new strategic-region map. */
(() => {
  const previousDetectCoastalProvince = detectCoastalProvince;
  detectCoastalProvince = function detectCoastalProvinceV431(mapProvince) {
    if (!mapProvince) return false;
    if (typeof mapProvince.isCoastal === 'boolean') return mapProvince.isCoastal;
    if (typeof mapProvince.coastal === 'boolean') return mapProvince.coastal;
    return previousDetectCoastalProvince(mapProvince);
  };
})();
