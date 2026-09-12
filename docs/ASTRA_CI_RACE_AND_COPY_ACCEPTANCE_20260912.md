# 062公開報告・受入補完の相談／021局所修正の再提出

実返答 ab7578b2-3439-4e13-ba68-5e9f01ca58a3 を確認し、020と021を別記録に保存しました。司令塔本人が062公開を先行しています。

## 1. UDL062 本番反映と受入補完
製品SHA a1a9b1c830eceb98464b107f2442deacaf765505 / BASE a757c126e1325532bb11a719cf92d0d13401d3ae / shared-canon-v1.1 / UDL-062-copy-v1.1 / specblob5481afd8c2b9ff5354bba0e671615c97fb8ceef7 / Pages_only / DB[] / Edge[]。
fresh main/祖先・exact Windows34679764998両SUCCESSを再確認し、08:01:44Zにforceなしmain push、同SHA Pages34682215186のbuild/deploy/report全SUCCESS。公開preflight ok:true、index/app37厳密byte一致を試験profile作成前に確認。
https://github.com/sakuratamaro/four-color-map-game/actions/runs/34682215186

許可された1profileの公開canaryは52件PASS後、最終「same server profile after all navigation」でFAILしました。全5tabを390/1280、接続文言、overflow0、閉じた診断DOMとlabel、reload接続までPASS。対局0・経済操作0・ブラウザ非読取request0・削除0、2画像の実目視も実施。ただし最終server等価は失敗し、後続のallowlist/console最終assertは未実行です。LIVE_ACCEPTANCE_PARTIALのままで、原JSONは不変。物理NOT_RUN、対局内診断はNOT_RUN_NO_MATCHのままです。

原因調査ではharnessのJSON.stringify比較がJSONB読戻しの項目順差を変更と誤判定する欠陥をoffline再現しました。初回profileは構築済みJS object、既存profileはJSONBから返却されます。ただし実失敗時のbefore/after値を保存していなかったため、今回の失敗がキー順だけだったとは断定しません。
harnessのみisDeepStrictEqualへ変更、revision/displayName/full profileStateの値と配列順を検査し、失敗前にredacted比較booleanを保存するよう補正。4/4安全テストPASS（キー順差は許し、revision/name/coin/inventory/配列順変更は拒否）。元の1profile・180秒・許可読取のみ・byte確認先行は維持。製品追加変更0、追加試験profile0、認証情報保存0です。

受入補完として、同じ公開a1に対し、修正済みharnessを追加の独立profile1件で一度だけ実行してよいか判断をお願いします。既存profileはセッション終了・認証情報非保持で再利用不可。許可時も先にfresh公開preflight/2asset bytes、対局/経済操作/削除0で、元失敗と累計profile数を残します。別のより適切な補完方法があればその指示を採用します。ゲーム公開の再承認を要求するものではありません。

固定証拠（画像・秘密・profile IDを含まない）:
https://github.com/sakuratamaro/four-color-map-game/blob/8b9095192cd1743e5619c63c28d602337be98e5a/docs/UI_PLAYER_COPY_RELEASE_20260912.md
https://github.com/sakuratamaro/four-color-map-game/blob/8b9095192cd1743e5619c63c28d602337be98e5a/docs/UI_PLAYER_COPY_LIVE_20260912.json
https://github.com/sakuratamaro/four-color-map-game/blob/8b9095192cd1743e5619c63c28d602337be98e5a/scripts/live-standard-player-copy-canary.cjs
https://github.com/sakuratamaro/four-color-map-game/blob/8b9095192cd1743e5619c63c28d602337be98e5a/tests/governance-player-copy-canary.test.cjs
061は94/94完了・累計2profile・元失敗不変・物理NOT_RUNのまま閉じ、再試験しません。

