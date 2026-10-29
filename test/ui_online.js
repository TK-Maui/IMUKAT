// 通信を含めた動作確認：同じブラウザ内のタブ同士（?transport=bc）で、部屋を作る→参加→数ターン→取り消し→再接続
const { chromium } = require("playwright");
const BASE = (process.env.BASE || "http://127.0.0.1:8765/") + "?transport=bc";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errs = [];
  const mk = async () => { const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); }); p.on("dialog", d => d.accept()); return p; };
  const host = await mk(); await host.goto(BASE);
  await host.fill("#hname", "ホスト"); await host.click("#bhost");
  await host.waitForSelector(".big"); const code = (await host.textContent(".big")).trim();
  console.log("room", code);
  const guests = [];
  for (const n of ["アキ", "ベン", "チカ"]) { const g = await mk(); await g.goto(BASE); await g.fill("#jname", n); await g.fill("#jcode", code); await g.click("#bjoin"); await g.waitForFunction(() => __S.view && __S.view.phase === "lobby", null, { timeout: 15000 }); guests.push(g); }
  const pages = [host, ...guests];
  await host.waitForFunction(() => __S.view.players.length === 4);
  await host.click("#bstart");
  const view = p => p.evaluate(() => { const v = __S.view; return v && { phase: v.phase, stage: v.stage, role: v.role, me: v.me, pend: v.pending, tp: v.role === "det" ? v.det.tp : v.my && v.my.tp, status: v.my && v.my.status, turn: v.turn }; });
  let undoDone = false, reconDone = false;
  for (let i = 0; i < 400; i++) {
    await host.waitForTimeout(60);
    const hv = await view(host);
    if (hv.phase === "roundEnd" || (hv.phase === "play" && hv.turn >= 4 && undoDone && reconDone)) break;
    for (const p of pages) {
      const v = await view(p); if (!v || !v.pend.includes(v.me)) continue;
      if (v.phase === "setup") { if (v.role === "det") { await p.click("#bsetrand"); await p.click("#bsetdet"); } else { const st0 = await p.$$("[data-tstart]"); await st0[0].click(); await p.click("#bdecN"); } break; }
      if (v.role === "thief") {
        if (v.status === "captured") { if (await p.$("#bconf")) await p.click("#bconf"); break; }
        if (v.tp.roll == null && !v.tp.stay) { await p.click("#broll"); break; }
        if (v.tp.dest == null) { const c = await p.$$(".cell.reach"); if (c.length) await c[c.length - 1].click(); break; }
        await p.click("#bconf"); break;
      }
      if (v.role === "det") {
        if (v.tp.roll == null && !v.tp.stay) { await p.click("#broll"); break; }
        if (v.tp.dest == null) { const c = await p.$$(".cell.reach"); if (c.length) await c[0].click(); break; }
        await p.click("#bcap"); break;
      }
    }
    if (hv.phase === "play" && hv.turn === 2 && !undoDone) {
      const before = await host.evaluate(() => __S.hist.length);
      await host.click("details.panel summary"); await host.click("#bundo"); undoDone = true;
      const after = await host.evaluate(() => __S.hist.length); console.log("undo hist", before, "->", after);
    }
    if (hv.phase === "play" && hv.turn === 3 && !reconDone) {
      // 1人の画面を閉じて、新しいタブから同じ名前で再参加する
      const g = guests[1]; await g.close(); const g2 = await mk(); await g2.goto(BASE); await g2.fill("#jname", "ベン"); await g2.fill("#jcode", code); await g2.click("#bjoin");
      await g2.waitForFunction(() => __S.view && __S.view.phase === "play", null, { timeout: 15000 }); guests[1] = g2; pages[2] = g2; reconDone = true; console.log("rejoined as", await g2.evaluate(() => __S.seat));
    }
  }
  const hv = await view(host); console.log("host state", JSON.stringify(hv));
  // 探偵の画面に怪盗の位置が出ていないか（情報漏れ）
  for (const p of pages) { const leak = await p.evaluate(() => { const v = __S.view; return v.role === "det" ? !!v.thieves : v.role === "thief" ? !!v.det : null; }); if (leak) console.log("LEAK on", await p.evaluate(() => __S.seat)); }
  await guests[0].screenshot({ path: "test/shot_guest.png", fullPage: true });
  console.log("errors", errs.length); errs.slice(0, 10).forEach(e => console.log(e));
  await browser.close();
})();
