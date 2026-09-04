import { createClient } from "npm:@supabase/supabase-js@2";
import "./standard-engine.bundle.js";

type JsonObject = Record<string, unknown>;
type Seat = "A" | "B";
type StandardEngineApi = {
  create(input: { matchId: string; loadouts: Record<Seat, JsonObject>; profiles: Record<Seat, JsonObject>; seed: number; debugMode?: boolean }): JsonObject;
  apply(input: { state: JsonObject; rngSnapshot: JsonObject; actor: Seat; action: JsonObject; expectedVersion: number; debugMode?: boolean }): JsonObject;
  applyCosmetic(input: { profile: JsonObject; cosmeticId: string }): { profile: JsonObject; quote: JsonObject };
  applyProfiles(input: { profiles: Record<Seat, JsonObject>; beforeState: JsonObject; nextState: JsonObject; actor: Seat; action: JsonObject; finishedAt: string; debugMode?: boolean }): { profiles: Record<Seat, JsonObject>; changed: Record<Seat, boolean> };
  applyCpuProfiles(input: { profiles: Record<Seat, JsonObject>; beforeState: JsonObject; nextState: JsonObject; actor: Seat; action: JsonObject; finishedAt: string; characterId: string }): { profiles: Record<Seat, JsonObject>; changed: Record<Seat, boolean> };
  createStarterProfile(displayName: string): JsonObject;
  drawGacha(input: { profile: JsonObject; ticketLevel: number; count: number; seed: number }): { profile: JsonObject; draws: JsonObject[] };
  quoteCardSale(input: { profile: JsonObject; skillId: string; count: number }): JsonObject;
  quoteCosmetic(input: { profile: JsonObject; cosmeticId: string }): JsonObject;
  sellCards(input: { profile: JsonObject; skillId: string; count: number; confirmed: boolean }): { profile: JsonObject; quote: JsonObject };
  getCpuRoster(): JsonObject[];
  getCosmetics(input: { profile: JsonObject }): JsonObject;
  createCpuProfile(characterId: string): { profile: JsonObject; loadout: JsonObject; policyVersion: string };
  chooseCpuAction(input: { publicState: JsonObject; ownPrivateState: JsonObject; characterId: string; seed: number }): JsonObject;
  publicState(state: JsonObject): JsonObject;
  privateState(state: JsonObject, seat: Seat): JsonObject;
  project(state: JsonObject, debugMode?: boolean): { publicState: JsonObject; privateA: JsonObject; privateB: JsonObject };
  validateProfile(profile: JsonObject): boolean;
  validateSeatLoadout(input: { loadout: JsonObject; profile?: JsonObject }): boolean;
};

