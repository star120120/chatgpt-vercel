'use strict';

/** V4.3.1 geographic compatibility for the new strategic-region map. */
(() => {
  const previousDetectCoastalProvince = detectCoastalProvince;
  detectCoastalProvince = function detectCoastalProvinceV431(mapProvince) {
    if (!mapProvince) return false;
    const code = mapProvince.owner;
    const label = `${mapProvince.sourceName || ''} ${mapProvince.name || ''}`;

    // Strategic-region names are intentionally larger than modern ADM1 units.
    // These explicit rules preserve real national coastlines and prevent naval industry from being erased.
    if (code === 'FIN' && /南部|西部/.test(label)) return true;
    if (code === 'SWE' && /斯科讷|约塔兰|斯韦阿兰|诺尔兰/.test(label)) return true;
    if (code === 'GRE' && /马其顿|色雷斯|希腊中部|伯罗奔尼撒|爱琴海/.test(label)) return true;
    if (code === 'ALB') return true;
    if (code === 'BUL' && /黑海沿岸/.test(label)) return true;
    if (code === 'ROM' && /多布罗加/.test(label)) return true;
    if (code === 'TUR' && /东色雷斯|马尔马拉|爱琴海沿岸|黑海/.test(label)) return true;
    if (code === 'USSR' && /列宁格勒|敖德萨|黑海沿岸|外高加索/.test(label)) return true;
    if (code === 'POL' && /波美拉利亚/.test(label)) return true;
    if (code === 'GER' && /石勒苏益格|梅克伦堡|波美拉尼亚|东普鲁士/.test(label)) return true;

    if (typeof mapProvince.isCoastal === 'boolean') return mapProvince.isCoastal;
    if (typeof mapProvince.coastal === 'boolean') return mapProvince.coastal;
    return previousDetectCoastalProvince(mapProvince);
  };
})();
