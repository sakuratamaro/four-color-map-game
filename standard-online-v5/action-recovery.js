// Presentation only. Inputs are loaded public room state and the player's own local intent flags.
export function cardActionRecovery({
  roomId = null, roomLoaded = false, roomStatus = null, setupRevision = 0,
  cpuDraftOwnsEntry = false, pendingCpuStart = false, pendingSetup = false,
  saleBusy = false, salePending = false, hasSurplus = false, hasSellable = false,
} = {}) {
  const knownRoom = Boolean(roomId && roomLoaded && ["waiting", "ready", "playing", "finished"].includes(roomStatus));
  const destination = !knownRoom ? null : roomStatus === "playing" ? "match" : roomStatus === "finished" ? "result" : "setup";
  const labels = { match: "対戦に戻る", result: "対戦結果へ", setup: "準備に戻る" };
  let loadout = { target: null, label: "次の対戦用6枚を編集", message: "", disabled: false };
  if (cpuDraftOwnsEntry) loadout = { target: "setup", label: "CPU戦の開始確認へ戻る",
    message: pendingCpuStart ? "前回の開始結果を確認してください。" : "選んだCPUと6枚の確認に戻れます。", disabled: false };
  else if (roomId && !knownRoom) loadout = { target: null, label: "対戦の状態を確認中", message: "対戦の状態を確認中です。", disabled: true };
  else if (destination) loadout = { target: destination, label: labels[destination], disabled: false,
    message: pendingSetup ? "前回の準備結果を確認してください。"
      : destination === "match" ? "対戦中の6枚は変更できません。"
      : destination === "result" ? "前の対戦結果が残っています。"
      : "この対戦の準備画面で6枚を確認できます。" };
  let sale = { kind: "idle", message: null, target: null, label: "", locked: false };
  const roomLocked = Boolean(roomId && (setupRevision > 0 || ["ready", "playing"].includes(roomStatus)));
  if (saleBusy) sale = { ...sale, kind: "pending", locked: true };
  else if (salePending) sale = { ...sale, kind: "pending", message: "前回の売却結果を確認してください。", locked: true };
  else if (roomId && !knownRoom) sale = { ...sale, kind: "blocked", message: "対戦の状態を確認中です。", locked: true };
  else if (pendingCpuStart && cpuDraftOwnsEntry) sale = { kind: "blocked", message: "CPU戦の開始結果を確認してください。",
    target: "setup", label: "CPU戦の開始確認へ戻る", locked: true };
  else if (pendingSetup && destination === "setup") sale = { kind: "blocked", message: "対戦の準備結果を確認してください。",
    target: "setup", label: labels.setup, locked: true };
  else if (roomLocked && destination) sale = { kind: "blocked", target: destination, label: labels[destination], locked: true,
    message: destination === "match" ? "対戦中は売却できません。" : destination === "result" ? "前の対戦結果が残っています。" : "対戦の準備中は売却できません。" };
  else if (!hasSellable) sale = { ...sale, kind: "blocked", locked: true,
    message: hasSurplus ? "余ったカードはすべて保護されています。" : "売れる余剰カードはありません（各1枚は残します）。" };
  return Object.freeze({ loadout: Object.freeze(loadout), sale: Object.freeze(sale) });
}