## 2. 021のCI先後レースだけを局所修正
SUBJECT_SHA: 8d4ca4b526858f1d8a7d0a6a521293a38e4ccd3d
BASE_SHA: 8b9095192cd1743e5619c63c28d602337be98e5a
PREVIOUS_REJECTED_SHA: d18ebfade8bbb53acf2bb860a8e2789e539f4441
CANON_VERSION: shared-canon-v1.1
SPEC_BLOB (docs/SHARED_CANON.md): 48fe73dbf4a740dcb4b6b40142dec2e7918b56ab
REVIEW_KIND / SCOPE: documentation_introduction
DB_CHANGE_SET: []
EDGE_CHANGE_SET: []

公開記録・harness補正等は先行証拠commit8b9095192cd1743e5619c63c28d602337be98e5aへ分離しました。このbase→subjectの製品外修正は指定のcheckerと対応testの2fileのみ、132adds/4deletesです。
https://github.com/sakuratamaro/four-color-map-game/compare/8b9095192cd1743e5619c63c28d602337be98e5a...8d4ca4b526858f1d8a7d0a6a521293a38e4ccd3d
前回レビューBASEからの全履歴も確認可能です:
https://github.com/sakuratamaro/four-color-map-game/compare/542f97f49d10443b215fb9e99377d881e0c45e9e...8d4ca4b526858f1d8a7d0a6a521293a38e4ccd3d

正確な承認済・未公開・CI進行中をNORMAL_WORK/CHECK_CIへ接続。既存slice内ci_followupに同じrun IDと元review時刻を固定し、+5/20/50分・最大3回・60分期限。保存前の終了、別run/期限変更/重複枠を拒否。遅延や再起動で期限を伸ばさず、失敗/枯渇/期限切れは同じ候補/runの一度の切り分け記録へ移し、その記録後は当該CI確認を閉じ、他のready workを妨げません。公開はSUCCESS後だけ。閉じたChatGPT待機、新司令塔、別queue、self-sendは作りません。具体的な既存担当の予約/消費/skip/診断手順は同じ証拠baseのCOMMANDER_CI_RACE_REPAIR_20260912.mdに保存しました。

red:旧checker11/15、4再現FAIL。その後CI継続17件を含む7ファイルのgovernance/reconciliation57/57 PASS、skip0、1526.9453ms。新020の正確なreview tupleをfixtureへ追加しましたが既存assertを緩めていません。これはoffline結果で、将来のCI自動確認の実証ではありません。06:51:30Zの実NORMAL起動と06194/94は保持。07:45:12Z予定の受信起動は今回の07:57:01Zユーザー再開までの読戻しで未観測、原因未確定と記録しています。

原062レビュー期限08:05:12Z・自動消費1は閉じたまま不変です。この再提出で待機予算を再起動せず、文書だけの新しいモデル巡回も作りません。ユーザー指定の既存連携で結果を一括送信しています。
上記1の受入補完判断と、2の新SHA文書判定（DECISION/SUBJECT_SHA/BLOCKERS/NOTES）を分けてお願いします。

