// 画面の動作確認（1台モード）：実際にボタンを押して1ゲーム通す
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://127.0.0.1:8765/";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  page.on("dialog", d => d.accept());
  await page.goto(BASE);
  await page.screenshot({ path: "test/shot_title.png", fullPage: true });
  await page.selectOption("#lnum", "4");
  await page.click("#blocal");
  await page.screenshot({ path: "test/shot_lobby.png", fullPage: true });
  await page.click("#bstart");
  let shots = 0, loops = 0;
  const snap = async n => { if (shots < 12) { await page.screenshot({ path: `test/shot_${n}.png`, fullPage: true }); shots++; } };
  while (loops++ < 3000) {
    const st = await page.evaluate(() => { const v = __S.view; return { phase: v.phase, stage: v.stage, pend: v.pending, seat: __S.seat, role: v.role, turn: v.turn, round: v.round }; });
    if (st.phase === "end") break;
    if (st.phase === "roundEnd") { await snap("roundend" + st.round); await page.click("#bnext"); continue; }
    if (!st.pend.length) { console.log("no pending", st); break; }
    if (!st.pend.includes(st.seat)) { await page.click(`[data-seat="${st.pend[0]}"]`); continue; }
    if (st.phase === "setup") {
      if (st.role === "det") { await snap("setup_det"); await page.click("#bsetrand"); await page.click("#bsetdet"); }
      else { await snap("setup_thief"); await page.click(Math.random() < 0.5 ? "#bdecY" : "#bdecN"); }
      continue;
    }
    if (st.role === "thief") {
      const info = await page.evaluate(() => { const v = __S.view; return { tp: v.my.tp, status: v.my.status, items: v.my.items }; });
      if (info.status === "captured") { if (await page.$("[data-use=rope]")) await page.click("[data-use=rope]"); else if (await page.$("#bconf")) await page.click("#bconf"); else await page.evaluate(() => { }); continue; }
      if (info.tp.roll == null && !info.tp.stay) {
        if (st.turn === 2 && await page.$("#bheli")) await page.click("#bheli");
        if (st.turn === 1 && st.round === 1) await snap("thief_turn");
        await page.click("#broll"); continue;
      }
      if (info.tp.dest == null) { const cells = await page.$$(".cell.reach"); await cells[Math.floor(Math.random() * cells.length)].click(); if (st.turn === 1) await snap("thief_dest"); continue; }
      if (await page.$("[data-act=unlock]")) await page.click("[data-act=unlock]");
      await page.click("#bconf"); continue;
    }
    if (st.role === "det") {
      const tp = await page.evaluate(() => __S.view.det.tp);
      if (st.turn === 1 && st.round === 1) await snap("det_turn");
      if (Math.random() < 0.2 && await page.$("#sSkills")) { await page.click("#sSkills"); const b = await page.$("dialog [data-sk]:not([disabled])"); if (b) await b.click(); else await page.click("#dclose"); continue; }
      if (tp.roll == null && !tp.stay) { await page.click("#broll"); continue; }
      if (tp.dest == null) { const cells = await page.$$(".cell.reach"); await cells[Math.floor(Math.random() * cells.length)].click(); continue; }
      await page.click("#bcap"); continue;
    }
  }
  await snap("end");
  // 記録ダイアログとダウンロード
  await page.click("#sLog");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-dl=actions]")]);
  const p = await dl.path(); const fs = require("fs"); const csv = fs.readFileSync(p, "utf8");
  console.log("actions.csv lines:", csv.split("\n").length, csv.split("\n")[0].slice(0, 120));
  await page.screenshot({ path: "test/shot_log.png", fullPage: true });
  console.log("loops", loops, "errors", errs.length); errs.slice(0, 10).forEach(e => console.log(e));
  await browser.close();
})();
