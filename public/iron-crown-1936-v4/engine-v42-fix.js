'use strict';

/** Compatibility patch for the Spanish Nationalist side and old V4 saves. */
(() => {
  COUNTRY_DEFS.ESP_N ??= {
    ...deepClone(COUNTRY_DEFS.ESP),
    name: '西班牙国民军', short: '西班牙国民军', color: '#b8a06b',
    ideology: '国民主义', army: 0, air: 0, navy: 0, civ: 0, mil: 0, dockyard: 0,
    generals: ['弗朗哥', '莫拉', '瓦雷拉'], aliases: ['Nationalist Spain'], iso: [],
  };
  const proto = IronCrownV4.prototype;
  const previous = proto.initCountries;
  proto.initCountries = function initCountriesV42Compatibility() {
    previous.call(this);
    if (!this.countries.ESP_N) {
      const base = deepClone(this.countries.ESP);
      base.code = 'ESP_N'; base.name = '西班牙国民军'; base.short = '西班牙国民军'; base.color = '#b8a06b';
      base.ideology = '国民主义'; base.army = 0; base.availableManpower = 80; base.civ = 0; base.mil = 0; base.dockyard = 0;
      base.production = []; base.shipProduction = []; base.training = []; base.construction = []; base.airWings = []; base.fleets = [];
      base.generals = COUNTRY_DEFS.ESP_N.generals.map((name, index) => ({ id: `ESP_N-general-${index}`, name, skill: 3, attack: 3, defense: 3, logistics: 2, planning: 3, assignedFront: null }));
      this.countries.ESP_N = base;
    }
  };
})();
