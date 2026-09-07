"use strict";
((root, factory) => {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  root.FourColorStandardSkillRegistry = value;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const skills = {
  "colorRandomBorrow": {
    "id": "colorRandomBorrow",
    "displayName": "色拾い・乱",
    "category": "color",
    "usageCategory": "color",
    "rarity": 1,
    "timing": "COLOR",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "colorChoiceBorrow": {
    "id": "colorChoiceBorrow",
    "displayName": "色借り",
    "category": "color",
    "usageCategory": "color",
    "rarity": 2,
    "timing": "COLOR",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "colorPrism": {
    "id": "colorPrism",
    "displayName": "四色解放",
    "category": "color",
    "usageCategory": "color",
    "rarity": 3,
    "timing": "COLOR",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "colorBonusRefill": {
    "id": "colorBonusRefill",
    "displayName": "おまけ色補充",
    "category": "color",
    "usageCategory": "color",
    "rarity": 2,
    "timing": "COLOR",
    "v49Catalogued": false,
    "standardUiEnabled": false,
    "alphaUiEnabled": true,
    "experimental": true
  },
  "colorRegionSplit": {
    "id": "colorRegionSplit",
    "displayName": "エリア二分",
    "category": "color",
    "usageCategory": "color",
    "rarity": 4,
    "timing": "COLOR",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "colorPaletteChange": {
    "id": "colorPaletteChange",
    "displayName": "持ち色変更",
    "category": "color",
    "usageCategory": "color",
    "rarity": 5,
    "timing": "COLOR",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "areaMicroBloom": {
    "id": "areaMicroBloom",
    "displayName": "ひとふくらみ",
    "category": "area",
    "usageCategory": "area",
    "rarity": 1,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "areaDiePlus": {
    "id": "areaDiePlus",
    "displayName": "エリア拡張",
    "category": "area",
    "usageCategory": "area",
    "rarity": 2,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "areaResize": {
    "id": "areaResize",
    "displayName": "拡大縮小",
    "category": "area",
    "usageCategory": "area",
    "rarity": 3,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "areaCornerBloom": {
    "id": "areaCornerBloom",
    "displayName": "角膨張",
    "category": "area",
    "usageCategory": "area",
    "rarity": 4,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "areaHalfShift": {
    "id": "areaHalfShift",
    "displayName": "半マスシフト",
    "category": "area",
    "usageCategory": "area",
    "rarity": 4,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "areaTripleShift": {
    "id": "areaTripleShift",
    "displayName": "三層断層",
    "category": "area",
    "usageCategory": "area",
    "rarity": 5,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "disruptRandomOne": {
    "id": "disruptRandomOne",
    "displayName": "色封じ・乱",
    "category": "disrupt",
    "usageCategory": "disrupt",
    "rarity": 1,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "disruptChoiceOne": {
    "id": "disruptChoiceOne",
    "displayName": "色封じ",
    "category": "disrupt",
    "usageCategory": "disrupt",
    "rarity": 2,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "disruptRandomTwo": {
    "id": "disruptRandomTwo",
    "displayName": "二重封じ・乱",
    "category": "disrupt",
    "usageCategory": "disrupt",
    "rarity": 3,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "disruptPaletteRandom": {
    "id": "disruptPaletteRandom",
    "displayName": "持ち色汚染・乱",
    "category": "disrupt",
    "usageCategory": "disrupt",
    "rarity": 3,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "disruptChoiceTwo": {
    "id": "disruptChoiceTwo",
    "displayName": "追封",
    "category": "disrupt",
    "usageCategory": "disrupt",
    "rarity": 4,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "disruptPaletteChoice": {
    "id": "disruptPaletteChoice",
    "displayName": "持ち色汚染",
    "category": "disrupt",
    "usageCategory": "disrupt",
    "rarity": 4,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "disruptChoiceThree": {
    "id": "disruptChoiceThree",
    "displayName": "長封",
    "category": "disrupt",
    "usageCategory": "disrupt",
    "rarity": 5,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "disruptForcedPalette": {
    "id": "disruptForcedPalette",
    "displayName": "強制持ち替え",
    "category": "disrupt",
    "usageCategory": "disrupt",
    "rarity": 5,
    "timing": "WORK",
    "v49Catalogued": true,
    "standardUiEnabled": true,
    "alphaUiEnabled": false,
    "experimental": false
  },
  "legalRecolor": {
    "id": "legalRecolor",
    "displayName": "塗り直し・乱",
    "category": "experimental",
    "usageCategory": "color",
    "rarity": 3,
    "timing": "WORK",
    "v49Catalogued": false,
    "standardUiEnabled": false,
    "alphaUiEnabled": true,
    "experimental": true
  }
};
  for (const definition of Object.values(skills)) Object.freeze(definition);
  return Object.freeze({
    VERSION: "standard-skill-registry-generated-v1",
    skills: Object.freeze(skills),
    v49SkillIds: Object.freeze(["colorRandomBorrow","colorChoiceBorrow","colorPrism","colorRegionSplit","colorPaletteChange","areaMicroBloom","areaDiePlus","areaResize","areaCornerBloom","areaHalfShift","areaTripleShift","disruptRandomOne","disruptChoiceOne","disruptRandomTwo","disruptPaletteRandom","disruptChoiceTwo","disruptPaletteChoice","disruptChoiceThree","disruptForcedPalette"]),
  });
});
