import { createClient } from "npm:@supabase/supabase-js@2";
import "./standard-engine.bundle.js";

type JsonObject = Record<string, unknown>;
type Seat = "A" | "B";
type StandardEngineApi = {
  create(input: { matchId: string; loadouts: Record<Seat, JsonObject>; profiles: Record<Seat, JsonObject>; seed: number }): JsonObject;
  apply(input: { state: JsonObject; rngSnapshot: JsonObject; actor: Seat; action: JsonObject; expectedVersion: number }): JsonObject;
  applyProfiles(input: { profiles: Record<Seat, JsonObject>; beforeState: JsonObject; nextState: JsonObject; actor: Seat; action: JsonObject; finishedAt: string }): { profiles: Record<Seat, JsonObject>; changed: Record<Seat, boolean> };
  createStarterProfile(displayName: string): JsonObject;
  drawGacha(input: { profile: JsonObject; ticketLevel: number; count: number; seed: number }): { profile: JsonObject; draws: JsonObject[] };
  quoteCardSale(input: { profile: JsonObject; skillId: string; count: number }): JsonObject;
  sellCards(input: { profile: JsonObject; skillId: string; count: number; confirmed: boolean }): { profile: JsonObject; quote: JsonObject };
  publicState(state: JsonObject): JsonObject;
  privateState(state: JsonObject, seat: Seat): JsonObject;
  validateProfile(profile: JsonObject): boolean;
  validateSeatLoadout(input: { loadout: JsonObject; profile: JsonObject }): boolean;
};

