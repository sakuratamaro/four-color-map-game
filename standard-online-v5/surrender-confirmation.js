(function (root) {
  "use strict";
  // UDL067: public identity and local confirmation only; no legality oracle or game RNG.
  const lines = Object.freeze({
    yuzu: "ええっ、もう終わりですか？ もう少しお手並みを見たかったです！",
    ren: "ここで降りるのか？ 俺はまだ、次の一手を待ってるぜ。",
    minato: "もう終わりにしますか？ まだあなたの手を見てみたいです。",
    koharu: "えっ、ここまで？ 私の読みをひっくり返す一手、ないかな……。",
    aoi: "ここで区切りますか？ 最後まで見届けるつもりでしたが。",
    kai: "ここで降りるか。もうひと勝負の一手、見せてくれてもいいんだぜ？",
    tsubasa: "あれ、もう幕引き？ 私、次の仕掛けを楽しみにしてたんだけどな。",
    shion: "ここで投了ですか？ あなたの最後の一手まで、見ていたかったですね。",
    rei: "ここまでにしますか？ もう少し、あなたの選択を観察したかったです。",
    kurogane: "ここで幕を下ろすか。最後の一手まで、俺に見せてみないか？",
  });
  const generic = "投了する前に、手札も確認してみましょう。対戦を続けることもできます。";
  function dialogueFor(opponentKind, characterId) {
    const known = opponentKind === "cpu" && typeof characterId === "string" && Object.hasOwn(lines, characterId);
    return Object.freeze({ characterId: known ? characterId : null, line: known ? lines[characterId] : generic });
  }
  function makeIntent({ model, clientRoomId, connected, activeTab, busy, pending } = {}) {
    const room = model?.room, state = room?.public_state, seat = model?.view?.seat;
    if (connected !== true || activeTab !== "battle" || busy || pending
        || typeof room?.id !== "string" || !room.id || clientRoomId !== room.id
        || room.status !== "playing" || state?.status !== "ACTIVE"
        || !["A", "B"].includes(seat) || state.active !== seat
        || typeof state.matchId !== "string" || !state.matchId
        || !Number.isSafeInteger(room.version) || room.version < 0
        || model.view.version !== room.version
        || !Number.isSafeInteger(state.version) || state.version < 0) return null;
    return Object.freeze({ roomId: room.id, matchId: state.matchId, seat,
      roomVersion: room.version, viewVersion: model.view.version, stateVersion: state.version,
      opponentKind: room.opponent_kind, characterId: room.opponent_kind === "cpu" ? room.cpu_character_id : null });
  }
  function isCurrentIntent(intent, context) {
    const now = makeIntent(context);
    return Boolean(intent && now && Object.keys(now).every(key => intent[key] === now[key]));
  }
  const api = Object.freeze({ dialogueFor, makeIntent, isCurrentIntent });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FourColorSurrenderConfirmation = api;
})(typeof globalThis === "object" ? globalThis : this);
