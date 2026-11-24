/* IMUKAT CPU（かんたん／ふつう）
   ・CPUは viewFor（自分に見える情報）だけを見て考える。隠れた情報（探偵の位置・怪盗の位置など）は使わない。
   ・decide(E, g, pid) は「次の1手」（操作オブジェクト）を返す。1回で1手だけ返し、呼ぶ側が safeApply する。
   ・CPUの記憶（追いかけている財宝など）は g.cpuMem[pid] に置く（画面には送られない）。 */
(function (root) {
  const C = {};
  const LV = { easy: "かんたん", normal: "ふつう" };
  C.LEVELS = LV;
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const chance = p => Math.random() < p;

  // 全マスへの距離（階段・封鎖も考える）。sources からの最短歩数
  function distMap(E, g, sources) {
    const d = new Array(128).fill(99); const q = [];
    sources.forEach(k => { if (k != null && d[k] > 0) { d[k] = 0; q.push(k); } });
    while (q.length) { const k = q.shift(); for (const nb of E.neighbors(g, k)) if (d[nb] > d[k] + 1) { d[nb] = d[k] + 1; q.push(nb); } }
    return d;
  }
  const mem = (g, pid) => { g.cpuMem = g.cpuMem || {}; return (g.cpuMem[pid] = g.cpuMem[pid] || {}); };

  C.decide = function (E, g, pid) {
    const p = E.P(g, pid); if (!p || !p.cpu) return null;
    const lv = p.cpu === "normal" ? "normal" : "easy";
    const v = E.viewFor(g, pid);
    if (v.phase === "setup") return v.role === "det" ? detSetup(E, g, v, lv) : thiefSetup(E, g, v, lv);
    if (v.phase !== "play") return null;
    if (v.role === "thief" && v.stage === "thief") return thiefTurn(E, g, v, lv, mem(g, pid));
    if (v.role === "det" && v.stage === "det") return detTurn(E, g, v, lv, mem(g, pid));
    return null;
  };

  /* ================= 準備 ================= */
  function detSetup(E, g, v, lv) {
    if (!v.det || v.det.ready) return null;
    const offer = v.det.offer || Object.keys(E.SKILLS);
    let sk;
    if (lv === "normal") {
      const pref = ["ask", "net", "sense", "sprint", "floor", "jump", "alarmdev", "seize", "secure", "block"];
      sk = pref.filter(x => offer.includes(x)).slice(0, 4);
    } else sk = offer.slice().sort(() => Math.random() - .5).slice(0, 4);
    if ((v.opt.skillMode || "draft") === "random") sk = offer.slice(0, 4);
    const ok = Array.from({ length: 64 }, (_, i) => 64 + i).filter(k => E.detStartOK(g, k));
    let k = pick(ok);
    if (lv === "normal") { // 財宝に近い真ん中寄りのマス
      const trs = v.tr.map(t => t.k);
      const dm = distMap(E, g, trs);
      ok.sort((a, b) => (dm[a] + Math.abs(E.RW(a) - 3.5) * .3 + Math.abs(E.CL(a) - 3.5) * .3) - (dm[b] + Math.abs(E.RW(b) - 3.5) * .3 + Math.abs(E.CL(b) - 3.5) * .3));
      k = ok[rnd(Math.min(4, ok.length))];
    }
    return { kind: "setupDet", k, skills: sk };
  }
  function thiefSetup(E, g, v, lv) {
    const me = v.players.find(x => x.id === v.me);
    if (!me || me.declared != null) return null;
    const b = E.bld(g);
    let start = pick(b.starts);
    if (lv === "normal") { // いちばん良さそうな財宝に近いスタート（仲間とばらける）
      const taken = (v.thieves || []).filter(t => t.id !== v.me && t.k != null).map(t => t.k);
      const best = v.tr.slice().sort((a, b2) => b2.value - a.value)[rnd(2)] || v.tr[0];
      const dm = distMap(E, g, [best.k]);
      const st = b.starts.slice().sort((a, c) => (dm[a] + (taken.includes(a) ? 3 : 0)) - (dm[c] + (taken.includes(c) ? 3 : 0)));
      start = st[chance(.7) ? 0 : 1];
    }
    const easyNotice = ["early", "noalarm", "top"];
    const yes = lv === "normal" ? easyNotice.includes(v.my && v.my.notice) && chance(.5) : chance(.15);
    return { kind: "declare", yes, start };
  }

  /* ================= 怪盗 ================= */
  function thiefTurn(E, g, v, lv, m) {
    const my = v.my; if (!my || !my.tp || my.tp.done) return null;
    const tp = my.tp; const T = v.turn;
    if (m.t !== T || m.r !== v.round) { m.t = T; m.r = v.round; m.buy = false; m.item = false; m.used = []; }
    if (my.status === "captured") return thiefCaptured(E, g, v, lv, m);
    const b = E.bld(g); const me = v.thieves.find(t => t.id === v.me); const pl = v.players.find(x => x.id === v.me);
    const plan = thiefPlan(E, g, v, lv, m, me);
    const dm = distMap(E, g, plan.goals);
    const here = me.k; const dHere = dm[here];
    // --- サイコロの前 ---
    if (tp.roll == null && !tp.stay) {
      // ヘリを呼ぶ
      if (pl.heliCall == null && wantHeli(E, g, v, lv, me, plan)) return { kind: "heli" };
      // 買う
      if (!m.buy && v.opt.shop !== false && !tp.bought) { m.buy = true; const it = chooseBuy(E, g, v, lv, me, plan, dHere, pl); if (it) return { kind: "buy", item: it }; }
      // アイテム（サイコロの前に使うもの）
      if (!m.item) { m.item = true; const a = chooseItem(E, g, v, lv, me, plan, dHere); if (a) return a; }
      if (my.items.includes("spare") && !m.used.includes("spare")) { m.used.push("spare"); const miss = E.PART_KEYS.filter(t => !(me.parts[t] > 0)); if (miss.length) return { kind: "useItem", item: "spare", part: miss[0] }; }
      if (plan.stay || dHere === 0 && plan.stayAtGoal) return { kind: "stay" };
      return { kind: "roll" };
    }
    // --- 移動先 ---
    if (tp.dest == null || m.destT !== T) {
      m.destT = T;
      const opts = E.reach(g, here, tp.roll);
      const danger = lv === "normal" ? dangerMap(E, g, v) : null;
      const needParts = E.PART_KEYS.filter(t => !(me.parts[t] > 0));
      let best = here, bs = 1e9;
      for (const k of opts) {
        let s = dm[k] * 10;
        if (danger) s += danger[k];
        if (lv === "normal" && !E.partsDone(g, { parts: me.parts }) && v.parts.some(x => !x.taken && x.k === k && needParts.includes(x.type))) s -= 12;
        if (lv === "easy") s += Math.random() * 6;
        if (s < bs) { bs = s; best = k; }
      }
      if (tp.dest !== best) return { kind: "dest", k: best };
    }
    // --- 行動の確定前：仲間の絆・万能鍵・解除キット ---
    const dest = tp.dest;
    const capHere = v.thieves.filter(t => t.id !== v.me && t.status === "captured" && t.k === dest);
    if (capHere.length && my.items.includes("bond") && !tp.use.bond) return { kind: "useItem", item: "bond", pid: capHere[0].id };
    const opts = my.options || [];
    let act = "none";
    if (opts.includes("wire") && (me.loot.length || v.turn >= v.opt.turns - 2)) act = "wire";
    else if (opts.includes("release") && (lv === "normal" || chance(.7))) act = opts.includes("receive") && lv === "normal" && v.thieves.some(t => t.status === "captured" && t.k === dest && t.loot.length) && chance(.3) ? "receive" : "release";
    else if (opts.includes("unlock")) {
      const tr = v.tr.find(t => !t.taken && t.k === dest);
      if (tr) {
        act = "unlock";
        if (my.items.includes("key") && !tp.use.key && (lv === "normal" ? tr.rank !== "low" : chance(.5))) return { kind: "useItem", item: "key" };
        if (my.items.includes("kit") && !tp.use.kit && (lv === "normal" ? tr.fails >= (v.opt.alarmFails || 2) - 1 : chance(.5))) return { kind: "useItem", item: "kit" };
      }
    }
    const pickPart = lv === "easy" ? true : (() => { const pt = v.parts.find(x => !x.taken && x.k === dest); return !pt || !(me.parts[pt.type] > 0); })();
    return { kind: "confirm", act, pick: pickPart };
  }

  function thiefCaptured(E, g, v, lv, m) {
    const my = v.my; const tp = my.tp; const me = v.thieves.find(t => t.id === v.me); const pl = v.players.find(x => x.id === v.me);
    if (my.items.includes("rope")) return { kind: "useItem", item: "rope" };
    const left = v.opt.turns - v.turn;
    if (my.canRelease && !tp.tried && pl.money >= E.MONEY.release) {
      const teamFree = v.thieves.some(t => t.id !== v.me && t.status === "active");
      const want = lv === "normal" ? (me.loot.length > 0 && left >= 2 && (!teamFree || left <= 4)) || (!teamFree && left >= 4) : me.loot.length > 0 && left >= 3; // かんたん：財宝を持っているときだけ保釈
      if (want) return { kind: "release" };
    }
    if (v.opt.breakout > 0 && !tp.tried) return { kind: "breakout" };
    return { kind: "confirm" };
  }

  // 目的地を決める
  function thiefPlan(E, g, v, lv, m, me) {
    const b = E.bld(g); const T = v.turn; const left = v.opt.turns - T;
    const pl = v.players.find(x => x.id === v.me);
    const hc = pl.heliCall;
    const partsOK = E.partsDone(g, { parts: me.parts });
    const loot = me.loot.length > 0;
    const exits = b.fronts.concat(v.backOpen ? [b.back] : []);
    // 1) ヘリを呼んでいて、まだ間に合う → 屋上で待つ
    if (hc != null && T <= hc + 3) return { goals: b.roof, stayAtGoal: true, why: "heli" };
    // 2) 変装がそろった → 正面ゲート
    if (partsOK && (loot || left <= 4 || hc != null || lv === "easy")) return { goals: exits, why: "gate" };
    // 3) ワイヤー銃＋財宝 → 窓
    if (v.my.items.includes("wire") && (loot || left <= 3)) return { goals: b.windows, why: "wire" };
    // 4) 捕まった仲間を助ける
    const caps = v.thieves.filter(t => t.id !== v.me && t.status === "captured");
    if (caps.length) {
      const dmMe = distMap(E, g, [me.k]);
      const c = caps.sort((a, c2) => dmMe[a.k] - dmMe[c2.k])[0];
      const lim = lv === "normal" ? (loot ? 4 : 8) : 3;
      if (dmMe[c.k] <= lim && left >= 2 && !(loot && left <= 5)) return { goals: [c.k], stayAtGoal: true, why: "rescue" };
    }
    // 5) 財宝を持っている → 屋上（ヘリ）か、変装パーツ集め
    if (loot) {
      if (hc == null && T + 2 <= v.opt.turns) return { goals: b.roof, why: "toHeli" };
      // ヘリに乗り損ねた：ワイヤー銃 → 変装パーツ（そろえられそうなら）→ 正面ゲート
      if (v.my.items.includes("wire")) return { goals: b.windows, why: "wire" };
      const need = v.parts.filter(x => !x.taken && !(me.parts[x.type] > 0)).map(x => x.k);
      const have = E.PART_KEYS.filter(t => me.parts[t] > 0).length;
      if (need.length) return { goals: need, why: "parts" };
      return { goals: exits, why: "gate" };
    }
    // 6) 終盤で手ぶら → 逃げる準備
    if (left <= 3) {
      if (hc == null && T + 2 <= v.opt.turns) return { goals: b.roof, why: "toHeli" };
      const need = v.parts.filter(x => !x.taken && !(me.parts[x.type] > 0)).map(x => x.k);
      return { goals: partsOK ? exits : need.length ? need : exits, why: "late" };
    }
    // 7) 財宝を狙う
    const cand = v.tr.filter(t => !t.taken && t.holder == null);
    if (cand.length) {
      let tgt = cand.find(t => t.id === m.target);
      if (!tgt) {
        const dmMe = distMap(E, g, [me.k]);
        const others = v.thieves.filter(t => t.id !== v.me && t.status === "active").map(t => t.k);
        const score = t => {
          let s = t.value / 100 - dmMe[t.k] * (lv === "normal" ? 1.2 : 2);
          if (lv === "normal") { if (t.alarm) s -= 6; if (t.secured) s -= 3; if (others.some(k => k === t.k)) s -= 2; s -= (t.need - t.stage) * 1.5; }
          return s + Math.random() * (lv === "easy" ? 4 : 1);
        };
        tgt = cand.sort((a, c) => score(c) - score(a))[0]; m.target = tgt.id;
      }
      return { goals: [tgt.k], stayAtGoal: true, why: "treasure" };
    }
    // 8) 財宝がもうない → 変装パーツか屋上
    const need = v.parts.filter(x => !x.taken && !(me.parts[x.type] > 0)).map(x => x.k);
    if (need.length) return { goals: need, why: "parts" };
    return { goals: b.roof, why: "toHeli" };
  }

  function wantHeli(E, g, v, lv, me, plan) {
    const b = E.bld(g); const T = v.turn;
    if (T + 2 > v.opt.turns) return false;
    const left = v.opt.turns - T;
    if (lv === "normal" && me.loot.length && left <= 5 && T + 2 <= v.opt.turns) { // 終盤で財宝を持っていたら、屋上に間に合う距離ならすぐ呼ぶ
      const dr = distMap(E, g, E.bld(g).roof)[me.k]; if (dr <= 13) return true; }
    if (!(plan.why === "toHeli" || plan.why === "late" || (lv === "easy" && me.loot.length))) return false;
    const dm = distMap(E, g, b.roof); const d = dm[me.k];
    return lv === "normal" ? d <= 10 : true; // ヘリは2ターン後に来て、もう1ターン待つ
  }

  function chooseBuy(E, g, v, lv, me, plan, dHere, pl) {
    const money = pl.money; const has = it => v.my.items.includes(it);
    const ok = it => !has(it) && money >= E.ITEMS[it].shop + (lv === "normal" ? 200 : 0);
    if (lv === "easy") { if (!chance(.15)) return null; const c = E.SHOP.filter(ok); return c.length ? pick(c) : null; }
    const miss = E.PART_KEYS.filter(t => !(me.parts[t] > 0)).length;
    const need = (v.opt.partsNeed || 3) - (E.PART_KEYS.length - miss);
    const ok2 = it => ok(it) && money >= E.ITEMS[it].shop + 300;
    if (need === 1 && ok2("spare") && (me.loot.length || v.turn >= 7)) return "spare";
    if (plan.why === "treasure" && dHere <= 3) {
      const tr = v.tr.find(t => t.k === plan.goals[0]);
      if (tr && tr.rank === "high" && ok2("key")) return "key";
      if (tr && tr.fails >= 1 && tr.rank !== "low" && ok2("kit")) return "kit";
    }
    if (me.loot.length && plan.why === "heli" && dHere > 7 && ok2("shoes")) return "shoes";
    return null;
  }

  function chooseItem(E, g, v, lv, me, plan, dHere) {
    const its = v.my.items; const T = v.turn;
    const cand = [];
    if (its.includes("shoes") && (lv === "normal" ? dHere > 5 : chance(.4))) cand.push({ kind: "useItem", item: "shoes" });
    if (its.includes("scope") && (lv === "normal" ? me.loot.length || plan.why === "heli" : chance(.3))) cand.push({ kind: "useItem", item: "scope" });
    if (its.includes("oil") && T >= 2 && (lv === "normal" ? chance(.5) : chance(.3))) cand.push({ kind: "useItem", item: "oil", k: me.k }); // 自分の足跡が残るマス：探偵が足跡を追うと踏む
    if (its.includes("bug") && (lv === "normal" ? me.loot.length || plan.why === "heli" : chance(.25))) cand.push({ kind: "useItem", item: "bug" });
    if (its.includes("blackout") && (lv === "normal" ? (me.loot.length || plan.why === "heli") && chance(.6) : chance(.25))) cand.push({ kind: "useItem", item: "blackout" });
    if (its.includes("decoy")) {
      const dmMe = distMap(E, g, [me.k]);
      const far = v.tr.filter(t => !t.taken && !t.alarm && !t.decoy).sort((a, b) => dmMe[b.k] - dmMe[a.k]);
      if (far.length && (lv === "normal" ? (me.loot.length || plan.why === "heli" || plan.why === "treasure" && dHere <= 3) && chance(.6) : chance(.25))) cand.push({ kind: "useItem", item: "decoy", k: far[0].k });
    }
    if (its.includes("fake") && T >= 2 && (lv === "normal" ? chance(.4) : chance(.25))) {
      // 自分の行き先と反対側のマスに偽の足跡
      const dg = distMap(E, g, plan.goals); const opts = E.reach(g, me.k, 4).filter(k => k !== me.k);
      const far = opts.sort((a, b) => dg[b] - dg[a]);
      if (far.length) cand.push({ kind: "useItem", item: "fake", k: far[0] });
    }
    return cand.length ? (lv === "normal" ? cand[0] : pick(cand)) : null;
  }

  // ふつうの怪盗：探偵がいそうな場所を避ける（怪盗に見える手がかりだけ）
  function dangerMap(E, g, v) {
    const dg = new Array(128).fill(0);
    const add = (k, w, r) => { const dm = distMap(E, g, [k]); for (let i = 0; i < 128; i++) if (dm[i] <= r) dg[i] += w * (r + 1 - dm[i]); };
    (v.reveals || []).filter(x => x.r === v.round && x.t >= v.turn - 1).forEach(x => add(x.k, 6, 3));
    // 双眼鏡の結果（このターンか前のターン）
    (v.notes || []).forEach(n => { const mm = /双眼鏡：探偵は今 エリア([A-H])/.exec(n.title || ""); if (mm && n.t >= v.turn - 1) { for (let i = 0; i < 128; i++) if (E.areaOf(i) === mm[1]) dg[i] += 8; } });
    // 盗聴器
    if (v.floorHint && v.floorHint.t >= v.turn - 1) for (let i = 0; i < 128; i++) if (E.FL(i) === v.floorHint.f) dg[i] += 3;
    // 鳴った警報のまわり（探偵が来やすい）
    v.tr.filter(t => t.alarm && !t.decoy).forEach(t => add(t.k, 3, 2));
    return dg;
  }

  /* ================= 探偵 ================= */
  function detTurn(E, g, v, lv, m) {
    const d = v.det; if (!d || !d.tp) return null;
    const T = v.turn, step = v.step;
    if (m.t !== T || m.r !== v.round) { m.t = T; m.r = v.round; m.miss = []; m.skillTried = {}; }
    m.alarmSeen = m.alarmSeen || {};
    v.tr.forEach(t => { if (t.alarm && m.alarmSeen[t.id] == null) m.alarmSeen[t.id] = T; });
    const H = heat(E, g, v, lv, m);
    const tp = d.tp; const b = E.bld(g);
    // --- サイコロの前：スキル・張り込み ---
    if (tp.roll == null && !tp.stay) {
      const key = T + "-" + step;
      if (!m.skillTried[key]) { m.skillTried[key] = true; const s = chooseSkill(E, g, v, lv, m, H); if (s) return s; }
      if (lv === "normal" && heliWindow(v) && b.roof.includes(d.k)) { m.ambushT = key; return { kind: "stay" }; }
      return { kind: "roll" };
    }
    if (tp.stay && m.ambushT === T + "-" + step) return { kind: "act", act: "ambush" };
    // --- 移動先 ---
    if (tp.dest == null || m.destKey !== T + "-" + step) {
      m.destKey = T + "-" + step;
      const opts = E.reach(g, d.k, tp.roll);
      let best = d.k, bs = -1e9;
      for (const k of opts) {
        let s = H[k] + (lv === "easy" ? Math.random() * 1.5 : Math.random() * .2);
        if (m.miss.includes(k)) s -= 50;
        if (s > bs) { bs = s; best = k; }
      }
      // 次の1回のために、熱い場所へ近づく（ふつう）
      if (lv === "normal" && step === 1 && bs < 2) {
        const hot = H.indexOf(Math.max(...H)); const dm = distMap(E, g, [hot]);
        best = opts.slice().sort((a, c) => dm[a] - dm[c])[0];
      }
      if (tp.dest !== best) return { kind: "dest", k: best };
    }
    // --- 行動 ---
    if (lv === "normal" && heliWindow(v) && b.roof.includes(tp.dest) && tp.stay) return { kind: "act", act: "ambush" };
    m.miss.push(tp.dest);
    return { kind: "act", act: "capture" };
  }
  function heliWindow(v) {
    return v.players.some(p => p.role === "thief" && p.status === "active" && p.heliCall != null && v.turn >= p.heliCall + 1 && v.turn <= p.heliCall + 3);
  }

  // 怪盗がいそうな度合い（探偵に見える手がかりだけで作る）
  function heat(E, g, v, lv, m) {
    const H = new Array(128).fill(0); const T = v.turn; const b = E.bld(g);
    const spread = (k, w, peak, r) => { const dm = distMap(E, g, [k]); for (let i = 0; i < 128; i++) { const x = dm[i]; if (x <= r) H[i] += w * Math.max(0, 1 - Math.abs(x - peak) / (r - peak + 1)); } };
    // 足跡：新しい足跡のマスから、怪盗は数マス先にいる
    (v.prints || []).forEach(pr => {
      const pl = v.players.find(p => p.id === pr.pid); if (!pl || pl.status !== "active") return;
      spread(pr.k, pr.age === 0 ? 4 : 1.5, pr.age === 0 ? 3 : 5, 7);
    });
    // 警報：鳴ったばかりの財宝のマスとそのまわり
    v.tr.forEach(t => {
      if (!t.alarm) return; const age = T - (m.alarmSeen[t.id] != null ? m.alarmSeen[t.id] : T);
      if (age <= 2) spread(t.k, age === 0 ? 7 : 3, age === 0 ? 0 : 2, 5);
    });
    // まだ盗まれていない（と思う）財宝のマスに少し
    v.tr.forEach(t => { const seen = t.seen; if (seen && seen.taken) return; H[t.k] += lv === "normal" ? 1.2 : .6; });
    // ヘリ：呼ばれたら屋上
    v.players.filter(p => p.role === "thief" && p.status === "active" && p.heliCall != null && T >= p.heliCall + 1 && T <= p.heliCall + 3)
      .forEach(() => b.roof.forEach(k => spread(k, lv === "normal" ? 6 : 3, 0, 2)));
    // 捕まった怪盗のマス（助けに来る）
    if (lv === "normal") v.players.filter(p => p.status === "captured" && p.capK != null).forEach(p => spread(p.capK, 2.5, 1, 3));
    // 終盤は出口
    if (T >= v.opt.turns - 4) b.fronts.forEach(k => spread(k, lv === "normal" ? 2 : 1, 0, 2));
    // スキルの結果（ふつう）
    if (lv === "normal") {
      (v.det.info || []).filter(x => x.r === v.round && x.t >= T - 1).forEach(x => {
        let mm;
        if ((mm = /聞き込み：エリア([A-H])にいる怪盗は (\d+)人/.exec(x.m))) { const n = +mm[2]; for (let i = 0; i < 128; i++) if (E.areaOf(i) === mm[1]) H[i] = n ? H[i] * 1.6 + 1.5 * n : H[i] * .2; }
        else if ((mm = /気配察知：([A-H]-\d+) から2マス以内に怪盗は (いる|いない)/.exec(x.m))) { const c = E.parse(mm[1]); for (let i = 0; i < 128; i++) if (E.dist(i, c) <= 2) H[i] = mm[2] === "いる" ? H[i] * 1.5 + 3 : H[i] * .15; }
        else if ((mm = /フロア照会：1階に(\d+)人・2階に(\d+)人/.exec(x.m))) { const f0 = +mm[1], f1 = +mm[2]; for (let i = 0; i < 128; i++) { const n = E.FL(i) ? f1 : f0; H[i] = n ? H[i] * (1 + .3 * n) + .3 : H[i] * .15; } }
        else if ((mm = /警報器：([A-H]-\d+) に怪盗が止まりました/.exec(x.m))) spread(E.parse(mm[1]), 8, 0, 4);
      });
    }
    return H;
  }

  function chooseSkill(E, g, v, lv, m, H) {
    const d = v.det; if (!v.opt.skills || d.blackout) return null;
    const ready = (d.skills || []).filter(s => !(d.cd[s] > 0));
    if (!ready.length) return null;
    const T = v.turn, step = v.step; const b = E.bld(g);
    const areaSum = a => { let s = 0; for (let i = 0; i < 128; i++) if (E.areaOf(i) === a) s += H[i]; return s; };
    const caps = v.players.filter(p => p.status === "captured" && !p.seized);
    const hot = H.indexOf(Math.max(...H)); const dmHot = distMap(E, g, [hot]);
    const onTr = v.tr.find(t => t.k === d.k && !(t.seen && t.seen.taken));
    const build = s => {
      if (s === "ask") { const as = "ABCDEFGH".split("").sort((a, c) => areaSum(c) - areaSum(a)); return { kind: "skill", id: s, area: lv === "normal" ? as[0] : pick(as) }; }
      if (s === "seize") return caps.length ? { kind: "skill", id: s, pid: caps[0].id } : null;
      if (s === "block") return { kind: "skill", id: s, stair: rnd(b.stairs.length) };
      if (s === "secure") return onTr ? { kind: "skill", id: s } : null;
      if (s === "jump") return { kind: "skill", id: s };
      return { kind: "skill", id: s };
    };
    if (lv === "easy") { if (!chance(.3)) return null; const s = pick(ready); return build(s); }
    // ふつう
    const has = s => ready.includes(s);
    if (has("seize") && caps.length) return build("seize");
    if (has("secure") && onTr && onTr.seen && onTr.seen.stage > 0) return build("secure");
    if (step === 1 && has("floor") && Math.max(...H) < 3) return build("floor");
    if (has("ask") && step === 1) return build("ask");
    if (has("jump") && E.FL(hot) !== E.FL(d.k) && dmHot[d.k] > 6) return build("jump");
    if (has("sprint") && dmHot[d.k] > 5) return build("sprint");
    if (has("sense") && dmHot[d.k] <= 3) return build("sense");
    if (has("net") && dmHot[d.k] <= 6 && Math.max(...H) >= 4) return build("net");
    if (has("alarmdev") && (onTr || b.stairs.flat().includes(d.k))) return build("alarmdev");
    return null;
  }

  /* ================= 呼ぶ側の手伝い ================= */
  // 1手進める。CPUの手がエラーなら「代わりに進める」で止まらないようにする。戻り値：進めた人のid（なければnull）
  C.step = function (E, g, apply) {
    const ids = E.pendingIds(g).filter(id => { const p = E.P(g, id); return p && p.cpu; });
    if (!ids.length) return null;
    const id = ids[0];
    let a = null;
    try { a = C.decide(E, g, id); } catch (e) { if (typeof console !== "undefined") console.error(e); }
    const err = a ? apply(id, a) : "no action";
    if (err) apply(id, null, () => E.proxyAct(g, id));
    return id;
  };
  C.isCpu = p => !!(p && p.cpu);

  if (typeof module !== "undefined" && module.exports) module.exports = C;
  else root.IMUKAT_CPU = C;
})(typeof window !== "undefined" ? window : globalThis);
