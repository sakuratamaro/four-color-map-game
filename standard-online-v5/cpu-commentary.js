(function initStandardCpuCommentary(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FourColorStandardCpuCommentary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function standardCpuCommentaryFactory() {
  "use strict";

  const VERSION = "standard-cpu-commentary-v3";
  const MIN_ACTIVE_VERSION_GAP = 4;
  const ACTIVE_TRACE_TYPES = Object.freeze(["CREATE_REGION", "COLOR_REGION", "USE_SKILL", "LEGAL_RECOLOR"]);
  const TERMINAL_REASONS = Object.freeze(["ILLEGAL_COLOR", "BOARD_LOCK", "SURRENDER", "SEALED_OUT", "NO_LEGAL_COLOR"]);

  const voices = {
    yuzu: {
      ambient: ["あっ、こっちも塗れそう！", "次もテンポよくいきましょう！"],
      skill: "えいっ、カードにおまかせです！",
      pressure: "わあ、いいところにつながりました！",
      threatened: "あっ、その形はちょっと困るかも……！",
      opponentSkill: "そのカード、ここで使うんですね！",
      win: "えへへ、うまくいきました！",
      loss: "あっ、そこで決まっちゃいましたか……！",
      noColorLoss: "ミスったー！！ 塗れる色が見つかりません！",
    },
    ren: {
      ambient: ["考えるより先に、盤面を取る！", "次だ次、止まってる暇はない！"],
      skill: "ここで一気に加速する！",
      pressure: "このエリア、先に押さえたぞ！",
      threatened: "しまった……！ そのエリアは速い。",
      opponentSkill: "ここで切るのか。やるな！",
      win: "よし、俺の勝ちだ！",
      loss: "しまった……！ 今回は俺の負けだ。",
      noColorLoss: "くそっ、塗れる色がない！ ここは俺の投了だ！",
    },
    minato: {
      ambient: ["この形、教本で見た気がします！", "一手ずつ覚えていきます！"],
      skill: "この技、試してみます！",
      pressure: "できました！ たぶん、いい形です！",
      threatened: "なるほど……そこに置くんですね。",
      opponentSkill: "その使い方、勉強になります！",
      win: "この勝ち筋、覚えておきます！",
      loss: "うう、まだ修行不足です……。",
      noColorLoss: "塗れる色がありません……参りました！",
    },
    koharu: {
      ambient: ["次の色は……たぶん、これ！", "読み筋はばっちりです。たぶん！"],
      skill: "ここで仕掛けます。読みどおりなら！",
      pressure: "これは効くはず……知らんけど！",
      threatened: "えっ、そっちでしたか！？",
      opponentSkill: "そのカードは……読んでませんでした！",
      win: "読みは当たってました！ たぶん！",
      loss: "これは一本取られました……見事です。",
      noColorLoss: "えっ、合法色がゼロ！？ 読み違えました！",
    },
    aoi: {
      ambient: ["一手ずつ、確かめましょう。", "急がなくても、道は見えてきます。"],
      skill: "今なら、この一枚が安全です。",
      pressure: "無理をせず、圧力だけ残します。",
      threatened: "落ち着いて……まだ形を見直せます。",
      opponentSkill: "その一枚も、盤面に織り込みましょう。",
      win: "一手ずつ確かめた甲斐がありました。",
      loss: "その一手までは読めませんでした。",
      noColorLoss: "打開できる色がありません。ここで投了します。",
    },
    kai: {
      ambient: ["勝負は流れだ。乗っていこうぜ！", "安全牌だけじゃ、地図は取れないぜ。"],
      skill: "ここは一発、賭けるぜ！",
      pressure: "来た来た、この形を待ってた！",
      threatened: "ヒリついてきたな……面白い！",
      opponentSkill: "いい度胸だ、その勝負買った！",
      win: "この勝負、もらったぜ！",
      loss: "今回は俺の負けだ。次は当てるぜ！",
      noColorLoss: "合法色なしとは大外れだ！ 今回は投了するぜ！",
    },
    tsubasa: {
      ambient: ["地図は動かしてこそ面白い！", "この形、もうひとひねりできそうだ。"],
      skill: "盤面ごと、景色を変えてやる！",
      pressure: "仕掛けはここから効いてくる！",
      threatened: "その形、私の仕掛けを越えてきたか！",
      opponentSkill: "へえ、盤面をそう動かすんだ！",
      win: "よし、決まった！ いい勝負だった！",
      loss: "やられた！ 面白い形だったよ。",
      noColorLoss: "仕掛けに夢中で色がない！ 参った、投了だ！",
    },
    shion: {
      ambient: ["その手、覚えておきます。", "公開された手には、必ず跡が残ります。"],
      skill: "観察は終わりました。ここで動きます。",
      pressure: "この接し方なら、次の反応が見えます。",
      threatened: "記録を更新します。これは鋭い手です。",
      opponentSkill: "そのタイミング……覚えておきます。",
      win: "公開された手を追った結果です。",
      loss: "見事です。今回は私の負けですね。",
      noColorLoss: "確認しました。合法色はゼロです。投了します。",
    },
    rei: {
      ambient: ["組み合わせには、すべて理由があります。", "カードは使う順番までが戦略ですよ。"],
      skill: "このスキルの恐ろしさ、味わわせてあげますよ。",
      pressure: "盤面の形が、きれいにかみ合いました。",
      threatened: "ほう、その組み合わせは研究対象ですね。",
      opponentSkill: "そのカード運用、興味深いですね。",
      win: "この勝ち筋にも、きちんと理由があります。",
      loss: "なるほど……研究し直します。",
      noColorLoss: "どの組み合わせでも救えませんね。投了します。",
    },
    kurogane: {
      ambient: ["盤面も色も、すべて読んでみせよう。", "勝ち筋は、もう地図に描かれている。"],
      skill: "この一枚で、盤面の理を変える。",
      pressure: "俺の四色美技に酔いな！",
      threatened: "ほう……俺の読みを越えてくるか。",
      opponentSkill: "その一手、盤面の景色を変えたな。",
      win: "俺の四色美技に酔いな！",
      loss: "見事だ……完敗だ。",
      noColorLoss: "まさか合法色がない……だと……！？ 俺の投了だ。",
    },
  };

  const CPU_CHARACTER_IDS = Object.freeze(Object.keys(voices));
  const CPU_VOICES = Object.freeze(Object.fromEntries(Object.entries(voices).map(([id, voice]) => [id, Object.freeze({
    ...voice,
    ambient: Object.freeze([...voice.ambient]),
  })])));

  function hashText(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hasExactKeys(value, keys) {
    return value && typeof value === "object" && !Array.isArray(value)
      && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
  }

  function validPublicTrace(publicState) {
    const trace = publicState?.lastPublicTrace;
    if (typeof publicState?.matchId !== "string" || publicState.matchId.length === 0
      || !Number.isSafeInteger(publicState.version) || publicState.version < 1 || !trace
      || !ACTIVE_TRACE_TYPES.includes(trace.type) || !["A", "B"].includes(trace.actor)
      || !Number.isSafeInteger(trace.version) || trace.version < 1 || trace.version !== publicState.version
      || trace.eventId !== `${publicState.matchId}:${trace.version}`) return null;
    const details = trace.type === "CREATE_REGION" ? ["contactColorCount", "regionId", "sourceMacroCount"]
      : ["COLOR_REGION", "LEGAL_RECOLOR"].includes(trace.type) ? ["color", "regionId"] : [];
    if (!hasExactKeys(trace, ["actor", "eventId", "type", "version", ...details])) return null;
    if (trace.type === "CREATE_REGION") {
      return typeof trace.regionId === "string" && trace.regionId.length > 0
        && Number.isSafeInteger(trace.sourceMacroCount) && trace.sourceMacroCount >= 1 && trace.sourceMacroCount <= 5
        && Number.isSafeInteger(trace.contactColorCount) && trace.contactColorCount >= 0 && trace.contactColorCount <= 4 ? trace : null;
    }
    if (["COLOR_REGION", "LEGAL_RECOLOR"].includes(trace.type)) {
      return typeof trace.regionId === "string" && trace.regionId.length > 0
        && ["red", "blue", "yellow", "green"].includes(trace.color) ? trace : null;
    }
    return trace;
  }

  function terminalNarration({ reason, cpuWon, trace, groundedNoColorSurrender }, speakerName) {
    const cpuName = typeof speakerName === "string" && speakerName.trim() ? speakerName.trim().slice(0, 40) : "CPU";
    if (reason === "SURRENDER") return cpuWon ? `あなたが投了し、${cpuName}の勝利が決まりました。`
      : groundedNoColorSurrender ? `${cpuName}は、塗れる色を確保できず投了しました。` : `${cpuName}が投了しました。`;
    if (reason === "BOARD_LOCK") return cpuWon ? `${cpuName}は、これ以上エリアを作れない盤面にして勝利しました。` : `${cpuName}は、これ以上エリアを作れない盤面にされて敗北しました。`;
    if (reason === "ILLEGAL_COLOR") return cpuWon ? `あなたの接色禁止違反により、${cpuName}の勝利が決まりました。` : `${cpuName}は接色禁止に違反して敗北しました。`;
    if (reason === "SEALED_OUT") return cpuWon ? `色封じであなたの使える色が0色になり、${cpuName}の勝利が決まりました。` : `色封じで${cpuName}の使える色が0色になり、敗北しました。`;
    if (reason === "NO_LEGAL_COLOR") {
      if (trace?.type === "CREATE_REGION") {
        const pressure = trace.contactColorCount >= 4 ? "四色に接するエリア"
          : trace.contactColorCount === 3 ? "三色に接するエリア"
          : trace.contactColorCount === 2 ? "二色に接するエリア" : "隣接色が重なるエリア";
        return cpuWon ? `${cpuName}は、${pressure}を渡してあなたの塗れる色をなくしました。` : `${cpuName}は、${pressure}を渡されて塗れる色がなくなりました。`;
      }
      return cpuWon ? `公開盤面であなたの塗れる色がなくなり、${cpuName}の勝利が決まりました。` : `公開盤面で${cpuName}の塗れる色がなくなりました。`;
    }
    return `公開された盤面で、${cpuName}との対戦が決着しました。`;
  }

  function previousCreateTrace(publicState) {
    const trace = publicState?.lastPublicTrace;
    if (!trace || trace.type !== "CREATE_REGION"
      || !hasExactKeys(trace, ["actor", "contactColorCount", "eventId", "regionId", "sourceMacroCount", "type", "version"])
      || !Number.isSafeInteger(publicState?.version) || trace.version !== publicState.version - 1
      || trace.eventId !== `${publicState.matchId}:${trace.version}` || trace.regionId !== publicState.pending
      || trace.actor !== publicState.winner || typeof trace.regionId !== "string" || trace.regionId.length === 0
      || !Number.isSafeInteger(trace.sourceMacroCount) || trace.sourceMacroCount < 1 || trace.sourceMacroCount > 5
      || !Number.isSafeInteger(trace.contactColorCount) || trace.contactColorCount < 0 || trace.contactColorCount > 4) return null;
    return trace;
  }

  function terminalEvent(publicState, cpuSeat) {
    if (publicState?.status !== "FINISHED" || !["A", "B"].includes(publicState.winner)
      || !TERMINAL_REASONS.includes(publicState.terminalReason) || typeof publicState.matchId !== "string" || publicState.matchId.length === 0
      || !Number.isSafeInteger(publicState.version) || publicState.version < 1) return null;
    const candidateTrace = validPublicTrace(publicState) || previousCreateTrace(publicState);
    const groundedNoColorSurrender = publicState.terminalReason === "SURRENDER" && publicState.winner !== cpuSeat
      && typeof publicState.pending === "string" && publicState.pending.length > 0;
    const trace = (publicState.terminalReason === "NO_LEGAL_COLOR" || groundedNoColorSurrender)
      && candidateTrace?.type === "CREATE_REGION"
      && candidateTrace.actor === publicState.winner
      && publicState.pending === candidateTrace.regionId ? candidateTrace : null;
    const cpuWon = publicState.winner === cpuSeat;
    return Object.freeze({
      sourceEventId: `${publicState.matchId}:${publicState.version}:terminal:${publicState.winner}:${publicState.terminalReason}`,
      version: publicState.version,
      kind: cpuWon ? "terminal-win" : "terminal-loss",
      reason: publicState.terminalReason,
      cpuWon,
      trace,
      groundedNoColorSurrender,
    });
  }

  function activeEvent(publicState, cpuSeat) {
    if (publicState?.status !== "ACTIVE") return null;
    const trace = validPublicTrace(publicState);
    if (!trace) return null;
    const byCpu = trace.actor === cpuSeat;
    let kind = null;
    if (trace.type === "USE_SKILL") kind = byCpu ? "skill" : "opponent-skill";
    else if (trace.type === "CREATE_REGION" && trace.contactColorCount >= 3) kind = byCpu ? "pressure" : "threatened";
    else if (byCpu && ["CREATE_REGION", "COLOR_REGION", "LEGAL_RECOLOR"].includes(trace.type)
      && hashText(`${trace.eventId}:ambient`) % 4 === 0) kind = "ambient";
    return kind ? Object.freeze({ sourceEventId: trace.eventId, version: trace.version, kind, trace }) : null;
  }

  function seenEvent(presentedEventIds, eventId) {
    if (presentedEventIds instanceof Set) return presentedEventIds.has(eventId);
    return Array.isArray(presentedEventIds) && presentedEventIds.includes(eventId);
  }

  function chooseCpuCommentary({
    characterId,
    cpuSeat = "B",
    publicState,
    speakerName = "CPU",
    presentedEventIds = [],
    lastPresented = null,
    visible = true,
  } = {}) {
    const voice = CPU_VOICES[characterId];
    if (!voice || !["A", "B"].includes(cpuSeat) || visible !== true) return null;
    const event = terminalEvent(publicState, cpuSeat) || activeEvent(publicState, cpuSeat);
    if (!event) return null;
    const eventId = `${event.sourceEventId}:cpu-commentary:${characterId}:${event.kind}`;
    if (seenEvent(presentedEventIds, eventId)) return null;
    const terminal = event.kind.startsWith("terminal-");
    if (!terminal && lastPresented?.matchId === publicState.matchId && Number.isSafeInteger(lastPresented.version)
      && event.version - lastPresented.version < MIN_ACTIVE_VERSION_GAP) return null;

    let text = null;
    let dialogue = null;
    let narration = null;
    if (terminal) {
      const groundedKuroganeLoss = characterId === "kurogane" && !event.cpuWon
        && event.reason === "NO_LEGAL_COLOR" && event.trace;
      dialogue = event.groundedNoColorSurrender ? voice.noColorLoss
        : groundedKuroganeLoss ? "なんと見事なエリア選択……完敗だ。" : event.cpuWon ? voice.win : voice.loss;
      narration = terminalNarration(event, speakerName);
    } else if (event.kind === "opponent-skill") text = voice.opponentSkill;
    else if (event.kind === "ambient") text = voice.ambient[hashText(`${event.sourceEventId}:${characterId}`) % voice.ambient.length];
    else text = voice[event.kind];

    return Object.freeze({
      eventId,
      sourceEventId: event.sourceEventId,
      matchId: publicState.matchId,
      version: event.version,
      kind: event.kind,
      text,
      dialogue,
      narration,
      priority: terminal ? "terminal" : event.kind === "ambient" ? "ambient" : "notable",
      announce: terminal || event.kind !== "ambient",
      reason: terminal ? event.reason : null,
    });
  }

  return Object.freeze({
    ACTIVE_TRACE_TYPES,
    CPU_CHARACTER_IDS,
    CPU_VOICES,
    MIN_ACTIVE_VERSION_GAP,
    TERMINAL_REASONS,
    VERSION,
    chooseCpuCommentary,
    validPublicTrace,
  });
});