declare global {
  // Generated from the reviewed Standard engine and profile modules.
  // deno-lint-ignore no-var
  var FourColorStandardServerEngine: StandardEngineApi;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function quizPrompt(level: number): { prompt: string; answer: number } {
  const kind = secureInt(0, 3);
  if (level === 1) {
    if (kind === 0) { const a = secureInt(8, 80); const b = secureInt(3, 40); return { prompt: `${a} + ${b} = ?`, answer: a + b }; }
    if (kind === 1) { const a = secureInt(30, 120); const b = secureInt(2, a - 1); return { prompt: `${a} − ${b} = ?`, answer: a - b }; }
    if (kind === 2) { const a = secureInt(2, 12); const b = secureInt(2, 12); return { prompt: `${a} × ${b} = ?`, answer: a * b }; }
    const divisor = secureInt(2, 12); const answer = secureInt(2, 15); return { prompt: `${divisor * answer} ÷ ${divisor} = ?`, answer };
  }
  if (level === 2) {
    if (kind === 0) { const x = secureInt(-8, 16); const a = secureInt(2, 8); const b = secureInt(-12, 12); return { prompt: `${a}x ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`} = ${a * x + b}　x = ?`, answer: x }; }
    if (kind === 1) { const base = secureInt(4, 40) * 10; const percent = [10, 20, 25, 50, 75][secureInt(0, 4)]; return { prompt: `${base} の ${percent}% は？`, answer: base * percent / 100 }; }
    if (kind === 2) { const a = secureInt(2, 15); const b = secureInt(2, 12); const c = secureInt(2, 9); return { prompt: `${a} + ${b} × ${c} = ?`, answer: a + b * c }; }
    const values = Array.from({ length: 4 }, () => secureInt(5, 30)); values[3] += (4 - values.reduce((sum, value) => sum + value, 0) % 4) % 4; return { prompt: `平均を求めよ：${values.join('、')}`, answer: values.reduce((sum, value) => sum + value, 0) / 4 };
  }
  if (level === 3) {
    if (kind === 0) { const a = secureInt(2, 7); const power = secureInt(2, 4); return { prompt: `${a}^${power} = ?`, answer: a ** power }; }
    if (kind === 1) { const root = secureInt(2, 24); return { prompt: `√${root * root} = ?`, answer: root }; }
    if (kind === 2) { const value = secureInt(3, 7); return { prompt: `${value}! = ?`, answer: factorial(value) }; }
    const end = secureInt(4, 10); return { prompt: `Σ(k=1→${end}) k = ?`, answer: end * (end + 1) / 2 };
  }
  if (level === 4) {
    if (kind === 0) { const small = secureInt(1, 8); const large = secureInt(small + 1, 13); return { prompt: `x² − ${small + large}x + ${small * large} = 0　小さい解 x = ?`, answer: small }; }
    if (kind === 1) { const total = secureInt(6, 11); const selected = secureInt(2, Math.min(4, total - 2)); return { prompt: `${total}C${selected} = ?`, answer: combination(total, selected) }; }
    if (kind === 2) { const first = secureInt(1, 12); const difference = secureInt(2, 8); const position = secureInt(6, 12); return { prompt: `初項${first}、公差${difference}の等差数列　第${position}項は？`, answer: first + (position - 1) * difference }; }
    const [a, b, c, d] = Array.from({ length: 4 }, () => secureInt(-6, 8)); return { prompt: `det [[${a}, ${b}], [${c}, ${d}]] = ?`, answer: a * d - b * c };
  }
  if (kind === 0) { const total = secureInt(7, 10); const count = secureInt(2, 4); return { prompt: `${total}! / ${total - count}! = ?`, answer: factorial(total) / factorial(total - count) }; }
  if (kind === 1) { const end = secureInt(4, 8); const a = secureInt(1, 4); const b = secureInt(-4, 7); return { prompt: `Σ(k=1→${end}) (${a}k² ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`}) = ?`, answer: a * end * (end + 1) * (2 * end + 1) / 6 + b * end }; }
  if (kind === 2) { const x = secureInt(-6, 9); const y = secureInt(-6, 9); const a = secureInt(2, 5); const b = secureInt(1, 4); const c = secureInt(1, 4); const d = secureInt(2, 5); return { prompt: `${a}x + ${b}y = ${a * x + b * y}、${c}x − ${d}y = ${c * x - d * y}　x = ?`, answer: x }; }
  const [a, b, c, d] = Array.from({ length: 4 }, () => secureInt(-4, 6)); const [e, f, g, h] = Array.from({ length: 4 }, () => secureInt(-4, 6)); return { prompt: `A=[[${a},${b}],[${c},${d}]], B=[[${e},${f}],[${g},${h}]]　ABの1行1列は？`, answer: a * e + b * g };
}

function createQuizChallenge(level: number): { questions: JsonObject[]; answerIds: string[] } {
  const questions: JsonObject[] = [];
  const answerIds: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const generated = quizPrompt(level);
    const choices = quizOptions(generated.answer, index);
    questions.push({ number: index + 1, prompt: generated.prompt, options: choices.options });
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
    if (!["profile", "gacha", "card-sale-quote", "card-sale", "quiz-start", "quiz-finish", "setup", "initialize", "action"].includes(String(operation))) {
      return json(400, { error: { code: "INVALID_REQUEST", message: "A valid operation is required." } });
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
      });
    }

    if (operation === "quiz-finish") {
      const sessionId = body.sessionId;
      const actionId = body.actionId;
      const answers = body.answers;
      if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)
          || typeof actionId !== "string" || !UUID_PATTERN.test(actionId)
          || !Array.isArray(answers) || answers.length !== 10
          || answers.some((answer) => typeof answer !== "string" || answer.length > 32)) {
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

    if (operation === "setup") {
      const setupActionId = body.setupActionId;
      const expectedSetupRevision = body.expectedSetupRevision;
      const loadout = body.loadout;
      if (typeof setupActionId !== "string" || !UUID_PATTERN.test(setupActionId)
          || !Number.isSafeInteger(expectedSetupRevision) || !loadout || typeof loadout !== "object") {
        return json(400, { error: { code: "INVALID_SETUP", message: "A setup ID, revision, and six-card loadout are required." } });
      }
      stage = "load-profile";
      const { data: profileData, error: profileError } = await service.rpc("fcg_standard_server_load_profile", {
        p_user_id: actorId,
      });
      if (profileError) throw profileError;
      const profile = firstRow(profileData);
      if (!profile) throw { code: "P0002" };
      try {
        globalThis.FourColorStandardServerEngine.validateSeatLoadout({ loadout: loadout as JsonObject, profile: profile.profile_state as JsonObject });
      } catch {
        return json(400, { error: { code: "INVALID_SETUP", message: "The loadout must contain two owned cards from each category." } });
      }
      const loadoutFingerprint = await fingerprint({ roomId, actorId, profileRevision: profile.revision, loadout });
      const quoteExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      stage = "commit-setup";
      const { data, error } = await service.rpc("fcg_standard_server_submit_loadout", {
        p_room_id: roomId,
        p_actor_id: actorId,
        p_expected_setup_revision: expectedSetupRevision,
        p_profile_revision: profile.revision,
        p_quote_id: setupActionId,
        p_quote_expires_at: quoteExpiresAt,
        p_loadout: loadout,
        p_loadout_fingerprint: loadoutFingerprint,
      });
      if (error) throw error;
      return json(200, { setupRevision: firstRow(data) ?? data, profileRevision: profile.revision, quoteId: setupActionId, quoteExpiresAt });
    }

    const load = async (): Promise<JsonObject> => {
      const { data, error } = await service.rpc("fcg_standard_server_load_room", { p_room_id: roomId, p_actor_id: actorId });
      if (error) throw error;
      const row = firstRow(data);
      if (!row) throw { code: "P0002" };
      return row;
    };

    stage = "load-room";
    let room = await load();
    const seat = room.actor_seat as Seat;
    if (seat !== "A" && seat !== "B") return json(403, { error: { code: "NOT_A_MEMBER", message: "You are not in this room." } });

    if (operation === "initialize") {
      if (room.room_status !== "ready" && room.room_status !== "playing") return json(409, { error: { code: "ROOM_NOT_READY", message: "Two validated loadouts are required." } });
      if (!room.authoritative_state) {
        if (!room.setup_a || !room.setup_b || !room.profile_a_state || !room.profile_b_state) {
          return json(409, { error: { code: "SETUP_REQUIRED", message: "Both players must submit a current loadout." } });
        }
        stage = "create-match";
        const initialVersion = Number(room.room_version);
        if (!Number.isSafeInteger(initialVersion) || initialVersion < 0) throw new Error("INVALID_ROOM_VERSION");
        const created = globalThis.FourColorStandardServerEngine.create({
          matchId: `${roomId}:${initialVersion}`,
          loadouts: { A: room.setup_a as JsonObject, B: room.setup_b as JsonObject },
          profiles: { A: room.profile_a_state as JsonObject, B: room.profile_b_state as JsonObject },
          seed: secureSeed(),
        });
        const initialState = { ...(created.state as JsonObject), version: initialVersion };
        stage = "initialize-room";
        const { error } = await service.rpc("fcg_standard_server_initialize_room", {
          p_room_id: roomId,
          p_expected_version: room.room_version,
          p_authoritative_state: { state: initialState, rngSnapshot: created.rngSnapshot },
          p_public_state: globalThis.FourColorStandardServerEngine.publicState(initialState),
          p_private_a: globalThis.FourColorStandardServerEngine.privateState(initialState, "A"),
          p_private_b: globalThis.FourColorStandardServerEngine.privateState(initialState, "B"),
        });
        if (error) throw error;
        room = await load();
      }
      return json(200, { room: roomProjection(room) });
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
    stage = "apply-action";
    const applied = globalThis.FourColorStandardServerEngine.apply({
      state: authority.state as JsonObject,
      rngSnapshot: authority.rngSnapshot as JsonObject,
      actor: seat,
      action,
      expectedVersion: action.expectedVersion as number,
    });
    if (applied.ok !== true) return json(400, { error: { code: applied.code || "RULE_REJECTED", message: "The action is not legal in the current state." } });

    const finishedAt = new Date().toISOString();
    const profiles = globalThis.FourColorStandardServerEngine.applyProfiles({
      profiles: { A: room.profile_a_state as JsonObject, B: room.profile_b_state as JsonObject },
      beforeState: authority.state as JsonObject,
      nextState: applied.state as JsonObject,
      actor: seat,
      action,
      finishedAt,
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
