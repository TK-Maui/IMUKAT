// v1.17：手札の重複なし・抜け出しサイコロ・ヘリの知らせ方・裏口が開くタイミング・解除の当たり目
const E = require("../engine.js");
let ok = 0, ng = 0; const check = (c, m) => { if (c) ok++; else { ng++; console.log("NG:", m); } };
function setup(n, seed) {
  const g = E.newGame(); g.seed = seed;
  for (let i = 0; i < n; i++) g.players.push(E.newPlayer("P" + (i + 1), "名前" + (i + 1)));
  g.opt.thiefTimer = false;
  E.safeApply(g, "P1", { kind: "start" });
  const d = E.P(g, g.detId);
  const okK = Array.from({ length: 64 }, (_, i) => 64 + i).filter(k => E.detStartOK(g, k));
  E.safeApply(g, d.id, { kind: "setupDet", k: okK[0], skills: ["seize", "sprint", "ask", "net"] });
  const ts = g.players.filter(p => p.th);
  ts.forEach(p => E.safeApply(g, p.id, { kind: "declare", yes: false, start: E.bld(g).starts[0] }));
  return { g, d, ts };
}
const stay = (g, p) => { E.safeApply(g, p.id, { kind: "stay" }); E.safeApply(g, p.id, { kind: "confirm", act: "none" }); };
const detPass = (g, d) => { for (let i = 0; i < 2 && g.stage === "det"; i++) { E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "pass" }); } };
// 1) 手札に同じアイテムが重ならない（3〜6人・各200ゲーム）
for (const n of [3, 4, 5, 6]) { let dup = 0, hands = 0, wire = 0;
  for (let s = 1; s <= 200; s++) { const { ts } = setup(n, s * 7 + n); ts.forEach(p => { hands++; if (new Set(p.th.items).size !== p.th.items.length) dup++; wire += p.th.items.filter(x => x === "wire").length; }); }
  check(dup === 0, `${n}人：重複した手札が ${dup}/${hands}`); check(wire <= 200, `${n}人：ワイヤー銃が1ゲームに2枚以上`); }
// 2) 解除の当たり目
check(E.TR.low.target === 2 && E.TR.mid.target === 4 && E.TR.high.target === 5 && E.TR.high.need === 2, "解除の当たり目が違う");
// 3) 抜け出しサイコロ：成功も失敗も起きる。失敗したらそのターンはもう振れない
{ let suc = 0, fail = 0;
  for (let s = 1; s <= 120; s++) {
    const { g, d, ts } = setup(4, 1000 + s); const [a, b, c] = ts;
    ts.forEach(p => stay(g, p)); ts.forEach(p => p.th.items = []);
    d.det.k = a.th.k; b.th.k = a.th.k + 1; c.th.k = a.th.k + 2;
    E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "capture" });
    d.det.k = (a.th.k + 40) % 128; detPass(g, d);
    if (s === 1) check(E.pendingIds(g).includes(a.id), "捕縛中の怪盗がサイコロを振る番になっていない");
    const e = E.safeApply(g, a.id, { kind: "breakout" }); if (s === 1) check(!e, "抜け出しに挑戦できない " + e);
    if (a.th.status === "active") { suc++; if (suc === 1) { check(E.pendingIds(g).includes(a.id), "成功したのにこのターン動けない"); check(E.viewFor(g, a.id).notes.some(n => /自力で抜け出した/.test(n.title)), "成功の通知がない"); } }
    else { fail++; if (fail === 1) { check(!!E.safeApply(g, a.id, { kind: "breakout" }), "同じターンに2回振れてしまう"); check(!E.pendingIds(g).includes(a.id), "失敗したのに待たされる"); } }
  }
  check(suc >= 8 && suc <= 40, `成功 ${suc}/120（6で成功＝約20回のはず）`); check(fail > 0, "失敗が一度もない");
  // 設定で「なし」にできる
  const { g, d, ts } = setup(4, 5); g.opt.breakout = 0; const [a, b, c] = ts;
  ts.forEach(p => stay(g, p)); ts.forEach(p => p.th.items = []);
  d.det.k = a.th.k; b.th.k = a.th.k + 1; c.th.k = a.th.k + 2;
  E.safeApply(g, d.id, { kind: "stay" }); E.safeApply(g, d.id, { kind: "act", act: "capture" }); d.det.k = (a.th.k + 40) % 128; detPass(g, d);
  check(!!E.safeApply(g, a.id, { kind: "breakout" }), "「なし」なのに挑戦できる");
}
// 4) ヘリ：呼んだターンの怪盗のターン中は探偵に分からず、探偵のターンの始めに知らされる。裏口もそのとき開く
{
  const { g, d, ts } = setup(4, 77); const [a, b, c] = ts;
  ts.forEach(p => stay(g, p)); detPass(g, d); // 1ターン目
  E.safeApply(g, a.id, { kind: "heli" });
  const dv = E.viewFor(g, d.id);
  check(dv.players.find(p => p.id === a.id).heliCall == null, "怪盗のターン中に、探偵にヘリが分かってしまう");
  check(!dv.log.some(l => /ヘリ/.test(l.m)), "怪盗のターン中に、探偵のログにヘリが出ている");
  check(E.viewFor(g, b.id).log.some(l => /ヘリを呼びました/.test(l.m)), "仲間にヘリが伝わっていない");
  E.safeApply(g, b.id, { kind: "heli" }); E.safeApply(g, c.id, { kind: "heli" });
  check(!g.backOpen, "全員が呼んだ瞬間に裏口が開いてしまう（探偵のターンの始めのはず）");
  ts.forEach(p => stay(g, p));
  check(g.stage === "det", "探偵のターンにならない");
  const dv2 = E.viewFor(g, d.id);
  check(dv2.notes.filter(n => /ヘリの音が近づいて/.test(n.title)).length === 3, "探偵に「ヘリの音」のポップアップが3人分出ていない");
  check(dv2.players.find(p => p.id === a.id).heliCall === g.turn, "探偵のターンになってもヘリが見えない");
  check(dv2.log.some(l => /ヘリの音が近づいて/.test(l.m)), "探偵のログにヘリが出ていない");
  check(g.backOpen, "探偵のターンの始めに裏口が開かない");
  check(E.viewFor(g, a.id).notes.some(n => /裏口が開いた/.test(n.title)) && dv2.notes.some(n => /裏口が開いた/.test(n.title)), "裏口が開いた通知がない");
}
// 5) 2人だけ呼んだときは裏口は開かない
{
  const { g, d, ts } = setup(4, 78); const [a, b, c] = ts;
  ts.forEach(p => stay(g, p)); detPass(g, d);
  E.safeApply(g, a.id, { kind: "heli" }); E.safeApply(g, b.id, { kind: "heli" });
  ts.forEach(p => stay(g, p));
  check(!g.backOpen, "全員が呼んでいないのに裏口が開いた");
}
console.log(`v1.17 test: ok ${ok} / ng ${ng}`); process.exit(ng ? 1 : 0);
