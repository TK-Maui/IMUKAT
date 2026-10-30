/* =====================================================================
   IMUKAT テスト版：ゲームの処理（部屋を作った人の端末・1台モードだけで動く）
   画面や通信には依存しない。ブラウザでも Node.js でも動く。
   ===================================================================== */
(function (root) {
"use strict";
const E = {};
E.VERSION = "テスト版 v1.7";

/* ---------- 乱数（ゲームごとの種から作る。同じ種＋同じ操作なら同じ結果） ---------- */
let RNG = null;
const rand01 = () => (RNG ? RNG() : Math.random());
const rnd = n => Math.floor(rand01() * n);
function gameRand(g) { let t = (g.rs = (g.rs + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function withRng(g, fn) { if (typeof g.rs !== "number") g.rs = (Math.random() * 4294967296) >>> 0; const prev = RNG; RNG = () => gameRand(g); try { return fn(); } finally { RNG = prev; } }
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clone = o => JSON.parse(JSON.stringify(o));
const d6 = () => 1 + rnd(6);

/* ---------- 座標：1階A〜D・2階E〜H、各エリア1〜16 ---------- */
const AREAS = [["A", "B", "C", "D"], ["E", "F", "G", "H"]];
const K = (f, r, c) => f * 64 + r * 8 + c;
const FL = k => k >> 6, RW = k => (k >> 3) & 7, CL = k => k & 7;
function areaOf(k) { return AREAS[FL(k)][(RW(k) >= 4 ? 2 : 0) + (CL(k) >= 4 ? 1 : 0)]; }
function nm(k) { if (k == null || k < 0) return "-"; return areaOf(k) + "-" + ((RW(k) % 4) * 4 + (CL(k) % 4) + 1); }
function parse(s) {
  const L = s[0], n = +s.slice(2); let f = -1, q = -1;
  AREAS.forEach((row, fi) => { const i = row.indexOf(L); if (i >= 0) { f = fi; q = i; } });
  const lr = Math.floor((n - 1) / 4), lc = (n - 1) % 4;
  return K(f, (q >= 2 ? 4 : 0) + lr, (q % 2 ? 4 : 0) + lc);
}
const dist = (a, b) => (FL(a) !== FL(b) ? 99 : Math.abs(RW(a) - RW(b)) + Math.abs(CL(a) - CL(b)));
const otherFloor = k => K(1 - FL(k), RW(k), CL(k));
E.nm = nm; E.parse = parse; E.areaOf = areaOf; E.FL = FL; E.RW = RW; E.CL = CL; E.K = K; E.dist = dist; E.AREAS = AREAS;

/* ---------- データ ---------- */
const BUILDINGS = {
  museum: {
    name: "美術館", front: "D-13", back: "A-2", stairs: [["B-9", "F-9"], ["C-8", "G-8"]],
    roof: ["E-1", "H-16"], windows: ["F-4", "G-13"], starts: ["A-2", "D-13", "F-4", "G-13"],
    tnames: { high: ["夜明けの涙"], mid: ["月下の貴婦人", "時を止めた懐中時計"], low: ["銀の燭台"] },
  },
};
const _bk = {};
function bld(g) {
  const id = g.building || "museum";
  if (!_bk[id]) {
    const b = BUILDINGS[id];
    _bk[id] = { name: b.name, front: parse(b.front), back: parse(b.back), stairs: b.stairs.map(p => p.map(parse)),
      roof: b.roof.map(parse), windows: b.windows.map(parse), starts: b.starts.map(parse), tnames: b.tnames };
  }
  return _bk[id];
}
function fixedList(g) { const b = bld(g); return [b.front, b.back, ...b.stairs.flat(), ...b.roof, ...b.windows]; }
E.bld = bld; E.BUILDINGS = BUILDINGS;

const TR = {
  high: { label: "高", value: 1500, need: 2, target: 5 },
  mid: { label: "普通", value: 600, need: 1, target: 5 },
  low: { label: "安", value: 300, need: 1, target: 4 },
};
const PARTS = { uniform: "警備員の制服", mask: "変装マスク", badge: "社員証", baton: "警棒" };
const PART_KEYS = Object.keys(PARTS);
const NOTICES = {
  top: { name: "至高の一品", text: "最も高い財宝を持って脱出する" },
  disguise: { name: "堂々たる退場", text: "変装して正面ゲートから脱出する" },
  early: { name: "電光石火", text: "8ターン目までに脱出する" },
  noalarm: { name: "無音の怪盗", text: "自分の解除で一度も警報を鳴らさずに脱出する" },
  upheli: { name: "天空の逃避行", text: "2階の財宝を持ってヘリで脱出する" },
};
const ITEMS = {
  shoes: { name: "俊足シューズ", text: "このターン、サイコロの出目に+2する（サイコロを振る前に使う）" },
  key: { name: "万能鍵", text: "このターンのセキュリティ解除は、当たり目が1つ広がる（例：5〜6→4〜6）" },
  pick: { name: "ピッキングツール", text: "このターンの解放作業が、2ターン分進む" },
  rope: { name: "縄抜け", text: "捕縛されているときに使うと、自力で抜け出せる（そのターンから動ける）" },
  erase: { name: "足跡消し", text: "このターンは足跡を残さない" },
  fake: { name: "偽の足跡", text: "好きなマスに、自分の色の足跡を1つ置く", target: true },
  blackout: { name: "停電スイッチ", text: "次の探偵のターン、探偵はスキルを使えない" },
  oil: { name: "オイル", text: "好きなマスに仕掛ける（探偵には見えない）。探偵がそこに止まると、そのターンの残りの行動ができなくなる", target: true },
  bug: { name: "盗聴器", text: "次の探偵のターンが終わったとき、探偵がいるフロアが怪盗全員に分かる" },
  wire: { name: "ワイヤー銃", text: "2階の窓のマスに止まったとき、そこから脱出できる（山札に1枚だけ）" },
};
const ITEM_DECK = () => [..."shoes key pick rope erase fake blackout oil bug".split(" ").flatMap(x => [x, x]), "wire"];
const SKILLS = {
  ask: { name: "聞き込み", ct: 2, text: "エリアを1つ選ぶ。そのエリアにいる怪盗（捕縛中を除く）の人数が分かる", target: "area" },
  sense: { name: "気配察知", ct: 2, text: "今いるマスから2マス以内（同じフロアで縦横に数える）に怪盗がいるかどうかが分かる" },
  floor: { name: "フロア照会", ct: 2, text: "1階と2階に、それぞれ何人の怪盗がいるかが分かる" },
  sprint: { name: "全力疾走", ct: 2, text: "このターン、次に振るサイコロの出目に+3する" },
  net: { name: "包囲網", ct: 3, text: "このターンの捕縛は、選んだマスの上下左右1マスも対象になる" },
  block: { name: "封鎖", ct: 3, text: "階段を1か所選ぶ。2ターンの間、怪盗も探偵もその階段を使えない", target: "stair" },
  seize: { name: "証拠押収", ct: 2, text: "捕縛中の怪盗を1人選ぶ。その怪盗の解放に必要な作業が1ターン分増える", target: "captured" },
  jump: { name: "階段跳び", ct: 2, text: "今いるマスの真上か真下のマスへ移動する（移動力を使わない。サイコロを振る前に使う）" },
  secure: { name: "セキュリティ強化", ct: 0, text: "財宝のマスにいるとき、その財宝の解除段階を1つ増やす（1つの財宝につき1ラウンド1回）。使うと探偵の位置が全員に分かる" },
  alarmdev: { name: "警報器", ct: 3, text: "今いるマスに警報器を仕掛ける（怪盗には見えない）。怪盗がそのマスに止まると、探偵に知らされる（踏んだ怪盗にも分かる）" },
};
E.TR = TR; E.PARTS = PARTS; E.PART_KEYS = PART_KEYS; E.NOTICES = NOTICES; E.ITEMS = ITEMS; E.SKILLS = SKILLS;
const PCOL = ["#2f6fd6", "#d1495b", "#2a9d6f", "#c98b12", "#8e5cc4", "#1e9aa8"];
E.PCOL = PCOL;
const MONEY = { bail: 100, endCap: 300, capture: 100, capMax: 2, failed: 150, block: 200, noticeOpen: 600, noticeHidden: 200, rescue: 200, flair: [300, 200, 100] };
E.MONEY = MONEY;

function defaultOpt() {
  return { turns: 12, thiefTimer: true, thiefSec: 30, detTimer: false, detSec: 90, items: true, skills: true,
    capture: "land", partsNeed: 4, alarmFails: 2, startMoneyPer: 100 };
}
E.defaultOpt = defaultOpt;

/* ---------- 基本 ---------- */
const P = (g, id) => g.players.find(p => p.id === id);
const PN = (g, id) => { const p = P(g, id); return p ? p.name : id; };
const thieves = g => g.players.filter(p => p.th);
const det = g => P(g, g.detId);
E.P = P;
function log(g, vis, m) { g.log.push({ r: g.round, t: g.turn, vis, m }); if (g.log.length > 600) g.log.splice(0, g.log.length - 600); }
function alog(g, pid, kind, o) {
  const p = P(g, pid);
  g.alog.push(Object.assign({ at: Date.now(), round: g.round, turn: g.turn, stage: g.stage || g.phase, pid: pid || "", name: p ? p.name : "", role: p ? (p.det ? "探偵" : p.th ? "怪盗" : "") : "", kind }, o || {}));
}

function newGame() {
  return { v: 1, phase: "lobby", players: [], opt: defaultOpt(), round: 0, rounds: 0, turn: 0, stage: null, step: 0,
    building: "museum", log: [], alog: [], records: [], errors: [], undos: 0, seed: (Math.random() * 4294967296) >>> 0, rs: null, gid: "g" + Date.now().toString(36) };
}
function newPlayer(id, name) { return { id, name: String(name || id).slice(0, 12), token: null, connected: true, money: 0, debt: 0, color: 0 }; }
E.newGame = newGame; E.newPlayer = newPlayer;

/* ---------- 移動範囲 ---------- */
function blockedStairs(g) { return (g.blocks || []).filter(b => b.until >= g.turn).map(b => b.i); }
function neighbors(g, k) {
  const out = [], f = FL(k), r = RW(k), c = CL(k);
  if (r > 0) out.push(K(f, r - 1, c)); if (r < 7) out.push(K(f, r + 1, c));
  if (c > 0) out.push(K(f, r, c - 1)); if (c < 7) out.push(K(f, r, c + 1));
  const bl = blockedStairs(g);
  bld(g).stairs.forEach((pair, i) => { if (bl.includes(i)) return; if (pair[0] === k) out.push(pair[1]); if (pair[1] === k) out.push(pair[0]); });
  return out;
}
function reach(g, from, n) {
  const d = new Map([[from, 0]]), q = [from];
  while (q.length) { const k = q.shift(), dk = d.get(k); if (dk >= n) continue; for (const nb of neighbors(g, k)) if (!d.has(nb)) { d.set(nb, dk + 1); q.push(nb); } }
  return [...d.keys()];
}
E.reach = reach;

/* ---------- ゲーム開始・ラウンド準備 ---------- */
function startGame(g) {
  if (g.players.length < 2) return "2人以上で始めてください";
  g.rounds = g.opt.rounds || g.players.length;
  g.order = g.players.map(p => p.id);
  g.players.forEach((p, i) => { p.color = i; p.money = g.players.length * g.opt.startMoneyPer; p.debt = 0; p.total = { det: 0 }; });
  g.rs = g.seed; g.round = 0;
  log(g, "all", `ゲーム開始（${g.players.length}人・${g.rounds}ラウンド・開始時の所持金 各${g.players.length * g.opt.startMoneyPer}万円）`);
  alog(g, null, "ゲーム開始", { detail: JSON.stringify(g.opt) });
  startRound(g);
  return null;
}
function placeRandom(g) {
  const b = bld(g); const used = new Set(fixedList(g));
  const pickIn = area => { for (let i = 0; i < 200; i++) { const n = 1 + rnd(16); const k = parse(area + "-" + n); if (!used.has(k)) { used.add(k); return k; } } return null; };
  const tr = []; const areasUsed = new Set(); const perFloor = [0, 0];
  const specs = [["high", 0], ["mid", 0], ["mid", 1], ["low", 0]];
  for (const [rank, ni] of specs) {
    let area;
    for (let i = 0; i < 500; i++) {
      const a = "ABCDEFGH"[rnd(8)]; const f = "ABCD".includes(a) ? 0 : 1;
      if (rank === "high" && !"BCFG".includes(a)) continue;
      if (areasUsed.has(a) || perFloor[f] >= 2) continue;
      area = a; break;
    }
    areasUsed.add(area); perFloor["ABCD".includes(area) ? 0 : 1]++;
    const k = pickIn(area);
    tr.push({ id: "t" + tr.length, rank, name: b.tnames[rank][ni] || TR[rank].label, value: TR[rank].value, need: TR[rank].need, target: TR[rank].target,
      k, floor: FL(k), stage: 0, fails: 0, alarm: false, taken: false, holder: null, secured: false });
  }
  const types = shuffle([...PART_KEYS, ...PART_KEYS]);
  const parts = "ABCDEFGH".split("").map((a, i) => ({ id: "p" + i, type: types[i], k: pickIn(a), taken: false }));
  g.tr = tr; g.parts = parts;
}
function startRound(g) {
  g.round++;
  const n = g.order.length;
  g.detId = g.order[(g.round - 1) % n];
  g.players.forEach(p => { delete p.th; delete p.det; p.rd = { start: p.money - p.debt, earn: {} }; });
  g.turn = 0; g.stage = null; g.step = 0;
  g.prints = []; g.heli = {}; g.backOpen = false; g.blocks = []; g.oils = []; g.devices = []; g.reveals = []; g.searchMarks = [];
  g.blackoutNext = false; g.bugNext = false; g.floorHint = null;
  placeRandom(g);
  const b = bld(g);
  const notices = shuffle(Object.keys(NOTICES));
  const deck = shuffle(ITEM_DECK());
  let ni = 0;
  g.players.forEach(p => {
    if (p.id === g.detId) {
      p.det = { k: null, skills: [], cd: {}, ready: false, ambush: null, captured: [], capN: 0, capBy: {}, sprint: 0, net: false, blackout: false, secured: [], info: [], known: { tr: {}, parts: {} } };
    } else {
      p.th = { k: null, status: "active", loot: [], parts: {}, items: g.opt.items ? [deck.pop(), deck.pop()].filter(Boolean) : [], notice: notices[ni++ % notices.length], declared: null,
        heliCall: null, escTurn: null, escHow: null, escK: null, rescues: 0, alarmTrig: false, rel: 0, relNeed: 2, relBy: [], pendingRecv: null, tp: null, stats: { moves: 0, stays: 0, unlockTry: 0, unlockOk: 0, fails: 0, timeouts: 0, items: 0 } };
    }
  });
  g.phase = "setup";
  log(g, "all", `第${g.round}ラウンド：探偵は ${PN(g, g.detId)}。建物は${b.name}`);
  alog(g, g.detId, "ラウンド開始", { detail: `探偵=${PN(g, g.detId)}`, result: g.tr.map(t => `${t.name}@${nm(t.k)}`).join(" / ") + " | 変装:" + g.parts.map(p => `${PARTS[p.type]}@${nm(p.k)}`).join(" / ") });
}
E.startGame = startGame;

/* ---------- ターンの始まり ---------- */
function startThiefTurn(g) {
  g.stage = "thief"; g.step = 0;
  g.blocks = (g.blocks || []).filter(b => b.until >= g.turn);
  // 前のターンに始めた「受け取り」「解放」の完了
  for (const p of thieves(g)) {
    const th = p.th;
    if (th.pendingRecv) {
      const c = P(g, th.pendingRecv);
      if (th.status === "active" && c && c.th.status === "captured" && c.th.k === th.k && c.th.loot.length) {
        th.loot.push(...c.th.loot); c.th.loot.forEach(id => { g.tr.find(t => t.id === id).holder = p.id; });
        log(g, "th", `${p.name}が ${c.name} から財宝を受け取りました`); alog(g, p.id, "財宝の受け取り完了", { detail: c.th.loot.join(",") });
        note(g, p.id, "💎", `${c.name}から財宝を受け取った`, [c.th.loot.map(id => g.tr.find(t => t.id === id).name).join("・")], "good");
        note(g, c.id, "🤝", `${p.name}が財宝を受け取った`, [], "info");
        c.th.loot = [];
      }
      th.pendingRecv = null;
    }
  }
  for (const p of thieves(g)) {
    const th = p.th;
    if (th.status === "captured" && th.rel >= th.relNeed) {
      th.status = "active"; th.rel = 0; th.relNeed = 2;
      const by = th.relBy[th.relBy.length - 1]; const rp = P(g, by); if (rp) rp.th.rescues++;
      log(g, "all", `${p.name}が解放されました（${nm(th.k)}）`); alog(g, by, "解放の完了", { detail: p.name, to: nm(th.k) });
      note(g, p.id, "🔓", "解放された！このターンから動けます", [`場所：${nm(th.k)}`], "good");
      note(g, by, "🔓", `${p.name}の解放に成功！`, [`救出ボーナス +${MONEY.rescue}万円`], "good");
      th.relBy = [];
    }
  }
  for (const p of thieves(g)) {
    const h = p.th.heliCall;
    if (h != null && g.turn === h + 2 && p.th.status === "active") { log(g, "all", `${p.name}のヘリが屋上に到着しました（${h + 3}ターン目の終わりまで待機）`); note(g, p.id, "🚁", "ヘリが屋上に到着！", [`${h + 3}ターン目の終わりまで、屋上階段（${bld(g).roof.map(nm).join("・")}）にいれば脱出できます`], "info"); }
  }
  for (const p of thieves(g)) {
    const th = p.th;
    if (th.status === "active") th.tp = { done: false, roll: null, stay: false, dest: null, use: {} };
    else if (th.status === "captured") th.tp = { done: !(th.items.includes("rope")) && thieves(g).some(q => q.th.status === "active"), roll: null, stay: true, dest: th.k, use: {}, captured: true };
    else th.tp = null;
  }
  checkThiefDone(g);
}
function startDetTurn(g) {
  g.stage = "det"; g.step = 1;
  const d = det(g).det;
  for (const s of Object.keys(d.cd)) d.cd[s] = Math.max(0, d.cd[s] - 1);
  d.blackout = g.blackoutNext; g.blackoutNext = false;
  d.net = false;
  d.tp = { roll: null, stay: false, dest: null };
  if (d.blackout) log(g, "det", "停電中：このターンはスキルを使えません");
}

/* ---------- 怪盗の操作 ---------- */
function thiefOptions(g, p, k) {
  const th = p.th; const o = [];
  const tr = g.tr.find(t => !t.taken && t.k === k);
  if (tr) o.push("unlock");
  const caps = thieves(g).filter(q => q.id !== p.id && q.th.status === "captured" && q.th.k === k);
  if (caps.length) o.push("release");
  if (caps.some(q => q.th.loot.length)) o.push("receive");
  if (bld(g).windows.includes(k) && th.items.includes("wire")) o.push("wire");
  o.push("none");
  return o;
}
E.thiefOptions = thiefOptions;
function partsDone(g, th) { return PART_KEYS.filter(t => (th.parts[t] || 0) > 0).length >= g.opt.partsNeed; }
E.partsDone = partsDone;

function thiefAct(g, p, a) {
  const th = p.th, tp = th.tp;
  if (g.stage !== "thief" || !tp) return "今は怪盗のターンではありません";
  if (a.kind === "useItem") {
    const it = a.item; const i = th.items.indexOf(it);
    if (i < 0) return "そのアイテムを持っていません";
    if (it === "wire") return "ワイヤー銃は、窓のマスに止まったときの行動で使います";
    if (it === "rope") {
      if (th.status !== "captured") return "縄抜けは捕縛されているときだけ使えます";
      th.items.splice(i, 1); th.stats.items++;
      th.status = "active"; th.rel = 0; th.relNeed = 2; th.relBy = [];
      th.tp = { done: false, roll: null, stay: false, dest: null, use: {} };
      log(g, "all", `${p.name}が縄抜けで自力で抜け出しました（${nm(th.k)}）`); alog(g, p.id, "アイテム", { detail: ITEMS[it].name, from: nm(th.k) });
      note(g, p.id, "🪢", "縄抜け成功！このターンから動けます", [], "good");
      return null;
    }
    if (th.status !== "active") return "今はそのアイテムを使えません";
    if (tp.done) return "行動を確定したあとは使えません（確定を取り消してから使ってください）";
    if (it === "shoes") { if (tp.roll != null || tp.stay) return "俊足シューズはサイコロを振る前に使います"; tp.use.shoes = true; }
    else if (it === "key") tp.use.key = true;
    else if (it === "pick") tp.use.pick = true;
    else if (it === "erase") tp.use.erase = true;
    else if (it === "fake") { if (a.k == null || a.k < 0 || a.k > 127) return "足跡を置くマスを選んでください"; tp.use.fake = a.k; }
    else if (it === "blackout") g.blackoutNext = true;
    else if (it === "oil") { if (a.k == null || a.k < 0 || a.k > 127) return "オイルを仕掛けるマスを選んでください"; g.oils.push({ k: a.k, by: p.id }); }
    else if (it === "bug") g.bugNext = true;
    th.items.splice(i, 1); th.stats.items++;
    log(g, "th", `${p.name}が「${ITEMS[it].name}」を使いました${a.k != null ? `（${nm(a.k)}）` : ""}`);
    alog(g, p.id, "アイテム", { detail: ITEMS[it].name, to: a.k != null ? nm(a.k) : "" });
    return null;
  }
  if (a.kind === "heli") {
    if (th.status !== "active") return "今はヘリを呼べません";
    if (th.heliCall != null) return "ヘリはこのラウンドでもう呼んでいます";
    th.heliCall = g.turn;
    log(g, "all", `${p.name}がヘリを呼びました（${g.turn + 2}ターン目の始めに到着・${g.turn + 3}ターン目の終わりまで待機）`);
    alog(g, p.id, "ヘリを呼ぶ", { from: nm(th.k) });
    checkBackDoor(g);
    return null;
  }
  if (a.kind === "give") {
    const to = P(g, a.to);
    if (th.status !== "active" || !to || !to.th || to.th.status !== "active" || to.th.k !== th.k) return "同じマスにいる仲間にだけ渡せます";
    if (a.loot) { const i = th.loot.indexOf(a.loot); if (i < 0) return "その財宝を持っていません"; th.loot.splice(i, 1); to.th.loot.push(a.loot); g.tr.find(t => t.id === a.loot).holder = to.id; }
    else if (a.item) { const i = th.items.indexOf(a.item); if (i < 0) return "そのアイテムを持っていません"; th.items.splice(i, 1); to.th.items.push(a.item); }
    else if (a.part) { if (!(th.parts[a.part] > 0)) return "その変装パーツを持っていません"; th.parts[a.part]--; to.th.parts[a.part] = (to.th.parts[a.part] || 0) + 1; }
    else return "渡すものを選んでください";
    const what = a.loot ? g.tr.find(t => t.id === a.loot).name : a.item ? ITEMS[a.item].name : PARTS[a.part];
    log(g, "th", `${p.name}が ${to.name} に「${what}」を渡しました`); alog(g, p.id, "譲渡", { detail: `${what}→${to.name}`, from: nm(th.k) });
    return null;
  }
  if (a.kind === "roll") {
    if (th.status !== "active") return "今は動けません";
    if (tp.done) return "行動はもう確定しています";
    if (tp.roll != null || tp.stay) return "サイコロはもう振っています";
    const n = d6(); tp.die = n; tp.roll = n + (tp.use.shoes ? 2 : 0);
    alog(g, p.id, "サイコロ", { dice: n, detail: tp.use.shoes ? "俊足シューズ+2" : "" });
    return null;
  }
  if (a.kind === "stay") {
    if (th.status !== "active") return "今は動けません";
    if (tp.done) return "行動はもう確定しています";
    if (tp.roll != null) return "サイコロを振ったあとは、出た目以内で好きなマスを選んでください（今いるマスも選べます）";
    tp.stay = true; tp.roll = 0; tp.dest = th.k; return null;
  }
  if (a.kind === "dest") {
    if (th.status !== "active" || tp.done) return "今は移動先を選べません";
    if (tp.roll == null) return "先にサイコロを振るか、その場に留まってください";
    if (!reach(g, th.k, tp.roll).includes(a.k)) return "そのマスには届きません";
    tp.dest = a.k; return null;
  }
  if (a.kind === "confirm") {
    if (tp.done) return "行動はもう確定しています";
    if (th.status === "captured") { tp.done = true; checkThiefDone(g); return null; }
    if (tp.dest == null) return "移動先を選んでください";
    const opts = thiefOptions(g, p, tp.dest);
    const act = a.act || "none";
    if (!opts.includes(act)) return "そのマスではその行動はできません";
    tp.act = act; tp.pick = a.pick !== false; tp.done = true;
    checkThiefDone(g); return null;
  }
  if (a.kind === "unconfirm") {
    if (!tp.done) return null;
    if (th.status === "captured" && !th.items.includes("rope")) return "捕縛中なので取り消すことはありません";
    tp.done = false; return null;
  }
  return "不明な操作です";
}
function checkThiefDone(g) {
  if (g.stage !== "thief") return;
  const all = thieves(g).filter(p => p.th.tp);
  if (all.every(p => p.th.tp.done)) resolveThieves(g);
}
/* ---------- 結果の通知（行動した本人だけにポップアップで見せる） ---------- */
let _nid = 0;
function note(g, to, icon, title, lines, tone) {
  g.notes = g.notes || [];
  const ids = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!ids.length) return;
  _nid = (_nid + 1) % 1e6;
  g.notes.push({ id: Date.now().toString(36) + "-" + _nid + "-" + Math.floor(Math.random() * 1e6).toString(36), to: ids, r: g.round, t: g.turn, icon, title, lines: (lines || []).filter(Boolean), tone: tone || "info" });
  if (g.notes.length > 120) g.notes = g.notes.slice(-120);
}
E.note = note;
const partsLine = th => "変装パーツ：" + PART_KEYS.map(t => `${PARTS[t]}${(th.parts[t] || 0) > 0 ? "✓" : "—"}`).join("・");

function capture(g, p, why, dk) {
  const th = p.th; const d = det(g);
  th.status = "captured"; th.rel = 0; th.relNeed = 2; th.relBy = []; th.pendingRecv = null;
  g.prints = g.prints.filter(x => x.pid !== p.id);
  d.det.capN++; d.det.capBy = d.det.capBy || {}; d.det.capBy[p.id] = (d.det.capBy[p.id] || 0) + 1; if (!d.det.captured.includes(p.id)) d.det.captured.push(p.id);
  const how = { meet: "探偵と鉢合わせして", det: "探偵に", ambush: "張り込み中の探偵に", disguise: "変装を見破られて" }[why] || "";
  log(g, "all", `${p.name}が${how}捕縛されました（${nm(th.k)}）`);
  if (why === "disguise") g.reveals.push({ r: g.round, t: g.turn, text: `探偵は ${nm(th.k)} から2マス以内にいた` });
  else g.reveals.push({ r: g.round, t: g.turn, k: dk != null ? dk : d.det.k, text: `探偵は ${nm(dk != null ? dk : d.det.k)} にいた` });
  alog(g, p.id, "捕縛された", { detail: why, to: nm(th.k), result: `探偵=${nm(d.det.k)}` });
  const lossT = th.loot.length ? `持っている財宝（${th.loot.map(id => g.tr.find(t => t.id === id).name).join("・")}）は、仲間が受け取らないと山分けに入りません` : "";
  note(g, p.id, "🔒", `${how}捕まった！`, [`場所：${nm(th.k)}`, "仲間の解放作業（合計2ターン）か「縄抜け」で抜け出せます", lossT], "bad");
  if (why === "meet") note(g, d.id, "🎯", `${p.name}が鉢合わせして捕まった！`, [`${nm(th.k)} に怪盗が止まりました`], "good");
  if (why === "ambush") note(g, d.id, "🎯", `張り込み成功！${p.name}を捕まえた`, [`場所：${nm(th.k)}`], "good");
  if (why === "disguise") note(g, d.id, "🎯", `変装を見破った！${p.name}を捕まえた`, [`場所：${nm(th.k)}`], "good");
}
function escape(g, p, how) {
  const th = p.th;
  th.status = "escaped"; th.escTurn = g.turn; th.escHow = how; th.escK = th.k;
  g.prints = g.prints.filter(x => x.pid !== p.id);
  const hw = { heli: "ヘリで", disguise: "変装して", wire: "ワイヤー銃で" }[how];
  log(g, "all", `${p.name}が${hw}脱出しました（${nm(th.k)}・財宝${th.loot.length}個）`);
  alog(g, p.id, "脱出", { detail: how, to: nm(th.k), result: th.loot.map(id => g.tr.find(t => t.id === id).name).join("・") });
  note(g, p.id, "🎉", `${hw}脱出成功！`, [th.loot.length ? `持ち出した財宝：${th.loot.map(id => g.tr.find(t => t.id === id).name).join("・")}` : "財宝は持っていません（山分けはもらえます）"], "good");
}
function checkBackDoor(g) {
  if (g.backOpen) return;
  const act = thieves(g).filter(p => p.th.status === "active");
  if (act.length && act.every(p => p.th.heliCall != null)) {
    g.backOpen = true; log(g, "all", "捕縛されていない怪盗全員がヘリを呼んだので、裏口が開きました（変装していれば裏口からも脱出できます）");
  }
}
function resolveThieves(g) {
  const b = bld(g); const d = det(g).det;
  const ts = thieves(g).filter(p => p.th.tp);
  // 足跡：2ターン前のものを取り除き、1ターン前のものを薄くする
  g.prints = g.prints.filter(x => x.age === 0).map(x => Object.assign(x, { age: 1 }));
  for (const p of ts) {
    const th = p.th, tp = th.tp;
    if (th.status !== "active") continue;
    if (tp.dest == null) { tp.dest = th.k; tp.stay = true; tp.act = "none"; th.stats.timeouts++; }
    if (!tp.use.erase && g.turn > 1) g.prints.push({ pid: p.id, k: th.k, age: 0 });
    if (tp.use.fake != null) g.prints.push({ pid: p.id, k: tp.use.fake, age: 0, fake: true });
    const from = th.k; th.k = tp.dest;
    if (tp.stay || from === th.k) th.stats.stays++; else th.stats.moves++;
    alog(g, p.id, "移動", { from: nm(from), to: nm(th.k), dice: tp.die || "", detail: tp.stay ? "留まる" : "", result: tp.act || "none" });
  }
  // 変装パーツを拾う
  for (const p of ts) {
    const th = p.th; if (th.status !== "active" || !th.tp.pick) continue;
    const pt = g.parts.find(x => !x.taken && x.k === th.k);
    if (pt) { pt.taken = true; th.parts[pt.type] = (th.parts[pt.type] || 0) + 1; log(g, "th", `${p.name}が「${PARTS[pt.type]}」を拾いました`); alog(g, p.id, "変装パーツを拾う", { detail: PARTS[pt.type], to: nm(th.k) });
      const have = PART_KEYS.filter(t => (th.parts[t] || 0) > 0).length;
      note(g, p.id, "🧩", `変装パーツ「${PARTS[pt.type]}」を拾った`, [partsLine(th), have >= g.opt.partsNeed ? "変装の準備完了！正面ゲートに止まれば脱出できます" : `あと${g.opt.partsNeed - have}種類`], "good"); }
  }
  // 鉢合わせ
  for (const p of ts) if (p.th.status === "active" && d.k === p.th.k) capture(g, p, "meet", d.k);
  // 行動
  for (const p of ts) {
    const th = p.th, tp = th.tp; if (th.status !== "active") continue;
    if (tp.act === "unlock") {
      const tr = g.tr.find(t => !t.taken && t.k === th.k); if (!tr) continue;
      const roll = d6(); const tgt = tr.target - (tp.use.key ? 1 : 0); th.stats.unlockTry++;
      if (roll >= tgt) {
        tr.stage++; th.stats.unlockOk++;
        if (tr.stage >= tr.need) { tr.taken = true; tr.holder = p.id; th.loot.push(tr.id); log(g, "th", `${p.name}が「${tr.name}」を手に入れました`); note(g, p.id, "💎", `「${tr.name}」を手に入れた！`, [`出目 ${roll}（${tgt}以上で成功）`, `${tr.value.toLocaleString("ja-JP")}万円。脱出すれば山分けに入ります`], "good"); }
        else { log(g, "th", `${p.name}：「${tr.name}」のセキュリティを1段階解除（${tr.stage}/${tr.need}）`); note(g, p.id, "🔐", `解除成功（${tr.stage}/${tr.need}段階）`, [`「${tr.name}」 出目 ${roll}（${tgt}以上で成功）`, `あと${tr.need - tr.stage}段階で手に入ります`], "good"); }
        alog(g, p.id, "解除", { dice: roll, detail: `${tr.name}（${tgt}以上で成功）`, to: nm(th.k), result: tr.taken ? "入手" : "1段階成功" });
      } else {
        tr.fails++; th.stats.fails++;
        log(g, "th", `${p.name}：「${tr.name}」の解除に失敗（失敗${tr.fails}回）`);
        let rang = false;
        if (tr.fails >= g.opt.alarmFails && !tr.alarm) { tr.alarm = true; th.alarmTrig = true; rang = true; log(g, "all", `🚨 警報！ ${nm(tr.k)} の「${tr.name}」で警報が鳴りました`); note(g, g.detId, "🚨", "警報が鳴った！", [`${nm(tr.k)} の「${tr.name}」`, "怪盗がいるか、近くにいたはずです"], "good"); }
        note(g, p.id, rang ? "🚨" : "❌", rang ? "解除失敗…警報が鳴った！" : "解除失敗", [`「${tr.name}」 出目 ${roll}（${tgt}以上で成功）`, rang ? "財宝の場所が探偵に知られました" : `この財宝の失敗 ${tr.fails}回（${g.opt.alarmFails}回で警報）`], "bad");
        alog(g, p.id, "解除", { dice: roll, detail: `${tr.name}（${tgt}以上で成功）`, to: nm(th.k), result: tr.alarm && th.alarmTrig ? "失敗・警報" : "失敗" });
      }
    } else if (tp.act === "release") {
      const c = thieves(g).find(q => q.id !== p.id && q.th.status === "captured" && q.th.k === th.k);
      if (c) { c.th.rel += tp.use.pick ? 2 : 1; c.th.relBy.push(p.id); log(g, "th", `${p.name}が ${c.name} の解放作業をしました（${Math.min(c.th.rel, c.th.relNeed)}/${c.th.relNeed}・そろうと次のターンの始めに解放）`); note(g, p.id, "🛠", `${c.name}の解放作業（${Math.min(c.th.rel, c.th.relNeed)}/${c.th.relNeed}）`, [c.th.rel >= c.th.relNeed ? "次のターンの始めに解放されます" : `あと${c.th.relNeed - c.th.rel}ターン分`], "info"); alog(g, p.id, "解放作業", { detail: c.name, to: nm(th.k), result: `${c.th.rel}/${c.th.relNeed}` }); }
    } else if (tp.act === "receive") {
      const c = thieves(g).find(q => q.id !== p.id && q.th.status === "captured" && q.th.k === th.k && q.th.loot.length);
      if (c) { th.pendingRecv = c.id; log(g, "th", `${p.name}が ${c.name} から財宝の受け取りを始めました（次のターンの始めに完了）`); note(g, p.id, "🤝", `${c.name}から財宝の受け取りを始めた`, ["次のターンの始めに受け取れます（そのときも同じマスにいること）"], "info"); alog(g, p.id, "受け取り開始", { detail: c.name, to: nm(th.k) }); }
    }
  }
  // 警報器
  for (const p of ts) {
    if (p.th.status !== "active") continue;
    const i = g.devices.indexOf(p.th.k);
    if (i >= 0) { g.devices.splice(i, 1); d.info.push({ r: g.round, t: g.turn, m: `🔔 警報器：${nm(p.th.k)} に怪盗が止まりました` }); log(g, "det", `🔔 警報器：${nm(p.th.k)} に怪盗が止まりました`); alog(g, p.id, "警報器に反応", { to: nm(p.th.k) });
      note(g, g.detId, "🔔", "警報器が作動した！", [`${nm(p.th.k)} に怪盗が止まりました`], "good");
      note(g, p.id, "🔔", "警報器に引っかかった！", [`${nm(p.th.k)} にいることが探偵に知られました`], "bad"); }
  }
  // 脱出
  for (const p of ts) {
    const th = p.th, tp = th.tp; if (th.status !== "active") continue;
    if (tp.act === "wire" && b.windows.includes(th.k) && th.items.includes("wire")) { th.items.splice(th.items.indexOf("wire"), 1); th.stats.items++; escape(g, p, "wire"); continue; }
    if (b.roof.includes(th.k) && th.heliCall != null && g.turn >= th.heliCall + 2 && g.turn <= th.heliCall + 3) { escape(g, p, "heli"); continue; }
    const exit = th.k === b.front || (g.backOpen && th.k === b.back);
    if (exit && partsDone(g, th)) {
      if (d.k != null && dist(d.k, th.k) <= 2) capture(g, p, "disguise");
      else escape(g, p, "disguise");
    }
  }
  // 張り込み
  if (d.ambush != null) {
    const hitA = ts.filter(p => p.th.status === "active" && dist(p.th.k, d.ambush) <= 1);
    hitA.forEach(p => capture(g, p, "ambush", d.ambush));
    if (!hitA.length) note(g, g.detId, "💨", "張り込みは空振り", [`${nm(d.ambush)} とその上下左右に怪盗はいませんでした`], "bad");
    d.ambush = null;
  }
  checkBackDoor(g);
  for (const p of thieves(g)) if (p.th.tp) p.th.tp.done = true;
  if (!thieves(g).some(p => p.th.status === "active")) { endRound(g, "怪盗が全員、脱出か捕縛になりました"); return; }
  startDetTurn(g);
}

/* ---------- 探偵の調査：財宝・変装パーツのマスに止まると、そこの今の状況が分かる ---------- */
function inspect(g, p) {
  const d = p.det; const k = d.k; if (k == null) return [];
  const out = [];
  d.known = d.known || { tr: {}, parts: {} };
  const tr = g.tr.find(t => t.k === k);
  if (tr) {
    d.known.tr[tr.id] = { taken: tr.taken, stage: tr.stage, need: tr.need, fails: tr.fails, t: g.turn };
    const m = tr.taken ? `調査：${nm(k)}「${tr.name}」は すでに盗まれていた` : `調査：${nm(k)}「${tr.name}」はまだある（解除 ${tr.stage}/${tr.need}段階・失敗${tr.fails}回）`;
    d.info.push({ r: g.round, t: g.turn, m }); log(g, "det", m); alog(g, p.id, "調査", { to: nm(k), result: m }); out.push("🔍 " + m);
  }
  const pt = g.parts.find(x => x.k === k);
  if (pt) {
    d.known.parts[pt.id] = { taken: pt.taken, t: g.turn };
    const m = `調査：${nm(k)} の変装パーツ「${PARTS[pt.type]}」は ${pt.taken ? "なくなっていた" : "まだある"}`;
    d.info.push({ r: g.round, t: g.turn, m }); log(g, "det", m); alog(g, p.id, "調査", { to: nm(k), result: m }); out.push("🔍 " + m);
  }
  return out;
}
E.inspect = inspect;

/* ---------- 探偵の操作 ---------- */
function detAct(g, p, a) {
  const d = p.det;
  if (g.phase !== "play" || g.stage !== "det") return "今は探偵のターンではありません";
  const tp = d.tp;
  if (a.kind === "skill") return useSkill(g, p, a);
  if (a.kind === "roll") {
    if (tp.roll != null || tp.stay) return "サイコロはもう振っています";
    const n = d6(); tp.die = n; tp.roll = n + d.sprint; const sp = d.sprint; d.sprint = 0;
    alog(g, p.id, "サイコロ", { dice: n, detail: `${g.step}回目${sp ? "・全力疾走+3" : ""}` });
    return null;
  }
  if (a.kind === "stay") { if (tp.roll != null) return "サイコロを振ったあとは、出た目以内で好きなマスを選んでください"; tp.stay = true; tp.roll = 0; tp.dest = d.k; return null; }
  if (a.kind === "dest") {
    if (tp.roll == null) return "先にサイコロを振るか、その場に留まってください";
    if (!reach(g, d.k, tp.roll).includes(a.k)) return "そのマスには届きません";
    tp.dest = a.k; return null;
  }
  if (a.kind === "act") {
    if (tp.dest == null) return "移動先を選んでください";
    const act = a.act;
    if (act === "ambush" && !tp.stay) return "張り込みは、その場から動かないときだけ選べます（「その場に留まる」を選んでください）";
    if (!["capture", "ambush", "pass"].includes(act)) return "行動を選んでください";
    let targets = [];
    if (act === "capture") {
      const base = g.opt.capture === "near2" ? a.target : tp.dest;
      if (base == null) return "捜査するマスを選んでください";
      if (g.opt.capture === "near2" && dist(base, tp.dest) > 2) return "移動先から2マス以内のマスを選んでください";
      targets = [base];
      if (d.net) neighbors(g, base).filter(k => FL(k) === FL(base)).forEach(k => targets.push(k));
    }
    const from = d.k; d.k = tp.dest; const insp = inspect(g, p);
    alog(g, p.id, "移動", { from: nm(from), to: nm(d.k), dice: tp.die || "", detail: `${g.step}回目${tp.stay ? "・留まる" : ""}`, result: act });
    // オイル
    const oi = g.oils.findIndex(o => o.k === d.k);
    if (oi >= 0) {
      g.oils.splice(oi, 1);
      log(g, "det", `オイルで滑りました（${nm(d.k)}）。このターンの残りの行動はできません`);
      log(g, "th", `探偵が ${nm(d.k)} のオイルを踏みました`);
      g.reveals.push({ r: g.round, t: g.turn, k: d.k, text: `探偵は ${nm(d.k)} でオイルを踏んだ` });
      alog(g, p.id, "オイルを踏んだ", { to: nm(d.k) });
      note(g, p.id, "🛢", "オイルで滑った！", [`${nm(d.k)} に怪盗のオイルが仕掛けてありました`, "このターンの残りの行動はできません", "踏んだ場所は怪盗に知られました", ...insp], "bad");
      thieves(g).filter(q => q.th.status !== "escaped").forEach(q => note(g, q.id, "🛢", "探偵がオイルを踏んだ！", [`場所：${nm(d.k)}`], "good"));
      return endDetTurn(g);
    }
    if (act === "capture") {
      const hit = thieves(g).filter(q => q.th.status === "active" && targets.includes(q.th.k));
      if (g.opt.capture === "near2") g.searchMarks.push({ k: targets[0], t: g.turn });
      if (hit.length) { hit.forEach(q => capture(g, q, "det", d.k)); note(g, p.id, "🎯", `捕縛成功！${hit.map(q => q.name).join("・")}を捕まえた`, [`場所：${[...new Set(hit.map(q => nm(q.th.k)))].join("・")}`, ...insp], "good"); }
      else { log(g, "det", `${targets.map(nm).join("・")} には誰もいませんでした`); note(g, p.id, "💨", "空振り…誰もいなかった", [`調べたマス：${targets.map(nm).join("・")}`, ...insp], "bad"); }
      alog(g, p.id, "捕縛", { to: targets.map(nm).join("・"), result: hit.length ? hit.map(q => q.name).join("・") : "空振り" });
    } else if (act === "ambush") {
      d.ambush = d.k; log(g, "det", `${nm(d.k)} で張り込みを始めました（次の怪盗のターン終了時、上下左右1マスにいる怪盗も捕縛）`); alog(g, p.id, "張り込み", { to: nm(d.k) });
      if (insp.length) note(g, p.id, "🔍", "調査結果", insp, "info");
      return endDetTurn(g);
    } else { alog(g, p.id, "パス", {}); if (insp.length) note(g, p.id, "🔍", "調査結果", insp, "info"); }
    // 動ける怪盗がいなくなったら探偵のターンは終わり。ラウンドの終了は次の怪盗のターン終了時に判定する（縄抜けのチャンスを残す）
    if (!thieves(g).some(q => q.th.status === "active")) {
      if (!thieves(g).some(q => q.th.status === "captured")) { endRound(g, "怪盗が全員、脱出か捕縛になりました"); return null; }
      return endDetTurn(g);
    }
    if (g.step >= 2) return endDetTurn(g);
    g.step = 2; d.tp = { roll: null, stay: false, dest: null };
    return null;
  }
  if (a.kind === "endTurn") { alog(g, p.id, "ターン終了", { detail: `${g.step}回目で終了` }); return endDetTurn(g); }
  return "不明な操作です";
}
function useSkill(g, p, a) {
  const d = p.det; const s = SKILLS[a.id];
  if (!g.opt.skills) return "このテストではスキルを使わない設定です";
  if (!s || !d.skills.includes(a.id)) return "そのスキルは持っていません";
  if (d.blackout) return "停電中なので、このターンはスキルを使えません";
  if ((d.cd[a.id] || 0) > 0) return `あと${d.cd[a.id]}ターン使えません`;
  let msg = "";
  const act = thieves(g).filter(q => q.th.status === "active");
  if (a.id === "ask") {
    if (!a.area || !"ABCDEFGH".includes(a.area)) return "エリアを選んでください";
    const n = act.filter(q => areaOf(q.th.k) === a.area).length; msg = `聞き込み：エリア${a.area}にいる怪盗は ${n}人`;
  } else if (a.id === "sense") {
    const n = act.filter(q => dist(q.th.k, d.k) <= 2).length; msg = `気配察知：${nm(d.k)} から2マス以内に怪盗は ${n ? "いる" : "いない"}`;
  } else if (a.id === "floor") {
    const f0 = act.filter(q => FL(q.th.k) === 0).length; msg = `フロア照会：1階に${f0}人・2階に${act.length - f0}人`;
  } else if (a.id === "sprint") {
    if (d.tp.roll != null) return "全力疾走は、サイコロを振る前に使います"; d.sprint = 3; msg = "全力疾走：次に振るサイコロの出目+3";
  } else if (a.id === "net") { d.net = true; msg = "包囲網：このターンの捕縛は上下左右1マスも対象"; }
  else if (a.id === "block") {
    const i = +a.stair; if (!(i >= 0 && i < bld(g).stairs.length)) return "階段を選んでください";
    g.blocks.push({ i, until: g.turn + 2 }); const sp = bld(g).stairs[i];
    msg = `封鎖：${nm(sp[0])}／${nm(sp[1])} の階段を${g.turn + 2}ターン目の終わりまで封鎖`;
    log(g, "all", `${nm(sp[0])}／${nm(sp[1])} の階段が封鎖されました（${g.turn + 2}ターン目の終わりまで）`);
  } else if (a.id === "seize") {
    const c = P(g, a.pid); if (!c || !c.th || c.th.status !== "captured") return "捕縛中の怪盗を選んでください";
    c.th.relNeed++; msg = `証拠押収：${c.name}の解放に必要な作業が${c.th.relNeed}ターン分になりました`; log(g, "all", `${c.name}の証拠が押収されました（解放に必要な作業 ${c.th.relNeed}）`);
  } else if (a.id === "jump") {
    if (d.tp.roll != null || d.tp.stay) return "階段跳びは、サイコロを振る前に使います"; const from = d.k; d.k = otherFloor(d.k); msg = `階段跳び：${nm(from)} → ${nm(d.k)}`;
  } else if (a.id === "secure") {
    const tr0 = g.tr.find(t => t.k === d.k); if (!tr0) return "財宝のマスにいるときだけ使えます";
    if (tr0.taken) { const ins = inspect(g, p); note(g, p.id, "🔍", "この財宝はもう盗まれていました", ins, "bad"); return null; }
    const tr = tr0;
    if (tr.secured) return "この財宝にはもう使っています";
    tr.secured = true; tr.need++; msg = `セキュリティ強化：「${tr.name}」の解除段階が${tr.need}段階になりました`;
    log(g, "all", `探偵が ${nm(d.k)} の「${tr.name}」のセキュリティを強化しました`); g.reveals.push({ r: g.round, t: g.turn, k: d.k, text: `探偵は ${nm(d.k)} にいた（セキュリティ強化）` });
  } else if (a.id === "alarmdev") {
    if (g.devices.includes(d.k)) return "このマスにはもう仕掛けています"; g.devices.push(d.k); msg = `警報器：${nm(d.k)} に仕掛けました`;
  }
  if (s.ct > 0) d.cd[a.id] = s.ct + 1;
  d.info.push({ r: g.round, t: g.turn, m: msg }); log(g, "det", msg);
  note(g, p.id, "🔎", s.name, [msg.replace(/^[^：]+：/, "")], "info");
  alog(g, p.id, "スキル", { detail: s.name, to: nm(d.k), result: msg });
  return null;
}
function endDetTurn(g) {
  const p = det(g); const d = p.det;
  d.net = false; d.sprint = 0;
  if (g.bugNext) { g.bugNext = false; g.floorHint = { t: g.turn, f: FL(d.k) }; log(g, "th", `盗聴器：探偵は今 ${FL(d.k) + 1}階にいます`); thieves(g).filter(q => q.th.status !== "escaped").forEach(q => note(g, q.id, "🎧", `盗聴器：探偵は今 ${FL(d.k) + 1}階`, [], "good")); }
  if (g.turn >= g.opt.turns) { endRound(g, `${g.opt.turns}ターンが終わりました`); return null; }
  g.turn++; startThiefTurn(g);
  return null;
}

/* ---------- 準備フェーズ ---------- */
function detStartOK(g, k) {
  if (!(k >= 64 && k < 128)) return false;
  if (fixedList(g).includes(k)) return false;
  if ((g.tr || []).some(t => t.k === k) || (g.parts || []).some(x => x.k === k)) return false;
  return true;
}
E.detStartOK = detStartOK;
function setupAct(g, p, a) {
  if (a.kind === "setupDet") {
    if (!p.det) return "探偵ではありません";
    if (p.det.ready) return "準備はもう終わっています";
    const k = +a.k; if (!(k >= 64 && k < 128)) return "スタートは2階のマスから選んでください";
    if (!detStartOK(g, k)) return "スタートは何もないマスから選んでください（財宝・変装パーツ・階段・窓・屋上階段のマスは選べません）";
    let sk = [];
    if (g.opt.skills) { sk = [...new Set(a.skills || [])].filter(x => SKILLS[x]); if (sk.length !== 4) return "スキルを4つ選んでください"; }
    p.det.k = k; p.det.skills = sk; p.det.ready = true; inspect(g, p);
    log(g, "all", "探偵の準備ができました");
    alog(g, p.id, "探偵の準備", { to: nm(k), detail: sk.map(x => SKILLS[x].name).join("・") });
  } else if (a.kind === "declare") {
    if (!p.th) return "怪盗ではありません";
    if (p.th.declared != null) return "もう決めています";
    const sk = +a.start; if (!bld(g).starts.includes(sk)) return "スタート地点を選んでください";
    p.th.k = sk; p.th.declared = !!a.yes;
    alog(g, p.id, "スタート地点", { to: nm(sk) });
    alog(g, p.id, "予告状", { detail: NOTICES[p.th.notice].name, result: a.yes ? "予告する" : "予告しない" });
  } else return "不明な操作です";
  if (det(g).det.ready && thieves(g).every(q => q.th.declared != null)) {
    const open = thieves(g).filter(q => q.th.declared);
    log(g, "all", open.length ? "予告状が公開されました：" + open.map(q => `${q.name}「${NOTICES[q.th.notice].text}」`).join("／") : "予告した怪盗はいませんでした");
    g.phase = "play"; g.turn = 1;
    startThiefTurn(g);
  }
  return null;
}

/* ---------- ラウンドの終わりと精算 ---------- */
function pay(g, p, amt, why) { if (amt <= 0) return; if (p.money >= amt) p.money -= amt; else { p.debt += amt - p.money; p.money = 0; } p.rd.earn[why] = (p.rd.earn[why] || 0) - amt; }
function gain(p, amt, why) { if (amt <= 0) return; p.money += amt; p.rd.earn[why] = (p.rd.earn[why] || 0) + amt; }
function noticeOK(g, p) {
  const th = p.th; if (th.status !== "escaped" || !th.loot.length) return false;
  const tr = id => g.tr.find(t => t.id === id);
  switch (th.notice) {
    case "top": return th.loot.some(id => tr(id).rank === "high");
    case "disguise": return th.escHow === "disguise" && th.escK === bld(g).front;
    case "early": return th.escTurn <= 8;
    case "noalarm": return !th.alarmTrig;
    case "upheli": return th.escHow === "heli" && th.loot.some(id => tr(id).floor === 1);
  }
  return false;
}
E.noticeOK = noticeOK;
function endRound(g, why) {
  const ts = thieves(g); const dp = det(g); const d = dp.det;
  ts.forEach(p => { if (p.th.status === "active") { p.th.status = "failed"; log(g, "all", `${p.name}は脱出できませんでした（脱出失敗）`); } });
  const pot = ts.filter(p => p.th.status === "escaped").reduce((s, p) => s + p.th.loot.reduce((a, id) => a + g.tr.find(t => t.id === id).value, 0), 0);
  const nT = ts.length; const share = Math.floor(pot / nT / 100) * 100;
  ts.forEach(p => {
    const th = p.th;
    gain(p, share, "山分け");
    const ok = noticeOK(g, p); th.noticeOK = ok;
    if (ok) gain(p, th.declared ? MONEY.noticeOpen : MONEY.noticeHidden, "予告状");
    if (th.status === "escaped" && th.loot.length) gain(p, th.escTurn <= 5 ? MONEY.flair[0] : th.escTurn <= 8 ? MONEY.flair[1] : MONEY.flair[2], "華麗さ");
    gain(p, th.rescues * MONEY.rescue, "救出");
  });
  const capturedNow = ts.filter(p => p.th.status === "captured");
  capturedNow.forEach(() => ts.forEach(p => pay(g, p, MONEY.bail, "保釈金"))); // 保釈金は銀行へ
  gain(dp, capturedNow.length * MONEY.endCap, "捕縛の報奨金");
  gain(dp, Object.values(d.capBy || {}).reduce((a, n) => a + Math.min(n, MONEY.capMax), 0) * MONEY.capture, "累計捕縛"); // 同じ怪盗は2回まで
  gain(dp, ts.filter(p => p.th.status === "failed").length * MONEY.failed, "脱出失敗");
  gain(dp, ts.filter(p => p.th.declared && !p.th.noticeOK).length * MONEY.block, "予告阻止");
  g.players.forEach(p => { if (p.det) p.total.det += (p.money - p.debt) - p.rd.start; });
  // 記録
  g.players.forEach(p => {
    const th = p.th; const e = p.rd.earn; const st = th ? th.stats : null;
    g.records.push({
      gid: g.gid, round: g.round, name: p.name, role: p.det ? "探偵" : "怪盗", endReason: why, endTurn: g.turn,
      status: th ? { escaped: "脱出成功", captured: "捕縛", failed: "脱出失敗" }[th.status] : "",
      escHow: th && th.escHow ? { heli: "ヘリ", disguise: "変装", wire: "ワイヤー銃" }[th.escHow] : "", escTurn: th ? th.escTurn || "" : "",
      loot: th ? th.loot.map(id => g.tr.find(t => t.id === id).name).join("・") : "",
      lootValue: th ? th.loot.reduce((a, id) => a + g.tr.find(t => t.id === id).value, 0) : "",
      notice: th ? NOTICES[th.notice].name : "", declared: th ? (th.declared ? "予告" : "非公開") : "", noticeOK: th ? (th.noticeOK ? "達成" : "未達成") : "",
      share: e["山分け"] || 0, noticeBonus: e["予告状"] || 0, flair: e["華麗さ"] || 0, rescue: e["救出"] || 0, bail: e["保釈金"] || 0, endCapReward: e["捕縛の報奨金"] || 0,
      capReward: e["累計捕縛"] || 0, failReward: e["脱出失敗"] || 0, blockReward: e["予告阻止"] || 0,
      delta: (p.money - p.debt) - p.rd.start, money: p.money, debt: p.debt, net: p.money - p.debt,
      captures: p.det ? p.det.captured.length : "", capN: p.det ? p.det.capN : "", capPaid: p.det ? Object.values(p.det.capBy || {}).reduce((a, n) => a + Math.min(n, MONEY.capMax), 0) : "",
      moves: st ? st.moves : "", stays: st ? st.stays : "", unlockTry: st ? st.unlockTry : "", unlockOk: st ? st.unlockOk : "", fails: st ? st.fails : "",
      rescues: th ? th.rescues : "", items: st ? st.items : "", timeouts: st ? st.timeouts : "", heliTurn: th && th.heliCall != null ? th.heliCall : "",
      alarms: g.tr.filter(t => t.alarm).length, treasuresTaken: g.tr.filter(t => t.taken).length, pot, skills: p.det ? p.det.skills.map(x => SKILLS[x].name).join("・") : "",
    });
  });
  g.phase = "roundEnd"; g.stage = null; g.roundEndWhy = why;
  log(g, "all", `第${g.round}ラウンド終了：${why}。持ち出した財宝 ${pot}万円・山分け 1人${share}万円`);
  alog(g, null, "ラウンド終了", { detail: why, result: `持ち出し${pot}・山分け${share}` });
}
function nextRound(g) {
  if (g.phase !== "roundEnd") return "ラウンドが終わっていません";
  if (g.round >= g.rounds) { g.phase = "end"; log(g, "all", "ゲーム終了"); alog(g, null, "ゲーム終了", {}); return null; }
  startRound(g); return null;
}

/* ---------- 操作の入口 ---------- */
function applyAction(g, pid, a) {
  if (!a || !a.kind) return "操作が空です";
  const p = P(g, pid);
  if (a.kind === "start") { if (g.phase !== "lobby") return "もう始まっています"; return startGame(g); }
  if (a.kind === "nextRound") return nextRound(g);
  if (!p) return "プレイヤーが見つかりません";
  if (g.phase === "setup") return setupAct(g, p, a);
  if (g.phase !== "play") return "今は操作できません";
  if (p.det) return detAct(g, p, a);
  if (p.th) return thiefAct(g, p, a);
  return "不明な操作です";
}
function safeApply(g, pid, a, fn) {
  const backup = JSON.stringify(g);
  try { return withRng(g, () => (fn ? fn() : applyAction(g, pid, a))); }
  catch (e) {
    const b = JSON.parse(backup); for (const k of Object.keys(g)) delete g[k]; Object.assign(g, b);
    (g.errors = g.errors || []).push({ at: Date.now(), round: g.round, turn: g.turn, stage: g.stage, pid, a, msg: String(e && e.message), stack: String(e && e.stack).slice(0, 800) });
    if (typeof console !== "undefined") console.error(e);
    return "内部エラーが起きたので、この操作は取り消しました：" + (e && e.message);
  }
}
E.applyAction = applyAction; E.safeApply = safeApply; E.withRng = withRng;

/* 待っている人と、代わりに進める処理（スリープ・時間切れ用） */
function pendingIds(g) {
  if (g.phase === "setup") { const out = []; const d = det(g); if (!d.det.ready) out.push(d.id); thieves(g).forEach(p => { if (p.th.declared == null) out.push(p.id); }); return out; }
  if (g.phase !== "play") return [];
  if (g.stage === "thief") return thieves(g).filter(p => p.th.tp && !p.th.tp.done).map(p => p.id);
  if (g.stage === "det") return [g.detId];
  return [];
}
function proxyAct(g, pid) {
  const p = P(g, pid); if (!p) return "プレイヤーがいません";
  if (g.phase === "setup") {
    if (p.det && !p.det.ready) { const sk = shuffle(Object.keys(SKILLS)).slice(0, 4); const ok = Array.from({ length: 64 }, (_, i) => 64 + i).filter(k => detStartOK(g, k)); return setupAct(g, p, { kind: "setupDet", k: ok[rnd(ok.length)], skills: sk }); }
    if (p.th && p.th.declared == null) { const st = bld(g).starts; return setupAct(g, p, { kind: "declare", yes: false, start: st[rnd(st.length)] }); }
    return null;
  }
  if (g.phase !== "play") return null;
  if (p.th && p.th.tp && !p.th.tp.done) {
    const tp = p.th.tp;
    if (p.th.status === "captured") { tp.done = true; checkThiefDone(g); return null; }
    if (tp.dest == null) { tp.dest = p.th.k; tp.stay = true; tp.roll = 0; p.th.stats.timeouts++; }
    tp.act = "none"; tp.pick = false; tp.done = true; checkThiefDone(g); return null;
  }
  if (p.det && g.stage === "det") { alog(g, p.id, "代わりに進めた", {}); return endDetTurn(g); }
  return null;
}
E.pendingIds = pendingIds; E.proxyAct = proxyAct;

/* ---------- 見せる情報（隠すべきものを取り除く） ---------- */
function viewFor(g, pid) {
  const me = P(g, pid);
  const role = me ? (me.det ? "det" : me.th ? "thief" : null) : null;
  const reveal = g.phase === "roundEnd" || g.phase === "end";
  const dp0 = g.detId ? P(g, g.detId) : null; const known = role === "det" && dp0 && dp0.det ? dp0.det.known || { tr: {}, parts: {} } : null;
  const isTh = role === "thief" || reveal, isDet = role === "det" || reveal;
  const v = {
    v: g.v, gid: g.gid, phase: g.phase, round: g.round, rounds: g.rounds, turn: g.turn, stage: g.stage, step: g.step, opt: g.opt, undos: g.undos,
    building: bld(g).name, bid: g.building || "museum", detId: g.detId, me: pid, role, roundEndWhy: g.roundEndWhy,
    players: g.players.map(p => ({ id: p.id, name: p.name, color: p.color, money: p.money, debt: p.debt, connected: p.connected, role: p.det ? "det" : p.th ? "thief" : null,
      status: p.th ? p.th.status : null, heliCall: p.th ? p.th.heliCall : null, declared: p.th ? p.th.declared : null, totalDet: p.total ? p.total.det : 0,
      notice: p.th && (p.th.declared || reveal || p.id === pid) ? p.th.notice : null, noticeOK: p.th && reveal ? !!p.th.noticeOK : null,
      capK: p.th && p.th.status === "captured" ? p.th.k : null, rel: p.th && p.th.status === "captured" ? p.th.rel : null, relNeed: p.th ? p.th.relNeed : null,
      itemCount: p.th ? p.th.items.length : null })),
    tr: (g.tr || []).map(t => ({ id: t.id, rank: t.rank, name: t.name, value: t.value, k: t.k, taken: isTh ? t.taken : false, alarm: t.alarm, secured: t.secured,
      stage: isTh ? t.stage : null, need: isTh ? t.need : null, fails: isTh ? t.fails : null, target: t.target, holder: isTh ? t.holder : null,
      seen: !isTh && known ? known.tr[t.id] || null : null })),
    parts: (g.parts || []).map(x => ({ id: x.id, type: x.type, k: x.k, taken: isTh ? x.taken : false, seen: !isTh && known ? known.parts[x.id] || null : null })),
    prints: (g.prints || []).map(x => ({ pid: x.pid, k: x.k, age: x.age, fake: isTh ? !!x.fake : false })),
    backOpen: g.backOpen, blocks: blockedStairs(g), reveals: g.reveals || [], searchMarks: (g.searchMarks || []).filter(m => m.t >= g.turn - 1),
    floorHint: isTh ? g.floorHint : null, oils: isTh ? g.oils : [], records: g.records, errorsN: (g.errors || []).length,
    log: g.log.filter(l => l.vis === "all" || l.vis === pid || (l.vis === "th" && isTh) || (l.vis === "det" && isDet)).slice(-250),
    pending: pendingIds(g),
    notes: (g.notes || []).filter(n => n.to.includes(pid) && n.r === g.round).slice(-20),
  };
  if (isTh) v.thieves = thieves(g).map(p => ({ id: p.id, k: p.th.k, status: p.th.status, loot: p.th.loot, parts: p.th.parts, heliCall: p.th.heliCall,
    tp: p.th.tp ? { done: p.th.tp.done, roll: p.th.tp.roll, dest: p.th.tp.dest, act: p.th.tp.act || null } : null, escHow: p.th.escHow, escTurn: p.th.escTurn }));
  if (isDet && det(g)) { const d = det(g).det; v.det = { k: d.k, skills: d.skills, cd: d.cd, ready: d.ready, ambush: d.ambush, tp: d.tp || null, net: d.net, sprint: d.sprint, blackout: d.blackout, info: d.info.slice(-30), devices: g.devices, captured: d.captured }; }
  if (role === "thief") { const th = me.th; v.my = { items: th.items, notice: th.notice, declared: th.declared, tp: th.tp, k: th.k, status: th.status, options: th.tp && th.tp.dest != null ? thiefOptions(g, me, th.tp.dest) : [] }; }
  if (reveal) { v.revealAll = true; v.alogN = g.alog.length; }
  return v;
}
E.viewFor = viewFor;

/* ---------- 記録の書き出し ---------- */
const q = x => { const t = x === null || x === undefined ? "" : String(x); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
function toCSV(cols, rows) { return "﻿" + [cols.map(c => q(c[1])).join(","), ...rows.map(r => cols.map(c => q(r[c[0]])).join(","))].join("\r\n"); }
E.ACT_COLS = [["at", "時刻"], ["round", "ラウンド"], ["turn", "ターン"], ["stage", "場面"], ["name", "プレイヤー"], ["role", "役"], ["kind", "操作"], ["from", "移動元"], ["to", "移動先・対象"], ["dice", "出目"], ["detail", "内容"], ["result", "結果"]];
E.REC_COLS = [["round", "ラウンド"], ["name", "名前"], ["role", "役"], ["status", "結果"], ["escHow", "脱出方法"], ["escTurn", "脱出ターン"], ["loot", "持ち出した財宝"], ["lootValue", "財宝の額"],
  ["notice", "予告状"], ["declared", "予告"], ["noticeOK", "予告達成"], ["share", "山分け"], ["noticeBonus", "予告状ボーナス"], ["flair", "華麗さ"], ["rescue", "救出"], ["bail", "保釈金"],
  ["endCapReward", "捕縛の報奨金"], ["capReward", "累計捕縛"], ["failReward", "脱出失敗の報酬"], ["blockReward", "予告阻止"], ["delta", "このラウンドの増減"], ["money", "所持金"], ["debt", "借金"], ["net", "差し引き"],
  ["captures", "捕縛した人数"], ["capN", "捕縛回数"], ["capPaid", "報酬の対象になった捕縛回数"], ["moves", "移動回数"], ["stays", "留まった回数"], ["unlockTry", "解除の挑戦"], ["unlockOk", "解除の成功"], ["fails", "解除の失敗"],
  ["rescues", "解放した回数"], ["items", "使ったアイテム"], ["timeouts", "時間切れ"], ["heliTurn", "ヘリを呼んだターン"], ["alarms", "鳴った警報"], ["treasuresTaken", "盗まれた財宝"], ["pot", "持ち出し合計"], ["skills", "探偵のスキル"], ["endReason", "終了理由"], ["endTurn", "終了ターン"]];
E.csvActions = g => toCSV(E.ACT_COLS, g.alog.map(r => Object.assign({}, r, { at: new Date(r.at).toLocaleString("ja-JP") })));
E.csvRecords = g => toCSV(E.REC_COLS, g.records);
E.finalRanking = g => g.players.map(p => ({ name: p.name, net: p.money - p.debt, det: p.total ? p.total.det : 0 })).sort((a, b) => b.net - a.net || b.det - a.det);

E.clone = clone;
if (typeof module !== "undefined" && module.exports) module.exports = E; else root.IMUKAT = E;
})(typeof window !== "undefined" ? window : globalThis);
