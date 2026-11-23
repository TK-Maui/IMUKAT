// 1台モード：1人＋CPU3人（ふつう）で1ラウンド進むか
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
  await page.goto("http://127.0.0.1:8765/?fx=0"); await page.selectOption("#lnum", "1"); await page.click("#blocal");
  await page.selectOption("#cpulv", "normal");
  for (let i = 0; i < 3; i++) await page.click("#baddcpu");
  await page.screenshot({ path: "test/shot_cpu_lobby.png" });
  await page.click("#bstart");
  const S = () => page.evaluate(() => { const g = window.__S.game; return { phase: g.phase, round: g.round, turn: g.turn, stage: g.stage, pend: window.IMUKAT.pendingIds(g), det: g.detId, errors: (g.errors || []).length }; });
  let s, n = 0, shot = false;
  while (n++ < 400) {
    s = await S();
    if (s.phase === "roundEnd" || s.phase === "end") break;
    if (s.pend.includes("P1")) {
      // 人間（P1）は「代わりに進める」と同じ処理で進める
      await page.evaluate(() => { const g = window.__S.game; window.IMUKAT.safeApply(g, "P1", null, () => window.IMUKAT.proxyAct(g, "P1")); });
      await page.evaluate(() => broadcast());
    }
    if (!shot && s.phase === "play" && s.turn >= 3) { shot = true; await page.screenshot({ path: "test/shot_cpu_play.png", fullPage: true }); }
    await page.waitForTimeout(60);
  }
  console.log("state", JSON.stringify(s), "loops", n, "errs", errs);
  await b.close(); if (s.phase !== "roundEnd" || errs.length || s.errors) process.exit(1);
})();
