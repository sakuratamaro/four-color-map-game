const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const edge = fs.readFileSync(path.join(root, "supabase/functions/standard-game-action/index.ts"), "utf8");

function loadQuizRuntime(secureInt) {
  const start = edge.indexOf("function factorial(");
  const end = edge.indexOf("function roomProjection(");
  assert.ok(start >= 0 && end > start, "quiz generator source region must remain extractable");
  const source = edge.slice(start, end)
    .replace(/type QuizGenerated = \{[\s\S]*?\n\};\n/, "")
    .replace("function factorial(value: number): number", "function factorial(value)")
    .replace("function combination(total: number, selected: number): number", "function combination(total, selected)")
    .replace("function inclusiveIntegerSum(lower: number, upper: number, term: (index: number) => number): number", "function inclusiveIntegerSum(lower, upper, term)")
    .replace("function signedTerm(value: number): string", "function signedTerm(value)")
    .replace("function quizHintOptions(correctHint: string): string[]", "function quizHintOptions(correctHint)")
    .replace("function quizOptions(answer: number, questionIndex: number): { options: JsonObject[]; correctId: string }", "function quizOptions(answer, questionIndex)")
    .replace("const values = new Set<number>([answer]);", "const values = new Set([answer]);")
    .replace(".id as string", ".id")
    .replace("function quizPrompt(level: number, recentTemplateIds: string[] = []): QuizGenerated", "function quizPrompt(level, recentTemplateIds = [])")
    .replace("const q = (templateId: string, category: string, prompt: string, answer: number, hint: string, timeLimitSeconds: number, math?: JsonObject): QuizGenerated =>", "const q = (templateId, category, prompt, answer, hint, timeLimitSeconds, math) =>")
    .replace("let catalog: Array<() => QuizGenerated>;", "let catalog;")
    .replace("function createQuizChallenge(level: number): { questions: JsonObject[]; answerIds: string[] }", "function createQuizChallenge(level)")
    .replace("const questions: JsonObject[] = [];", "const questions = [];")
    .replace("const answerIds: string[] = [];", "const answerIds = [];")
    .replace("const recentTemplateIds: string[] = [];", "const recentTemplateIds = [];");
  const context = vm.createContext({
    secureInt,
    shuffled: (values) => [...values],
  });
  new vm.Script(`${source}\nglobalThis.__quizRuntime = { quizPrompt, createQuizChallenge };`, { filename: "standard-game-action.quiz-runtime.js" }).runInContext(context);
  return context.__quizRuntime;
}

function selectedPrompt(level, selection) {
  const catalogLastIndex = level === 1 ? 7 : 9;
  const runtime = loadQuizRuntime((minimum, maximum) => minimum === 0 && maximum === catalogLastIndex ? selection : minimum);
  return JSON.parse(JSON.stringify(runtime.quizPrompt(level)));
}

test("all eight story generators expose only the story descriptor before an answer", () => {
  for (const level of [2, 3, 4, 5]) {
    for (const selection of [8, 9]) {
      const question = selectedPrompt(level, selection);
      assert.deepEqual(question.math, { kind: "story" }, `${level}:${selection}:${question.templateId}`);
      assert.ok(question.prompt.length > 0);
      assert.equal(typeof question.answer, "number");
    }
  }
});

test("all eight structured geometry generators keep dimensions and answers consistent", () => {
  const cases = [[1, 5], [1, 7], [2, 5], [2, 6], [3, 5], [4, 5], [4, 6], [5, 6]];
  const areaOrVolume = {
    rectangle: ({ width, height }) => width * height,
    cube: ({ side }) => side ** 3,
    triangle: ({ base, height }) => base * height / 2,
    cuboid: ({ length, width, height }) => length * width * height,
    circle: ({ radius }) => radius ** 2,
    trapezoid: ({ top, bottom, height }) => (top + bottom) * height / 2,
    cylinder: ({ radius, height }) => radius ** 2 * height,
    cone: ({ radius, height }) => radius ** 2 * height / 3,
  };
  const seen = new Set();
  for (const [level, selection] of cases) {
    const question = selectedPrompt(level, selection);
    const { shape, dimensions } = question.math;
    assert.equal(question.answer, areaOrVolume[shape](dimensions), `${question.templateId}:${JSON.stringify(dimensions)}`);
    seen.add(shape);
  }
  assert.deepEqual([...seen].sort(), Object.keys(areaOrVolume).sort());
});

test("three sigma generators and the sequence generator recompute to their answer", () => {
  const sigmas = [selectedPrompt(3, 3), selectedPrompt(4, 4), selectedPrompt(5, 1)];
  const termFor = {
    sigma: (k) => k,
    "sigma-linear": (k) => 2 * k - 3,
    "sigma-square": (k) => k ** 2 - 4,
  };
  for (const question of sigmas) {
    const { lower, upper } = question.math;
    let expected = 0;
    for (let k = lower; k <= upper; k += 1) expected += termFor[question.templateId](k);
    assert.equal(question.answer, expected, question.templateId);
    assert.deepEqual([lower, upper], [1, 4]);
  }

  const sequence = selectedPrompt(4, 2);
  const { first, difference, position } = sequence.math;
  assert.equal(sequence.answer, first + (position - 1) * difference);
  assert.equal(sequence.math.kind, "sequence");
});

test("ten-question challenge keeps server answers separate from public questions", () => {
  const { createQuizChallenge } = loadQuizRuntime((minimum) => minimum);
  const challenge = JSON.parse(JSON.stringify(createQuizChallenge(3)));
  assert.equal(challenge.questions.length, 10);
  assert.equal(challenge.answerIds.length, 10);
  challenge.questions.forEach((question, index) => {
    assert.equal("answer" in question, false);
    assert.equal("correctId" in question, false);
    assert.equal(question.options.length, 6);
    assert.equal(question.options.some((option) => option.id === challenge.answerIds[index]), true);
    assert.equal(question.options.some((option) => "isCorrect" in option), false);
  });
});