declare global {
  // Generated from the reviewed Standard engine and profile modules.
  // deno-lint-ignore no-var
  var FourColorStandardServerEngine: StandardEngineApi;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEBUG_SETUP_KEY = "__debugUnlimitedSkills";
const QUIZ_TIMEOUT_ANSWER = "__timeout__";
const QUIZ_ANSWER_PATTERN = /^q(?:[1-9]|10)-[1-6]$/;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const RATE_WINDOW_MS = 60_000;
const RATE_ENTRY_LIMIT = 4096;
const RATE_GROUP = Object.freeze({
  "cosmetic-catalog": ["read", 120], "cosmetic-quote": ["read", 120], "card-sale-quote": ["read", 120], "cpu-roster": ["read", 120],
  profile: ["economy", 60], gacha: ["economy", 60], "card-sale": ["economy", 60], "cosmetic-action": ["economy", 60],
  "quiz-start": ["economy", 60], "quiz-finish": ["economy", 60],
  setup: ["match", 240], initialize: ["match", 240], action: ["match", 240], "cpu-action": ["match", 240],
  "cpu-accept": ["match", 240], "cpu-rematch": ["match", 240],
} as const);
const rateEntries = new Map<string, { windowStarted: number; count: number }>();

function rateLimited(actorId: string, operation: string, now = Date.now()): boolean {
  const policy = RATE_GROUP[operation as keyof typeof RATE_GROUP];
  if (!policy) return false;
  const [group, limit] = policy;
  const key = `${actorId}:${group}`;
  let entry = rateEntries.get(key);
  if (!entry || now - entry.windowStarted >= RATE_WINDOW_MS) {
    entry = { windowStarted: now, count: 0 };
    rateEntries.set(key, entry);
  }
  entry.count += 1;
  if (rateEntries.size > RATE_ENTRY_LIMIT) {
    for (const [candidate, value] of rateEntries) {
      if (now - value.windowStarted >= RATE_WINDOW_MS) rateEntries.delete(candidate);
    }
    while (rateEntries.size > RATE_ENTRY_LIMIT) rateEntries.delete(rateEntries.keys().next().value as string);
  }
  return entry.count > limit;
}

function json(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing Edge Function environment: ${name}`);
  return value;
}

function firstRow(value: unknown): JsonObject | null {
  if (Array.isArray(value)) return (value[0] as JsonObject | undefined) || null;
  return value && typeof value === "object" ? value as JsonObject : null;
}

function actorIdFromGatewayVerifiedJwt(authorization: string): string | null {
  try {
    const token = authorization.slice("Bearer ".length);
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (value) => value.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as JsonObject;
    return typeof payload.sub === "string" && UUID_PATTERN.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as JsonObject).sort().map((key) => [key, canonical((value as JsonObject)[key])]));
  }
  return value;
}

async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function storedLoadout(loadout: JsonObject, debugMode: boolean): JsonObject {
  return debugMode ? { ...loadout, [DEBUG_SETUP_KEY]: true } : { ...loadout };
}

function playableLoadout(loadout: JsonObject): JsonObject {
  const value = { ...loadout };
  delete value[DEBUG_SETUP_KEY];
  return value;
}

function debugModeForRoom(room: JsonObject): boolean | null {
  const a = Boolean((room.setup_a as JsonObject | null)?.[DEBUG_SETUP_KEY] === true);
  const b = Boolean((room.setup_b as JsonObject | null)?.[DEBUG_SETUP_KEY] === true);
  return a === b ? a : null;
}

async function deterministicCpuIdentity(roomId: string, version: number, characterId: string, policyVersion: string): Promise<{ actionId: string; seed: number }> {
  const hex = await fingerprint({ roomId, version, characterId, policyVersion });
  const actionId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return { actionId, seed: Number.parseInt(hex.slice(0, 8), 16) >>> 0 };
}

function secureSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0];
}

function secureInt(min: number, max: number): number {
  return min + (secureSeed() % (max - min + 1));
}

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = secureInt(0, index);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function factorial(value: number): number {
  let result = 1;
  for (let current = 2; current <= value; current += 1) result *= current;
  return result;
}

function combination(total: number, selected: number): number {
  return Math.round(factorial(total) / (factorial(selected) * factorial(total - selected)));
}

type QuizGenerated = {
  templateId: string;
  category: string;
  prompt: string;
  answer: number;
  hint: string;
  timeLimitSeconds: number;
  math?: JsonObject;
};

const QUIZ_FORMULA_DECOYS = Object.freeze([
  "長方形の面積：S = たて × よこ",
  "三角形の面積：S = 底辺 × 高さ ÷ 2",
  "円の面積：S = πr²",
  "直方体の体積：V = たて × よこ × 高さ",
  "円柱の体積：V = πr²h",
  "等差数列の和：Sₙ = n(a₁ + aₙ) ÷ 2",
  "組合せ：ₙCᵣ = n! ÷ (r!(n−r)!)",
  "微分：d(xⁿ)/dx = nxⁿ⁻¹",
  "積分：∫xⁿdx = xⁿ⁺¹/(n+1) + C",
  "2次の行列式：det A = ad − bc",
]);

function signedTerm(value: number): string {
  return value >= 0 ? `+ ${value}` : `− ${Math.abs(value)}`;
}

function quizHintOptions(correctHint: string): string[] {
  const decoys = shuffled(QUIZ_FORMULA_DECOYS.filter((formula) => formula !== correctHint)).slice(0, 2);
  return shuffled([correctHint, ...decoys]);
}

function quizOptions(answer: number, questionIndex: number): { options: JsonObject[]; correctId: string } {
  const magnitude = Math.max(1, Math.round(Math.abs(answer) * 0.08));
  const values = new Set<number>([answer]);
  let distance = 1;
  while (values.size < 6) {
    values.add(answer + magnitude * distance);
    if (values.size < 6) values.add(answer - magnitude * distance);
    distance += 1;
  }
  const mixed = shuffled([...values]);
  const options = mixed.map((value, optionIndex) => ({ id: `q${questionIndex + 1}-${optionIndex + 1}`, label: String(value) }));
  return { options, correctId: options[mixed.indexOf(answer)].id as string };
}

function quizPrompt(level: number, recentTemplateIds: string[] = []): QuizGenerated {
  const q = (templateId: string, category: string, prompt: string, answer: number, hint: string, timeLimitSeconds: number, math?: JsonObject): QuizGenerated =>
    ({ templateId, category, prompt, answer, hint, timeLimitSeconds, ...(math ? { math } : {}) });
  let catalog: Array<() => QuizGenerated>;
  if (level === 1) catalog = [
    () => { const a = secureInt(8, 80); const b = secureInt(3, 40); return q("add", "たし算", `${a} + ${b} = ?`, a + b, "たし算：同じ位どうしを足す", 25, { kind: "expression", value: `${a} + ${b} = ?` }); },
    () => { const a = secureInt(30, 120); const b = secureInt(2, a - 1); return q("subtract", "ひき算", `${a} − ${b} = ?`, a - b, "ひき算：同じ位をそろえて引く", 25, { kind: "expression", value: `${a} − ${b} = ?` }); },
    () => { const a = secureInt(2, 12); const b = secureInt(2, 12); return q("multiply", "かけ算", `${a} × ${b} = ?`, a * b, "かけ算：a × b は a を b 回足した数", 25, { kind: "expression", value: `${a} × ${b} = ?` }); },
    () => { const divisor = secureInt(2, 12); const answer = secureInt(2, 15); return q("divide", "わり算", `${divisor * answer} ÷ ${divisor} = ?`, answer, "わり算：答え × 割る数 = 割られる数", 25, { kind: "fraction", numerator: divisor * answer, denominator: divisor, suffix: "= ?" }); },
    () => { const answer = secureInt(2, 30); const b = secureInt(2, 30); return q("missing", "穴埋め", `□ + ${b} = ${answer + b}　□ = ?`, answer, "a + b = c なら a = c − b", 30, { kind: "expression", value: `□ + ${b} = ${answer + b}　　□ = ?` }); },
    () => { const width = secureInt(2, 12); const height = secureInt(2, 12); return q("rectangle-area", "面積", `たて${height}、よこ${width}の長方形の面積は？`, width * height, "長方形の面積：S = たて × よこ", 30, { kind: "geometry", label: "長方形", value: `たて ${height}　よこ ${width}　S = ?` }); },
    () => { const width = secureInt(2, 12); const height = secureInt(2, 12); return q("rectangle-perimeter", "周の長さ", `たて${height}、よこ${width}の長方形の周の長さは？`, 2 * (width + height), "長方形の周：L = 2(たて + よこ)", 30, { kind: "geometry", label: "長方形", value: `たて ${height}　よこ ${width}　L = ?` }); },
    () => { const side = secureInt(2, 9); return q("cube-volume", "体積", `一辺${side}の立方体の体積は？`, side ** 3, "立方体の体積：V = 一辺³", 35, { kind: "power", base: side, exponent: 3, suffix: "= V" }); },
  ];
  else if (level === 2) catalog = [
    () => { const x = secureInt(-8, 16); const a = secureInt(2, 8); const b = secureInt(-12, 12); return q("linear", "一次方程式", `${a}x ${signedTerm(b)} = ${a * x + b}　x = ?`, x, "ax + b = c なら x = (c − b) ÷ a", 38, { kind: "expression", value: `${a}x ${signedTerm(b)} = ${a * x + b}　　x = ?` }); },
    () => { const base = secureInt(4, 40) * 10; const percent = [10, 20, 25, 50, 75][secureInt(0, 4)]; return q("percent", "割合", `${base} の ${percent}% は？`, base * percent / 100, "割合：比べる量 = もとにする量 × 割合", 35, { kind: "expression", value: `${base} × ${percent}/100 = ?` }); },
    () => { const a = secureInt(2, 15); const b = secureInt(2, 12); const c = secureInt(2, 9); return q("order", "計算順序", `${a} + ${b} × ${c} = ?`, a + b * c, "計算順序：掛け算・割り算を先に計算", 32, { kind: "expression", value: `${a} + ${b} × ${c} = ?` }); },
    () => { const kg10 = secureInt(5, 75); return q("unit", "単位換算", `${kg10 / 10} kg は何 g？`, kg10 * 100, "1 kg = 1000 g", 35, { kind: "expression", value: `${kg10 / 10} kg = ? g` }); },
    () => { const values = Array.from({ length: 4 }, () => secureInt(5, 30)); values[3] += (4 - values.reduce((sum, value) => sum + value, 0) % 4) % 4; return q("average", "平均", `平均を求めよ：${values.join("、")}`, values.reduce((sum, value) => sum + value, 0) / 4, "平均 = 合計 ÷ 個数", 40, { kind: "expression", value: `(${values.join(" + ")}) ÷ 4 = ?` }); },
    () => { const base = secureInt(2, 12) * 2; const height = secureInt(2, 12); return q("triangle-area", "面積", `底辺${base}、高さ${height}の三角形の面積は？`, base * height / 2, "三角形の面積：S = 底辺 × 高さ ÷ 2", 38, { kind: "geometry", label: "三角形", value: `底辺 ${base}　高さ ${height}　S = ?` }); },
    () => { const a = secureInt(2, 8); const b = secureInt(2, 8); const h = secureInt(2, 8); return q("cuboid-volume", "体積", `${a}×${b}の底面で高さ${h}の直方体の体積は？`, a * b * h, "直方体の体積：V = たて × よこ × 高さ", 40, { kind: "geometry", label: "直方体", value: `${a} × ${b} × ${h}　V = ?` }); },
    () => { const unit = secureInt(2, 9); const left = secureInt(2, 7); const right = secureInt(2, 7); return q("ratio", "比", `${left}:${right}と同じ比で、左が${left * unit}なら右は？`, right * unit, "a:b = c:d なら ad = bc", 40, { kind: "expression", value: `${left} : ${right} = ${left * unit} : ?` }); },
    () => { const turtles = secureInt(2, 8); const cranes = secureInt(3, 12); const total = turtles + cranes; const legs = turtles * 4 + cranes * 2; return q("crane-turtle", "鶴亀算", `鶴と亀が合わせて${total}匹、足は${legs}本。亀は何匹？`, turtles, "鶴亀算：全部を鶴と仮定し、足の差を1匹あたりの差で割る", 48, { kind: "story", value: `合計 ${total}匹　足 ${legs}本　亀 = ?匹` }); },
    () => { const speed = secureInt(3, 12); const hours = secureInt(2, 8); return q("speed-distance", "速さ", `時速${speed}kmで${hours}時間進むと何km？`, speed * hours, "道のり = 速さ × 時間", 40, { kind: "story", value: `時速 ${speed} km × ${hours}時間 = ? km` }); },
  ];
  else if (level === 3) catalog = [
    () => { const a = secureInt(2, 7); const power = secureInt(2, 4); return q("power", "累乗", `${a}の${power}乗は？`, a ** power, "累乗：aⁿ は a を n 回掛ける", 42, { kind: "power", base: a, exponent: power, suffix: "= ?" }); },
    () => { const root = secureInt(2, 24); return q("root", "平方根", `√${root * root} = ?`, root, "平方根：√a は2乗して a になる正の数", 42, { kind: "root", value: root * root, suffix: "= ?" }); },
    () => { const value = secureInt(3, 7); return q("factorial", "階乗", `${value}! = ?`, factorial(value), "階乗：n! = n × (n−1) × … × 1", 48, { kind: "expression", value: `${value}! = ?` }); },
    () => { const end = secureInt(4, 10); return q("sigma", "数列の和", `k=1から${end}までの k の総和は？`, end * (end + 1) / 2, "自然数の和：1 + … + n = n(n+1) ÷ 2", 50, { kind: "sum", lower: "k = 1", upper: end, body: "k", suffix: "= ?" }); },
    () => { const x = secureInt(2, 12); const a = secureInt(2, 6); const b = secureInt(1, 10); const c = secureInt(1, 8); return q("expression", "式の計算", `${a}(${x} + ${b}) − ${c} = ?`, a * (x + b) - c, "分配法則：a(b+c) = ab + ac", 45, { kind: "expression", value: `${a}(${x} + ${b}) − ${c} = ?` }); },
    () => { const radius = secureInt(2, 10); return q("circle-area", "面積", `半径${radius}の円の面積は何π？（πの係数を答える）`, radius ** 2, "円の面積：S = πr²", 45, { kind: "geometry", label: "円", value: `r = ${radius}　S = ?π` }); },
    () => { const a = secureInt(2, 7); const x = secureInt(1, 9); return q("derivative-monomial", "微分", `y=${a}x² のとき、x=${x}での dy/dx は？`, 2 * a * x, "微分：d(xⁿ)/dx = nxⁿ⁻¹", 52, { kind: "derivative", function: `${a}x²`, at: x, suffix: "= ?" }); },
    () => { const end = secureInt(2, 10); return q("integral-linear", "積分", `0から${end}まで 2x を積分した値は？`, end ** 2, "積分：∫xⁿdx = xⁿ⁺¹/(n+1) + C", 55, { kind: "integral", lower: 0, upper: end, body: "2x", variable: "x", suffix: "= ?" }); },
    () => { const a = secureInt(2, 6); const b = secureInt(2, 6); const hours = secureInt(2, 8); return q("work-rate", "仕事算", `Aは1時間に${a}枚、Bは1時間に${b}枚仕上げる。2人で${hours}時間に何枚？`, (a + b) * hours, "共同作業：1時間あたりの仕事量を足してから時間を掛ける", 52, { kind: "story", value: `(${a} + ${b})枚/時 × ${hours}時間 = ?枚` }); },
    () => { const childAge = secureInt(6, 14); const gap = secureInt(18, 34); const years = secureInt(3, 12); return q("age-story", "年齢算", `子は${childAge}歳、親は子より${gap}歳上。${years}年後の親は何歳？`, childAge + gap + years, "年齢算：年齢差は何年たっても変わらない", 52, { kind: "story", value: `${childAge} + ${gap} + ${years} = ?歳` }); },
  ];
  else if (level === 4) catalog = [
    () => { const small = secureInt(1, 8); const large = secureInt(small + 1, 13); return q("quadratic", "二次方程式", `x² − ${small + large}x + ${small * large} = 0　小さい解は？`, small, "x² − (α+β)x + αβ = (x−α)(x−β)", 58, { kind: "expression", value: `x² − ${small + large}x + ${small * large} = 0　　x = ?` }); },
    () => { const total = secureInt(6, 11); const selected = secureInt(2, Math.min(4, total - 2)); return q("combination", "組合せ", `${total}個から${selected}個を選ぶ組合せは？`, combination(total, selected), "組合せ：ₙCᵣ = n! ÷ (r!(n−r)!)", 58, { kind: "combination", total, selected, suffix: "= ?" }); },
    () => { const first = secureInt(1, 12); const difference = secureInt(2, 8); const position = secureInt(6, 12); return q("sequence", "等差数列", `初項${first}、公差${difference}の等差数列の第${position}項は？`, first + (position - 1) * difference, "等差数列：aₙ = a₁ + (n−1)d", 58, { kind: "expression", value: `a₁=${first}　d=${difference}　a${position}=?` }); },
    () => { const [a, b, c, d] = Array.from({ length: 4 }, () => secureInt(-6, 8)); return q("determinant", "行列式", `[[${a},${b}],[${c},${d}]] の行列式は？`, a * d - b * c, "2次の行列式：det A = ad − bc", 58, { kind: "matrix-determinant", rows: [[a, b], [c, d]], suffix: "= ?" }); },
    () => { const end = secureInt(4, 8); const a = secureInt(2, 5); const b = secureInt(-3, 6); return q("sigma-linear", "数列の和", `k=1から${end}まで ${a}k ${signedTerm(b)} の総和は？`, a * end * (end + 1) / 2 + b * end, "Σ(ak+b) = aΣk + bΣ1", 62, { kind: "sum", lower: "k = 1", upper: end, body: `${a}k ${signedTerm(b)}`, suffix: "= ?" }); },
    () => { const top = secureInt(2, 10); const bottom = secureInt(top + 1, 15); const height = secureInt(2, 10) * 2; return q("trapezoid-area", "面積", `上底${top}、下底${bottom}、高さ${height}の台形の面積は？`, (top + bottom) * height / 2, "台形の面積：S = (上底 + 下底) × 高さ ÷ 2", 58, { kind: "geometry", label: "台形", value: `上底 ${top}　下底 ${bottom}　高さ ${height}　S = ?` }); },
    () => { const radius = secureInt(2, 8); const height = secureInt(2, 10); return q("cylinder-volume", "体積", `半径${radius}、高さ${height}の円柱の体積は何π？`, radius ** 2 * height, "円柱の体積：V = πr²h", 60, { kind: "geometry", label: "円柱", value: `r=${radius}　h=${height}　V=?π` }); },
    () => { const a = secureInt(1, 5); const b = secureInt(-6, 8); const x = secureInt(1, 8); return q("derivative-polynomial", "微分", `y=${a}x² ${signedTerm(b)}x のとき、x=${x}での dy/dx は？`, 2 * a * x + b, "微分：(ax²+bx)' = 2ax+b", 62, { kind: "derivative", function: `${a}x² ${signedTerm(b)}x`, at: x, suffix: "= ?" }); },
    () => { const inflow = secureInt(2, 7); const workerRate = secureInt(inflow + 2, inflow + 8); const workers = secureInt(2, 5); const minutes = secureInt(3, 10); const initial = minutes * (workers * workerRate - inflow); return q("newton-flow", "ニュートン算", `行列は最初${initial}人。毎分${inflow}人増え、窓口${workers}か所が各毎分${workerRate}人を案内する。行列がなくなるまで何分？`, minutes, "ニュートン算：最初の量 ÷ (処理量 − 増加量) = 時間", 68, { kind: "story", value: `${initial} ÷ (${workers}×${workerRate} − ${inflow}) = ?分` }); },
    () => { const slow = secureInt(3, 8); const fast = secureInt(slow + 2, slow + 8); const hours = secureInt(2, 6); const headStart = (fast - slow) * hours; return q("catch-up", "追いつき算", `時速${slow}kmの人が${headStart}km先にいる。時速${fast}kmで追うと何時間で追いつく？`, hours, "追いつく時間 = はじめの距離 ÷ 速さの差", 65, { kind: "story", value: `${headStart} ÷ (${fast} − ${slow}) = ?時間` }); },
  ];
  else catalog = [
    () => { const [a, b, c, d] = Array.from({ length: 4 }, () => secureInt(-4, 6)); const [e, f, g, h] = Array.from({ length: 4 }, () => secureInt(-4, 6)); return q("matrix-multiply", "行列積", `A=[[${a},${b}],[${c},${d}]], B=[[${e},${f}],[${g},${h}]]　ABの1行1列は？`, a * e + b * g, "行列積：(AB)ᵢⱼ = Σ aᵢₖbₖⱼ", 72, { kind: "matrix-product", left: [[a, b], [c, d]], right: [[e, f], [g, h]], suffix: "AB の (1,1) = ?" }); },
    () => { const end = secureInt(4, 8); const a = secureInt(1, 4); const b = secureInt(-4, 7); return q("sigma-square", "複合数列", `k=1から${end}まで ${a}k² ${signedTerm(b)} の総和は？`, a * end * (end + 1) * (2 * end + 1) / 6 + b * end, "二乗和：Σk² = n(n+1)(2n+1) ÷ 6", 75, { kind: "sum", lower: "k = 1", upper: end, body: `${a}k² ${signedTerm(b)}`, suffix: "= ?" }); },
    () => { const total = secureInt(7, 10); const count = secureInt(2, 4); return q("factorial-ratio", "階乗比", `${total}! ÷ ${total - count}! = ?`, factorial(total) / factorial(total - count), "n!/(n−r)! = n(n−1)…(n−r+1)", 68, { kind: "fraction", numerator: `${total}!`, denominator: `${total - count}!`, suffix: "= ?" }); },
    () => { const x = secureInt(-6, 9); const y = secureInt(-6, 9); const a = secureInt(2, 5); const b = secureInt(1, 4); const c = secureInt(1, 4); const d = secureInt(2, 5); return q("system", "連立方程式", `${a}x + ${b}y = ${a * x + b * y}、${c}x − ${d}y = ${c * x - d * y}　x = ?`, x, "連立方程式：係数をそろえて一方の文字を消去", 75, { kind: "system", lines: [`${a}x + ${b}y = ${a * x + b * y}`, `${c}x − ${d}y = ${c * x - d * y}`], suffix: "x = ?" }); },
    () => { const [a, b, c, d] = Array.from({ length: 4 }, () => secureInt(-4, 6)); const [e, f, g, h] = Array.from({ length: 4 }, () => secureInt(-4, 6)); return q("determinant-product", "行列式", `det(A)det(B) を求めよ。A=[[${a},${b}],[${c},${d}]], B=[[${e},${f}],[${g},${h}]]`, (a * d - b * c) * (e * h - f * g), "det(AB) = det(A)det(B)", 78, { kind: "matrix-product", left: [[a, b], [c, d]], right: [[e, f], [g, h]], prefix: "det A × det B", suffix: "= ?" }); },
    () => { const end = secureInt(2, 8); return q("integral-quadratic", "積分", `0から${end}まで 3x² を積分した値は？`, end ** 3, "積分：∫xⁿdx = xⁿ⁺¹/(n+1) + C", 78, { kind: "integral", lower: 0, upper: end, body: "3x²", variable: "x", suffix: "= ?" }); },
    () => { const radius = secureInt(2, 8); const height = secureInt(2, 8) * 3; return q("cone-volume", "体積", `半径${radius}、高さ${height}の円すいの体積は何π？`, radius ** 2 * height / 3, "円すいの体積：V = πr²h ÷ 3", 75, { kind: "geometry", label: "円すい", value: `r=${radius}　h=${height}　V=?π` }); },
    () => { const a = secureInt(1, 4); const b = secureInt(-5, 7); const x = secureInt(1, 6); return q("derivative-cubic", "微分", `y=${a}x³ ${signedTerm(b)}x のとき、x=${x}での dy/dx は？`, 3 * a * x ** 2 + b, "微分：(ax³+bx)' = 3ax²+b", 78, { kind: "derivative", function: `${a}x³ ${signedTerm(b)}x`, at: x, suffix: "= ?" }); },
    () => { const inflow = secureInt(2, 8); const workerRate = secureInt(4, 9); const workers = secureInt(Math.floor(inflow / workerRate) + 2, Math.floor(inflow / workerRate) + 6); const minutes = secureInt(4, 10); const initial = minutes * (workers * workerRate - inflow); return q("newton-workers", "ニュートン算", `最初${initial}人の行列に毎分${inflow}人来る。各窓口は毎分${workerRate}人を案内し、${minutes}分で行列がなくなった。窓口はいくつ？`, workers, "ニュートン算：窓口数 = (最初の量 + 増加量×時間) ÷ (1窓口の処理量×時間)", 82, { kind: "story", value: `(${initial} + ${inflow}×${minutes}) ÷ (${workerRate}×${minutes}) = ?窓口` }); },
    () => { const first = secureInt(3, 8); const second = secureInt(2, 7); const hours = secureInt(3, 8); return q("opposite-travel", "旅人算", `向かい合う2人が時速${first}kmと時速${second}kmで進み、${hours}時間後に出会う。最初の距離は？`, (first + second) * hours, "向かい合う速さ：距離 = (2人の速さの和) × 時間", 75, { kind: "story", value: `(${first} + ${second}) × ${hours} = ? km` }); },
  ];
  const generatedCatalog = catalog.map((generate) => generate());
  const blocked = new Set(recentTemplateIds.slice(-2));
  const candidates = generatedCatalog.filter((question) => !blocked.has(question.templateId));
  const pool = candidates.length ? candidates : generatedCatalog;
  return pool[secureInt(0, pool.length - 1)];
}

function createQuizChallenge(level: number): { questions: JsonObject[]; answerIds: string[] } {
  const questions: JsonObject[] = [];
  const answerIds: string[] = [];
  const recentTemplateIds: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const generated = quizPrompt(level, recentTemplateIds);
    recentTemplateIds.push(generated.templateId);
    const choices = quizOptions(generated.answer, index);
    questions.push({
      number: index + 1,
      templateId: generated.templateId,
      category: generated.category,
      prompt: generated.prompt,
      math: generated.math || null,
      hintOptions: quizHintOptions(generated.hint),
      hintDurationMs: level >= 4 ? 5000 : 3500,
      timeLimitSeconds: generated.timeLimitSeconds,
      options: choices.options,
    });
    answerIds.push(choices.correctId);
  }
  return { questions, answerIds };
}

function roomProjection(row: JsonObject): JsonObject {
  return {
    status: row.room_status,
    version: row.room_version,
    seat: row.actor_seat,
    publicState: row.action_public_state,
    privateState: row.actor_private_state,
  };
}

function publicError(error: unknown): { status: number; code: string; message: string } {
  const candidate = error as { code?: string; message?: string };
  const detail = String(candidate?.message || "");
  if (detail.includes("QUIZ_RATE_LIMIT")) return { status: 429, code: "QUIZ_RATE_LIMIT", message: "Quiz limit reached; try again later." };
  if (detail.includes("QUIZ_TOO_FAST")) return { status: 409, code: "QUIZ_TOO_FAST", message: "Complete the quiz before claiming the reward." };
  if (detail.includes("QUIZ_EXPIRED")) return { status: 409, code: "QUIZ_EXPIRED", message: "Quiz expired; start a new challenge." };
  if (detail.includes("QUIZ_ALREADY_COMPLETED")) return { status: 409, code: "QUIZ_ALREADY_COMPLETED", message: "Quiz was already completed." };
  if (detail.includes("QUIZ_SESSION_NOT_FOUND")) return { status: 404, code: "QUIZ_SESSION_NOT_FOUND", message: "Quiz was not found." };
  if (detail.includes("INVALID_QUIZ")) return { status: 400, code: "INVALID_QUIZ", message: "Quiz input is invalid." };
  if (candidate?.code === "PT409" || candidate?.code === "40001") return { status: 409, code: "STALE_VERSION", message: "Match changed; reload and retry." };
  if (candidate?.code === "55000" && detail.includes("CARD_SALE_MATCH_LOCKED")) return { status: 409, code: "CARD_SALE_MATCH_LOCKED", message: "Cards cannot be sold after a loadout is submitted or while a match is active." };
  if (candidate?.code === "55000" && detail.includes("CPU_CONSENT_TOO_EARLY")) return { status: 409, code: "CPU_CONSENT_TOO_EARLY", message: "CPU play becomes available after 90 seconds." };
  if (candidate?.code === "55000" && detail.includes("MATCHMAKING_")) return { status: 409, code: "MATCHMAKING_RESOLVED", message: "Matchmaking was already resolved or expired." };
  if (candidate?.code === "23505") return { status: 409, code: "IDEMPOTENCY_KEY_REUSE", message: "Action ID was reused with different input." };
  if (candidate?.code === "42501") return { status: 403, code: "NOT_A_MEMBER", message: "You are not in this room." };
  if (candidate?.code === "P0002") return { status: 404, code: "ROOM_NOT_FOUND", message: "Room was not found." };
  if (candidate?.code === "PGRST003") return { status: 503, code: "SERVER_BUSY", message: "The game server is busy; wait briefly and retry." };
  return { status: 500, code: "SERVER_ERROR", message: "The game server could not complete the request." };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: { code: "METHOD_NOT_ALLOWED", message: "POST required." } });

  let stage = "authenticate";
  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json(401, { error: { code: "AUTH_REQUIRED", message: "Anonymous sign-in is required." } });
    const actorId = actorIdFromGatewayVerifiedJwt(authorization);
    if (!actorId) return json(401, { error: { code: "AUTH_INVALID", message: "Anonymous session is invalid." } });

    const service = createClient(requiredEnvironment("SUPABASE_URL"), requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await request.json() as JsonObject;
    const operation = body.operation;
    if (!["profile", "gacha", "card-sale-quote", "card-sale", "cosmetic-catalog", "cosmetic-quote", "cosmetic-action", "quiz-start", "quiz-finish", "cpu-roster", "cpu-accept", "cpu-rematch", "cpu-action", "setup", "initialize", "action"].includes(String(operation))) {
      return json(400, { error: { code: "INVALID_REQUEST", message: "A valid operation is required." } });
    }
    if (rateLimited(actorId, String(operation))) {
      return json(429, { error: { code: "RATE_LIMITED", message: "Too many requests; wait briefly and retry." } });
    }

    if (operation === "cpu-roster") {
      return json(200, { rosterVersion: "standard-character-roster-v1", characters: globalThis.FourColorStandardServerEngine.getCpuRoster() });
    }

    if (operation === "cpu-accept") {
      const ticketId = body.ticketId;
      const characterId = body.characterId;
      if (typeof ticketId !== "string" || !UUID_PATTERN.test(ticketId) || typeof characterId !== "string" || characterId.length > 32) {
        return json(400, { error: { code: "INVALID_CPU_ACCEPT", message: "A valid ticket and CPU character are required." } });
      }
      let cpu;
      try { cpu = globalThis.FourColorStandardServerEngine.createCpuProfile(characterId); }
      catch { return json(400, { error: { code: "UNKNOWN_CPU_CHARACTER", message: "That CPU character is not available." } }); }
      stage = "accept-cpu";
      const { data, error } = await service.rpc("fcg_standard_server_accept_cpu", {
        p_user_id: actorId,
        p_ticket_id: ticketId,
        p_cpu_user_id: crypto.randomUUID(),
        p_character_id: characterId,
        p_policy_version: cpu.policyVersion,
        p_display_name: (cpu.profile as { displayName?: string }).displayName,
        p_profile_state: cpu.profile,
        p_loadout: cpu.loadout,
        p_loadout_fingerprint: await fingerprint(cpu.loadout),
      });
      if (error) throw error;
      const accepted = firstRow(data);
      return json(200, {
        matchmakingStatus: accepted?.matchmaking_status,
        roomId: accepted?.room_id,
        seat: accepted?.seat,
        characterId: accepted?.cpu_character_id,
        duplicate: accepted?.duplicate === true,
      });
    }

    if (operation === "profile") {
      const expectedRevision = body.expectedRevision;
      const displayName = body.displayName;
      const profileState = body.profileState;
      if (!Number.isSafeInteger(expectedRevision) || typeof displayName !== "string" || !profileState || typeof profileState !== "object") {
        return json(400, { error: { code: "INVALID_PROFILE", message: "A profile revision, name, and state are required." } });
      }
      stage = "load-profile";
      const { data: existingData, error: existingError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
      if (existingError) throw existingError;
      const existing = firstRow(existingData);
      if (existing) {
        return json(200, {
          revision: existing.revision,
          profileState: existing.profile_state,
          displayName: existing.display_name,
        });
      }
      const committedState = globalThis.FourColorStandardServerEngine.createStarterProfile(displayName as string);
      stage = "commit-profile";
      const { data, error } = await service.rpc("fcg_standard_server_commit_profile", {
        p_user_id: actorId,
        p_expected_revision: 0,
        p_display_name: displayName,
        p_profile_state: committedState,
      });
      if (error) throw error;
      const { data: currentData, error: currentError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
      if (currentError) throw currentError;
      const current = firstRow(currentData);
      return json(200, { revision: firstRow(data) ?? data, profileState: current?.profile_state || committedState, displayName });
    }

    if (operation === "gacha") {
      const expectedRevision = body.expectedRevision;
      const actionId = body.actionId;
      const ticketLevel = body.ticketLevel;
      const count = body.count;
      if (!Number.isSafeInteger(expectedRevision) || typeof actionId !== "string" || !UUID_PATTERN.test(actionId)
          || !Number.isSafeInteger(ticketLevel) || (ticketLevel as number) < 1 || (ticketLevel as number) > 5
          || !Number.isSafeInteger(count) || (count as number) < 1 || (count as number) > 100) {
        return json(400, { error: { code: "INVALID_GACHA", message: "A valid gacha action and ticket count are required." } });
      }
      const actionFingerprint = await fingerprint({ actorId, ticketLevel, count });
      stage = "replay-gacha";
      const { data: replayData, error: replayError } = await service.rpc("fcg_standard_server_replay_gacha", {
        p_user_id: actorId,
        p_action_id: actionId,
        p_action_fingerprint: actionFingerprint,
      });
      if (replayError) throw replayError;
      const replay = firstRow(replayData);
      if (replay?.found === true) {
        const { data: replayProfileData, error: replayProfileError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
        if (replayProfileError) throw replayProfileError;
        const replayProfile = firstRow(replayProfileData);
        return json(200, {
          revision: replayProfile?.revision ?? replay.profile_revision,
          duplicate: true,
          draws: (replay.action_result as JsonObject)?.draws || [],
          profileState: replayProfile?.profile_state,
        });
      }
      stage = "load-profile";
      const { data: profileData, error: profileError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
      if (profileError) throw profileError;
      const profile = firstRow(profileData);
      if (!profile) throw { code: "P0002" };
      let drawn;
      try {
        drawn = globalThis.FourColorStandardServerEngine.drawGacha({
          profile: profile.profile_state as JsonObject,
          ticketLevel: ticketLevel as number,
          count: count as number,
          seed: secureSeed(),
        });
      } catch (error) {
        const code = String((error as { message?: string })?.message || "GACHA_REJECTED");
        return json(400, { error: { code, message: code === "INSUFFICIENT_GACHA_TICKETS" ? "Not enough gacha tickets." : "The gacha request is not valid." } });
      }
      const actionResult = { draws: drawn.draws };
      stage = "commit-gacha";
      const { data, error } = await service.rpc("fcg_standard_server_commit_gacha", {
        p_user_id: actorId,
        p_expected_revision: expectedRevision,
        p_action_id: actionId,
        p_action_fingerprint: actionFingerprint,
        p_profile_state: drawn.profile,
        p_action_result: actionResult,
      });
      if (error) throw error;
      const committed = firstRow(data);
      const { data: currentData, error: currentError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
      if (currentError) throw currentError;
      const current = firstRow(currentData);
      return json(200, {
        revision: current?.revision ?? committed?.new_revision,
        duplicate: committed?.duplicate === true,
        draws: (committed?.action_result as JsonObject)?.draws || drawn.draws,
        profileState: current?.profile_state,
      });
    }

    if (operation === "card-sale-quote" || operation === "card-sale") {
      const expectedRevision = body.expectedRevision;
      const actionId = body.actionId;
      const skillId = body.skillId;
      const count = body.count;
      const confirmed = body.confirmed === true;
      if (!Number.isSafeInteger(expectedRevision) || typeof skillId !== "string" || skillId.length > 64
          || !Number.isSafeInteger(count) || (count as number) < 1 || (count as number) > 100
          || (operation === "card-sale" && (typeof actionId !== "string" || !UUID_PATTERN.test(actionId)))) {
        return json(400, { error: { code: "INVALID_CARD_SALE", message: "A valid card and sale count are required." } });
      }
      const actionFingerprint = await fingerprint({ actorId, skillId, count, confirmed });
      if (operation === "card-sale") {
        stage = "replay-card-sale";
        const { data: replayData, error: replayError } = await service.rpc("fcg_standard_server_replay_card_sale", {
          p_user_id: actorId,
          p_action_id: actionId,
          p_action_fingerprint: actionFingerprint,
        });
        if (replayError) throw replayError;
        const replay = firstRow(replayData);
        if (replay?.found === true) {
          const { data: replayProfileData, error: replayProfileError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
          if (replayProfileError) throw replayProfileError;
          const replayProfile = firstRow(replayProfileData);
          return json(200, {
            revision: replayProfile?.revision ?? replay.profile_revision,
            duplicate: true,
            quote: (replay.action_result as JsonObject)?.quote,
            profileState: replayProfile?.profile_state,
          });
        }
      }
      stage = "load-profile";
      const { data: profileData, error: profileError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
      if (profileError) throw profileError;
      const profile = firstRow(profileData);
      if (!profile) throw { code: "P0002" };
      let quote: JsonObject;
      try {
        quote = globalThis.FourColorStandardServerEngine.quoteCardSale({
          profile: profile.profile_state as JsonObject,
          skillId: skillId as string,
          count: count as number,
        });
      } catch (error) {
        const code = String((error as { message?: string })?.message || "CARD_SALE_REJECTED");
        return json(400, { error: { code, message: "This card sale is not available." } });
      }
      if (operation === "card-sale-quote") {
        return json(200, { revision: profile.revision, quote });
      }
      if ((quote as { requiresConfirmation?: boolean }).requiresConfirmation && !confirmed) {
        return json(409, { error: { code: "SALE_CONFIRMATION_REQUIRED", message: "Confirm this card sale before continuing.", quote } });
      }
      let sold;
      try {
        sold = globalThis.FourColorStandardServerEngine.sellCards({
          profile: profile.profile_state as JsonObject,
          skillId: skillId as string,
          count: count as number,
          confirmed,
        });
      } catch (error) {
        const code = String((error as { message?: string })?.message || "CARD_SALE_REJECTED");
        return json(400, { error: { code, message: "This card sale is not available." } });
      }
      stage = "commit-card-sale";
      const { data, error } = await service.rpc("fcg_standard_server_commit_card_sale", {
        p_user_id: actorId,
        p_expected_revision: expectedRevision,
        p_action_id: actionId,
        p_action_fingerprint: actionFingerprint,
        p_profile_state: sold.profile,
        p_action_result: { quote: sold.quote },
      });
      if (error) throw error;
      const committed = firstRow(data);
      const { data: currentData, error: currentError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
      if (currentError) throw currentError;
      const current = firstRow(currentData);
      return json(200, {
        revision: current?.revision ?? committed?.new_revision,
        duplicate: committed?.duplicate === true,
        quote: (committed?.action_result as JsonObject)?.quote || sold.quote,
        profileState: current?.profile_state,
      });
    }

    if (operation === "cosmetic-catalog" || operation === "cosmetic-quote" || operation === "cosmetic-action") {
      const cosmeticId = body.cosmeticId;
      const expectedRevision = body.expectedRevision;
      const actionId = body.actionId;
      if (operation !== "cosmetic-catalog" && (typeof cosmeticId !== "string" || cosmeticId.length < 1 || cosmeticId.length > 64)) {
        return json(400, { error: { code: "INVALID_COSMETIC", message: "A valid cosmetic is required." } });
      }
      if (operation === "cosmetic-action" && (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 0
          || typeof actionId !== "string" || !UUID_PATTERN.test(actionId))) {
        return json(400, { error: { code: "INVALID_COSMETIC_ACTION", message: "A valid revision and action ID are required." } });
      }
      const actionFingerprint = operation === "cosmetic-action" ? await fingerprint({ actorId, cosmeticId }) : null;
      if (operation === "cosmetic-action") {
        stage = "replay-cosmetic";
        const { data: replayData, error: replayError } = await service.rpc("fcg_standard_server_replay_cosmetic", {
          p_user_id: actorId, p_action_id: actionId, p_action_fingerprint: actionFingerprint,
        });
        if (replayError) throw replayError;
        const replay = firstRow(replayData);
        if (replay?.found === true) {
          const { data: replayProfileData, error: replayProfileError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
          if (replayProfileError) throw replayProfileError;
          const replayProfile = firstRow(replayProfileData);
          if (!replayProfile?.profile_state) throw { code: "P0002" };
          return json(200, { revision: replayProfile?.revision ?? replay.profile_revision, duplicate: true,
            quote: (replay.action_result as JsonObject)?.quote, profileState: replayProfile?.profile_state,
            cosmetics: globalThis.FourColorStandardServerEngine.getCosmetics({ profile: replayProfile?.profile_state as JsonObject }) });
        }
      }
      stage = "load-profile";
      const { data: profileData, error: profileError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
      if (profileError) throw profileError;
      const profile = firstRow(profileData);
      if (!profile) throw { code: "P0002" };
      if (operation === "cosmetic-catalog") {
        return json(200, { revision: profile.revision, cosmetics: globalThis.FourColorStandardServerEngine.getCosmetics({ profile: profile.profile_state as JsonObject }) });
      }
      let quote: JsonObject;
      try { quote = globalThis.FourColorStandardServerEngine.quoteCosmetic({ profile: profile.profile_state as JsonObject, cosmeticId: cosmeticId as string }); }
      catch (error) {
        const code = String((error as { message?: string })?.message || "COSMETIC_REJECTED");
        return json(400, { error: { code, message: "This cosmetic action is not available." } });
      }
      if (operation === "cosmetic-quote") return json(200, { revision: profile.revision, quote });
      let applied;
      try { applied = globalThis.FourColorStandardServerEngine.applyCosmetic({ profile: profile.profile_state as JsonObject, cosmeticId: cosmeticId as string }); }
      catch (error) {
        const code = String((error as { message?: string })?.message || "COSMETIC_REJECTED");
        return json(400, { error: { code, message: "This cosmetic action is not available." } });
      }
      stage = "commit-cosmetic";
      const { data, error } = await service.rpc("fcg_standard_server_commit_cosmetic", {
        p_user_id: actorId, p_expected_revision: expectedRevision, p_action_id: actionId,
        p_action_fingerprint: actionFingerprint, p_profile_state: applied.profile, p_action_result: { quote: applied.quote },
      });
      if (error) throw error;
      const committed = firstRow(data);
      const { data: currentData, error: currentError } = await service.rpc("fcg_standard_server_load_profile", { p_user_id: actorId });
      if (currentError) throw currentError;
      const current = firstRow(currentData);
      if (!current?.profile_state) throw { code: "P0002" };
      return json(200, { revision: current?.revision ?? committed?.new_revision, duplicate: committed?.duplicate === true,
        quote: (committed?.action_result as JsonObject)?.quote || applied.quote, profileState: current?.profile_state,
        cosmetics: globalThis.FourColorStandardServerEngine.getCosmetics({ profile: current?.profile_state as JsonObject }) });
    }

    if (operation === "quiz-start") {
      const actionId = body.actionId;
      const selectedLevel = body.selectedLevel;
      if (typeof actionId !== "string" || !UUID_PATTERN.test(actionId)
          || !Number.isSafeInteger(selectedLevel) || (selectedLevel as number) < 1 || (selectedLevel as number) > 5) {
        return json(400, { error: { code: "INVALID_QUIZ", message: "A quiz action and level are required." } });
      }
      const challenge = createQuizChallenge(selectedLevel as number);
      const actionFingerprint = await fingerprint({ actorId, selectedLevel });
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      stage = "start-quiz";
      const { data, error } = await service.rpc("fcg_standard_server_start_quiz", {
        p_user_id: actorId,
        p_session_id: sessionId,
        p_start_action_id: actionId,
        p_start_fingerprint: actionFingerprint,
        p_selected_level: selectedLevel,
        p_questions: challenge.questions,
        p_answer_ids: challenge.answerIds,
        p_expires_at: expiresAt,
      });
      if (error) throw error;
      const started = firstRow(data);
      return json(200, {
        sessionId: started?.session_id,
        duplicate: started?.duplicate === true,
        selectedLevel: started?.selected_level,
        expiresAt: started?.expires_at,
        questions: started?.questions,
        timeoutAnswerId: QUIZ_TIMEOUT_ANSWER,
      });
    }

    if (operation === "quiz-finish") {
      const sessionId = body.sessionId;
      const actionId = body.actionId;
      const answers = body.answers;
      if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)
          || typeof actionId !== "string" || !UUID_PATTERN.test(actionId)
          || !Array.isArray(answers) || answers.length !== 10
          || answers.some((answer) => typeof answer !== "string"
            || (answer !== QUIZ_TIMEOUT_ANSWER && !QUIZ_ANSWER_PATTERN.test(answer)))) {
        return json(400, { error: { code: "INVALID_QUIZ", message: "Ten quiz answers are required." } });
      }
      stage = "finish-quiz";
      const { data, error } = await service.rpc("fcg_standard_server_finish_quiz", {
        p_user_id: actorId,
        p_session_id: sessionId,
        p_finish_action_id: actionId,
        p_answers: answers,
      });
      if (error) throw error;
      const finished = firstRow(data);
      return json(200, {
        revision: finished?.new_revision,
        duplicate: finished?.duplicate === true,
        correct: finished?.correct,
        wrong: finished?.wrong,
        bestStreak: finished?.best_streak,
        reward: finished?.reward,
        profileState: finished?.profile_state,
      });
    }

    const roomId = body.roomId;
    if (typeof roomId !== "string" || !UUID_PATTERN.test(roomId)) {
      return json(400, { error: { code: "INVALID_REQUEST", message: "A valid roomId is required." } });
    }

    const load = async (): Promise<JsonObject> => {
      const { data, error } = await service.rpc("fcg_standard_server_load_room_v2", { p_room_id: roomId, p_actor_id: actorId });
      if (error) throw error;
      const row = firstRow(data);
      if (!row) throw { code: "P0002" };
      return row;
    };

    if (operation === "setup") {
      const setupActionId = body.setupActionId;
      const expectedSetupRevision = body.expectedSetupRevision;
      const loadout = body.loadout;
      const debugMode = body.debugMode ?? false;
      if (typeof setupActionId !== "string" || !UUID_PATTERN.test(setupActionId)
          || !Number.isSafeInteger(expectedSetupRevision) || !loadout || typeof loadout !== "object" || typeof debugMode !== "boolean") {
        return json(400, { error: { code: "INVALID_SETUP", message: "A setup ID, revision, and six-card loadout are required." } });
      }
      if (debugMode) {
        stage = "authorize-debug-setup";
        const setupRoom = await load();
        if (setupRoom.access_mode !== "private_code" || setupRoom.opponent_kind === "cpu") {
          return json(403, { error: { code: "DEBUG_MODE_NOT_ALLOWED", message: "Debug mode is available only in private human matches." } });
        }
      }
      stage = "load-profile";
      const { data: profileData, error: profileError } = await service.rpc("fcg_standard_server_load_profile", {
        p_user_id: actorId,
      });
      if (profileError) throw profileError;
      const profile = firstRow(profileData);
      if (!profile) throw { code: "P0002" };
      try {
        globalThis.FourColorStandardServerEngine.validateSeatLoadout(debugMode
          ? { loadout: loadout as JsonObject }
          : { loadout: loadout as JsonObject, profile: profile.profile_state as JsonObject });
      } catch {
        return json(400, { error: { code: "INVALID_SETUP", message: debugMode
          ? "Debug loadouts must contain two available cards from each category."
          : "The loadout must contain two owned cards from each category." } });
      }
      const committedLoadout = storedLoadout(loadout as JsonObject, debugMode);
      const loadoutFingerprint = await fingerprint({ roomId, actorId, profileRevision: profile.revision, loadout, debugMode });
      const quoteExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      stage = "commit-setup";
      const { data, error } = await service.rpc("fcg_standard_server_submit_loadout", {
        p_room_id: roomId,
        p_actor_id: actorId,
        p_expected_setup_revision: expectedSetupRevision,
        p_profile_revision: profile.revision,
        p_quote_id: setupActionId,
        p_quote_expires_at: quoteExpiresAt,
        p_loadout: committedLoadout,
        p_loadout_fingerprint: loadoutFingerprint,
      });
      if (error) throw error;
      return json(200, { setupRevision: firstRow(data) ?? data, profileRevision: profile.revision, quoteId: setupActionId, quoteExpiresAt, debugMode });
    }

    stage = "load-room";
    let room = await load();
    const seat = room.actor_seat as Seat;
    if (seat !== "A" && seat !== "B") return json(403, { error: { code: "NOT_A_MEMBER", message: "You are not in this room." } });

    if (operation === "cpu-rematch") {
      const expectedVersion = body.expectedVersion;
      const actionId = body.actionId;
      if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0 || typeof actionId !== "string" || !UUID_PATTERN.test(actionId)) {
        return json(400, { error: { code: "INVALID_CPU_REMATCH", message: "A valid version and rematch action ID are required." } });
      }
      if (seat !== "A" || room.opponent_kind !== "cpu" || room.room_status !== "finished" || typeof room.cpu_character_id !== "string") {
        return json(409, { error: { code: "CPU_ROOM_REQUIRED", message: "A finished CPU room is required." } });
      }
      let cpu;
      try { cpu = globalThis.FourColorStandardServerEngine.createCpuProfile(room.cpu_character_id as string); }
      catch { throw new Error("UNKNOWN_CPU_CHARACTER"); }
      stage = "cpu-rematch";
      const { data, error } = await service.rpc("fcg_standard_server_request_cpu_rematch", {
        p_user_id: actorId,
        p_room_id: roomId,
        p_expected_version: expectedVersion,
        p_action_id: actionId,
        p_character_id: room.cpu_character_id,
        p_policy_version: cpu.policyVersion,
        p_cpu_display_name: (cpu.profile as { displayName?: string }).displayName,
        p_cpu_profile_state: cpu.profile,
        p_cpu_loadout: cpu.loadout,
        p_loadout_fingerprint: await fingerprint(cpu.loadout),
      });
      if (error) throw error;
      const result = firstRow(data);
      return json(200, {
        roomStatus: result?.room_status,
        roomVersion: result?.room_version,
        readyToSetup: result?.ready_to_setup === true,
        duplicate: result?.duplicate === true,
      });
    }

    if (operation === "initialize") {
      if (room.room_status !== "ready" && room.room_status !== "playing") return json(409, { error: { code: "ROOM_NOT_READY", message: "Two validated loadouts are required." } });
      if (!room.authoritative_state) {
        if (!room.setup_a || !room.setup_b || !room.profile_a_state || !room.profile_b_state) {
          return json(409, { error: { code: "SETUP_REQUIRED", message: "Both players must submit a current loadout." } });
        }
        const debugMode = debugModeForRoom(room);
        if (debugMode === null) return json(409, { error: { code: "DEBUG_MODE_MISMATCH", message: "Both players must choose the same debug mode setting." } });
        stage = "create-match";
        const initialVersion = Number(room.room_version);
        if (!Number.isSafeInteger(initialVersion) || initialVersion < 0) throw new Error("INVALID_ROOM_VERSION");
        const created = globalThis.FourColorStandardServerEngine.create({
          matchId: `${roomId}:${initialVersion}`,
          loadouts: { A: playableLoadout(room.setup_a as JsonObject), B: playableLoadout(room.setup_b as JsonObject) },
          profiles: { A: room.profile_a_state as JsonObject, B: room.profile_b_state as JsonObject },
          seed: secureSeed(),
          debugMode,
        });
        const initialState = { ...(created.state as JsonObject), version: initialVersion };
        const initialProjection = globalThis.FourColorStandardServerEngine.project(initialState, debugMode);
        stage = "initialize-room";
        const { error } = await service.rpc("fcg_standard_server_initialize_room", {
          p_room_id: roomId,
          p_expected_version: room.room_version,
          p_authoritative_state: { state: initialState, rngSnapshot: created.rngSnapshot },
          p_public_state: initialProjection.publicState,
          p_private_a: initialProjection.privateA,
          p_private_b: initialProjection.privateB,
        });
        if (error) throw error;
        room = await load();
      }
      return json(200, { room: roomProjection(room) });
    }

    if (operation === "cpu-action") {
      const expectedVersion = body.expectedVersion;
      if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0) {
        return json(400, { error: { code: "INVALID_CPU_ACTION", message: "A valid match version is required." } });
      }
      if (seat !== "A" || room.opponent_kind !== "cpu" || typeof room.cpu_character_id !== "string"
          || typeof room.cpu_policy_version !== "string" || typeof room.cpu_user_id !== "string") {
        return json(409, { error: { code: "CPU_ROOM_REQUIRED", message: "This room has no CPU opponent." } });
      }
      stage = "load-cpu-turn";
      const { data: cpuData, error: cpuLoadError } = await service.rpc("fcg_standard_server_load_room_v2", {
        p_room_id: roomId, p_actor_id: room.cpu_user_id,
      });
      if (cpuLoadError) throw cpuLoadError;
      const cpuRoom = firstRow(cpuData);
      if (!cpuRoom || cpuRoom.actor_seat !== "B" || cpuRoom.room_status !== "playing" || !cpuRoom.authoritative_state
          || !cpuRoom.actor_private_state || Number(cpuRoom.room_version) !== expectedVersion) {
        return json(409, { error: { code: "CPU_TURN_CHANGED", message: "The CPU turn changed; refresh the room." } });
      }
      const authority = cpuRoom.authoritative_state as JsonObject;
      const state = authority.state as JsonObject;
      if (state.active !== "B" || state.status === "FINISHED") {
        return json(409, { error: { code: "CPU_NOT_ACTIVE", message: "It is not the CPU turn." } });
      }
      const identity = await deterministicCpuIdentity(roomId, expectedVersion as number, room.cpu_character_id as string, room.cpu_policy_version as string);
      const chosen = globalThis.FourColorStandardServerEngine.chooseCpuAction({
        publicState: cpuRoom.action_public_state as JsonObject,
        ownPrivateState: cpuRoom.actor_private_state as JsonObject,
        characterId: room.cpu_character_id as string,
        seed: identity.seed,
      });
      if (!chosen || typeof chosen.type !== "string" || !chosen.payload || typeof chosen.payload !== "object") {
        throw new Error("INVALID_CPU_CHOICE");
      }
      const action: JsonObject = { id: identity.actionId, expectedVersion, type: chosen.type, payload: chosen.payload };
      const actionFingerprint = await fingerprint({ roomId, actorId: room.cpu_user_id, action });
      stage = "replay-cpu-action";
      const { data: replayData, error: replayError } = await service.rpc("fcg_standard_server_replay_action", {
        p_room_id: roomId, p_actor_id: room.cpu_user_id, p_action_id: identity.actionId, p_action_fingerprint: actionFingerprint,
      });
      if (replayError) throw replayError;
      const replay = firstRow(replayData);
      if (replay?.found === true) return json(200, { duplicate: true, result: replay.action_result, room: roomProjection(room) });
      stage = "apply-cpu-action";
      const applied = globalThis.FourColorStandardServerEngine.apply({
        state, rngSnapshot: authority.rngSnapshot as JsonObject, actor: "B", action, expectedVersion: expectedVersion as number,
      });
      if (applied.ok !== true) throw new Error("CPU_RULE_REJECTED");
      const profiles = globalThis.FourColorStandardServerEngine.applyCpuProfiles({
        profiles: { A: cpuRoom.profile_a_state as JsonObject, B: cpuRoom.profile_b_state as JsonObject },
        beforeState: state, nextState: applied.state as JsonObject, actor: "B", action,
        finishedAt: new Date().toISOString(), characterId: room.cpu_character_id as string,
      });
      const safeResult = { code: applied.code, contactColorCount: applied.contactColorCount, terminalReason: applied.terminalReason };
      stage = "commit-cpu-action";
      const { data: committed, error: commitError } = await service.rpc("fcg_standard_server_commit_action", {
        p_room_id: roomId, p_actor_id: room.cpu_user_id, p_action_id: identity.actionId,
        p_expected_version: expectedVersion, p_action_type: action.type, p_action_fingerprint: actionFingerprint,
        p_authoritative_state: { state: applied.state, rngSnapshot: applied.rngSnapshot },
        p_public_state: applied.publicState, p_private_a: applied.privateA, p_private_b: applied.privateB,
        p_result: safeResult,
        p_profile_a_expected_revision: profiles.changed.A ? cpuRoom.profile_a_revision : null,
        p_profile_a_state: profiles.changed.A ? profiles.profiles.A : null,
        p_profile_b_expected_revision: profiles.changed.B ? cpuRoom.profile_b_revision : null,
        p_profile_b_state: profiles.changed.B ? profiles.profiles.B : null,
        p_finished: applied.finished, p_winner_seat: applied.winnerSeat,
      });
      if (commitError) throw commitError;
      const receipt = firstRow(committed) || {};
      stage = "reload-room";
      room = await load();
      return json(200, { duplicate: Boolean(receipt.duplicate), result: receipt.action_result || safeResult, room: roomProjection(room) });
    }

    const action = body.action as JsonObject;
    if (!action || typeof action !== "object" || typeof action.id !== "string" || !UUID_PATTERN.test(action.id)
        || typeof action.type !== "string" || !Number.isSafeInteger(action.expectedVersion)) {
      return json(400, { error: { code: "INVALID_ACTION", message: "A UUID action with expectedVersion is required." } });
    }
    const actionFingerprint = await fingerprint({ roomId, actorId, action });
    stage = "replay-preflight";
    const { data: replayData, error: replayError } = await service.rpc("fcg_standard_server_replay_action", {
      p_room_id: roomId, p_actor_id: actorId, p_action_id: action.id, p_action_fingerprint: actionFingerprint,
    });
    if (replayError) throw replayError;
    const replay = firstRow(replayData);
    if (replay?.found === true) return json(200, { duplicate: true, result: replay.action_result, room: roomProjection(room) });

    if (room.room_status !== "playing" || !room.authoritative_state) return json(409, { error: { code: "ROOM_NOT_PLAYING", message: "The match has not started." } });
    const authority = room.authoritative_state as JsonObject;
    const debugMode = debugModeForRoom(room) === true;
    stage = "apply-action";
    const applied = globalThis.FourColorStandardServerEngine.apply({
      state: authority.state as JsonObject,
      rngSnapshot: authority.rngSnapshot as JsonObject,
      actor: seat,
      action,
      expectedVersion: action.expectedVersion as number,
      debugMode,
    });
    if (applied.ok !== true) return json(400, { error: { code: applied.code || "RULE_REJECTED", message: "The action is not legal in the current state." } });

    const finishedAt = new Date().toISOString();
    const profiles = room.opponent_kind === "cpu"
      ? globalThis.FourColorStandardServerEngine.applyCpuProfiles({
        profiles: { A: room.profile_a_state as JsonObject, B: room.profile_b_state as JsonObject },
        beforeState: authority.state as JsonObject,
        nextState: applied.state as JsonObject,
        actor: seat,
        action,
        finishedAt,
        characterId: room.cpu_character_id as string,
      })
      : globalThis.FourColorStandardServerEngine.applyProfiles({
      profiles: { A: room.profile_a_state as JsonObject, B: room.profile_b_state as JsonObject },
      beforeState: authority.state as JsonObject,
      nextState: applied.state as JsonObject,
      actor: seat,
      action,
      finishedAt,
      debugMode,
    });
    const safeResult = { code: applied.code, contactColorCount: applied.contactColorCount, terminalReason: applied.terminalReason };
    stage = "commit-action";
    const { data: committed, error: commitError } = await service.rpc("fcg_standard_server_commit_action", {
      p_room_id: roomId,
      p_actor_id: actorId,
      p_action_id: action.id,
      p_expected_version: action.expectedVersion,
      p_action_type: action.type,
      p_action_fingerprint: actionFingerprint,
      p_authoritative_state: { state: applied.state, rngSnapshot: applied.rngSnapshot },
      p_public_state: applied.publicState,
      p_private_a: applied.privateA,
      p_private_b: applied.privateB,
      p_result: safeResult,
      p_profile_a_expected_revision: profiles.changed.A ? room.profile_a_revision : null,
      p_profile_a_state: profiles.changed.A ? profiles.profiles.A : null,
      p_profile_b_expected_revision: profiles.changed.B ? room.profile_b_revision : null,
      p_profile_b_state: profiles.changed.B ? profiles.profiles.B : null,
      p_finished: applied.finished,
      p_winner_seat: applied.winnerSeat,
    });
    if (commitError) throw commitError;
    const receipt = firstRow(committed) || {};
    stage = "reload-room";
    room = await load();
    return json(200, { duplicate: Boolean(receipt.duplicate), result: receipt.action_result || safeResult, room: roomProjection(room) });
  } catch (error) {
    const safe = publicError(error);
    console.error("standard-game-action failed", safe.code, "stage", stage);
    return json(safe.status, { error: { code: safe.code, message: safe.message } });
  }
});
