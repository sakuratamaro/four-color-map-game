"use strict";

let optionSerial = 1;

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function sample(random, values) {
  return values[randomInt(random, 0, values.length - 1)];
}

function shuffle(random, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInt(random, 0, index);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function roundTo(value, digits = 0) {
  const power = 10 ** digits;
  return Math.round((value + Number.EPSILON) * power) / power;
}

function formatNumber(value, digits = 4) {
  if (Number.isInteger(value)) return String(value);
  return String(roundTo(value, digits)).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

function factorial(value) {
  let result = 1;
  for (let current = 2; current <= value; current += 1) result *= current;
  return result;
}

function combination(n, r) {
  const count = Math.min(r, n - r);
  let result = 1;
  for (let index = 1; index <= count; index += 1) result = result * (n - count + index) / index;
  return Math.round(result);
}

function option(label, value, isCorrect = false) {
  return Object.freeze({ id: `standard-opt-${optionSerial++}`, label: String(label), value, isCorrect });
}

function makeRankedNumericOptions(answer, { digits = 0, formatter = null, count = 6, rankRandom, placementRandom }) {
  const correctRank = randomInt(rankRandom, 0, count - 1);
  const belowCount = correctRank;
  const aboveCount = count - 1 - correctRank;
  const integer = digits === 0;
  const unit = integer ? Math.max(1, Math.round(Math.max(1, Math.abs(answer)) * 0.045)) : 10 ** (-digits);
  const used = new Set([formatNumber(answer, Math.max(digits, 6))]);
  const build = (side, targetCount) => {
    const values = [];
    let guard = 0;
    while (values.length < targetCount && guard++ < 500) {
      const multiplier = randomInt(rankRandom, 1, Math.max(12, count * 4));
      const jitter = integer ? randomInt(rankRandom, 0, Math.max(1, Math.round(unit))) : randomInt(rankRandom, 0, 4) * unit;
      const value = roundTo(answer + side * (unit * multiplier + jitter), digits);
      const key = formatNumber(value, Math.max(digits, 6));
      if (!used.has(key)) {
        used.add(key);
        values.push(value);
      }
    }
    while (values.length < targetCount) {
      const value = roundTo(answer + side * unit * (values.length + 17), digits);
      const key = formatNumber(value, Math.max(digits, 6));
      if (!used.has(key)) {
        used.add(key);
        values.push(value);
      }
    }
    return values;
  };
  const below = build(-1, belowCount);
  const above = build(1, aboveCount);
  const render = formatter || ((value) => formatNumber(value, digits));
  const items = [
    ...below.map((value) => option(render(value), value)),
    option(render(answer), answer, true),
    ...above.map((value) => option(render(value), value)),
  ];
  return shuffle(placementRandom, items);
}

function numericQuestion(templateKey, type, prompt, answer, level, randoms, { bonusMs = 0, digits = 0, formatter = null } = {}) {
  const options = makeRankedNumericOptions(answer, { digits, formatter, rankRandom: randoms.rank, placementRandom: randoms.placement });
  return {
    templateKey,
    type,
    prompt,
    options,
    correctId: options.find((entry) => entry.isCorrect).id,
    timeMs: [0, 10000, 13000, 18000, 25000, 40000][level] + bonusMs,
    answerLabel: formatter ? formatter(answer) : formatNumber(answer, digits),
    answer,
    level,
  };
}

function mixedNumberEntry(level, random, usedValues, usedLabels) {
  const forms = level >= 3 ? ["fraction", "decimal", "percent", "root"] : ["fraction", "decimal", "percent"];
  for (let tries = 0; tries < 300; tries += 1) {
    const form = sample(random, forms);
    let label;
    let value;
    if (form === "fraction") {
      const denominator = randomInt(random, 2, level >= 4 ? 18 : 10);
      const numerator = randomInt(random, level >= 4 ? -denominator * 2 : 1, denominator * 3);
      const divisor = gcd(numerator, denominator);
      label = `${numerator / divisor}/${denominator / divisor}`;
      value = numerator / denominator;
    } else if (form === "decimal") {
      const digits = level >= 3 ? randomInt(random, 1, 3) : randomInt(random, 1, 2);
      const scale = 10 ** digits;
      value = randomInt(random, level >= 4 ? -150 : 5, level >= 4 ? 350 : 160) / scale;
      label = value.toFixed(digits);
    } else if (form === "percent") {
      const percent = randomInt(random, level >= 4 ? -80 : 5, level >= 4 ? 250 : 160);
      value = percent / 100;
      label = `${percent}%`;
    } else {
      const root = randomInt(random, 2, level >= 5 ? 180 : 80);
      const scale = sample(random, [1, 10]);
      value = Math.sqrt(root) / scale;
      label = `√${root}${scale === 10 ? "/10" : ""}`;
    }
    const valueKey = roundTo(value, 7).toString();
    if (!usedValues.has(valueKey) && !usedLabels.has(label)) {
      usedValues.add(valueKey);
      usedLabels.add(label);
      return { label, value };
    }
  }
  throw new Error("COMPARISON_OPTION_EXHAUSTED");
}

function comparisonQuestion(level, _askMax, randoms) {
  const usedValues = new Set();
  const usedLabels = new Set();
  const entries = [];
  while (entries.length < 6) entries.push(mixedNumberEntry(level, randoms.content, usedValues, usedLabels));
  const targetRank = randomInt(randoms.rank, 0, entries.length - 1);
  const chosen = [...entries].sort((left, right) => left.value - right.value)[targetRank];
  const options = shuffle(randoms.placement, entries.map((entry) => option(entry.label, entry.value, entry === chosen)));
  const target = targetRank === 0 ? "一番小さい" : targetRank === entries.length - 1 ? "一番大きい" : `小さい方から${targetRank + 1}番目の`;
  return { templateKey: "compare", type: "大小比較", prompt: `次のうち${target}数を選べ！`, options, correctId: options.find((entry) => entry.isCorrect).id, timeMs: [0, 13000, 17000, 22000, 32000, 47000][level], answerLabel: chosen.label, answer: chosen.value, level };
}

function generatorsFor(randoms) {
  const r = randoms.content;
  const n = (key, type, prompt, answer, level, extra) => numericQuestion(key, type, prompt, answer, level, randoms, extra);
  return {
    1: [
      ["add", () => { const a = randomInt(r, 5, 75); const b = randomInt(r, 3, 45); return n("add", "加算", `${a} + ${b} = ?`, a + b, 1); }],
      ["subtract", () => { const a = randomInt(r, 25, 110); const b = randomInt(r, 2, a - 1); return n("subtract", "減算", `${a} − ${b} = ?`, a - b, 1); }],
      ["multiply", () => { const a = randomInt(r, 2, 12); const b = randomInt(r, 2, 12); return n("multiply", "乗算", `${a} × ${b} = ?`, a * b, 1); }],
      ["divide", () => { const b = randomInt(r, 2, 12); const answer = randomInt(r, 2, 14); return n("divide", "除算", `${b * answer} ÷ ${b} = ?`, answer, 1); }],
      ["missing", () => { const answer = randomInt(r, 2, 30); const b = randomInt(r, 2, 30); return n("missing", "穴埋め", `□ + ${b} = ${answer + b}　□ = ?`, answer, 1, { bonusMs: 1000 }); }],
      ["compare", () => comparisonQuestion(1, true, randoms)],
    ],
    2: [
      ["linear", () => { const x = randomInt(r, -9, 18); const a = randomInt(r, 2, 8); const b = randomInt(r, -12, 12); return n("linear", "一次方程式", `${a}x ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`} = ${a * x + b}　x = ?`, x, 2, { bonusMs: 3000 }); }],
      ["percent", () => { const base = randomInt(r, 4, 40) * 10; const percent = sample(r, [5, 10, 15, 20, 25, 30, 40, 50, 60, 75]); const answer = base * percent / 100; return n("percent", "割合", `${base} の ${percent}% は？`, answer, 2, { bonusMs: 2000, digits: Number.isInteger(answer) ? 0 : 1 }); }],
      ["order", () => { const a = randomInt(r, 2, 15); const b = randomInt(r, 2, 12); const c = randomInt(r, 2, 9); return n("order", "計算順序", `${a} + ${b} × ${c} = ?`, a + b * c, 2, { bonusMs: 1000 }); }],
      ["unit", () => { const kg = randomInt(r, 1, 25) / 10; return n("unit", "単位換算", `${kg.toFixed(1)} kg = ? g`, Math.round(kg * 1000), 2, { bonusMs: 2000 }); }],
      ["average", () => { const values = Array.from({ length: 4 }, () => randomInt(r, 5, 30)); values[3] += (4 - values.reduce((a, b) => a + b, 0) % 4) % 4; return n("average", "平均", `平均を求めよ：${values.join("、")}`, values.reduce((a, b) => a + b, 0) / 4, 2, { bonusMs: 3000 }); }],
      ["compare", () => comparisonQuestion(2, r() < 0.8, randoms)],
    ],
    3: [
      ["power", () => { const a = randomInt(r, 2, 7); const power = randomInt(r, 2, 5); return n("power", "累乗", `${a}^${power} = ?`, a ** power, 3, { bonusMs: 2000 }); }],
      ["root", () => { const root = randomInt(r, 2, 24); return n("root", "平方根", `√${root * root} = ?`, root, 3, { bonusMs: 2000 }); }],
      ["factorial", () => { const value = randomInt(r, 3, 7); return n("factorial", "階乗", `${value}! = ?`, factorial(value), 3, { bonusMs: 5000 }); }],
      ["sigma", () => { const end = randomInt(r, 4, 9); return n("sigma", "Σ", `Σ(k=1→${end}) k = ?`, end * (end + 1) / 2, 3, { bonusMs: 6000 }); }],
      ["expression", () => { const x = randomInt(r, 2, 12); const a = randomInt(r, 2, 6); const b = randomInt(r, 1, 10); const c = randomInt(r, 1, 8); return n("expression", "展開不要の式", `${a}(${x} + ${b}) − ${c} = ?`, a * (x + b) - c, 3, { bonusMs: 3000 }); }],
      ["compare", () => comparisonQuestion(3, true, randoms)],
    ],
    4: [
      ["quadratic", () => { const small = randomInt(r, 1, 9); const large = randomInt(r, small + 1, 13); return n("quadratic", "二次方程式", `x² − ${small + large}x + ${small * large} = 0\n小さい解 x = ?`, small, 4, { bonusMs: 5000 }); }],
      ["combination", () => { const total = randomInt(r, 6, 11); const selected = randomInt(r, 2, Math.min(4, total - 2)); return n("combination", "組合せ", `${total}C${selected} = ?`, combination(total, selected), 4, { bonusMs: 6000 }); }],
      ["sequence", () => { const first = randomInt(r, 1, 12); const difference = randomInt(r, 2, 8); const index = randomInt(r, 6, 12); return n("sequence", "等差数列", `初項 ${first}、公差 ${difference} の等差数列\n第${index}項は？`, first + (index - 1) * difference, 4, { bonusMs: 6000 }); }],
      ["matrixAdd", () => { const A = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => randomInt(r, -5, 8))); const B = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => randomInt(r, -5, 8))); const row = randomInt(r, 0, 1); const column = randomInt(r, 0, 1); return n("matrixAdd", "行列加算", `A=[[${A[0].join(", ")}], [${A[1].join(", ")}]]\nB=[[${B[0].join(", ")}], [${B[1].join(", ")}]]\nA+B の ${row + 1}行${column + 1}列成分は？`, A[row][column] + B[row][column], 4, { bonusMs: 8000 }); }],
      ["determinant", () => { const a = randomInt(r, -6, 8); const b = randomInt(r, -6, 8); const c = randomInt(r, -6, 8); const d = randomInt(r, -6, 8); return n("determinant", "行列式", `det [[${a}, ${b}], [${c}, ${d}]] = ?`, a * d - b * c, 4, { bonusMs: 7000 }); }],
      ["sigma", () => { const end = randomInt(r, 4, 8); const a = randomInt(r, 2, 5); const b = randomInt(r, -3, 6); return n("sigma", "Σ", `Σ(k=1→${end}) (${a}k ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`}) = ?`, a * end * (end + 1) / 2 + b * end, 4, { bonusMs: 8000 }); }],
    ],
    5: [
      ["matrixMultiply", () => { const A = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => randomInt(r, -4, 6))); const B = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => randomInt(r, -4, 6))); const row = randomInt(r, 0, 1); const column = randomInt(r, 0, 1); return n("matrixMultiply", "行列積", `A=[[${A[0].join(", ")}], [${A[1].join(", ")}]]\nB=[[${B[0].join(", ")}], [${B[1].join(", ")}]]\nAB の ${row + 1}行${column + 1}列成分は？`, A[row][0] * B[0][column] + A[row][1] * B[1][column], 5, { bonusMs: 10000 }); }],
      ["sigmaSquare", () => { const end = randomInt(r, 4, 8); const a = randomInt(r, 1, 4); const b = randomInt(r, -4, 7); return n("sigmaSquare", "複合Σ", `Σ(k=1→${end}) (${a}k² ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`}) = ?`, a * end * (end + 1) * (2 * end + 1) / 6 + b * end, 5, { bonusMs: 10000 }); }],
      ["factorialRatio", () => { const total = randomInt(r, 6, 10); const count = randomInt(r, 2, 4); return n("factorialRatio", "階乗比", `${total}! / ${total - count}! = ?`, factorial(total) / factorial(total - count), 5, { bonusMs: 7000 }); }],
      ["system", () => { const x = randomInt(r, -6, 9); const y = randomInt(r, -6, 9); const a = randomInt(r, 2, 5); const b = randomInt(r, 1, 4); const c = randomInt(r, 1, 4); const d = randomInt(r, 2, 5); return n("system", "連立方程式", `${a}x + ${b}y = ${a * x + b * y}\n${c}x − ${d}y = ${c * x - d * y}\nx = ?`, x, 5, { bonusMs: 9000 }); }],
      ["determinantProduct", () => { const values = Array.from({ length: 8 }, () => randomInt(r, -5, 7)); const [a, b, c, d, e, f, g, h] = values; return n("determinantProduct", "行列式の積", `A=[[${a}, ${b}], [${c}, ${d}]]\nB=[[${e}, ${f}], [${g}, ${h}]]\ndet(AB) = ?`, (a * d - b * c) * (e * h - f * g), 5, { bonusMs: 10000 }); }],
      ["compare", () => comparisonQuestion(5, true, randoms)],
    ],
  };
}

function generateQuestion(level, randoms, previousTemplateKeys = []) {
  const catalog = generatorsFor(randoms)[level];
  const blocked = previousTemplateKeys.length >= 2 && previousTemplateKeys.at(-1) === previousTemplateKeys.at(-2) ? previousTemplateKeys.at(-1) : null;
  const candidates = blocked ? catalog.filter(([key]) => key !== blocked) : catalog;
  const [templateKey, generate] = sample(randoms.content, candidates);
  const question = generate();
  if (question.templateKey !== templateKey) throw new Error("TEMPLATE_KEY_MISMATCH");
  return Object.freeze({ ...question, options: Object.freeze(question.options) });
}

module.exports = { generateQuestion, makeRankedNumericOptions, randomInt, shuffle };
