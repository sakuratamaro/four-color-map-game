(function initStateCodec(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorOnlineState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function stateCodecFactory() {
  "use strict";

  const TYPE_KEY = "__fourColorMapType";

  function encode(value, seen) {
    if (value instanceof Set) {
      return { [TYPE_KEY]: "Set", values: Array.from(value, (item) => encode(item, seen)) };
    }
    if (value instanceof Map) {
      return {
        [TYPE_KEY]: "Map",
        entries: Array.from(value, ([key, item]) => [encode(key, seen), encode(item, seen)]),
      };
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return { [TYPE_KEY]: "Number", value: String(value) };
    }
    if (Array.isArray(value)) return value.map((item) => encode(item, seen));
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) throw new TypeError("Game state must not contain circular references");

    seen.add(value);
    const result = {};
    for (const key of Object.keys(value)) result[key] = encode(value[key], seen);
    seen.delete(value);
    return result;
  }

  function decode(value) {
    if (Array.isArray(value)) return value.map(decode);
    if (!value || typeof value !== "object") return value;

    if (value[TYPE_KEY] === "Set") return new Set((value.values || []).map(decode));
    if (value[TYPE_KEY] === "Map") {
      return new Map((value.entries || []).map(([key, item]) => [decode(key), decode(item)]));
    }
    if (value[TYPE_KEY] === "Number") {
      if (value.value === "Infinity") return Infinity;
      if (value.value === "-Infinity") return -Infinity;
      if (value.value === "NaN") return NaN;
      throw new TypeError("Unknown encoded number: " + value.value);
    }

    const result = {};
    for (const key of Object.keys(value)) result[key] = decode(value[key]);
    return result;
  }

  function toSnapshot(game) {
    if (!game || typeof game !== "object") throw new TypeError("Game state must be an object");
    return encode(game, new WeakSet());
  }

  function fromSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") throw new TypeError("Snapshot must be an object");
    return decode(snapshot);
  }

  function stringify(game) {
    return JSON.stringify(toSnapshot(game));
  }

  function parse(serialized) {
    return fromSnapshot(JSON.parse(serialized));
  }

  return Object.freeze({ TYPE_KEY, toSnapshot, fromSnapshot, stringify, parse });
});
