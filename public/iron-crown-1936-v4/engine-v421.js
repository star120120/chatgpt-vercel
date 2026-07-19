'use strict';

/** Create the Spanish Nationalist runtime state only when the V4.2 civil-war system is present. */
(() => {
  const proto = IronCrownV4.prototype;
  if (typeof proto.startSpanishCivilWar !== 'function') return;
  const originalStart = proto.startSpanishCivilWar;
  proto.startSpanishCivilWar = function startSpanishCivilWarCompatibility(...args) {
    if (!this.countries.ESP_N) {
      const source = this.countries.ESP;
      if (source) {
        const faction = deepClone(source);
        Object.assign(faction, {
          code: 'ESP_N', name: '西班牙国民军', short: '西班牙国民军', color: '#b8a06b',
          ideology: '国民主义', alive: true, army: 0, availableManpower: 80,
          civ: 0, mil: 0, dockyard: 0, production: [], shipProduction: [], training: [],
          construction: [], airWings: [], fleets: [],
        });
        faction.generals = ['弗朗哥', '莫拉', '瓦雷拉'].map((name, index) => ({
          id: `ESP_N-general-${index}`, name, skill: 3, attack: 3, defense: 3,
          logistics: 2, planning: 3, assignedFront: null,
        }));
        faction.ai = { state: '内战集结', target: 'ESP', lastRedeployDay: 0, lastAttackDay: 0 };
        this.countries.ESP_N = faction;
      }
    }
    return originalStart.apply(this, args);
  };
})();

