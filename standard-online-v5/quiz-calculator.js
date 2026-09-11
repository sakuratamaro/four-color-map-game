// UDL-048: arithmetic only. No question, answer, network, or game-state access.
export const CALCULATOR_LIMITS = Object.freeze({ characters: 96, tokens: 64, depth: 12, history: 8 });

const messages = Object.freeze({
  EMPTY: "式を入力してください。",
  INVALID: "数字と ＋ − × ÷、小数点、括弧だけを使えます。",
  INCOMPLETE: "式や括弧を確認してください。",
  LIMIT: "式が長すぎます。短く分けて計算してください。",
  ZERO_DIVISION: "0では割れません。",
  NON_FINITE: "計算できる数の範囲を超えています。",
});

export function calculateExpression(source) {
  const fail = (code) => { throw Object.assign(new Error(code), { calculatorCode: code }); };
  try {
    if (typeof source !== "string") fail("INVALID");
    if (source.length > CALCULATOR_LIMITS.characters) fail("LIMIT");
    const expression = source.replace(/[×＊]/g, "*").replace(/[÷／]/g, "/").replace(/[−－]/g, "-").replace(/＋/g, "+");
    const tokens = [];
    for (let offset = 0; offset < expression.length;) {
      if (/\s/.test(expression[offset])) { offset += 1; continue; }
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(expression.slice(offset));
      if (number) { tokens.push(Number(number[0])); offset += number[0].length; }
      else if ("+-*/()".includes(expression[offset])) tokens.push(expression[offset++]);
      else fail("INVALID");
      if (tokens.length > CALCULATOR_LIMITS.tokens) fail("LIMIT");
    }
    if (!tokens.length) fail("EMPTY");
    let cursor = 0;
    const finite = (value) => { if (!Number.isFinite(value)) fail("NON_FINITE"); return value; };
    function primary(depth) {
      if (depth > CALCULATOR_LIMITS.depth) fail("LIMIT");
      const token = tokens[cursor++];
      if (token === "+") return primary(depth + 1);
      if (token === "-") return finite(-primary(depth + 1));
      if (typeof token === "number") return finite(token);
      if (token !== "(") fail("INCOMPLETE");
      const value = sum(depth + 1);
      if (tokens[cursor++] !== ")") fail("INCOMPLETE");
      return value;
    }
    function product(depth) {
      let value = primary(depth);
      while (tokens[cursor] === "*" || tokens[cursor] === "/") {
        const operator = tokens[cursor++];
        const right = primary(depth);
        if (operator === "/" && right === 0) fail("ZERO_DIVISION");
        value = finite(operator === "*" ? value * right : value / right);
      }
      return value;
    }
    function sum(depth) {
      let value = product(depth);
      while (tokens[cursor] === "+" || tokens[cursor] === "-") {
        const operator = tokens[cursor++];
        const right = product(depth);
        value = finite(operator === "+" ? value + right : value - right);
      }
      return value;
    }
    const value = sum(0);
    if (cursor !== tokens.length) fail("INCOMPLETE");
    const display = new Intl.NumberFormat("en-US", { useGrouping: false, maximumSignificantDigits: 12 }).format(Object.is(value, -0) ? 0 : value);
    return { ok: true, value, display };
  } catch (error) {
    const code = Object.hasOwn(messages, error?.calculatorCode) ? error.calculatorCode : "INVALID";
    return { ok: false, code, message: messages[code] };
  }
}
