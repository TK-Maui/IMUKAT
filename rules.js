/* IMUKAT ルールブック（かんたん／くわしく）。数値は engine.js（E）から読むので、調整してもルールが追従する */
(function () {
  const E = window.IMUKAT;
  const M = E.MONEY, TR = E.TR;
  const B = E.BUILDINGS.museum;
  const P = s => E.parse(s);
  const NW = x => `<span class="nw">${x}</span>`;
  const CO = l => (Array.isArray(l) ? l : [l]).map(NW).join("・");
  const man = n => `${n.toLocaleString("ja-JP")}万円`;

  /* ---------- 図のパーツ ---------- */
  // 美術館のマップ（2フロア）
  function mapFig() {
    const fx = {};
    fx[P(B.front)] = ["門", "gate"]; fx[P(B.back)] = ["裏", "back"];
    B.stairs.flat().forEach(s => fx[P(s)] = ["階", "stair"]);
    B.roof.forEach(s => fx[P(s)] = ["屋", "roof"]);
    B.windows.forEach(s => fx[P(s)] = ["窓", "win"]);
    const floor = f => {
      let h = `<div class="rb-floor"><div class="rb-fttl">${f + 1}階</div><div class="rb-grid">`;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const k = E.K(f, r, c); const name = E.nm(k); const [ar, n] = name.split("-");
        const q = ((r < 4 ? 0 : 2) + (c < 4 ? 0 : 1)) % 3 === 0 ? "" : " q";
        const x = fx[k];
        h += `<div class="rb-c${q}${x ? " fx " + x[1] : ""}" title="${name}">${x ? `<b>${x[0]}</b>` : ""}${(n === "1") ? `<i class="ar">${ar}</i>` : ""}<i class="no">${n}</i></div>`;
      }
      return h + `</div></div>`;
    };
    return `<div class="rb-maps">${floor(0)}${floor(1)}</div>
    <div class="rb-legend"><span><b class="lg gate">門</b>正面ゲート ${CO(B.front)}</span><span><b class="lg back">裏</b>裏口 ${CO(B.back)}</span><span><b class="lg stair">階</b>階段 ${B.stairs.map(p => p.join("⇔")).join("・")}</span><span><b class="lg roof">屋</b>屋上階段 ${CO(B.roof)}</span><span><b class="lg win">窓</b>2階の窓 ${CO(B.windows)}</span></div>`;
  }
  // エリアの並び
  function areaFig() {
    const box = (f, ls) => `<div class="rb-floor"><div class="rb-fttl">${f}</div><div class="rb-area">${ls.map(a => `<div>${a}</div>`).join("")}</div></div>`;
    const nums = `<div class="rb-floor"><div class="rb-fttl">エリアの中の番号</div><div class="rb-nums">${Array.from({ length: 16 }, (_, i) => `<div>${i + 1}</div>`).join("")}</div></div>`;
    return `<div class="rb-maps three">${box("1階", ["A", "B", "C", "D"])}${box("2階", ["E", "F", "G", "H"])}${nums}</div>`;
  }
  // 範囲の図（中心から縦横の距離）
  function rangeFig(n, center, label, mid) {
    const R = 2; let h = `<div class="rb-range"><div class="rb-rgrid">`;
    for (let r = -R; r <= R; r++) for (let c = -R; c <= R; c++) {
      const d = Math.abs(r) + Math.abs(c);
      h += `<div class="${d === 0 ? "ctr" : d <= n ? "in" : ""}">${d === 0 ? center : ""}</div>`;
    }
    return h + `</div><div class="rb-rcap">${label}</div>${mid ? `<div class="rb-rcap sub">${mid}</div>` : ""}</div>`;
  }
  // 流れ図
  const flow = (items, opt = {}) => `<div class="rb-flow${opt.v ? " v" : ""}">${items.map((t, i) => `${i ? `<span class="arr">${opt.v ? "↓" : "→"}</span>` : ""}<div class="st${t.loop ? " loop" : ""}">${t.h ? `<b>${t.h}</b>` : ""}${t.s ? `<span>${t.s}</span>` : ""}</div>`).join("")}</div>`;
  // 1ラウンドの流れ
  function roundFig() {
    return `<div class="rb-round">
      <div class="st">① 準備</div><div class="arr">↓</div>
      <div class="loopbox"><div class="lt">最大12ターンくり返す（1ターン ＝ 怪盗のターン ＋ 探偵のターン）</div>
        <div class="rb-flow"><div class="st thief"><b>怪盗のターン</b><span>全員同時に1回</span></div><span class="arr">→</span><div class="st det"><b>探偵のターン</b><span>1人で2回</span></div><span class="arr">↺</span></div>
      </div><div class="arr">↓ 怪盗全員が「脱出・捕縛」になる／12ターン終了</div>
      <div class="st">② お金の精算</div><div class="arr">↓</div>
      <div class="st">③ 探偵を時計回りに交代 → 次のラウンド</div>
    </div>`;
  }
  // 足跡の図
  function printFig() {
    return `<div class="rb-steps">
      <div><div class="fpc"><i class="dark"></i></div><b>置いたばかり</b><span>濃い色＝1ターン前にいた</span></div>
      <div><div class="fpc"><i class="light"></i></div><b>次のターン</b><span>薄い色＝2ターン前にいた</span></div>
      <div><div class="fpc"></div><b>その次</b><span>消える</span></div>
    </div>`;
  }
  // ヘリのタイムライン
  function heliFig() {
    const cells = [["3", "呼ぶ", "call"], ["4", "飛行中", ""], ["5", "到着・乗れる", "ok"], ["6", "乗れる（最後）", "ok"], ["7", "帰る", "gone"]];
    return `<div class="rb-time">${cells.map(([t, s, c]) => `<div class="${c}"><b>${t}ターン目</b><span>${s}</span></div>`).join("")}</div>
    <div class="sub">例：3ターン目に呼ぶ → 5ターン目と6ターン目の怪盗のターンに、屋上階段にいれば脱出。</div>`;
  }
  // 情報の見え方（○△×）
  const yes = `<span class="ok">見える</span>`, no = `<span class="ng">見えない</span>`;

  /* ---------- かんたんルール ---------- */
  function easy() {
    return `
<h2 id="e1">1. どんなゲーム？</h2>
<p><b>探偵1人</b>と<b>怪盗3〜5人</b>に分かれる、追いかけっこと推理のゲームです。お互いの位置は基本的に分かりません。足跡や手がかりから、相手の動きを読みましょう。</p>
<table class="rb-t"><tr><th>人数</th><td>4〜6人</td></tr><tr><th>年齢</th><td>10歳以上</td></tr><tr><th>時間</th><td>1ラウンド約20〜40分 × 人数分</td></tr></table>

<div class="rb-vs">
  <div class="det"><div class="ic">🕵️</div><b>探偵（1人）</b><span>建物に潜む怪盗を<br>捕まえて稼ぐ</span></div>
  <div class="vs">VS</div>
  <div class="thief"><div class="ic">🎭</div><b>怪盗（3〜5人）</b><span>財宝を盗んで<br>脱出して稼ぐ</span></div>
</div>
<p class="sub">怪盗同士は協力できます。ただし、ボーナスは1人ずつもらいます。</p>

<h2 id="e2">2. どうしたら勝ち？</h2>
<div class="rb-goal">すべてのラウンドが終わったとき、<b>いちばんお金を持っている人</b>の勝ち</div>
<ul>
<li>ラウンドは<b>プレイ人数と同じ回数</b>。探偵は毎ラウンド時計回りに交代し、全員が1回ずつ探偵をします。</li>
<li>最初は全員「プレイ人数×100万円」を持っています（4人なら400万円）。</li>
<li>借金があれば差し引いて比べます。同じ金額なら、探偵のときに多く稼いだ人の勝ち。</li>
</ul>

<h2 id="e3">3. 1ラウンドの流れ</h2>
${roundFig()}

<h2 id="e4">4. 怪盗のターン</h2>
<p>怪盗は<b>全員同時</b>に動きます。相談は30秒。共有マップを指差して相談できますが、声に出した言葉は探偵にも聞こえます。</p>
${flow([{ h: "🎲 ダイス1個", s: "振らずに留まってもOK" }, { h: "🚶 移動", s: "出た目以内・縦横だけ" }, { h: "✋ 行動を1つ", s: "下の表から" }])}
<table class="rb-t"><tr><th>行動</th><th>できること</th></tr>
<tr><td>セキュリティ解除</td><td>財宝のマスでダイス。当たれば解除が進む</td></tr>
<tr><td>解放作業</td><td>捕まった仲間を助ける</td></tr>
<tr><td>財宝の受け取り</td><td>捕まった仲間の財宝をもらう</td></tr>
<tr><td>何もしない</td><td>—</td></tr></table>
<p class="sub">行動とは別に、いつでもできること：アイテムを使う／ヘリを呼ぶ／同じマスの仲間に渡す／変装パーツを拾う／出口から脱出する。</p>
<div class="rb-warn"><b>気をつけること</b><ul>
<li>2ターン目から、出発したマスに<b>自分の色の足跡</b>が残る</li>
<li><b>探偵のいるマスに止まると捕まる</b>（探偵の位置は見えない！）</li>
<li>30秒以内に決めないと、その場で何もしない</li></ul></div>

<h2 id="e5">5. 探偵のターン</h2>
<p>探偵は<b>1ターンに2回</b>「移動→行動」をします。</p>
${flow([{ h: "1回目", s: "🎲→🚶→✋" }, { h: "2回目", s: "🎲→🚶→✋" }])}
<table class="rb-t"><tr><th>行動</th><th>効果</th></tr>
<tr><td>捕縛</td><td>止まったマスに怪盗がいれば捕まえる</td></tr>
<tr><td>張り込み</td><td>留まったときだけ。次の怪盗のターンの終わりに、上下左右1マスにいる怪盗も捕まえる。選ぶとそのターンは終わり</td></tr>
<tr><td>何もしない</td><td>—</td></tr></table>
<div class="rb-ranges">${rangeFig(0, "🕵️", "捕縛", "止まったマスだけ")}${rangeFig(1, "🕵️", "張り込み", "上下左右1マスも")}</div>
<p class="sub">足跡・警報・調べた結果から怪盗の居場所を推理しましょう。ラウンドの始めに選んだ4つのスキルも使えます。</p>

<h2 id="e6">6. どうやって脱出する？</h2>
<table class="rb-t"><tr><th>方法</th><th>どこで</th><th>条件</th></tr>
<tr><td>🚁 ヘリ</td><td>屋上階段<br>${CO(B.roof)}</td><td>自分のヘリが来ている間にいる</td></tr>
<tr><td>🥸 変装</td><td>正面ゲート<br>${CO(B.front)}</td><td>パーツ4種類を1個ずつ集めて止まる</td></tr>
<tr><td>🚪 裏口</td><td>裏口<br>${CO(B.back)}</td><td>全員がヘリを呼び終わると開く。変装して止まる</td></tr>
<tr><td>🪝 ワイヤー銃</td><td>2階の窓<br>${CO(B.windows)}</td><td>アイテムを持って止まる</td></tr></table>
<div class="rb-ranges">${rangeFig(2, "門", "正面ゲート・裏口", "探偵がこの範囲にいると見破られて捕まる")}</div>
<p><b>ヘリ</b>は1ラウンドに1人1回。呼んだ2ターン後に来て、2ターンだけ待ってくれます。</p>
${heliFig()}

<h3>ラウンドの終わり</h3>
<p>怪盗全員が、次のどれかになったら終わりです。</p>
<table class="rb-t"><tr><td>✅ 脱出成功</td><td>財宝がなくてもOK</td></tr><tr><td>🔒 捕縛</td><td>捕まったまま</td></tr><tr><td>⌛ 脱出失敗</td><td>12ターン目が終わっても建物の中</td></tr></table>

<h2 id="e7">7. お金の基本</h2>
<p>お金が動くのは<b>ラウンドの終わりだけ</b>です。</p>
<div class="rb-two">
<div class="thief"><b>🎭 怪盗がもらう</b><ul><li>山分け（脱出して持ち出した財宝を全員で等分）</li><li>予告状ボーナス</li><li>華麗さボーナス</li><li>救出ボーナス</li></ul><b>払う</b><ul><li>保釈金（捕まったままの仲間がいると）</li></ul></div>
<div class="det"><b>🕵️ 探偵がもらう</b><ul><li>捕縛の報奨金</li><li>累計捕縛</li><li>脱出失敗</li><li>予告阻止</li></ul></div>
</div>
<p class="sub">払えないときは銀行から借金します。借金は最後に所持金から差し引きます。金額は「くわしく」の「6. お金」へ。</p>`;
  }

  /* ---------- 詳しいルール ---------- */
  function full() {
    const items = Object.entries(E.ITEMS).map(([, v]) => `<tr><td>${v.name}</td><td>${v.text}</td></tr>`).join("");
    const skills = Object.entries(E.SKILLS).map(([, v]) => `<tr><td>${v.name}</td><td>${v.text}</td><td class="n">${v.ct ? v.ct + "ターン" : "なし"}</td></tr>`).join("");
    const notices = Object.values(E.NOTICES).map(v => `<tr><td>${v.name}</td><td>${v.text}</td></tr>`).join("");
    const trs = [["high", 0], ["mid", 0], ["mid", 1], ["low", 0]].map(([r, i]) => { const t = TR[r]; const faces = []; for (let f = t.target; f <= 6; f++) faces.push(f); return `<tr><td>${t.label}：${B.tnames[r][i]}</td><td class="n">${man(t.value)}</td><td>${faces.join("・")}が当たり<br>${t.need}段階</td></tr>`; }).join("");
    return `
<p class="sub">テスト版 ${E.VERSION} に合わせています。数値はテストプレイで調整中です。</p>
<div class="rb-toc">${[["f1", "1 全体像"], ["f2", "2 ラウンドの流れ"], ["f3", "3 怪盗のターン"], ["f4", "4 探偵のターン"], ["f5", "5 脱出"], ["f6", "6 お金"], ["f7", "7 細かいルール"], ["f8", "8 よくある質問"]].map(([id, t]) => `<button data-rbgo="${id}">${t}</button>`).join("")}</div>

<h2 id="f1">1. 全体像</h2>
<h3>世界観</h3>
<p>国際指名手配中の、正体不明のカリスマ怪盗集団「IMUKAT（イムカット）」。今夜、彼らが狙う財宝のありかを、1人の敏腕探偵が突き止めました。夜、財宝が眠る建物に足を踏み入れた探偵は、目にも耳にも捉えられない気配を感じます。探偵は怪盗たちを全員捕まえられるのか。それとも怪盗たちが、鮮やかに財宝を盗み出すのか。</p>
<h3>基本情報</h3>
<table class="rb-t"><tr><th>人数</th><td>4〜6人（探偵1人・怪盗3〜5人）</td></tr><tr><th>時間</th><td>1ラウンド約20〜40分 × 人数分</td></tr><tr><th>年齢</th><td>10歳以上</td></tr><tr><th>お金</th><td>単位は万円。最初は全員「人数×100万円」</td></tr></table>
<h3>勝利条件</h3>
<div class="rb-goal">すべてのラウンドが終わったとき、<b>いちばんお金を持っている人</b>の勝ち</div>
<ul><li>ラウンドは人数と同じ回数。毎ラウンド探偵を交代し、全員が1回ずつ探偵をします。</li><li>借金があれば差し引いて比べます。</li><li>同じ金額なら、探偵だったラウンドで多く稼いだ人の勝ち。</li></ul>
<h3>2つの役割</h3>
<table class="rb-t"><tr><th></th><th>🕵️ 探偵</th><th>🎭 怪盗</th></tr>
<tr><th>人数</th><td>1人</td><td>3〜5人</td></tr>
<tr><th>目的</th><td>怪盗を捕まえる</td><td>財宝を盗んで脱出する</td></tr>
<tr><th>稼ぎ方</th><td>捕縛の報奨金・累計捕縛・脱出失敗・予告阻止</td><td>山分け・予告状・華麗さ・救出</td></tr>
<tr><th>自分の位置</th><td>自分だけが知っている</td><td>仲間同士は共有マップで見える</td></tr>
<tr><th>相手の位置</th><td>見えない（足跡・警報・スキルで推理）</td><td>見えない（捕縛などで分かることも）</td></tr>
<tr><th>特別な力</th><td>スキル4つ・1ターン2回行動</td><td>アイテム2枚・仲間との協力</td></tr></table>
<h3>怪盗は「協力しながら競う」</h3>
<p>盗み出した財宝は、ラウンドの終わりに怪盗全員で山分けします（捕まった怪盗ももらえます）。だからチームで協力します。ただし予告状・華麗さ・救出のボーナスは個人のもの。仲間を助けながら、自分の目標も狙いましょう。</p>

<h2 id="f2">2. 1ラウンドの流れ</h2>
${roundFig()}
<h3>準備</h3>
<ol>
<li><b>探偵を決める。</b>1ラウンド目は最年少の人。その後は時計回り。</li>
<li><b>財宝と変装パーツを置く。</b>アプリかダイスで、財宝4つと変装パーツ8個をランダムに置きます。場所は全員に見えます。</li>
<li><b>怪盗がカードを引く。</b>アイテムカード2枚と予告状カード1枚。自分だけが見ます。</li>
<li><b>探偵がスキルを選ぶ。</b>全スキルから好きな4つ。</li>
<li><b>スタート地点を秘密に選ぶ。</b>（下の表）</li>
<li><b>予告するか決める。</b>怪盗全員で「せーの」で、予告状を表にするか伏せるかを選びます。</li>
<li>1ターン目の怪盗のターンから始めます。</li></ol>
<table class="rb-t"><tr><th></th><th>選べるマス</th><th>誰に見える？</th></tr>
<tr><td>🎭 怪盗</td><td>裏口 ${CO(B.back)}・正面ゲート ${CO(B.front)}・2階の窓 ${CO(B.windows)} から1人ずつ</td><td>仲間には見える。探偵には見えない</td></tr>
<tr><td>🕵️ 探偵</td><td>2階の「何もないマス」（財宝・パーツ・階段・窓・屋上階段は不可）</td><td>自分だけ</td></tr></table>
<h3>ラウンドが終わるとき</h3>
<p>怪盗全員が次のどれかになったら終わりです。<b>1ターン ＝ 怪盗のターン＋探偵のターン</b>と数えます。</p>
<table class="rb-t"><tr><th>結果</th><th>内容</th></tr>
<tr><td>✅ 脱出成功</td><td>建物から出た。財宝がなくてもOK</td></tr>
<tr><td>🔒 捕縛</td><td>捕まって、解放されないままラウンドが終わった</td></tr>
<tr><td>⌛ 脱出失敗</td><td>12ターン目の探偵のターンが終わっても建物の中にいた</td></tr></table>
<p class="sub">まだ動ける怪盗（脱出も捕縛もしていない人）が1人もいなくなった時点で、すぐに終わります。</p>

<h2 id="f3">3. 怪盗のターン</h2>
<h3>同時に動く</h3>
<p>怪盗は全員同時に動きます。共有マップを指差して作戦を相談できますが、口に出した言葉は探偵にも聞こえます。<b>わざと嘘の作戦を話して、探偵をだましてもOK</b>。制限時間は30秒です。</p>
${flow([{ h: "🎲 ダイス1個", s: "振らずに留まってもOK" }, { h: "🚶 移動", s: "出た目以内・縦横だけ・手前で止まってもOK" }, { h: "✋ 行動を1つ", s: "" }, { h: "✔ 全員確定", s: "結果がまとめて出る" }])}
<h3>移動したあとの行動（1つだけ）</h3>
<table class="rb-t"><tr><th>行動</th><th>どこで</th><th>効果</th></tr>
<tr><td>セキュリティ解除</td><td>財宝のマス</td><td>ダイスを振り、当たり目なら1段階進む。全部進むと財宝が手に入る</td></tr>
<tr><td>解放作業</td><td>捕まった仲間のマス</td><td>合計2ターン分で、仲間が次のターンの始めに解放される</td></tr>
<tr><td>財宝の受け取り</td><td>捕まった仲間のマス</td><td>次のターンの始めに、仲間の財宝を受け取る</td></tr>
<tr><td>何もしない</td><td>どこでも</td><td>—</td></tr></table>
<h3>行動に数えないこと</h3>
<table class="rb-t"><tr><th>できること</th><th>ルール</th></tr>
<tr><td>🚁 ヘリを呼ぶ</td><td>1ラウンド1回。「5. 脱出」参照</td></tr>
<tr><td>🃏 アイテムを使う</td><td>怪盗のターン中だけ。1枚1回で使い切り</td></tr>
<tr><td>🤝 仲間に渡す</td><td>同じマスの仲間に、財宝・アイテム・変装パーツを自由に</td></tr>
<tr><td>🧩 パーツを拾う</td><td>パーツのマスに止まったら拾える（拾わなくてもOK）</td></tr>
<tr><td>🏃 脱出する</td><td>条件を満たして出口に止まると自動で脱出</td></tr></table>
<h3>足跡と鉢合わせ</h3>
<ul><li>2ターン目から、出発したマスに自分の色の足跡が残ります（くわしくは「7. 細かいルール」）。</li>
<li><b>探偵のいるマスに止まると捕まります。</b>探偵の位置は見えないので、運も絡みます。</li>
<li>30秒以内に確定しなかった怪盗は、その場で何もしません。</li></ul>

<h2 id="f4">4. 探偵のターン</h2>
<p>探偵はダイスを2個持ち、1個ずつ振って「移動→行動」を2回します。</p>
${flow([{ h: "1回目", s: "🎲 振る（留まってもOK）→ 🚶 移動 → ✋ 行動" }, { h: "2回目", s: "🎲 → 🚶 → ✋" }])}
<h3>選べる行動</h3>
<table class="rb-t"><tr><th>行動</th><th>効果</th></tr>
<tr><td>捕縛</td><td>止まったマスを調べる。怪盗がいれば捕まえる。いなければ空振り</td></tr>
<tr><td>張り込み</td><td>留まったときだけ。次の怪盗のターンの終わりに、上下左右1マスにいる怪盗も捕まえる。<b>選ぶとそのターンは終わり</b>（1回目で選んだら2回目はなし）</td></tr>
<tr><td>何もしない</td><td>—</td></tr></table>
<div class="rb-ranges">${rangeFig(0, "🕵️", "捕縛", "止まったマスだけ")}${rangeFig(1, "🕵️", "張り込み", "上下左右1マスも")}</div>
<h3>スキル</h3>
<p>ラウンドの始めに選んだ4つを、自分のターン中の好きなときに使えます。一度使うと決まったターン数は使えません（<b>クールタイム</b>）。一覧は「7. 細かいルール」にあります。</p>
<h3>探偵のヒント</h3>
<table class="rb-t"><tr><th>手がかり</th><th>読み方</th></tr>
<tr><td>👣 足跡</td><td>色で誰か分かる。濃いほど新しい</td></tr>
<tr><td>🚨 警報</td><td>鳴った財宝には、怪盗がいるか、近くにいたはず</td></tr>
<tr><td>🚁 ヘリ</td><td>呼ばれたら屋上階段（${CO(B.roof)}）で待ち伏せのチャンス</td></tr>
<tr><td>📜 予告状</td><td>公開された予告から狙いを読んで先回り</td></tr>
<tr><td>🔍 調査</td><td>財宝や変装パーツのマスに止まると、まだあるか分かる</td></tr></table>

<h2 id="f5">5. 脱出</h2>
<table class="rb-t"><tr><th>方法</th><th>どこで</th><th>条件・注意</th></tr>
<tr><td>🚁 ヘリ</td><td>屋上階段<br>${CO(B.roof)}</td><td>自分のヘリが待っている間にいる。ヘリが来ると全員に分かるので、待ち伏せされやすい</td></tr>
<tr><td>🥸 変装</td><td>正面ゲート<br>${CO(B.front)}</td><td>制服・マスク・社員証・警棒を1個ずつ集めて止まる</td></tr>
<tr><td>🚪 裏口<br>（最終手段）</td><td>裏口<br>${CO(B.back)}</td><td>捕まっていない怪盗全員がヘリを呼び終わると開く。変装していれば脱出できる</td></tr>
<tr><td>🪝 ワイヤー銃</td><td>2階の窓<br>${CO(B.windows)}</td><td>アイテム「ワイヤー銃」を持って止まる（山札に1枚だけ）</td></tr></table>
<div class="rb-ranges">${rangeFig(2, "門", "正面ゲート・裏口から2マス", "探偵がこの中にいると、変装を見破られて捕まる（同じフロアで縦横に数える）")}</div>
<h3>ヘリのルール</h3>
<ul><li>1ラウンドに1人1回、自分のターンの好きなときに呼べます。</li>
<li>呼んだ<b>2ターン後</b>の始めに到着し、<b>3ターン後</b>の終わりまで屋上で待ちます（乗れるのは2ターン）。</li>
<li>先に屋上階段で待っていてもOK。自分以外が呼んだヘリには乗れません。</li></ul>
${heliFig()}
<h3>財宝を持たずに脱出したら</h3>
<p>脱出成功です。山分けはもらえますが、予告状と華麗さのボーナスはもらえません。それでも、捕まって保釈金を払うよりはましです。</p>

<h2 id="f6">6. お金</h2>
<p>お金が動くのは<b>ラウンドの終わりだけ</b>。卓上の銀行から受け取り、銀行へ払います。</p>
<h3>🎭 怪盗がもらうお金</h3>
<table class="rb-t"><tr><th>項目</th><th class="n">金額</th><th>条件</th></tr>
<tr><td>山分け</td><td>合計÷人数</td><td>脱出した怪盗が持ち出した財宝の合計を、怪盗全員で等分（捕まった人も）。100万円未満は切り捨て</td></tr>
<tr><td>予告状（公開）</td><td class="n">${man(M.noticeOpen)}</td><td rowspan="2">予告を達成し、財宝を持って脱出</td></tr>
<tr><td>予告状（伏せ）</td><td class="n">${man(M.noticeHidden)}</td></tr>
<tr><td rowspan="3">華麗さ</td><td class="n">${man(M.flair[0])}</td><td>財宝を持って1〜5ターン目に脱出</td></tr>
<tr><td class="n">${man(M.flair[1])}</td><td>6〜8ターン目に脱出</td></tr>
<tr><td class="n">${man(M.flair[2])}</td><td>9〜12ターン目に脱出</td></tr>
<tr><td>救出</td><td class="n">1回 ${man(M.rescue)}</td><td>捕まった仲間を解放した回数</td></tr></table>
<div class="rb-ex"><b>山分けの例</b>（怪盗3人）<br>Aが「夜明けの涙」（${man(TR.high.value)}）と「銀の燭台」（${man(TR.low.value)}）を持って脱出 → 合計 ${man(TR.high.value + TR.low.value)} ÷ 3人 ＝ <b>1人 ${man(Math.floor((TR.high.value + TR.low.value) / 3 / 100) * 100)}</b>（捕まったBとCも同じ額）</div>
<h3>🎭 怪盗が払うお金</h3>
<table class="rb-t"><tr><th>項目</th><th class="n">金額</th><th>条件</th></tr>
<tr><td>保釈金</td><td class="n">1人につき ${man(M.bail)}</td><td>ラウンド終了時に捕まったままの怪盗1人につき、怪盗<b>全員</b>（本人も）が銀行に払う</td></tr></table>
<div class="rb-ex"><b>保釈金の例</b>：2人が捕まったまま終わった → 怪盗は全員 ${man(M.bail)}×2 ＝ <b>${man(M.bail * 2)}</b> ずつ払う</div>
<h3>🕵️ 探偵がもらうお金</h3>
<table class="rb-t"><tr><th>項目</th><th class="n">金額</th><th>条件</th></tr>
<tr><td>捕縛の報奨金</td><td class="n">1人 ${man(M.endCap)}</td><td>ラウンド終了時に捕まったままの怪盗1人につき</td></tr>
<tr><td>累計捕縛</td><td class="n">1回 ${man(M.capture)}</td><td>ラウンド中に捕まえた回数。同じ怪盗は${M.capMax}回まで</td></tr>
<tr><td>脱出失敗</td><td class="n">1人 ${man(M.failed)}</td><td>12ターン終わっても逃げられなかった怪盗</td></tr>
<tr><td>予告阻止</td><td class="n">1件 ${man(M.block)}</td><td>予告した（公開した）怪盗が達成できなかった</td></tr></table>
<h3>お金が足りないとき</h3>
<p>銀行から借金して払います。借金はゲームの最後に所持金から差し引きます。</p>

<h2 id="f7">7. 細かいルール</h2>
<h3>マップと座標</h3>
<p>建物は1階と2階。各フロアは8×8マスで、4×4マスのエリア4つに分かれています。マスは「エリア-番号」で呼びます。</p>
${areaFig()}
<p>1階と2階は同じ位置が上下に重なっています（A-1の真上はE-1）。美術館の固定マスは次のとおりです。</p>
${mapFig()}
<h3>移動</h3>
<ul><li>縦と横だけ。斜めには進めません。出た目以内なら、どこで止まってもOK。</li>
<li>階段マスからもう一方のフロアの階段マスへは<b>1マス</b>と数えます（例：出目3なら、2マス進んで階段へ、残り1で上の階の階段マスへ）。</li>
<li>人がいるマスも通れます。捕縛などの判定は<b>止まったマスだけ</b>です。</li></ul>
<h3>足跡</h3>
<p>怪盗は2ターン目から、毎ターン出発したマスに自分の色の足跡を置きます。動かなかったターンは今いるマスに置きます。</p>
${printFig()}
<ul><li>1ターン目は置きません（どこから入ったか分からないように）。</li>
<li>捕まった怪盗・脱出した怪盗の足跡は消えます。探偵は足跡を残しません。</li></ul>
<h3>財宝とセキュリティ</h3>
<table class="rb-t"><tr><th>財宝</th><th class="n">金額</th><th>解除</th></tr>${trs}</table>
<ul><li>財宝のマスで「セキュリティ解除」を選んでダイスを振ります。当たり目で1段階進み、全部進めば手に入ります。</li>
<li>同じマスに仲間が何人いても、それぞれ1回ずつ振れます。取った財宝を誰が持つかは相談して決めます。</li>
<li>1人が持てる財宝に上限はありません。ただし、持ったまま捕まってラウンドが終わると、その財宝は山分けに入りません。</li>
<li><b>警報</b>：1つの財宝で失敗が合計${E.defaultOpt().alarmFails}回になると鳴り、その財宝の場所が全員に知らされます。</li>
<li>置き方：財宝は1つのエリアに1つまで・1フロアに2つずつ。「高」はB・C・F・Gのどれかに置きます。変装パーツは4種類×2個を、各エリアに1個ずつ置きます。</li></ul>
<h3>見える情報・見えない情報</h3>
<table class="rb-t"><tr><th>情報</th><th>🎭 怪盗</th><th>🕵️ 探偵</th></tr>
<tr><td>怪盗たちの位置</td><td>${yes}</td><td>${no}</td></tr>
<tr><td>探偵の位置</td><td>${no}</td><td>${yes}</td></tr>
<tr><td>財宝・変装パーツの場所</td><td>${yes}</td><td>${yes}</td></tr>
<tr><td>盗まれたか・拾われたか</td><td>${yes}</td><td>止まったときだけ</td></tr>
<tr><td>解除の段階・失敗回数</td><td>${yes}</td><td>止まったときだけ</td></tr>
<tr><td>足跡・警報・ヘリ・捕まった怪盗</td><td>${yes}</td><td>${yes}</td></tr>
<tr><td>アイテム・伏せた予告状</td><td>自分の分だけ</td><td>${no}</td></tr></table>
<p><b>探偵の位置が怪盗に分かるとき</b></p>
<table class="rb-t"><tr><th>できごと</th><th>分かること</th></tr>
<tr><td>怪盗を捕まえた</td><td>そのときいたマス</td></tr>
<tr><td>変装を見破った</td><td>出口から2マス以内にいたこと</td></tr>
<tr><td>セキュリティ強化（スキル）を使った</td><td>そのマス</td></tr>
<tr><td>オイル（アイテム）を踏んだ</td><td>そのマス</td></tr>
<tr><td>盗聴器（アイテム）</td><td>何階にいるか</td></tr></table>
<h3>捕縛と解放</h3>
<ul><li>捕まった怪盗は動けず、行動もできません。位置は全員に公開されます。仲間との相談はできます。</li>
<li><b>解放作業</b>：仲間が捕まった怪盗のマスで合計2ターン作業すると、次のターンの始めに解放。途中で離れても作業は残ります。</li>
<li><b>財宝の受け取り</b>：1ターン作業すると、次のターンの始めに財宝を受け取れます。受け取った財宝は受け取った人のものとして扱い、その人が脱出すれば山分けに入ります。</li>
<li><b>縄抜け</b>（アイテム）：自力で抜け出し、そのターンから動けます。</li>
<li><b>鉢合わせ</b>：怪盗が自分のターンに探偵のいるマスに止まると、その場で捕まります。</li></ul>
<h3>探偵の調査</h3>
<p>探偵が財宝や変装パーツのマスに止まると、そのときの状況が分かり、調査メモとマップに残ります。</p>
<table class="rb-t"><tr><th>マス</th><th>分かること</th></tr><tr><td>財宝</td><td>まだあるか・解除が何段階か・失敗が何回か</td></tr><tr><td>変装パーツ</td><td>まだあるか</td></tr></table>
<p class="sub">調べたあとに盗まれても、それは分かりません。</p>
<h3>予告状</h3>
<table class="rb-t"><tr><th></th><th>達成したら</th><th>達成できなかったら</th></tr>
<tr><td>予告する（公開）</td><td>${man(M.noticeOpen)}</td><td>探偵に ${man(M.block)}</td></tr>
<tr><td>予告しない（伏せる）</td><td>${man(M.noticeHidden)}</td><td>なし</td></tr></table>
<p class="sub">どの予告状も、<b>財宝を持って脱出したときだけ</b>達成になります。</p>
<table class="rb-t"><tr><th>予告状</th><th>達成条件</th></tr>${notices}</table>
<p class="sub">「最も高い財宝」は「夜明けの涙」（1つだけ）です。ほかの財宝も一緒に持っていて構いません。</p>
<h3>アイテム（怪盗）</h3>
<p>ラウンドの始めに2枚配られ、そのラウンドはその2枚だけ使えます。使えるのは怪盗のターン中だけ。捕縛そのものを無効にするアイテムはありません。<span class="sub">（効果はテスト用の仮のものです）</span></p>
<table class="rb-t"><tr><th>アイテム</th><th>効果</th></tr>${items}</table>
<h3>スキル（探偵）</h3>
<p class="sub">効果はテスト用の仮のものです。</p>
<table class="rb-t"><tr><th>スキル</th><th>効果</th><th class="n">休み</th></tr>${skills}</table>

<h2 id="f8">8. よくある質問</h2>
<dl class="rb-qa">
<dt>怪盗同士で相談していいの？</dt><dd>共有マップを指差して自由に相談してOK。ただし口に出した言葉は探偵にも聞こえます。嘘の作戦でだますのもアリ。</dd>
<dt>探偵が怪盗のいるマスを通り過ぎたら？</dt><dd>捕まりません。捕縛は止まったマスだけで判定します。</dd>
<dt>ヘリを呼んだのに間に合わなかったら？</dt><dd>そのラウンドはもう呼べません。変装かワイヤー銃を目指しましょう。怪盗全員がヘリを呼び終わると裏口も開きます。</dd>
<dt>同じ種類の変装パーツを2つ拾ったら？</dt><dd>同じマスにいる仲間に渡せます。仲間のために拾わずに残しておくこともできます。</dd>
<dt>捕まっている間は何もできないの？</dt><dd>動けませんが、相談はできます。「縄抜け」があれば自力で抜け出せます。</dd>
<dt>制限時間内に決められなかったら？</dt><dd>その場に留まって何もしません。</dd>
<dt>問題や迷ったところがあったら？</dt><dd>アプリの📋から記録を保存して、気づいたことと一緒に作者に伝えてください。部屋を作った人は「1つ前の操作に戻す」でやり直せます。</dd>
</dl>`;
  }

  /* ---------- 見た目 ---------- */
  const CSS = `
.rb h2{font-size:17px;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--accent)}
.rb h3{font-size:15px;margin:14px 0 6px}
.rb p{margin:6px 0}.rb ul,.rb ol{margin:6px 0;padding-left:20px}.rb li{margin:2px 0}
.rb-tabs{display:flex;gap:6px;position:sticky;top:-14px;background:var(--panel);padding:6px 0;z-index:2}
.rb-tabs button{flex:1}
.rb-toc{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}
.rb-toc button{min-height:32px;padding:4px 8px;font-size:12px}
.rb-t{margin:6px 0 10px;border:1px solid var(--line);border-radius:8px;overflow:hidden;border-collapse:separate;border-spacing:0}
.rb-t th{background:var(--cell2);white-space:nowrap}
.rb-t td,.rb-t th{padding:6px;border-bottom:1px solid var(--line)}
.rb-t tr:last-child td,.rb-t tr:last-child th{border-bottom:0}
.rb-t td:first-child{font-weight:600;min-width:6.6em}
.rb-t td.n,.rb-t th.n{white-space:nowrap}
.nw{white-space:nowrap}
.rb-c.fx .ar{color:#fff}
.rb-t td[rowspan]{border-right:1px solid var(--line)}
.rb-goal{background:var(--gold-bg);border:2px solid var(--gold);border-radius:10px;padding:10px;text-align:center;font-size:15px;margin:8px 0}
.rb-vs{display:flex;align-items:stretch;gap:6px;margin:10px 0}
.rb-vs>div{flex:1;border-radius:10px;padding:10px 6px;text-align:center;display:flex;flex-direction:column;gap:2px;font-size:13px}
.rb-vs .ic{font-size:28px}.rb-vs .vs{flex:0 0 auto;align-self:center;font-weight:800;color:var(--sub)}
.rb .det{background:color-mix(in srgb,#2f6fd6 12%,var(--panel));border:1px solid color-mix(in srgb,#2f6fd6 45%,var(--line))}
.rb .thief{background:color-mix(in srgb,#d1495b 12%,var(--panel));border:1px solid color-mix(in srgb,#d1495b 45%,var(--line))}
.rb-two{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.rb-two>div{border-radius:10px;padding:8px;font-size:13px}.rb-two ul{padding-left:16px}
@media (max-width:420px){.rb-two{grid-template-columns:1fr}}
.rb-flow{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:8px 0}
.rb-flow .st{flex:1 1 0;min-width:84px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 6px;text-align:center;display:flex;flex-direction:column;gap:2px}
.rb-flow .st span{font-size:11px;color:var(--sub)}
.rb-flow .arr{font-weight:800;color:var(--accent)}
.rb-round{display:flex;flex-direction:column;align-items:stretch;gap:2px;margin:8px 0;text-align:center}
.rb-round>.st{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px;font-weight:600}
.rb-round>.arr{color:var(--accent);font-weight:700;font-size:12px}
.rb-round .loopbox{border:2px dashed var(--accent);border-radius:12px;padding:6px 8px}
.rb-round .lt{font-size:12px;color:var(--accent);font-weight:700}
.rb-round .rb-flow .st{border-width:1px}
.rb-warn{border-left:4px solid var(--warn);background:var(--bg);border-radius:6px;padding:6px 10px;margin:8px 0}
.rb-ex{border-left:4px solid var(--gold);background:var(--gold-bg);border-radius:6px;padding:6px 10px;margin:6px 0 10px;font-size:13px}
.rb-ranges{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin:8px 0}
.rb-range{display:flex;flex-direction:column;align-items:center;max-width:220px;text-align:center}
.rb-rgrid{display:grid;grid-template-columns:repeat(5,26px);gap:2px}
.rb-rgrid div{width:26px;height:26px;border-radius:4px;background:var(--cell);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
.rb-rgrid .in{background:color-mix(in srgb,var(--warn) 30%,var(--panel));border-color:var(--warn)}
.rb-rgrid .ctr{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.rb-rcap{font-weight:700;font-size:13px;margin-top:4px}.rb-rcap.sub{font-weight:400;font-size:12px;color:var(--sub);margin:0}
.rb-time{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin:8px 0 4px}
.rb-time div{background:var(--cell);border:1px solid var(--line);border-radius:8px;padding:6px 2px;text-align:center;display:flex;flex-direction:column;font-size:11px}
.rb-time b{font-size:12px}
.rb-time .call{background:var(--gold-bg);border-color:var(--gold)}
.rb-time .ok{background:color-mix(in srgb,var(--ok) 22%,var(--panel));border-color:var(--ok);color:var(--ink)}
.rb-time .gone{opacity:.5}
.rb-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}
.rb-steps>div{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 4px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:13px}
.rb-steps span{font-size:11px;color:var(--sub)}
.fpc{width:36px;height:36px;border-radius:6px;background:var(--cell);border:1px solid var(--line);display:flex;align-items:center;justify-content:center}
.fpc i{width:14px;height:14px;border-radius:50%;background:#d1495b;display:block}.fpc i.light{opacity:.35}
.rb-maps{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}
.rb-maps.three{grid-template-columns:1fr 1fr 1fr}
@media (max-width:560px){.rb-maps:not(.three){grid-template-columns:1fr;max-width:340px;margin:8px auto}.rb-c .no{font-size:8px}.rb-c .ar{font-size:10px}.rb-c{font-size:13px}}
.rb-fttl{font-weight:700;font-size:13px;text-align:center;margin-bottom:3px}
.rb-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:1px}
.rb-c{aspect-ratio:1;background:var(--cell);border-radius:2px;position:relative;display:flex;align-items:center;justify-content:center;font-size:10px}
.rb-c.q{background:var(--cell2)}
.rb-c .no{position:absolute;right:1px;bottom:0;font-size:6px;font-style:normal;color:var(--sub);opacity:.7}
.rb-c .ar{position:absolute;left:1px;top:0;font-size:8px;font-style:normal;font-weight:800;color:var(--accent)}
.rb-c.fx b,.lg{color:#fff;font-weight:800}
.lg{display:inline-flex;width:18px;height:18px;border-radius:4px;align-items:center;justify-content:center;font-size:11px;margin-right:3px}
.gate{background:#c2410c!important}.back{background:#7c4dbb!important}.stair{background:#5b6878!important}.roof{background:#2a9d6f!important}.win{background:#1e9aa8!important}
.rb-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;margin:4px 0 8px}
.rb-legend span{display:inline-flex;align-items:center}
.rb-area,.rb-nums{display:grid;gap:2px}
.rb-area{grid-template-columns:1fr 1fr}.rb-area div{aspect-ratio:1;background:var(--cell2);border:1px solid var(--line);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--accent)}
.rb-nums{grid-template-columns:repeat(4,1fr)}.rb-nums div{aspect-ratio:1;background:var(--cell);border:1px solid var(--line);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:11px}
.rb-qa dt{font-weight:700;margin-top:10px}.rb-qa dt:before{content:"Q. ";color:var(--accent)}
.rb-qa dd{margin:2px 0 0 0;padding-left:20px}
`;
  function injectCSS() { if (document.getElementById("rbcss")) return; const s = document.createElement("style"); s.id = "rbcss"; s.textContent = CSS; document.head.appendChild(s); }

  // tab: "easy" | "full"。container に描画し、タブと目次を動かす
  function render(container, tab) {
    injectCSS();
    let cur = tab || "easy";
    try { cur = tab || localStorage.getItem("imukat_rules_tab") || "easy"; } catch (e) { }
    const draw = () => {
      container.innerHTML = `<div class="rb"><div class="rb-tabs"><button data-rbtab="easy" class="${cur === "easy" ? "primary" : ""}">かんたんルール</button><button data-rbtab="full" class="${cur === "full" ? "primary" : ""}">くわしいルール</button></div>${cur === "easy" ? easy() : full()}</div>`;
      container.querySelectorAll("[data-rbtab]").forEach(b => b.onclick = () => { cur = b.dataset.rbtab; try { localStorage.setItem("imukat_rules_tab", cur); } catch (e) { } draw(); container.scrollTop = 0; (container.closest("dialog") || window).scrollTo?.(0, 0); });
      container.querySelectorAll("[data-rbgo]").forEach(b => b.onclick = () => { const el = container.querySelector("#" + b.dataset.rbgo); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
    };
    draw();
  }
  window.IMUKAT_RULES = { render, easy, full };
})();
