# 《铁与王冠：1936》V4.1 机制重构说明

本版本不是把七条需求逐条硬编码，而是增加四层规则：地理约束层、经济与补给层、战争AI层、反馈层。所有规则均以可查询的 eligibility/result 对象返回结果，UI不再只得到 true/false。

## 1. 沿海建设限制

**架构思路：** 省份在游戏初始化时生成 `isCoastal`，建设统一通过 `getConstructionEligibility()` 校验。

```js
province.isCoastal = detectCoastalProvince(MapV4.getProvince(province.id));
const result = game.getConstructionEligibility(province.id, 'navalBase');
// { ok:false, code:'INLAND', reason:'❌ 内陆省份无法建造海军基地' }
```

采用“历史地区名称白名单 + 保守地理回退”的混合判定。原因是当前地图只有国家和ADM1多边形，没有独立海岸线拓扑；直接把“国家外边界”当海岸线会把德法边界误判为海岸。

## 2. 建筑上限与铁路瓶颈

**架构思路：** `BUILDING_RULES`统一保存上限；补给路径使用 maximin（最大化最小边容量）算法，而不是普通最短路。

```js
const BUILDING_RULES = {
  rail: { maxLevel: 5 },
  infrastructure: { maxLevel: 10 },
  navalBase: { maxLevel: 10, requiresCoast: true },
};

const flow = game.calculateSupplyFlow('GER', frontlineProvinceId);
// { connected:true, path:[...], bottleneckRail:2, flow:28 }
```

## 3. 历史地名

**架构思路：** 地图载入前向 `REGION_TRANSLATIONS`注入历史地理名称；未精确对应1936行政建制的现代ADM1被映射为可识别的历史地理区，而不是伪造精确边界。

主要覆盖德国、捷克斯洛伐克、奥地利、荷兰、比利时、波兰、法国和英国。

## 4. 德国资源与地区职能

**架构思路：** 德国省份资源先清零，再按地区角色配置；柏林只提供国家级加成，不提供矿产。

- 柏林：每日政治点、科研、军工组织加成。
- 莱茵-鲁尔：煤、铁、钢和重工业加成。
- 萨尔：煤钢次级中心。
- 西里西亚：煤钢次级中心。
- 萨克森：煤、机械与科研加成。
- 德国本土石油、橡胶、铝设为零，迫使玩家依赖贸易、合成技术或扩张。

## 5. 战争AI状态机

**架构思路：** AI每周在“前线集结→战略机动→战力评估→组织进攻/固守待机”之间切换。

```js
game.executeWarAI('FRA');
console.log(game.countries.FRA.ai.state);
```

后方师每次AI周期向最近前线移动一步；只有局部有效兵力比达到1.5时才建立主动战线，避免无脑自杀进攻。

## 6. 资源短缺与损耗

**架构思路：** 原料不足同时作用于生产和作战；损耗由补给、地形、天气和堆叠共同计算。

```js
const penalties = game.calculateResourcePenalties('GER');
// oil:0.58, aluminium:0.48, rubber:0.62...
```

低于30%补给会触发显著组织度和装备损失；山地、沼泽、丛林、泥泞、暴风雪以及超宽度堆叠进一步增加损耗。

## 7. Tooltip与战报气泡

**架构思路：** 被拒绝的操作返回结构化原因，按钮保持可点击以便iPad显示说明；战斗事件保存地图世界坐标，由独立UX层投影到屏幕。

```js
game.emitBattleEvent(provinceId, '💥 柏林大捷：击退敌军', 'victory');
// { x, y, provinceId, text, result, ttl }
```

## 文件划分

- `core-rules.js`：地名、沿海判定、建筑上限、德国地区配置。
- `engine-v41.js`：建设校验、补给瓶颈、资源惩罚、损耗、AI状态机、战报事件。
- `ux-v41.js`：动态Tooltip、按钮置灰原因、地区情报、战报气泡。
- `style-v41.css`：V4.1反馈层样式。
