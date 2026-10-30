// 縄抜けのチャンス：探偵のターンに最後の怪盗を捕まえても、次の怪盗のターン終了時まで終わらない
const E = require("../engine.js");
let ok = 0, ng = 0; const check = (c, m) => { if (c) ok++; else { ng++; console.log("NG:", m); } };
function setup(ropeHolder) {
  const g = E.newGame(); g.seed = 99;
  for (let i = 0; i < 4; i++) g.players.push(E.newPlayer("P" + (i + 1), "名前" + (i + 1)));
  g.opt.thiefTimer = false;
  E.safeApply(g, "P1", { kind: "start" });
  const d = E.P(g, g.detId);
  const okK = Array.from({ length: 64 }, (_, i) => 64 + i).filter(k => E.detStartOK(g, k));
  E.safeApply(g, d.id, { kind: "setupDet", k: okK[0], skills: Object.keys(E.SKILLS).slice(0, 4) });
  const ts = g.players.filter(p => p.th);
  ts.forEach(p => E.safeApply(g, p.id, { kind: "declare", yes: false, start: E.bld(g).starts[0] }));
  ts.forEach(p => { p.th.items = p.id === (ropeHolder && ropeHolder(ts)) ? ["rope"] : []; });
  return { g, d, ts };
}
function allCapturedInDetTurn(g, d, ts) {
  // 怪盗：全員その場で確定
  ts.forEach(p => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); });
  if (g.stage !== "det") return "探偵のターンにならない";
  // 全員を同じマスに集めて、探偵をそのマスへワープさせて捕縛
  const k = ts[0].th.k; ts.forEach(p => p.th.k = k); d.det.k = k;
  E.safeApply(g, d.id, { kind: "stay" });
  return E.safeApply(g, d.id, { kind: "act", act: "capture" });
}
// 1) 縄抜けを持っている人がいる
{
  const { g, d, ts } = setup(ts => ts[1].id);
  const e = allCapturedInDetTurn(g, d, ts);
  check(!e, "捕縛でエラー " + e);
  check(ts.every(p => p.th.status === "captured"), "全員捕縛になっていない");
  check(g.phase === "play" && g.stage === "thief", "全員捕縛ですぐ終わってしまった: " + g.phase + "/" + g.stage);
  check(E.pendingIds(g).length === ts.length, "捕縛中の全員に確定を求めていない（縄抜けの有無が探偵に漏れる）: " + E.pendingIds(g));
  const dn = E.viewFor(g, d.id).notes; check(dn.some(n => /捕縛成功/.test(n.title)), "探偵に捕縛成功の通知がない");
  const tn = E.viewFor(g, ts[0].id).notes; check(tn.some(n => /捕まった/.test(n.title)), "怪盗に捕まった通知がない");
  check(!E.viewFor(g, ts[0].id).notes.some(n => !n.to.includes(ts[0].id)), "他人宛ての通知が見えている");
  E.safeApply(g, ts[1].id, { kind: "useItem", item: "rope" });
  check(ts[1].th.status === "active", "縄抜けできない");
  ts.forEach(p => { if (p.th.status === "captured") E.safeApply(g, p.id, { kind: "confirm" }); });
  d.det.k = (ts[1].th.k + 3) % 128; E.safeApply(g, ts[1].id, { kind: "stay" }); E.safeApply(g, ts[1].id, { kind: "confirm", act: "none" });
  check(g.phase === "play" && g.stage === "det", "縄抜け後にゲームが続かない: " + g.phase + "/" + g.stage);
}
// 2) 縄抜けを持っている人がいない → 次の怪盗のターン終了時に終わる
{
  const { g, d, ts } = setup(null);
  allCapturedInDetTurn(g, d, ts);
  check(g.phase === "play" && g.stage === "thief", "すぐ終わってしまった");
  ts.forEach(p => E.safeApply(g, p.id, { kind: "confirm" }));
  check(g.phase === "roundEnd", "怪盗のターン終了時に終わらない: " + g.phase);
}
// 3) 縄抜けしたターンは、探偵と同じマスにいても捕まらない（鉢合わせ・探偵の捕縛とも）。次のターンは捕まる
{
  const { g, d, ts } = setup(ts => ts[0].id);
  // ts[0]だけ捕縛、ほかは遠くで動ける状態にする
  ts.forEach(p => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); });
  const k = ts[0].th.k; d.det.k = k; ts[1].th.k = (k + 40) % 128; ts[2].th.k = (k + 50) % 128;
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "capture" });
  check(ts[0].th.status === "captured", "準備：捕縛されていない");
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" });
  check(g.stage === "thief", "怪盗のターンにならない");
  E.safeApply(g, ts[0].id, { kind: "useItem", item: "rope" });
  E.safeApply(g, ts[0].id, { kind: "stay" }); E.safeApply(g, ts[0].id, { kind: "confirm", act: "none" });
  ts.slice(1).forEach(p => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); });
  check(ts[0].th.status === "active", "縄抜けしたターンに鉢合わせで捕まった");
  check(E.viewFor(g, ts[0].id).notes.some(n => /捕まらなかった/.test(n.title)), "免れた通知がない");
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "capture" });
  check(ts[0].th.status === "active", "縄抜けしたターンに探偵の捕縛で捕まった");
  check(E.viewFor(g, d.id).notes.some(n => /抜け出したばかり/.test(n.title)), "探偵に理由の通知がない");
  check(g.stage === "det" && g.step === 2, "探偵の2回目に進まない");
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" });
  // 次のターン：同じマスに留まると鉢合わせで捕まる
  E.safeApply(g, ts[0].id, { kind: "stay" }); E.safeApply(g, ts[0].id, { kind: "confirm", act: "none" });
  ts.slice(1).forEach(p => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); });
  check(ts[0].th.status === "captured", "次のターンなのに捕まらない");
}
// 4) 仲間に解放されたターンも同じ
{
  const { g, d, ts } = setup(null);
  ts.forEach(p => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); });
  const k = ts[0].th.k; d.det.k = k; ts[1].th.k = (k + 40) % 128; ts[2].th.k = (k + 50) % 128;
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "capture" });
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" });
  ts[0].th.rel = 2; // 解放作業がそろった状態にして、次のターンの始めに解放
  d.det.k = k;
  E.safeApply(g, ts[0].id, { kind: "confirm" }); ts.slice(1).forEach(p => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); });
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" });
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" });
  check(ts[0].th.status === "active", "解放されていない: " + ts[0].th.status);
  E.safeApply(g, ts[0].id, { kind: "stay" }); E.safeApply(g, ts[0].id, { kind: "confirm", act: "none" });
  ts.slice(1).forEach(p => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); });
  check(ts[0].th.status === "active", "解放されたターンに鉢合わせで捕まった");
  // 動いて別のマスで捕まるのは通常どおり
}
console.log(`rope test: ok ${ok} / ng ${ng}`); process.exit(ng ? 1 : 0);
