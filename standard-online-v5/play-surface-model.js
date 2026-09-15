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
  function choice(role, color, uses, available, slot = null) {
    const sealed = validColor(color) && safeCount(ownSeals?.[color]) > 0;
    const matches = Number.isInteger(slot) && Array.isArray(own.privateEffects?.paletteDebuffs)
      ? own.privateEffects.paletteDebuffs.filter(effect => effect?.slot === slot) : [];
    const effect = matches.length === 1 ? matches[0] : null;
    const polluted = effect && validColor(effect.previousColor) && effect.previousColor !== color
      && effect.injectedColor === color && validColor(color)
      && Number.isSafeInteger(effect.remaining) && effect.remaining >= 1 && effect.remaining <= 2;
    return Object.freeze({
      role, color: validColor(color) ? color : null, uses, available,
      originColor: polluted ? effect.previousColor : validColor(color) ? color : null,
      pollutionRemaining: polluted ? effect.remaining : 0,
      sealed, selectable: available && !sealed,
      mark: !available ? "×" : sealed ? "lock" : uses === null ? "∞" : String(uses),
    });
  }
  const slots = [0, 1].map(index => choice("basic" + (index + 1), basic[index], null, validColor(basic[index]), index));
  slots.push(choice("bonus", bonus, bonusUses, Boolean(bonus && bonusUses > 0), 2));
  // Keep resource roles separate. If an exhausted bonus is temporarily granted
  // by borrow/prism, its usable grant belongs in slot4 instead of disappearing.
  const covered = new Set(basic.filter(validColor));
  if (bonus && bonusUses > 0) covered.add(bonus);
  const remaining = PALETTE_COLORS.filter(color => !covered.has(color))
    .map(color => choice("remaining", color, 1, prism || temporary.has(color)));
  const grants = remaining.filter(item => item.available);
  // The idle fourth role is not a menu of every color lost to pollution.
  // Actual temporary grants stay distinct, including exhausted bonus grants.
  const idleColor = PALETTE_COLORS.find(color => !slots.some(item => item.originColor === color)) || null;
  const selected = remaining.find(item => item.color === selectedRemaining && item.available)
    || remaining.find(item => item.selectable)
    || remaining.find(item => item.available)
    || choice("remaining", idleColor, 0, false);
  slots.push(Object.freeze({ ...selected, options: Object.freeze(remaining),
    displayOptions: Object.freeze(grants.length ? grants : [selected]) }));
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
