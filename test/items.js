// 新アイテム「仲間の絆」「陽動」の確認
const E = require("../engine.js");
let ok = 0, ng = 0; const check = (c, m) => { if (c) ok++; else { ng++; console.log("NG:", m); } };
function setup() {
  const g = E.newGame(); g.seed = 21;
  for (let i = 0; i < 4; i++) g.players.push(E.newPlayer("P" + (i + 1), "名前" + (i + 1)));
  g.opt.thiefTimer = false;
  E.safeApply(g, "P1", { kind: "start" });
  const d = E.P(g, g.detId);
  const okK = Array.from({ length: 64 }, (_, i) => 64 + i).filter(k => E.detStartOK(g, k));
  E.safeApply(g, d.id, { kind: "setupDet", k: okK[0], skills: ["seize", "sprint", "ask", "net"] });
  const ts = g.players.filter(p => p.th);
  ts.forEach(p => E.safeApply(g, p.id, { kind: "declare", yes: false, start: E.bld(g).starts[0] }));
  return { g, d, ts };
}
const stayAll = (g, ps) => ps.forEach(p => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); });
const detPass = (g, d) => { for (let i = 0; i < 2 && g.stage === "det"; i++) { E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" }); } };
// --- 仲間の絆 ---
{
  const { g, d, ts } = setup(); const [a, b, c] = ts;
  stayAll(g, ts);
  ts.forEach(p => p.th.items = []);
  // 探偵が包囲網なしで a と c を同じマスで捕まえ、a の証拠を押収
  d.det.k = a.th.k; c.th.k = a.th.k; b.th.k = a.th.k + 1;
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "capture" });
  E.safeApply(g, d.id, { kind: "skill", id: "seize", pid: a.id });
  check(a.th.status === "captured" && c.th.status === "captured" && a.th.relNeed === 2, "捕縛＋押収の準備ができていない");
  d.det.k = (a.th.k + 40) % 128; detPass(g, d);
  check(g.stage === "thief", "怪盗のターンにならない");
  b.th.items = ["bond"];
  check(!!E.safeApply(g, b.id, { kind: "useItem", item: "bond" }), "移動先を選ぶ前に使えてしまう");
  E.safeApply(g, b.id, { kind: "roll" });
  E.safeApply(g, b.id, { kind: "dest", k: b.th.k });
  check(!!E.safeApply(g, b.id, { kind: "useItem", item: "bond" }), "仲間がいないマスで使えてしまう");
  b.th.tp.roll = 6; check(!E.safeApply(g, b.id, { kind: "dest", k: a.th.k }), "仲間のマスを選べない");
  check(!!E.safeApply(g, b.id, { kind: "useItem", item: "bond" }), "2人いるのに、選ばずに使えてしまう");
  check(b.th.items.includes("bond"), "使えなかったのにカードが減った");
  check(!E.safeApply(g, b.id, { kind: "useItem", item: "bond", pid: a.id }), "仲間の絆が使えない");
  check(a.th.status === "active", "その場ですぐ解放されない（押収されていても解放できるはず）");
  check(c.th.status === "captured", "選んでいない仲間まで解放された");
  check(b.th.rescues === 1, "救出ボーナスが数えられていない");
  check(E.pendingIds(g).includes(a.id), "解放された仲間がこのターンに動けない");
  check(E.viewFor(g, a.id).notes.some(n => /仲間の絆/.test(n.title)), "助けられた本人に通知がない");
  check(!!E.safeApply(g, b.id, { kind: "dest", k: b.th.k }), "使ったあとに移動先を変えられてしまう");
  // 解放された a はこのターンに動ける
  check(!E.safeApply(g, a.id, { kind: "roll" }), "解放された仲間がサイコロを振れない");
  const r = E.reach(g, a.th.k, a.th.tp.roll); const to = r.find(k => k !== a.th.k) ?? a.th.k;
  E.safeApply(g, a.id, { kind: "dest", k: to }); E.safeApply(g, a.id, { kind: "confirm", act: "none" });
  E.safeApply(g, b.id, { kind: "confirm", act: "none" });
  check(g.stage === "det" && a.th.k === to && a.th.status === "active", "解放された仲間の移動が反映されない: " + g.stage);
}
// --- 陽動 ---
{
  const { g, d, ts } = setup(); const [a, b, c] = ts;
  const tr = g.tr[1]; a.th.items = ["decoy"]; b.th.items = ["decoy"];
  check(!!E.safeApply(g, a.id, { kind: "useItem", item: "decoy", k: (tr.k + 1) % 128 === g.tr[0].k ? tr.k + 2 : tr.k + 1 }) || g.tr.some(t => t.k === tr.k + 1), "財宝のないマスを選べてしまう");
  check(!E.safeApply(g, a.id, { kind: "useItem", item: "decoy", k: tr.k }), "陽動が使えない");
  check(!!E.safeApply(g, b.id, { kind: "useItem", item: "decoy", k: tr.k }), "同じ財宝に二重に使えてしまう");
  check(!E.viewFor(g, d.id).tr.find(t => t.id === tr.id).alarm, "使った瞬間に警報が出てしまう（ターンの終わりのはず）");
  stayAll(g, ts);
  const dv = E.viewFor(g, d.id), tv = E.viewFor(g, c.id);
  check(dv.tr.find(t => t.id === tr.id).alarm === true, "探偵に警報が見えない");
  check(dv.tr.find(t => t.id === tr.id).decoy === false, "探偵に陽動だと漏れている");
  check(tv.tr.find(t => t.id === tr.id).decoy === true, "怪盗に陽動の印が出ない");
  check(dv.notes.some(n => /警報が鳴った/.test(n.title)), "探偵に警報のポップアップがない");
  const dl = dv.log.map(l => l.m).join("\n");
  check(/警報！/.test(dl) && !/陽動/.test(dl), "探偵のログに陽動が漏れている");
  check(!a.th.alarmTrig, "陽動で「警報を鳴らした」扱いになっている");
  // 探偵が調べると失敗0回と分かる
  detPass(g, d);
  check(g.stage === "thief", "次のターンにならない");
}
console.log(`items test: ok ${ok} / ng ${ng}`); process.exit(ng ? 1 : 0);
