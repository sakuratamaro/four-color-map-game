import { createClient } from "npm:@supabase/supabase-js@2";
// The dashboard deployer only bundles files inside this function directory.
// `tests/edge-handler.test.cjs` guarantees this deploy copy stays source-identical
// to the browser engine at `online/quick-engine.js` (apart from line endings).
import "./quick-engine.js";

type JsonObject = Record<string, unknown>;
type EngineApi = {
  RuleError: new (...args: never[]) => Error & { code: string };
  createQuickGame(options: { random: () => number }): JsonObject;
  applyAction(
    state: JsonObject,
    actor: "A" | "B",
    action: JsonObject,
    options: { random: () => number },
  ): { state: JsonObject; duplicate: boolean; result: JsonObject };
  publicState(state: JsonObject): JsonObject;
  privateState(state: JsonObject, seat: "A" | "B"): JsonObject;
};

declare global {
  // The shared UMD engine is also loaded directly by the GitHub Pages client.
  // Keeping the state transition code in one file prevents browser/server drift.
  // deno-lint-ignore no-var
  var FourColorQuickEngine: EngineApi;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function secureRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x100000000;
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing Edge Function environment: ${name}`);
  return value;
}

function firstRow(value: unknown): JsonObject | null {
  if (Array.isArray(value)) return (value[0] as JsonObject | undefined) || null;
  return value && typeof value === "object" ? (value as JsonObject) : null;
}

function publicError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof globalThis.FourColorQuickEngine.RuleError) {
    const code = error.code || "RULE_REJECTED";
    const conflict = code === "STALE_VERSION";
    return { status: conflict ? 409 : 400, code, message: error.message };
  }
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === "40001") return { status: 409, code: "STALE_VERSION", message: "Match changed; reload and retry." };
  if (candidate?.code === "P0002") return { status: 404, code: "ROOM_NOT_FOUND", message: "Room was not found." };
  return { status: 500, code: "SERVER_ERROR", message: "The game server could not complete the request." };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: { code: "METHOD_NOT_ALLOWED", message: "POST required." } });

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return json(401, { error: { code: "AUTH_REQUIRED", message: "Anonymous sign-in is required." } });
    }

    const supabaseUrl = requiredEnvironment("SUPABASE_URL");
    const publishableKey = requiredEnvironment("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return json(401, { error: { code: "AUTH_INVALID", message: "Anonymous session is invalid." } });
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = (await request.json()) as JsonObject;
    const operation = body.operation;
    const roomId = body.roomId;
    if ((operation !== "initialize" && operation !== "action") || typeof roomId !== "string") {
      return json(400, { error: { code: "INVALID_REQUEST", message: "operation and roomId are required." } });
    }

    const load = async () => {
      const { data, error } = await service.rpc("fcg_server_load_room", {
        p_room_id: roomId,
        p_actor_id: authData.user.id,
      });
      if (error) throw error;
      const row = firstRow(data);
      if (!row) throw { code: "P0002" };
      return row;
    };

    let room = await load();
    const seat = room.actor_seat as "A" | "B";
    if (seat !== "A" && seat !== "B") return json(403, { error: { code: "NOT_A_MEMBER", message: "You are not in this room." } });

    if (operation === "initialize") {
      if (room.room_status !== "ready" && room.room_status !== "playing") {
        return json(409, { error: { code: "ROOM_NOT_READY", message: "Two players are required." } });
      }
      if (!room.authoritative_state) {
        const state = globalThis.FourColorQuickEngine.createQuickGame({ random: secureRandom });
        const { error } = await service.rpc("fcg_server_initialize_room", {
          p_room_id: roomId,
          p_authoritative_state: state,
          p_public_state: globalThis.FourColorQuickEngine.publicState(state),
          p_private_a: globalThis.FourColorQuickEngine.privateState(state, "A"),
          p_private_b: globalThis.FourColorQuickEngine.privateState(state, "B"),
        });
        if (error) throw error;
        room = await load();
      }
      const state = room.authoritative_state as JsonObject;
      return json(200, {
        room: {
          status: room.room_status,
          version: room.room_version,
          seat,
          publicState: globalThis.FourColorQuickEngine.publicState(state),
          privateState: globalThis.FourColorQuickEngine.privateState(state, seat),
        },
      });
    }

    if (room.room_status !== "playing" || !room.authoritative_state) {
      return json(409, { error: { code: "ROOM_NOT_PLAYING", message: "The match has not started." } });
    }
    const submittedAction = body.action;
    if (!submittedAction || typeof submittedAction !== "object") {
      return json(400, { error: { code: "INVALID_ACTION", message: "action is required." } });
    }

    const applied = globalThis.FourColorQuickEngine.applyAction(
      room.authoritative_state as JsonObject,
      seat,
      submittedAction as JsonObject,
      { random: secureRandom },
    );
    if (applied.duplicate) {
      return json(200, { duplicate: true, result: applied.result });
    }

    const next = applied.state;
    const action = submittedAction as JsonObject;
    const { data: committed, error: commitError } = await service.rpc("fcg_server_commit_action", {
      p_room_id: roomId,
      p_actor_id: authData.user.id,
      p_action_id: action.id,
      p_expected_version: action.expectedVersion,
      p_action_type: action.type,
      p_authoritative_state: next,
      p_public_state: globalThis.FourColorQuickEngine.publicState(next),
      p_private_a: globalThis.FourColorQuickEngine.privateState(next, "A"),
      p_private_b: globalThis.FourColorQuickEngine.privateState(next, "B"),
      p_result: applied.result,
      p_finished: Boolean(next.winner),
      p_winner_seat: next.winner || null,
    });
    if (commitError) throw commitError;
    const receipt = firstRow(committed) || {};

    return json(200, {
      duplicate: Boolean(receipt.duplicate),
      result: receipt.action_result || applied.result,
      room: {
        status: next.winner ? "finished" : "playing",
        version: receipt.new_version,
        seat,
        publicState: globalThis.FourColorQuickEngine.publicState(next),
        privateState: globalThis.FourColorQuickEngine.privateState(next, seat),
      },
    });
  } catch (error) {
    const safe = publicError(error);
    console.error("game-action failed", safe.code);
    return json(safe.status, { error: { code: safe.code, message: safe.message } });
  }
});
