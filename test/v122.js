// v1.22：保釈・ボーナス・正面ゲート2マス・探偵の順番・スキル配布
const E = require("../engine.js");
let ok = 0, ng = 0; const check = (c, m) => { if (c) ok++; else { ng++; console.log("NG:", m); } };
function setup(n, seed) {
  const g = E.newGame(); g.seed = seed;
  for (let i = 0; i < n; i++) g.players.push(E.newPlayer("P" + (i + 1), "名前" + (i + 1)));
  g.opt.thiefTimer = false; E.safeApply(g, "P1", { kind: "start" });
  const d = E.P(g, g.detId); check(d.det.offer.length === 6, "スキルが6つ配られていない");
  const okK = Array.from({ length: 64 }, (_, i) => 64 + i).filter(k => E.detStartOK(g, k));
  check(!!E.safeApply(g, d.id, { kind: "setupDet", k: okK[0], skills: Object.keys(E.SKILLS).filter(x => !d.det.offer.includes(x)).concat(d.det.offer).slice(0, 4) }), "配られていないスキルを選べてしまう");
  E.safeApply(g, d.id, { kind: "setupDet", k: okK[0], skills: d.det.offer.slice(0, 4) });
  const ts = g.players.filter(p => p.th);
  ts.forEach(p => E.safeApply(g, p.id, { kind: "declare", yes: false, start: E.bld(g).starts[0] }));
  return { g, d, ts };
}
const stay = (g, p) => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); };
{ // 配る枚数
  const { ts } = setup(6, 3); check(ts.every(p => p.th.items.length === 1), "5人の怪盗に1枚ずつ配られていない");
  check(ts.every(p => p.th.items.every(i => !E.ITEMS[i].shop)), "購入アイテムが配られている");
  const s4 = setup(4, 3); check(s4.ts.every(p => p.th.items.length === 2), "怪盗3人に2枚ずつ配られていない");
}
{ // 保釈
  const { g, d, ts } = setup(4, 11); const [a, b, c] = ts;
  ts.forEach(p => stay(g, p));
  d.det.k = a.th.k; b.th.k = (a.th.k + 9) % 128; c.th.k = (a.th.k + 18) % 128;
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "capture" });
  check(a.th.status === "captured", "捕縛されていない");
  d.det.k = (a.th.k + 40) % 128; E.safeApply(g, d.id, { kind: "endTurn" });
  const m0 = a.money, dm0 = d.money;
  check(E.pendingIds(g).includes(a.id), "捕縛中に保釈の機会がない");
  check(!E.safeApply(g, a.id, { kind: "release" }), "保釈できない");
  check(a.th.status === "active" && a.money === m0 - 300 && d.money === dm0 + 300, "保釈のお金が動かない");
  check(!!E.safeApply(g, a.id, { kind: "release" }), "2回保釈できてしまう");
}
{ // 正面ゲート2マス・変装脱出（探偵が近くても成功）・変装ボーナス
  const { g, d, ts } = setup(4, 12); const [a] = ts; const b = E.bld(g);
  check(b.fronts.length === 2, "正面ゲートが2マスではない");
  a.th.parts = { mask: 1, uniform: 1, badge: 1 }; a.th.k = b.fronts[1]; d.det.k = b.fronts[0];
  E.safeApply(g, a.id, { kind: "stay" }); E.safeApply(g, a.id, { kind: "confirm", act: "none" });
  ts.slice(1).forEach(p => stay(g, p));
  check(a.th.status === "escaped" && a.th.escHow === "disguise", "隣に探偵がいると変装脱出できない");
  ts.slice(1).forEach(p => p.th.status = "escaped");
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" });
  const r = g.records.find(x => x.name === a.name && x.round === 1);
  check(r && r.disguiseBonus === 300, "変装脱出ボーナスがない");
}
{ // 探偵の順番：全員1回、所持金が少ない人から
  const g = E.newGame(); g.seed = 7; for (let i = 0; i < 4; i++) g.players.push(E.newPlayer("P" + (i + 1), "n" + i));
  E.safeApply(g, "P1", { kind: "start" }); const seen = [g.detId];
  for (let r = 2; r <= 4; r++) {
    g.phase = "roundEnd"; const cand = g.players.filter(p => !seen.includes(p.id)); cand.forEach((p, i) => p.money = 1000 - i * 100);
    const low = cand[cand.length - 1].id; E.safeApply(g, "P1", { kind: "nextRound" });
    check(g.detId === low, `所持金が少ない人が探偵にならない（R${r}）`); seen.push(g.detId);
  }
  check(new Set(seen).size === 4, "全員が1回ずつ探偵をしていない");
}
{ // 購入・アイテム支援・妨害成功
  const { g, d, ts } = setup(4, 13); const [a, b] = ts;
  check(!E.safeApply(g, a.id, { kind: "buy", item: "kit" }), "買えない"); check(a.th.items.includes("kit"), "買ったアイテムがない");
  b.th.k = a.th.k; check(!E.safeApply(g, a.id, { kind: "give", to: b.id, item: "kit" }), "渡せない");
  E.safeApply(g, b.id, { kind: "useItem", item: "kit" }); check(a.th.bonus.gift === 1, "アイテム支援が数えられない");
  b.th.items.push("oil"); E.safeApply(g, b.id, { kind: "useItem", item: "oil", k: d.det.k });
  ts.forEach(p => stay(g, p)); E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" });
  check(b.th.bonus.hinder === 1, "オイルの妨害成功が数えられない");
}
console.log(`v1.22 test: ok ${ok} / ng ${ng}`); if (ng) process.exit(1);
