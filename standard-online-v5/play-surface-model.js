// Presentation of the viewer's own authoritative projection; no board legality oracle.
export const PALETTE_COLORS = Object.freeze(["red", "blue", "yellow", "green"]);
const validColor = value => PALETTE_COLORS.includes(value);
const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function paletteRoleSlots(privateState = {}, ownSeals = {}, selectedRemaining = null) {
  const own = privateState && typeof privateState === "object" ? privateState : {};
  const basic = Array.isArray(own.basicPalette) ? own.basicPalette.slice(0, 2) : [];
  const bonus = validColor(own.bonusColor) ? own.bonusColor : null;
  const bonusUses = safeCount(own.bonusUsesRemaining);
  const temporary = new Set(Array.isArray(own.privateEffects?.temporaryColors)
    ? own.privateEffects.temporaryColors.filter(validColor) : []);
  const prism = own.privateEffects?.prism === true;
  function choice(role, color, uses, available) {
    const sealed = validColor(color) && safeCount(ownSeals?.[color]) > 0;
    return Object.freeze({
      role, color: validColor(color) ? color : null, uses, available,
      sealed, selectable: available && !sealed,
      mark: !available ? "❌" : sealed ? "🔒" : uses === null ? "∞" : String(uses),
    });
  }
  const slots = [0, 1].map(index => choice("basic" + (index + 1), basic[index], null, validColor(basic[index])));
  slots.push(choice("bonus", bonus, bonusUses, Boolean(bonus && bonusUses > 0)));
  // Keep resource roles separate. If an exhausted bonus is temporarily granted
  // by borrow/prism, its usable grant belongs in slot4 instead of disappearing.
  const covered = new Set(basic.filter(validColor));
  if (bonus && bonusUses > 0) covered.add(bonus);
  const remaining = PALETTE_COLORS.filter(color => !covered.has(color))
    .map(color => choice("remaining", color, 1, prism || temporary.has(color)));
  const selected = remaining.find(item => item.color === selectedRemaining && item.available)
    || remaining.find(item => item.selectable)
    || remaining.find(item => item.available)
    || remaining[0]
    || choice("remaining", null, 0, false);
  slots.push(Object.freeze({ ...selected, options: Object.freeze(remaining) }));
  return Object.freeze(slots);
}

export function stableHandSlots(privateState = {}, knownSkills = {}) {
  const own = privateState && typeof privateState === "object" ? privateState : {};
  const hand = own.hand && typeof own.hand === "object" ? own.hand : {};
  const loadout = ["color", "area", "disrupt"].flatMap(category =>
    Array.isArray(own.loadout?.[category]) ? own.loadout[category] : []);
  const valid = id => typeof id === "string" && Object.hasOwn(knownSkills, id);
  const ids = [...new Set([...loadout.filter(valid), ...Object.keys(hand).filter(valid)])];
  return Object.freeze(ids.map((skill, index) => Object.freeze({
    skill, index, count: safeCount(hand[skill]), used: safeCount(hand[skill]) === 0,
    extra: loadout.length > 0 ? !loadout.includes(skill) : index >= 6,
  })));
}
