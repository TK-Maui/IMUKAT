// 自動プレイ検証：ランダム寄りのボットで何百ゲームも回し、止まらないか・矛盾がないか確かめる
const E = require("../engine.js");
const N = +(process.argv[2] || 300);
let seed = 12345; const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rand() * a.length)];
const stats = { t1prints: 0, nullk: 0, games: 0, rounds: 0, errors: 0, esc: { heli: 0, disguise: 0, wire: 0 }, cap: 0, fail: 0, turnsSum: 0, alarms: 0, stolen: 0, detMoney: 0, thMoney: 0, leaks: 0, backOpen: 0, stuck: 0 };
function act(g, pid, a) { const e = E.safeApply(g, pid, a); if (e && e.startsWith("内部エラー")) { stats.errors++; console.log("ERR", e, JSON.stringify(a)); } return e; }
function bfsTo(g, from, n, goals) { const r = E.reach(g, from, n); const hit = r.filter(k => goals.includes(k)); if (hit.length) return pick(hit); // 近づく
  if (!goals.length) return pick(r); let best = r[0], bd = 1e9; for (const k of r) for (const gk of goals) { const d = E.dist(k, gk) + (E.FL(k) !== E.FL(gk) ? 6 : 0); if (d < bd) { bd = d; best = k; } } return rand() < 0.8 ? best : pick(r); }
for (let gi = 0; gi < N; gi++) {
  const g = E.newGame(); g.seed = (gi * 7919 + 17) >>> 0;
  const n = 4 + (gi % 3);
  for (let i = 0; i < n; i++) g.players.push(E.newPlayer("P" + (i + 1), "名前" + (i + 1)));
  g.opt.capture = gi % 5 === 0 ? "near2" : "land";
  if (gi % 7 === 0) { g.opt.items = false; g.opt.skills = false; }
  act(g, "P1", { kind: "start" });
  let guard = 0;
  while (g.phase !== "end" && guard++ < 5000) {
    if (g.phase === "roundEnd") { stats.rounds++; stats.turnsSum += g.turn; if (g.backOpen) stats.backOpen++; stats.alarms += g.tr.filter(t => t.alarm).length; stats.stolen += g.tr.filter(t => t.taken).length;
      g.players.filter(p => p.th).forEach(p => { if (p.th.status === "escaped") stats.esc[p.th.escHow]++; if (p.th.status === "captured") stats.cap++; if (p.th.status === "failed") stats.fail++; });
      act(g, "P1", { kind: "nextRound" }); continue; }
    // 情報漏れチェック：探偵の画面に怪盗の位置がないこと、怪盗の画面に探偵の位置がないこと
    if (g.phase === "play") {
      const dv = E.viewFor(g, g.detId); if (dv.thieves || dv.tr.some(t => t.stage != null)) stats.leaks++;
      const tid = g.players.find(p => p.th).id; const tv = E.viewFor(g, tid); if (tv.det) stats.leaks++;
    }
    if (g.phase === "play" && g.turn === 1 && g.stage === "det" && g.prints.some(x => !x.fake)) stats.t1prints++;
    if (g.phase === "play" && g.players.some(q => q.th && q.th.k == null)) stats.nullk++;
    const pend = E.pendingIds(g);
    if (!pend.length) { stats.stuck++; console.log("STUCK", g.phase, g.stage, g.turn); break; }
    const pid = pend[0]; const p = E.P(g, pid);
    if (g.phase === "setup") {
      if (p.det && !p.det.ready) act(g, pid, { kind: "setupDet", k: pick(Array.from({length:64},(_,i)=>64+i).filter(k=>!E.bld(g).starts.includes(k))), skills: Object.keys(E.SKILLS).sort(() => rand() - .5).slice(0, 4) });
      else act(g, pid, { kind: "declare", yes: rand() < 0.4, start: pick(E.bld(g).starts) });
      continue;
    }
    if (p.th) {
      const th = p.th, tp = th.tp, b = E.bld(g);
      if (th.status === "captured") { if (th.items.includes("rope") && rand() < 0.7) act(g, pid, { kind: "useItem", item: "rope" }); else act(g, pid, { kind: "confirm" }); continue; }
      if (rand() < 0.1 && th.items.length) { const it = pick(th.items); act(g, pid, { kind: "useItem", item: it, k: Math.floor(rand() * 128) }); }
      if (th.heliCall == null && (th.loot.length || g.turn > 7) && rand() < 0.5) act(g, pid, { kind: "heli" });
      if (rand() < 0.05) { if (rand() < 0.2) { E.proxyAct(g, pid); continue; } }
      act(g, pid, rand() < 0.1 ? { kind: "stay" } : { kind: "roll" });
      const goals = [];
      if (th.heliCall != null && g.turn >= th.heliCall + 1) goals.push(...b.roof);
      if (E.partsDone(g, th)) goals.push(b.front);
      if (!th.loot.length || rand() < 0.4) g.tr.filter(t => !t.taken).forEach(t => goals.push(t.k));
      g.parts.filter(x => !x.taken && !(th.parts[x.type] > 0)).forEach(x => goals.push(x.k));
      g.players.filter(q => q.th && q.th.status === "captured").forEach(q => goals.push(q.th.k));
      if (th.items.includes("wire")) goals.push(...b.windows);
      const dest = tp.stay ? th.k : bfsTo(g, th.k, tp.roll, goals);
      act(g, pid, { kind: "dest", k: dest });
      const opts = E.thiefOptions(g, p, dest);
      act(g, pid, { kind: "confirm", act: opts.includes("wire") ? "wire" : opts.includes("unlock") ? "unlock" : opts.includes("release") ? "release" : opts.includes("receive") ? "receive" : "none" });
      continue;
    }
    if (p.det) {
      const d = p.det;
      if (g.opt.skills && rand() < 0.3 && d.skills.length) { const s = pick(d.skills); act(g, pid, { kind: "skill", id: s, area: pick("ABCDEFGH".split("")), stair: 0, pid: (g.players.find(q => q.th && q.th.status === "captured") || {}).id }); }
      if (rand() < 0.15) { act(g, pid, { kind: "stay" }); act(g, pid, { kind: "act", act: rand() < 0.5 ? "ambush" : "capture", target: d.k }); continue; }
      act(g, pid, { kind: "roll" });
      const goals = [...g.tr.filter(t => t.alarm && !t.taken).map(t => t.k), ...g.prints.map(x => x.k), ...E.bld(g).roof];
      const dest = bfsTo(g, d.k, d.tp.roll, goals);
      act(g, pid, { kind: "dest", k: dest });
      const r = act(g, pid, { kind: "act", act: "capture", target: dest });
      if (r && !r.startsWith("内部")) act(g, pid, { kind: "endTurn" });
      continue;
    }
  }
  if (guard >= 5000) { stats.stuck++; console.log("GUARD", g.phase, g.stage); }
  stats.games++;
  g.players.forEach(p => { if (!Number.isFinite(p.money) || p.money < 0 || p.debt < 0) console.log("BAD MONEY", p); });
  if ((g.errors || []).length) { stats.errors += g.errors.length; console.log(g.errors[0]); }
}
console.log(JSON.stringify(stats, null, 1));
console.log("平均ターン", (stats.turnsSum / stats.rounds).toFixed(2));
