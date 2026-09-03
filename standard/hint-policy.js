"use strict";

const HINT_MS = Object.freeze({ instant: 3000, normal: 3000, hard: 5000, spike: 5000 });

const HINTS = Object.freeze({
  add: "位をそろえ、同じ位どうしを足します。",
  subtract: "位をそろえ、必要なら上の位から借ります。",
  multiply: "片方を分けて分配法則で考えると確認しやすくなります。",
  divide: "割る数を掛けて元の数になる候補を探します。",
  missing: "等式の両辺へ同じ操作をして空欄だけを残します。",
  compare: "同じ尺度へ直してから順序を比べます。",
  linear: "定数項を移し、最後に係数で割ります。",
  percent: "百分率を割合へ直して元の量へ掛けます。",
  order: "括弧、掛け算・割り算、足し算・引き算の順です。",
  unit: "単位間の倍率を確認して小数点を移します。",
  average: "合計を個数で割ります。",
  power: "底を指数の回数だけ掛け合わせます。",
  root: "自分自身を掛けると根号内になる数を探します。",
  factorial: "自然数をひとつずつ下げながら掛け合わせます。",
  sigma: "規則を確認し、各項の合計として整理します。",
  expression: "括弧の中を先に処理します。",
  quadratic: "積と和が係数に合う組を探します。",
  combination: "順序を区別しない選び方として整理します。",
  sequence: "初項へ、公差を必要回数だけ加えます。",
  matrixAdd: "同じ行・同じ列の成分どうしを足します。",
  determinant: "主対角の積から逆対角の積を引きます。",
  matrixMultiply: "指定行と指定列の対応成分を掛けて足します。",
  sigmaSquare: "二乗和と定数項の和へ分けて整理します。",
  factorialRatio: "分子と分母で共通する階乗部分を消します。",
  system: "片方の文字を消去できるよう式をそろえます。",
  determinantProduct: "積の行列式は、それぞれの行列式の積として考えられます。",
});

function hintDurationMs(band) {
  if (!Object.hasOwn(HINT_MS, band)) throw new RangeError("UNKNOWN_DIFFICULTY_BAND");
  return HINT_MS[band];
}

function hintFor({ templateId, difficulty }) {
  const text = HINTS[templateId];
  if (!text) throw new RangeError("UNKNOWN_HINT_TEMPLATE");
  return Object.freeze({ text, durationMs: hintDurationMs(difficulty) });
}

module.exports = { HINTS, HINT_MS, hintDurationMs, hintFor };
