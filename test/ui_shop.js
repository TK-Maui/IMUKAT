const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
  await page.goto("http://127.0.0.1:8765/?fx=0"); await page.selectOption("#lnum", "4"); await page.click("#blocal"); await page.click("#bstart");
  // setup: det おまかせ, thieves
  const S = () => page.evaluate(() => window.__S.game);
  let g = await S();
  for (const p of g.players) {
    await page.click(`[data-seat="${p.id}"]`);
    if (p.det) { await page.click("#bsetrand"); await page.click("#bsetdet"); }
    else { await page.click("[data-tstart]"); await page.click("#bdecN"); }
  }
  g = await S(); const th = g.players.find(p => p.th);
  await page.click(`[data-seat="${th.id}"]`); await page.click("#bshop");
  await page.click('[data-buy="spare"]'); await page.waitForTimeout(200);
  g = await S(); console.log("items", g.players.find(p => p.id === th.id).th.items, "money", g.players.find(p => p.id === th.id).money);
  await page.click("#sItems"); await page.click('[data-useitem="spare"]'); await page.click('[data-spare="mask"]'); await page.waitForTimeout(200);
  g = await S(); console.log("parts", JSON.stringify(g.players.find(p => p.id === th.id).th.parts));
  await page.click("#bnoteok").catch(()=>{});
  await page.screenshot({ path: "/tmp/claude-0/-home-claude/07e9dec8-fa93-58df-9efe-cd737bda6885/scratchpad/shop.png" });
  console.log("errs", errs); await b.close();
})();