## CI correction complete two-file diff
```diff
diff --git a/scripts/check-commander-continuation.cjs b/scripts/check-commander-continuation.cjs
index 418ce95..15929cd 100644
--- a/scripts/check-commander-continuation.cjs
+++ b/scripts/check-commander-continuation.cjs
@@ -44,11 +44,49 @@ function pendingBinding(c) {
     (c.self_sent_message_ids || []).includes(request);
 }
 
+// Same-run CI continuation is metadata on the existing slice, not a second queue.
+function pendingCiPlan(s, review, ref, now) {
+  const base={phase:"NORMAL_WORK",ref,subject_sha:s.candidate_sha,review_id:review.review_id,run_id:s.windows_run};
+  const investigate=reason=>{
+    const saved=s.ci_followup?.investigation;
+    if(saved?.status==="RECORDED" && saved.reason===reason &&
+        saved.subject_sha===s.candidate_sha && saved.run_id===s.windows_run)
+      return {...base,phase:"STOP",reason:reason+"_RECORDED"};
+    return {...base,action:"INVESTIGATE_CI",reason};
+  };
+  if(!/^[1-9][0-9]*$/.test(String(s.windows_run||"")))return investigate("CI_RUN_BINDING_MISSING");
+  const start=Date.parse(review.recorded_at_utc),time=Date.parse(now);
+  if(!Number.isFinite(start)||!Number.isFinite(time))return investigate("CI_REVIEW_ANCHOR_MISSING");
+  const offsets=[5,20,50],expiry=start+60*60_000,slots=offsets.map(m=>new Date(start+m*60_000).toISOString());
+  const budget=s.ci_followup || {run_id:s.windows_run,subject_sha:s.candidate_sha,
+    started_at_utc:new Date(start).toISOString(),expires_at_utc:new Date(expiry).toISOString(),
+    offset_minutes:offsets,max_checks:3,consumed_slots_utc:[],skipped_slots_utc:[],reset_on_restart_or_candidate_revision:false};
+  const consumed=budget.consumed_slots_utc,skipped=budget.skipped_slots_utc;
+  if(budget.run_id!==s.windows_run || budget.subject_sha!==s.candidate_sha ||
+      Date.parse(budget.started_at_utc)!==start || Date.parse(budget.expires_at_utc)!==expiry ||
+      budget.max_checks!==3 || !equal(budget.offset_minutes,offsets) ||
+      budget.reset_on_restart_or_candidate_revision!==false || !Array.isArray(consumed) || !Array.isArray(skipped) ||
+      consumed.length+skipped.length>3 || new Set([...consumed,...skipped]).size!==consumed.length+skipped.length ||
+      [...consumed,...skipped].some(at=>!slots.includes(at)))
+    return investigate("CI_BUDGET_INVALID");
+  if(!["IN_PROGRESS","QUEUED","PENDING","WAITING"].includes(s.windows_status))
+    return investigate("CI_FAILED_OR_UNKNOWN");
+  if(time>=expiry)return investigate("CI_DEADLINE_EXPIRED");
+  const last=Math.max(-Infinity,...[...consumed,...skipped].map(Date.parse));
+  const remaining=slots.filter(at=>Date.parse(at)>last);
+  if(consumed.length>=3||!remaining.length)return investigate("CI_CHECK_BUDGET_EXHAUSTED");
+  const due=remaining.filter(at=>Date.parse(at)<=time);
+  return {...base,action:"CHECK_CI",at_utc:due.at(-1)||remaining[0],
+    ci_budget:budget,budget_persisted:Boolean(s.ci_followup),
+    reason:"APPROVED_UNPUBLISHED_SAME_CI_RUN_REQUIRES_BOUNDED_CHECK"};
+}
+
 function planContinuation(log, {now = new Date().toISOString(), otherOwnerActive = false} = {}) {
   const c = log.coordination;
   if (!c || c.automation_id !== "automation") return {phase:"STOP", reason:"INVALID_EXISTING_COORDINATION"};
   if (otherOwnerActive) return {phase:"OWNER_ACTIVE", reason:"NO_CONCURRENT_LEDGER_WRITE"};
   const issues = [];
+  let recordedCiStop;
   for (const {ref,slice:s} of slices(c)) {
     if (s.owner_thread_id !== OWNER) continue;
     const r = matchingReview(log,s);
@@ -66,9 +104,14 @@ function planContinuation(log, {now = new Date().toISOString(), otherOwnerActive
     // A review is a gate, not a release command: fresh main/CI/Pages/live checks remain mandatory.
     if (r && ["APPROVE_RELEASE","APPROVE"].includes(r.decision) &&
         ["NOT_RUN","NOT_MERGED","not_merged"].includes(s.publication) &&
-        s.windows_status === "SUCCESS" && s.push_status === "PUSHED_EXACT_BRANCH")
-      return {phase:"NORMAL_WORK", action:"RELEASE_CHECKS", ref, subject_sha:s.candidate_sha,
-        review_id:r.review_id, reason:"APPROVED_UNPUBLISHED_WORK_MUST_NOT_BE_ORPHANED"};
+        s.push_status === "PUSHED_EXACT_BRANCH") {
+      if(s.windows_status === "SUCCESS")
+        return {phase:"NORMAL_WORK", action:"RELEASE_CHECKS", ref, subject_sha:s.candidate_sha,
+          review_id:r.review_id, reason:"APPROVED_UNPUBLISHED_WORK_MUST_NOT_BE_ORPHANED"};
+      const ci=pendingCiPlan(s,r,ref,now);
+      if(ci.phase!=="STOP")return ci;
+      recordedCiStop=ci; // A recorded CI hold must not hide another ready slice or review.
+    }
     if (r?.decision === "REQUEST_CHANGES" && s.state === "REVISION_REQUIRED_NOT_PUBLISHED")
       return {phase:"NORMAL_WORK", action:"REVISE_EXACT_SLICE", ref, subject_sha:s.candidate_sha,
         review_id:r.review_id, reason:"RECEIVED_CHANGES_NEED_NORMAL_WORK"};
@@ -79,7 +122,7 @@ function planContinuation(log, {now = new Date().toISOString(), otherOwnerActive
   }
   if (issues.length) return {phase:"STOP", reason:"RECONCILE_INVALID_REVIEW", issues};
   const w = c.wait_budget || {}, pending = (w.followup_status || w.status) === "review_pending";
-  if (!pending) return {phase:"STOP", reason:"NO_ELIGIBLE_REVIEW_OR_READY_WORK"};
+  if (!pending) return recordedCiStop || {phase:"STOP", reason:"NO_ELIGIBLE_REVIEW_OR_READY_WORK"};
   if (!pendingBinding(c)) return {phase:"STOP", reason:"INVALID_PENDING_BINDING"};
   const start = Date.parse(w.started_at_utc), expiry = Date.parse(w.expires_at_utc), time = Date.parse(now);
   const checks = w.automatic_checks;
@@ -127,6 +170,11 @@ function endOfTurnIssues(plan, continuation, automation, {now = new Date().toISO
     errors.push("NEXT_RUN_MUST_HAVE_TWO_MINUTE_END_TURN_MARGIN");
   if (needed && plan.phase !== "NORMAL_WORK" && Date.parse(continuation.next_run?.at_utc) !== Date.parse(plan.at_utc))
     errors.push("FINITE_SLOT_MUST_NOT_MOVE");
+  if (plan.action === "CHECK_CI") {
+    if (!plan.budget_persisted) errors.push("CI_BUDGET_MUST_BE_SAVED_BEFORE_END");
+    if (Date.parse(continuation.next_run?.at_utc) !== Date.parse(plan.at_utc)) errors.push("CI_SLOT_MUST_NOT_MOVE");
+    if (Date.parse(continuation.next_run?.at_utc) >= Date.parse(plan.ci_budget.expires_at_utc)) errors.push("CI_DEADLINE_MUST_NOT_EXTEND");
+  }
   if (!needed && automation.status !== "PAUSED") errors.push("PAUSE_WHEN_NO_ELIGIBLE_WORK");
   return errors;
 }
diff --git a/tests/governance-commander-continuation.test.cjs b/tests/governance-commander-continuation.test.cjs
index 9f86132..5569fcb 100644
--- a/tests/governance-commander-continuation.test.cjs
+++ b/tests/governance-commander-continuation.test.cjs
@@ -112,6 +112,86 @@ test("finished work pauses without another model loop; blocked goal label is not
   const plan=planContinuation(log);assert.equal(plan.phase,"STOP");
   assert.ok(endOfTurnIssues(plan,{resume_transport:"existing_heartbeat_next_run"},{status:"ACTIVE"}).includes("PAUSE_WHEN_NO_ELIGIBLE_WORK"));
 });
+
+function waitingCiFixture(){
+  const log=fixture();approve(log);
+  log.decisions[0].recorded_at_utc="2026-09-12T00:00:00Z";
+  const s=log.coordination.active_slice;s.windows_status="IN_PROGRESS";s.windows_run="12345";
+  return log;
+}
+test("approved unpublished CI in progress remains normal work, never an idle stop",()=>{
+  const log=waitingCiFixture(),before=JSON.stringify(log);
+  const plan=planContinuation(log,{now:"2026-09-12T00:01:00Z"});
+  assert.equal(plan.phase,"NORMAL_WORK");assert.equal(plan.action,"CHECK_CI");
+  assert.equal(plan.run_id,"12345");assert.equal(plan.at_utc,"2026-09-12T00:05:00.000Z");
+  assert.equal(plan.ci_budget.expires_at_utc,"2026-09-12T01:00:00.000Z");
+  assert.equal(plan.ci_budget.max_checks,3);assert.equal(JSON.stringify(log),before);
+  const continuation={resume_transport:"existing_heartbeat_next_run",next_run:{phase:"NORMAL_WORK",subject_sha:plan.subject_sha,at_utc:plan.at_utc}};
+  assert.ok(endOfTurnIssues(plan,continuation,{status:"PAUSED"},{now:"2026-09-12T00:01:00Z"}).includes("ORPHANED_ACTIONABLE_WORK"));
+  assert.ok(endOfTurnIssues(plan,continuation,{status:"ACTIVE"},{now:"2026-09-12T00:01:00Z"}).includes("CI_BUDGET_MUST_BE_SAVED_BEFORE_END"));
+  log.coordination.active_slice.ci_followup=plan.ci_budget;
+  const saved=planContinuation(log,{now:"2026-09-12T00:01:00Z"});
+  assert.deepEqual(endOfTurnIssues(saved,continuation,{id:"automation",status:"ACTIVE",target_thread_id:OWNER,
+    readback_verified:true,scheduled_for_utc:plan.at_utc},{now:"2026-09-12T00:01:00Z"}),[]);
+  log.coordination.active_slice.windows_status="SUCCESS";
+  assert.equal(planContinuation(log,{now:"2026-09-12T00:06:00Z"}).action,"RELEASE_CHECKS");
+  assert.equal(log.coordination.wait_budget.status,"review_received_closed");
+});
+test("CI check slots and deadline do not reset across restart or missing a slot",()=>{
+  const log=waitingCiFixture(),s=log.coordination.active_slice;
+  s.ci_followup=planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget;
+  assert.equal(planContinuation(log,{now:"2026-09-12T00:30:00Z"}).at_utc,"2026-09-12T00:20:00.000Z");
+  s.ci_followup.consumed_slots_utc=["2026-09-12T00:20:00.000Z"];
+  const plan=planContinuation(log,{now:"2026-09-12T00:31:00Z"});
+  assert.equal(plan.at_utc,"2026-09-12T00:50:00.000Z");
+  assert.equal(plan.ci_budget.started_at_utc,"2026-09-12T00:00:00.000Z");
+  assert.equal(plan.ci_budget.expires_at_utc,"2026-09-12T01:00:00.000Z");
+  const continuation={resume_transport:"existing_heartbeat_next_run",next_run:{phase:"NORMAL_WORK",subject_sha:plan.subject_sha,at_utc:"2026-09-12T00:55:00Z"}};
+  assert.ok(endOfTurnIssues(plan,continuation,{status:"ACTIVE"},{now:"2026-09-12T00:31:00Z"}).includes("CI_SLOT_MUST_NOT_MOVE"));
+});
+test("failed, exhausted or expired CI moves to one diagnosis, not endless result checks",()=>{
+  for(const scenario of ["failure","exhausted","expired"]){
+    const log=waitingCiFixture(),s=log.coordination.active_slice;
+    s.ci_followup=planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget;
+    if(scenario==="failure")s.windows_status="FAILURE";
+    if(scenario==="exhausted")s.ci_followup.consumed_slots_utc=["2026-09-12T00:05:00.000Z","2026-09-12T00:20:00.000Z","2026-09-12T00:50:00.000Z"];
+    const now=scenario==="expired"?"2026-09-12T01:00:00Z":"2026-09-12T00:51:00Z";
+    const plan=planContinuation(log,{now});assert.equal(plan.action,"INVESTIGATE_CI");assert.equal(plan.phase,"NORMAL_WORK");
+    s.ci_followup.investigation={subject_sha:s.candidate_sha,run_id:s.windows_run,reason:plan.reason,status:"RECORDED"};
+    const held=planContinuation(log,{now});assert.equal(held.phase,"STOP");assert.match(held.reason,/CI_.*_RECORDED/);
+    assert.equal(log.coordination.wait_budget.status,"review_received_closed");
+  }
+});
+test("CI budget rejects changed run, anchor, expiry and duplicate consumed slots",()=>{
+  for(const patch of [{run_id:"67890"},{started_at_utc:"2026-09-12T00:01:00Z"},{expires_at_utc:"2026-09-12T02:00:00Z"},
+    {consumed_slots_utc:["2026-09-12T00:05:00.000Z","2026-09-12T00:05:00.000Z"]},{max_checks:4}]){
+    const log=waitingCiFixture(),s=log.coordination.active_slice;
+    s.ci_followup={...planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget,...patch};
+    assert.equal(planContinuation(log,{now:"2026-09-12T00:02:00Z"}).action,"INVESTIGATE_CI");
+  }
+  const log=waitingCiFixture();delete log.coordination.active_slice.windows_run;
+  assert.equal(planContinuation(log,{now:"2026-09-12T00:02:00Z"}).reason,"CI_RUN_BINDING_MISSING");
+});
+
+test("receive-only work may skip a missed CI slot without inventing a check or shifting the deadline",()=>{
+  const log=waitingCiFixture(),s=log.coordination.active_slice;
+  s.ci_followup=planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget;
+  s.ci_followup.skipped_slots_utc=["2026-09-12T00:05:00.000Z"];
+  const plan=planContinuation(log,{now:"2026-09-12T00:10:00Z"});
+  assert.equal(plan.at_utc,"2026-09-12T00:20:00.000Z");assert.equal(plan.ci_budget.consumed_slots_utc.length,0);
+  assert.equal(plan.ci_budget.expires_at_utc,"2026-09-12T01:00:00.000Z");
+});
+
+test("a recorded CI hold does not orphan another ready existing slice",()=>{
+  const log=waitingCiFixture(),s=log.coordination.active_slice;
+  s.ci_followup=planContinuation(log,{now:"2026-09-12T00:01:00Z"}).ci_budget;s.windows_status="FAILURE";
+  const held=planContinuation(log,{now:"2026-09-12T00:10:00Z"});
+  s.ci_followup.investigation={subject_sha:s.candidate_sha,run_id:s.windows_run,reason:held.reason,status:"RECORDED"};
+  log.coordination.preparing_next_slice={owner_thread_id:OWNER,candidate_sha:"e".repeat(40),
+    review_send_attempts:0,review_status:"NOT_SENT",windows_status:"SUCCESS",push_status:"PUSHED_EXACT_BRANCH"};
+  assert.equal(planContinuation(log,{now:"2026-09-12T00:10:00Z"}).action,"SEND_REVIEW");
+});
+
 test("repository routing uses one automation and records actual execution separately from configuration",()=>{
   const c=JSON.parse(fs.readFileSync(path.join(__dirname,"../docs/CHATGPT_REVIEW_DECISIONS.json"),"utf8")).coordination;
   assert.equal(c.continuation.resume_transport,"existing_heartbeat_next_run");
```
