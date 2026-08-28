const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(
  __dirname,
  '..',
  'reference',
  'v4.9',
  'four-color-map-game-browser-v4-9-modes-economy.html',
);
const source = fs.readFileSync(sourcePath, 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist in the canonical v4.9 source`);
  const openingParen = source.indexOf('(', start);
  let parameterDepth = 0;
  let closingParen = -1;
  for (let index = openingParen; index < source.length; index += 1) {
    if (source[index] === '(') parameterDepth += 1;
    if (source[index] === ')') {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        closingParen = index;
        break;
      }
    }
  }
  assert.notEqual(closingParen, -1, `${name} must have a complete parameter list`);
  const openingBrace = source.indexOf('{', closingParen);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openingBrace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not find the end of ${name}`);
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createOptionGenerator(seed) {
  const seededMath = Object.create(Math);
  seededMath.random = mulberry32(seed);
  const sandbox = { Math: seededMath };
  vm.createContext(sandbox);
  const functionNames = [
    'shuffle',
    'rand',
    'roundTo',
    'formatNumber',
    'option',
    'makeRankedNumericOptions',
  ];
  const script = [
    'let quizOptionSerial = 1;',
    ...functionNames.map(extractFunction),
    'globalThis.generateOptions = makeRankedNumericOptions;',
  ].join('\n');
  vm.runInContext(script, sandbox);
  return sandbox.generateOptions;
}

function chiSquare(counts) {
  const expected = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  return counts.reduce((sum, count) => sum + ((count - expected) ** 2) / expected, 0);
}

function independenceChiSquare(matrix) {
  const rowTotals = matrix.map((row) => row.reduce((sum, count) => sum + count, 0));
  const columnTotals = matrix[0].map((_, column) =>
    matrix.reduce((sum, row) => sum + row[column], 0),
  );
  const total = rowTotals.reduce((sum, count) => sum + count, 0);
  return matrix.reduce(
    (sum, row, rowIndex) => sum + row.reduce((rowSum, observed, columnIndex) => {
      const expected = (rowTotals[rowIndex] * columnTotals[columnIndex]) / total;
      return rowSum + ((observed - expected) ** 2) / expected;
    }, 0),
    0,
  );
}

test('v4.9 randomizes both the displayed answer slot and its numeric rank', () => {
  const generateOptions = createOptionGenerator(0x4c4f524d);
  const samples = 60_000;
  const displayedSlotCounts = Array(6).fill(0);
  const numericRankCounts = Array(6).fill(0);
  const jointCounts = Array.from({ length: 6 }, () => Array(6).fill(0));

  for (let index = 0; index < samples; index += 1) {
    const answer = ((index * 37) % 2001) - 1000;
    const options = generateOptions(answer, { count: 6, digits: 0 });
    assert.equal(options.length, 6);
    assert.equal(options.filter((option) => option.isCorrect).length, 1);
    assert.equal(new Set(options.map((option) => option.label)).size, 6);

    const displayedSlot = options.findIndex((option) => option.isCorrect);
    const numericRank = [...options]
      .sort((left, right) => left.value - right.value)
      .findIndex((option) => option.isCorrect);
    displayedSlotCounts[displayedSlot] += 1;
    numericRankCounts[numericRank] += 1;
    jointCounts[displayedSlot][numericRank] += 1;
  }

  // df=5. The generous ceiling catches structural bias while avoiding flaky noise.
  assert.ok(chiSquare(displayedSlotCounts) < 30, JSON.stringify(displayedSlotCounts));
  assert.ok(chiSquare(numericRankCounts) < 30, JSON.stringify(numericRankCounts));
  assert.ok(displayedSlotCounts.every((count) => count > samples * 0.15));
  assert.ok(numericRankCounts.every((count) => count > samples * 0.15));

  // Marginal uniformity alone is insufficient: position and numeric rank must
  // also be independent across all 36 combinations.
  const expectedJoint = samples / 36;
  const flattenedJoint = jointCounts.flat();
  assert.ok(flattenedJoint.every((count) => count > 0), JSON.stringify(jointCounts));
  assert.ok(independenceChiSquare(jointCounts) < 55, JSON.stringify(jointCounts));
  assert.ok(
    flattenedJoint.every((count) => Math.abs(count - expectedJoint) < expectedJoint * 0.1),
    JSON.stringify(jointCounts),
  );

  // A trivial predictor that guesses rank from display slot should remain near
  // the 1/6 chance baseline.
  const bestSlotOnlyPredictions = jointCounts.reduce(
    (correct, row) => correct + Math.max(...row),
    0,
  );
  assert.ok(bestSlotOnlyPredictions / samples < 0.18, JSON.stringify(jointCounts));
});
