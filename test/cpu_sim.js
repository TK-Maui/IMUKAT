// CPU同士の対戦：止まらないか・結果の傾向を見る
// node test/cpu_sim.js [ゲーム数] [怪盗レベル] [探偵レベル] [人数]
const E = require("../engine.js"); const C = require("../cpu.js");
const N = +process.argv[2] || 20, LT = process.argv[3] || "normal", LD = process.argv[4] || LT, NP = +process.argv[5] || 5;
const st = { lootFail: 0, lootN: 0, games: 0, rounds: 0, endTurn: 0, esc: 0, cap: 0, fail: 0, how: {}, detEarn: 0, thEarn: 0, thN: 0, actions: 0, errors: 0, stalls: 0, unlockTry: 0, unlockOk: 0, items: 0, bought: 0, release: 0 };
for (let gi = 0; gi < N; gi++) {
  const g = E.newGame(); g.seed = 1000 + gi;
  for (let i = 0; i < NP; i++) { const p = E.newPlayer("C" + (i + 1), "CPU" + (i + 1)); g.players.push(p); }
  g.opt.thiefTimer = false; g.opt.detTimer = false;
  E.safeApply(g, "C1", { kind: "start" });
  let guard = 0;
  const apply = (id, a, fn) => { st.actions++; return E.safeApply(g, id, a, fn); };
  while (g.phase !== "end" && guard++ < 20000) {
    // レベルは役ごとに（探偵はLD、怪盗はLT）
    g.players.forEach(p => p.cpu = p.id === g.detId ? LD : LT);
    if (g.phase === "roundEnd") { E.safeApply(g, "C1", { kind: "nextRound" }); continue; }
    const id = C.step(E, g, apply);
    if (!id) { st.stalls++; console.log("STALL", g.phase, g.stage, E.pendingIds(g)); break; }
  }
  if (guard >= 20000) { st.stalls++; console.log("LOOP", g.phase, g.round, g.turn, g.stage); }
  st.errors += (g.errors || []).length; if ((g.errors || []).length) console.log(g.errors[0]);
  st.games++;
  for (const r of g.records) {
    if (r.role === "探偵") { st.detEarn += r.delta; st.rounds++; st.endTurn += +r.endTurn || 0; }
    else { st.thEarn += r.delta; st.thN++; const s = r.status; if (/脱出成功/.test(s)) st.esc++; else if (/捕縛/.test(s)) st.cap++; else st.fail++; if (r.escHow) st.how[r.escHow] = (st.how[r.escHow] || 0) + 1;
      st.unlockTry += +r.unlockTry || 0; st.unlockOk += +r.unlockOk || 0; st.items += +r.items || 0; st.bought += +r.bought || 0; if (r.releasePaid) st.release++; if (r.loot) { st.lootN++; if (/脱出失敗/.test(r.status)) st.lootFail++; } }
  }
  g.alog.filter(x => x.kind === "ラウンド終了").forEach(x => { const m = /(\d+)ターン/.exec(x.detail || ""); });
}
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "-";
console.log(`怪盗=${LT} 探偵=${LD} ${NP}人 × ${st.games}ゲーム（${st.rounds}ラウンド）`);
console.log(`脱出 ${pct(st.esc, st.thN)} / 捕縛 ${pct(st.cap, st.thN)} / 失敗 ${pct(st.fail, st.thN)}  脱出方法 ${JSON.stringify(st.how)}`);
console.log(`財宝を持ったまま逃げそこねた ${pct(st.lootFail, st.lootN)}（${st.lootFail}/${st.lootN}）`); console.log(`平均終了ターン ${(st.endTurn / st.rounds).toFixed(1)}`); console.log(`1ラウンドの稼ぎ：探偵 ${Math.round(st.detEarn / st.rounds)} / 怪盗 ${Math.round(st.thEarn / st.thN)}（万円）`);
console.log(`解除 ${st.unlockOk}/${st.unlockTry}  アイテム使用 ${st.items}  購入 ${st.bought}  保釈 ${st.release}  手数 ${st.actions}  エラー ${st.errors}  停止 ${st.stalls}`);
if (st.errors || st.stalls) process.exit(1);
