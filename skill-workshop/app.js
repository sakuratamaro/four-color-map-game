"use strict";
(() => {
  const api = globalThis.FourColorSkillWorkshop;
  const $ = (id) => document.getElementById(id);
  const names = { red: "赤", blue: "青", yellow: "黄", green: "緑" };
  const paint = { red: "#fa7366", blue: "#68b8ed", yellow: "#f6d66f", green: "#7dcca4" };
  let session, selected = [], picked = [], saveBlocked = false;
  for (const [id, card] of Object.entries(api.CARDS)) {
    for (const target of ["scenario", "skill"]) $(target).add(new Option(card.name, id));
  }
  function save() {
    if (saveBlocked) return;
    try { localStorage.setItem(api.SAVE_KEY, api.encode(session)); $("saveNotice").textContent = "実験室の続きはこの端末に保存されます。"; }
    catch { $("saveNotice").textContent = "このブラウザーでは保存できません。画面を閉じるまで遊べます。"; }
  }
  try {
    const saved = localStorage.getItem(api.SAVE_KEY);
    session = saved ? api.decode(saved) : api.create();
  } catch {
    session = api.create(); saveBlocked = true;
    $("saveNotice").textContent = "以前の試遊データを読めませんでした。上書きせず新しい画面で開始しています。練習盤面を明示的に選ぶと保存を再開します。";
  }
  function reset(scenario) {
    session = api.create({ scenario }); selected = []; picked = []; saveBlocked = false;
    if (scenario !== "free") $("skill").value = scenario;
    $("effectColor").value = scenario === "labChecker" ? "yellow" : "blue";
    save(); render();
  }
  function act(type, payload) {
    const result = api.apply(session, { id: `ui-${crypto.randomUUID()}`, actor: session.state.active, expectedVersion: session.state.version, type, payload });
    if (!result.ok) {
      const errors = { INVALID_TARGETS: "必要な数のエリアを選んでください。", WRONG_PHASE: "このタイミングでは使えません。", SKILL_CATEGORY_ALREADY_USED_IN_WINDOW: "この操作区間では同じカテゴリをすでに使っています。", RECOLOR_ADJACENCY_CONFLICT: "変更後に同じ色が接するため、使いませんでした。", COLOR_UNAVAILABLE: "その色は今使えません。", INELIGIBLE_REGION: "対象にできないエリアです。予約中・同ターン作成のエリアは選べません。", WRONG_REGION_SIZE: `空きマスを${session.state.requiredSize}個選んでください。`, REGION_NOT_CONNECTED: "辺でつながる形を選んでください。", REGION_NOT_ADJACENT: "既存のエリアに辺で接する形を選んでください。", SWAP_REQUIRES_NONADJACENT: "色交換は、辺で接していない2エリアを選びます。", DISRUPT_CATEGORY_SILENCED: "今は妨害封じの効果中です。救済COLORカードは使えます。", OWN_SEALED_COLOR_REQUIRED: "封印されている自分の持ち色を選んでください。", NO_EFFECT: "何も変わらないため、消費しませんでした。" };
      $("message").textContent = `${errors[result.code] || `使えませんでした（${result.code}）。`} カード・盤面は変わっていません。`;
      return;
    }
    session = result.session; selected = []; picked = []; save(); render();
  }
  function render() {
    const state = session.state, skillId = $("skill").value, card = api.CARDS[skillId];
    $("turnTitle").textContent = state.status === "FINISHED" ? `終局 · ${state.winner}の勝ち` : `${state.active} の番`;
    $("phaseTag").textContent = { COLOR: "彩色", WORK: "指定・スキル", CREATE_FIRST: "最初の指定", GAME_OVER: "練習終了" }[state.phase];
    $("turnHelp").textContent = state.status === "FINISHED" ? "別のカードの練習盤面で、何度でも試せます。" : state.phase === "COLOR" ? "点線のエリアに色を選ぶか、救済スキルを使えます。隣接する同色を選ぶと負けます。" : `空きマスを${state.requiredSize}個つなげて相手へ渡します。先に既塗エリアへスキルを使うこともできます。`;
    $("board").replaceChildren();
    for (let row = 1; row <= 10; row += 1) for (let col = 1; col <= 10; col += 1) {
      const macro = row * 12 + col;
      const region = Object.values(state.regions).find((item) => item.sourceMacros.includes(macro));
      const button = document.createElement("button"); button.type = "button"; button.className = "cell"; button.dataset.macro = String(macro);
      if (region) {
        button.dataset.region = region.id;
        button.classList.add(region.color ? "painted" : "pending");
        button.style.setProperty("--paint", paint[region.color] || "#909cab");
        if (region.labColors) { button.classList.add("checker"); button.style.setProperty("--accent", paint[region.labColors[1]]); }
        if (session.scheduled.some((entry) => entry.regionId === region.id)) button.classList.add("reservation");
        const order = picked.indexOf(region.id);
        button.textContent = order >= 0 ? String(order + 1) : region.id.slice(1);
        if (order >= 0) button.classList.add("selected");
      } else if (selected.includes(macro)) { button.classList.add("selected"); button.textContent = "●"; }
      const description = region ? `${region.id} ${region.color ? api.colors(region).map((color) => names[color]).join("・") : "未塗り"}` : "空き";
      button.setAttribute("aria-label", `${row}行${col}列 ${description}`);
      button.setAttribute("aria-pressed", String(region ? picked.includes(region.id) : selected.includes(macro)));
      button.addEventListener("click", () => {
        if (region) picked = picked.includes(region.id) ? picked.filter((id) => id !== region.id) : [...picked, region.id];
        else selected = selected.includes(macro) ? selected.filter((id) => id !== macro) : [...selected, macro];
        render(); $("board").querySelector(`[data-macro="${macro}"]`).focus({ preventScroll: true });
      });
      $("board").append(button);
    }
    $("selectionHelp").textContent = `選択エリア：${picked.join(" → ") || "なし"} ／ 空きマス：${selected.length}個`;
    $("createRegion").disabled = state.status !== "ACTIVE" || !["WORK", "CREATE_FIRST"].includes(state.phase);
    $("skillHelp").textContent = card.help;
    $("targetHelp").textContent = card.targets ? `盤面からエリアを${card.targets}個選んで実行します。数字は選択順です。` : "エリア選択は不要です。";
    const needsColor = ["labChecker", "labUnseal"].includes(skillId);
    $("effectColor").hidden = $("colorLabel").hidden = !needsColor;
    $("chargeInfo").textContent = `${state.active}の残り：${session.charges[state.active][skillId]}回 ／ ${card.category === "color" ? "COLOR" : "妨害"}カテゴリ${session.silence[state.active] === "ACTIVE" ? " ／ 妨害封じ中" : ""}`;
    $("useSkill").disabled = state.status !== "ACTIVE" || state.phase !== card.phase || session.charges[state.active][skillId] === 0;
    for (const option of $("skill").options) option.textContent = `${api.CARDS[option.value].name} · 残${session.charges[state.active][option.value]}`;
    $("palette").replaceChildren();
    for (const color of Object.keys(names)) {
      const basic = state.basicPalettes[state.active].includes(color), bonus = state.bonusColors[state.active] === color;
      const seal = state.publicEffects[state.active].seals[color] || 0;
      const b = document.createElement("button"); b.type = "button"; b.dataset.color = color; b.style.setProperty("--paint", paint[color]);
      b.textContent = `${names[color]} ${seal ? `封${seal}` : basic ? "基本" : bonus ? `残${state.bonusUsesRemaining[state.active]}` : "なし"}`;
      b.disabled = state.status !== "ACTIVE" || state.phase !== "COLOR" || seal > 0 || !(basic || bonus && state.bonusUsesRemaining[state.active] > 0);
      b.addEventListener("click", () => act("COLOR_REGION", { color })); $("palette").append(b);
    }
    const opponent = state.active === "A" ? "B" : "A";
    $("opponentPalette").textContent = `この練習は両者公開：${opponent}の基本色 ${state.basicPalettes[opponent].map((color) => names[color]).join("・")} ／ おまけ ${names[state.bonusColors[opponent]]} ${state.bonusUsesRemaining[opponent]}回`;
    $("message").textContent = session.lastEvent;
    $("scheduled").textContent = session.scheduled.length ? `公開予約：${session.scheduled.map((item) => `${item.regionId}（${item.actor}）`).join("、")}` : "再彩色予約なし";
    $("history").replaceChildren(...state.publicLog.slice(-15).map((entry) => { const li = document.createElement("li"); li.textContent = entry; return li; }));
  }
  $("loadScenario").addEventListener("click", () => reset($("scenario").value));
  $("freePlay").addEventListener("click", () => reset("free"));
  $("clearSelection").addEventListener("click", () => { selected = []; picked = []; render(); });
  $("skill").addEventListener("change", () => { picked = []; render(); });
  $("useSkill").addEventListener("click", () => act("USE_SKILL", { skill: $("skill").value, regionIds: api.CARDS[$("skill").value].targets ? picked : [], color: $("effectColor").value }));
  $("createRegion").addEventListener("click", () => act("CREATE_REGION", { sourceMacros: selected }));
  render();
})();