/** V4.2.1 performance layer: cache expensive daily calculations and keep one authoritative clock. */
(() => {
  const proto = IronCrownV4.prototype;

  const previousInitCountries = proto.initCountries;
  proto.initCountries = function initCountriesV421() {
    previousInitCountries.call(this);
    this.ruleVersion = '4.2.1-stable.1';
    this.performanceState = {
      supplyDay: -1,
      supplyNetworks: new Map(),
      resourceDay: -1,
      availableResources: new Map(),
      resourceBalances: new Map(),
      bonusDay: -1,
      provinceBonuses: new Map(),
      lastAdvanceMs: 0,
    };
  };

  proto.ensurePerformanceState = function ensurePerformanceState() {
    if (!this.performanceState || !(this.performanceState.supplyNetworks instanceof Map)) {
      this.performanceState = {
        supplyDay: -1,
        supplyNetworks: new Map(),
        resourceDay: -1,
        availableResources: new Map(),
        resourceBalances: new Map(),
        bonusDay: -1,
        provinceBonuses: new Map(),
        lastAdvanceMs: 0,
      };
    }
    return this.performanceState;
  };

  proto.invalidatePerformanceCaches = function invalidatePerformanceCaches(scope = 'all', countryId = null) {
    const state = this.ensurePerformanceState();
    if (scope === 'all' || scope === 'supply') {
      if (countryId) state.supplyNetworks.delete(countryId);
      else { state.supplyNetworks.clear(); state.supplyDay = -1; }
    }
    if (scope === 'all' || scope === 'resources') {
      if (countryId) {
        state.availableResources.delete(countryId);
        state.resourceBalances.delete(countryId);
      } else {
        state.availableResources.clear();
        state.resourceBalances.clear();
        state.resourceDay = -1;
      }
    }
    if (scope === 'all' || scope === 'bonuses') {
      if (countryId) state.provinceBonuses.delete(countryId);
      else { state.provinceBonuses.clear(); state.bonusDay = -1; }
    }
  };

  class MaxHeap {
    constructor() { this.items = []; }
    push(node) {
      this.items.push(node);
      let index = this.items.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (this.items[parent].priority >= node.priority) break;
        this.items[index] = this.items[parent];
        index = parent;
      }
      this.items[index] = node;
    }
    pop() {
      if (!this.items.length) return null;
      const root = this.items[0];
      const tail = this.items.pop();
      if (this.items.length && tail) {
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          if (left >= this.items.length) break;
          let child = left;
          if (right < this.items.length && this.items[right].priority > this.items[left].priority) child = right;
          if (this.items[child].priority <= tail.priority) break;
          this.items[index] = this.items[child];
          index = child;
        }
        this.items[index] = tail;
      }
      return root;
    }
    get size() { return this.items.length; }
  }

  proto.buildSupplyNetwork = function buildSupplyNetwork(countryId) {
    const state = this.ensurePerformanceState();
    if (state.supplyDay !== this.day) {
      state.supplyDay = this.day;
      state.supplyNetworks.clear();
    }
    if (state.supplyNetworks.has(countryId)) return state.supplyNetworks.get(countryId);

    const controlled = Object.values(this.provinces).filter(province => province.controller === countryId);
    const capital = controlled.find(province => province.capital) || controlled[0] || null;
    const network = {
      capitalId: capital?.id || null,
      capacity: new Map(),
      previous: new Map(),
      bottleneckRail: new Map(),
    };
    if (!capital) {
      state.supplyNetworks.set(countryId, network);
      return network;
    }

    const heap = new MaxHeap();
    const startCapacity = this.railNodeCapacity(capital);
    network.capacity.set(capital.id, startCapacity);
    network.bottleneckRail.set(capital.id, capital.rail);
    heap.push({ id: capital.id, priority: startCapacity });

    while (heap.size) {
      const currentEntry = heap.pop();
      if (!currentEntry) break;
      const currentCapacity = network.capacity.get(currentEntry.id) ?? -1;
      if (currentEntry.priority < currentCapacity) continue;
      const current = this.provinces[currentEntry.id];
      if (!current) continue;

      for (const neighborId of current.neighbors) {
        const neighbor = this.provinces[neighborId];
        if (!neighbor || neighbor.controller !== countryId) continue;
        const candidate = Math.min(currentCapacity, this.railNodeCapacity(neighbor));
        if (candidate <= (network.capacity.get(neighborId) ?? -1)) continue;
        network.capacity.set(neighborId, candidate);
        network.previous.set(neighborId, current.id);
        network.bottleneckRail.set(neighborId, Math.min(network.bottleneckRail.get(current.id) ?? current.rail, neighbor.rail));
        heap.push({ id: neighborId, priority: candidate });
      }
    }

    state.supplyNetworks.set(countryId, network);
    return network;
  };

  proto.calculateSupplyFlow = function calculateSupplyFlowV421(countryId, targetProvinceId) {
    const target = this.provinces[targetProvinceId];
    if (!target || target.controller !== countryId) {
      return { connected: false, path: [], bottleneckRail: 0, flow: 0, reason: '首都或目标省份不可用' };
    }
    const network = this.buildSupplyNetwork(countryId);
    if (!network.capitalId) {
      return { connected: false, path: [], bottleneckRail: 0, flow: 0, reason: '未找到有效首都补给源' };
    }
    if (!network.capacity.has(targetProvinceId)) {
      const navalFlow = target.isCoastal && target.navalBase > 0
        ? target.navalBase * 5 + Math.min(10, (this.countries[countryId]?.convoys || 0) / 20)
        : 0;
      return { connected: false, path: [], bottleneckRail: 0, flow: navalFlow, reason: navalFlow ? '依靠海运临时补给' : '补给线中断' };
    }

    const path = [];
    let cursor = targetProvinceId;
    let guard = 0;
    while (cursor && guard < 256) {
      path.unshift(cursor);
      if (cursor === network.capitalId) break;
      cursor = network.previous.get(cursor);
      guard += 1;
    }
    const bottleneckRail = network.bottleneckRail.get(targetProvinceId) ?? target.rail;
    return {
      connected: true,
      path,
      bottleneckRail,
      flow: network.capacity.get(targetProvinceId),
      reason: targetProvinceId === network.capitalId ? '首都直供' : `铁路瓶颈等级 ${bottleneckRail}`,
    };
  };

  const uncachedAvailableResources = proto.availableResources;
  proto.availableResources = function availableResourcesV421(code) {
    const state = this.ensurePerformanceState();
    if (state.resourceDay !== this.day) {
      state.resourceDay = this.day;
      state.availableResources.clear();
      state.resourceBalances.clear();
    }
    if (!state.availableResources.has(code)) state.availableResources.set(code, uncachedAvailableResources.call(this, code));
    return state.availableResources.get(code);
  };

  const uncachedResourceBalance = proto.resourceBalance;
  proto.resourceBalance = function resourceBalanceV421(code) {
    const state = this.ensurePerformanceState();
    if (state.resourceDay !== this.day) {
      state.resourceDay = this.day;
      state.availableResources.clear();
      state.resourceBalances.clear();
    }
    if (!state.resourceBalances.has(code)) state.resourceBalances.set(code, uncachedResourceBalance.call(this, code));
    return state.resourceBalances.get(code);
  };

  const uncachedBonuses = proto.controlledProvinceBonuses;
  proto.controlledProvinceBonuses = function controlledProvinceBonusesV421(code) {
    const state = this.ensurePerformanceState();
    if (state.bonusDay !== this.day) {
      state.bonusDay = this.day;
      state.provinceBonuses.clear();
    }
    if (!state.provinceBonuses.has(code)) state.provinceBonuses.set(code, uncachedBonuses.call(this, code));
    return state.provinceBonuses.get(code);
  };

  for (const methodName of ['changeProduction', 'changeShipProduction', 'addProductionLine', 'addShipLine', 'adjustImport']) {
    const original = proto[methodName];
    if (typeof original !== 'function') continue;
    proto[methodName] = function invalidateResourcesAfterAction(...args) {
      const result = original.apply(this, args);
      if (result) this.invalidatePerformanceCaches('resources', this.player);
      return result;
    };
  }

  const previousAdvanceFront = proto.advanceFront;
  proto.advanceFront = function advanceFrontV421(front) {
    const attacker = front?.attacker;
    const defender = front?.defender;
    const result = previousAdvanceFront.call(this, front);
    if (attacker) this.invalidatePerformanceCaches('all', attacker);
    if (defender) this.invalidatePerformanceCaches('all', defender);
    return result;
  };

  const previousStartSpanishCivilWar = proto.startSpanishCivilWar;
  if (typeof previousStartSpanishCivilWar === 'function') {
    proto.startSpanishCivilWar = function startSpanishCivilWarV421(...args) {
      const result = previousStartSpanishCivilWar.apply(this, args);
      this.invalidatePerformanceCaches('all');
      return result;
    };
  }

  const previousAdvanceDay = proto.advanceDay;
  proto.advanceDay = function advanceDayV421() {
    if (this._advancingDay) return false;
    this._advancingDay = true;
    const state = this.ensurePerformanceState();
    state.supplyNetworks.clear();
    state.availableResources.clear();
    state.resourceBalances.clear();
    state.provinceBonuses.clear();
    state.supplyDay = -1;
    state.resourceDay = -1;
    state.bonusDay = -1;
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      previousAdvanceDay.call(this);
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      state.lastAdvanceMs = end - start;
      return true;
    } finally {
      this._advancingDay = false;
    }
  };

  const previousLoad = IronCrownV4.load;
  IronCrownV4.load = function loadV421() {
    const loaded = previousLoad.call(this);
    if (!loaded) return null;
    loaded.performanceState = null;
    loaded.ensurePerformanceState();
    loaded.clock ??= { desiredSpeed: 1, lastAdvanceAt: Date.now(), stalledTicks: 0 };
    loaded.dynamicEvents ??= {};
    loaded.expeditions ??= [];
    loaded.intelligenceAlerts ??= [];
    loaded.civilWars ??= {};
    return loaded;
  };
})();
