const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const edge = fs.readFileSync(path.join(root, "supabase/functions/standard-game-action/index.ts"), "utf8");

function loadQuizRuntime(secureInt, sourceText = edge) {
  const start = sourceText.indexOf("function factorial(");
  const end = sourceText.indexOf("function quizAnswerProjection(");
  assert.ok(start >= 0 && end > start, "quiz generator source region must remain extractable");
  const source = sourceText.slice(start, end)
    .replace(/type QuizGenerated = \{[\s\S]*?\r?\n\};\r?\n/, "")
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
    .replace("function quizExperienceMeta(level: number, question: QuizGenerated): JsonObject", "function quizExperienceMeta(level, question)")
    .replace("function createQuizChallenge(level: number): { questions: JsonObject[]; answerIds: string[]; explanations: string[] }", "function createQuizChallenge(level)")
    .replace("const questions: JsonObject[] = [];", "const questions = [];")
    .replace("const answerIds: string[] = [];", "const answerIds = [];")
    .replace("const explanations: string[] = [];", "const explanations = [];")
    .replace("const recentTemplateIds: string[] = [];", "const recentTemplateIds = [];");
  const context = vm.createContext({
    secureInt,
    shuffled: (values) => [...values],
  });
  new vm.Script(`${source}\nglobalThis.__quizRuntime = { quizPrompt, quizExperienceMeta, createQuizChallenge };`, { filename: "standard-game-action.quiz-runtime.js" }).runInContext(context);
  return context.__quizRuntime;
}

function selectedPrompt(level, selection) {
  const catalogLastIndex = level === 1 ? 7 : 9;
  const runtime = loadQuizRuntime((minimum, maximum) => minimum === 0 && maximum === catalogLastIndex ? selection : minimum);
  return JSON.parse(JSON.stringify(runtime.quizPrompt(level)));
}

test("quiz runtime extraction accepts LF and CRLF checkouts", () => {
  for (const sourceText of [edge.replace(/\r\n/g, "\n"), edge.replace(/\r?\n/g, "\r\n")]) {
    const runtime = loadQuizRuntime((minimum) => minimum, sourceText);
    assert.equal(typeof runtime.quizPrompt, "function");
    assert.equal(typeof runtime.createQuizChallenge, "function");
  }
});

test("story generators expose only the story descriptor before an answer", () => {
  for (const [level, selection] of [[2, 8], [2, 9], [3, 8], [3, 9], [4, 8], [4, 9], [5, 6], [5, 8], [5, 9]]) {
    const question = selectedPrompt(level, selection);
    assert.deepEqual(question.math, { kind: "story" }, `${level}:${selection}:${question.templateId}`);
    assert.ok(question.prompt.length > 0);
    assert.equal(typeof question.answer, "number");
  }
});

test("all eight structured geometry generators keep dimensions and answers consistent", () => {
  const cases = [[1, 5], [1, 7], [2, 5], [2, 6], [3, 5], [4, 5], [4, 6]];
  const areaOrVolume = {
    rectangle: ({ width, height }) => width * height,
    cube: ({ side }) => side ** 3,
    triangle: ({ base, height }) => base * height / 2,
    cuboid: ({ length, width, height }) => length * width * height,
    circle: ({ radius }) => radius ** 2,
    trapezoid: ({ top, bottom, height }) => (top + bottom) * height / 2,
    cylinder: ({ radius, height }) => radius ** 2 * height,
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
    "sigma-quadratic": (k, question) => question.math.coefficients.quadratic * k ** 2
      + question.math.coefficients.linear * k + question.math.coefficients.constant,
  };
  for (const question of sigmas) {
    const { lower, upper } = question.math;
    let expected = 0;
    for (let k = lower; k <= upper; k += 1) expected += termFor[question.templateId](k, question);
    assert.equal(question.answer, expected, question.templateId);
    if (question.templateId !== "sigma-quadratic") assert.deepEqual([lower, upper], [1, 4]);
  }

  const sequence = selectedPrompt(4, 2);
  const { first, difference, position } = sequence.math;
  assert.equal(sequence.answer, first + (position - 1) * difference);
  assert.equal(sequence.math.kind, "sequence");
});

test("quadratic asks visibly and semantically for the smaller root", () => {
  const runtime = loadQuizRuntime((minimum, maximum) => minimum === 0 && maximum === 9 ? 0 : minimum);
  const question = JSON.parse(JSON.stringify(runtime.quizPrompt(4)));
  assert.equal(question.templateId, "quadratic");
  assert.equal(question.answer, 1);
  assert.match(question.prompt, /小さい方の解 x = \?/);
  assert.match(question.math.value, /小さい方の解 x = \?/);
  assert.equal(runtime.quizExperienceMeta(4, question).mission, "式を整理して、小さい方の解を求めよう");
});

test("ten-question challenge keeps server answers separate from public questions", () => {
  const { createQuizChallenge } = loadQuizRuntime((minimum) => minimum);
  for (const level of [3, 5]) {
    const challenge = JSON.parse(JSON.stringify(createQuizChallenge(level)));
    assert.equal(challenge.questions.length, 10);
    assert.equal(challenge.answerIds.length, 10);
    assert.equal(challenge.explanations.length, 10);
    challenge.questions.forEach((question, index) => {
      assert.equal("answer" in question, false);
      assert.equal("correctId" in question, false);
      assert.equal(question.options.length, 6);
      assert.equal(question.options.some((option) => option.id === challenge.answerIds[index]), true);
      assert.equal(question.options.some((option) => "isCorrect" in option), false);
      assert.equal(typeof challenge.explanations[index], "string");
      assert.ok(challenge.explanations[index].length > 0);
      assert.equal(typeof question.mission, "string");
      assert.ok(question.mission.length > 0);
      assert.equal(typeof question.formatLabel, "string");
      assert.ok(question.formatLabel.length > 0);
      assert.ok([1, 2, 3].includes(question.thinkingSteps));
    });
  }
});

test("level five requires multi-step work instead of one-formula substitutions", () => {
  const questions = Array.from({ length: 10 }, (_, selection) => selectedPrompt(5, selection));
  assert.deepEqual(questions.map((question) => question.templateId), [
    "matrix-trace", "sigma-quadratic", "committee-roles", "system-three", "determinant-three",
    "integral-polynomial", "cylinder-minus-cone", "derivative-product", "paired-selection", "recurrence",
  ]);
  assert.deepEqual(questions.map((question) => question.answer), [196, 98, 1512, -15, 4, 28, 54, 80, 100, -123]);
  assert.equal(questions.every((question) => question.timeLimitSeconds >= 52 && question.timeLimitSeconds <= 62), true);
  assert.equal(questions[3].math.lines.length, 3);
  assert.equal(questions[4].math.rows.length, 3);
  assert.equal(questions[4].math.rows.every((row) => row.length === 3), true);
  assert.match(questions[2].prompt, /委員長と副委員長/);
  assert.match(questions[7].hint, /積の微分/);
  const runtime = loadQuizRuntime((minimum) => minimum);
  assert.equal(runtime.quizExperienceMeta(5, questions[0]).mission, "行列積の対角成分を求め、tr(AB)を計算しよう");
  assert.equal(runtime.quizExperienceMeta(5, questions[3]).mission, "3つの式から x+y+z を求めよう");
});
