// 闯关东 · 游戏引擎
(function () {
  const { nodes: N, endings: ENDINGS } = window.GUANDONG;

  const SAVE_KEY = 'guandong.save.v1';
  const END_KEY = 'guandong.endings.v1';
  const SPEED_KEY = 'guandong.speed.v1';

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 无痕模式等 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  const $ = id => document.getElementById(id);
  const val = (x, s) => (typeof x === 'function' ? x(s) : x);

  const STAT_NAMES = { money: '盘缠', hp: '体力', rep: '情义' };

  const newState = () => ({ node: 'p1', money: 2, hp: 8, rep: 3, letters: 0, flags: {} });

  let S = null;
  let speed = store.get(SPEED_KEY);
  if (typeof speed !== 'number') speed = 50;

  /* ───────── 状态与效果 ───────── */

  function apply(fx, set) {
    if (fx) {
      for (const k of ['money', 'hp', 'rep', 'letters']) {
        if (fx[k]) S[k] += fx[k];
      }
      S.hp = Math.max(0, Math.min(10, S.hp));
      S.rep = Math.max(0, Math.min(10, S.rep));
      S.money = Math.max(0, S.money);
    }
    if (set) Object.assign(S.flags, set);
  }

  function snapshot() { return { money: S.money, hp: S.hp, rep: S.rep }; }

  function showDiff(before) {
    const parts = [];
    for (const k of ['money', 'hp', 'rep']) {
      const d = S[k] - before[k];
      if (d) parts.push(`<span class="${d > 0 ? 'up' : 'down'}">${STAT_NAMES[k]} ${d > 0 ? '+' : '−'}${Math.abs(d)}</span>`);
    }
    if (!parts.length) return;
    const t = $('toast');
    t.innerHTML = parts.join(' · ');
    t.classList.add('show');
    clearTimeout(showDiff.timer);
    showDiff.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function renderStats() {
    $('stMoney').textContent = `${S.money} 两`;
    $('stRep').textContent = S.rep;
    const bar = $('stHp');
    bar.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('i');
      if (i < S.hp) el.className = 'on';
      bar.appendChild(el);
    }
    bar.classList.toggle('low', S.hp <= 3);
  }

  /* ───────── 场景 ───────── */

  const SCENES = {
    drought:        { bg: 'linear-gradient(180deg,#d9b77a 0%,#b3864c 45%,#6b4a2a 100%)', ridge: 0.45, fx: 'dust' },
    drought_spring: { bg: 'linear-gradient(180deg,#bcd2c4 0%,#d9c99a 50%,#7a6a44 100%)', ridge: 0.4, fx: 'mote' },
    night:          { bg: 'linear-gradient(180deg,#0b1020 0%,#18223a 55%,#0c0e14 100%)', ridge: 0.7, fx: 'star' },
    harbor:         { bg: 'linear-gradient(180deg,#9aaab2 0%,#6e8088 50%,#38464d 100%)', ridge: 0.25, fx: 'none' },
    sea:            { bg: 'linear-gradient(180deg,#2c3740 0%,#1c262d 50%,#0d1418 100%)', ridge: 0, fx: 'rain' },
    road:           { bg: 'linear-gradient(180deg,#b7b0a0 0%,#8b7f69 50%,#463c2f 100%)', ridge: 0.55, fx: 'dust' },
    snow:           { bg: 'linear-gradient(180deg,#a9b6c2 0%,#c9d1d8 45%,#6f7c88 100%)', ridge: 0.45, fx: 'snow' },
    forest:         { bg: 'linear-gradient(180deg,#3d5a48 0%,#22382b 50%,#0e1a12 100%)', ridge: 0.8, fx: 'mote' },
    mine:           { bg: 'linear-gradient(180deg,#3a2c21 0%,#21180f 55%,#0b0806 100%)', ridge: 0.6, fx: 'dust' },
    field:          { bg: 'linear-gradient(180deg,#c9d6d0 0%,#e2c682 48%,#3a2a1a 100%)', ridge: 0.3, fx: 'mote' },
    city:           { bg: 'linear-gradient(180deg,#5d5b60 0%,#3c3a3f 50%,#18171a 100%)', ridge: 0.5, fx: 'snow' },
    fire:           { bg: 'linear-gradient(180deg,#1c0d08 0%,#4a1a0c 55%,#1a0703 100%)', ridge: 0.8, fx: 'ember' },
  };

  let bgFront = 'bgA';
  let curScene = null;
  function setScene(name) {
    const sc = SCENES[name] || SCENES.night;
    if (curScene === name) return;
    curScene = name;
    const back = bgFront === 'bgA' ? 'bgB' : 'bgA';
    $(back).style.background = sc.bg;
    $(back).style.opacity = 1;
    $(bgFront).style.opacity = 0;
    bgFront = back;
    $('ridge').style.opacity = sc.ridge;
    particles.set(sc.fx);
  }

  /* ───────── 粒子 ───────── */

  const particles = (() => {
    const cv = $('fx');
    const ctx = cv.getContext('2d');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let kind = 'none', list = [], W = 0, H = 0, dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    const R = (a, b) => a + Math.random() * (b - a);
    function spawn(initial) {
      const p = { x: R(0, W), y: initial ? R(0, H) : -10, a: R(0.3, 1) };
      switch (kind) {
        case 'snow': p.r = R(1, 3.2); p.vx = R(-0.3, 0.3); p.vy = R(0.4, 1.2); break;
        case 'rain': p.r = R(10, 22); p.vx = -3; p.vy = R(12, 18); break;
        case 'dust': p.y = initial ? R(0, H) : R(0, H); p.x = initial ? R(0, W) : -10; p.r = R(0.8, 2); p.vx = R(0.2, 0.8); p.vy = R(-0.1, 0.1); break;
        case 'mote': p.r = R(1, 2.4); p.vx = R(-0.15, 0.15); p.vy = R(-0.3, -0.05); p.y = initial ? R(0, H) : H + 10; break;
        case 'ember': p.r = R(1, 2.6); p.vx = R(-0.4, 0.4); p.vy = R(-1.6, -0.5); p.y = initial ? R(0, H) : H + 10; break;
        case 'star': p.r = R(0.4, 1.4); p.vx = 0; p.vy = 0; p.y = R(0, H * 0.6); p.t = R(0, 6); break;
      }
      return p;
    }
    function set(k) {
      kind = reduce ? 'none' : (k || 'none');
      const n = { snow: 110, rain: 140, dust: 50, mote: 40, ember: 70, star: 120 }[kind] || 0;
      list = Array.from({ length: n }, () => spawn(true));
    }
    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.x += p.vx; p.y += p.vy;
        if (kind === 'snow') p.x += Math.sin((p.y + i * 13) / 40) * 0.3;
        const out = p.y > H + 30 || p.y < -30 || p.x > W + 30 || p.x < -30;
        if (out) { list[i] = spawn(false); continue; }
        if (kind === 'rain') {
          ctx.strokeStyle = `rgba(200,215,225,${p.a * 0.45})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 1.4, p.y + p.r); ctx.stroke();
        } else {
          let a = p.a;
          let color = '255,255,255';
          if (kind === 'dust') color = '240,215,170', a *= 0.5;
          if (kind === 'mote') color = '255,240,190', a *= 0.6;
          if (kind === 'ember') color = '255,150,70';
          if (kind === 'star') { p.t += 0.02; a = 0.4 + Math.sin(p.t) * 0.3; }
          ctx.fillStyle = `rgba(${color},${a})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return { set };
  })();

  /* ───────── 文字打字机 ───────── */

  let typing = null; // { paras, els, pi, ci, done, raf }

  function startTyping(paras, onDone) {
    const box = $('text');
    const els = paras.map(t => {
      const p = document.createElement('p');
      p.dataset.full = t;
      box.appendChild(p);
      return p;
    });
    typing = { els, pi: 0, ci: 0, acc: 0, last: performance.now(), onDone, done: false };
    $('hint').hidden = false;
    if (speed === 0) return finishTyping();
    const step = now => {
      if (!typing || typing.done) return;
      const dt = now - typing.last; typing.last = now;
      typing.acc += dt * speed / 1000;
      while (typing.acc >= 1 && !typing.done) {
        typing.acc -= 1;
        const el = typing.els[typing.pi];
        const full = el.dataset.full;
        typing.ci++;
        el.textContent = full.slice(0, typing.ci);
        el.classList.add('cur');
        if (typing.ci >= full.length) {
          el.classList.remove('cur');
          typing.pi++; typing.ci = 0;
          typing.acc -= speed * 0.25; // 段落之间稍作停顿
          if (typing.pi >= typing.els.length) return finishTyping();
        }
      }
      keepBottom();
      typing.raf = requestAnimationFrame(step);
    };
    typing.raf = requestAnimationFrame(step);
  }

  function finishTyping() {
    if (!typing || typing.done) return;
    typing.done = true;
    cancelAnimationFrame(typing.raf);
    typing.els.forEach(el => { el.textContent = el.dataset.full; el.classList.remove('cur'); });
    $('hint').hidden = true;
    const cb = typing.onDone;
    cb && cb();
  }

  function keepBottom() {
    const sc = $('scroll');
    sc.scrollTop = sc.scrollHeight;
  }

  /* ───────── 节点渲染 ───────── */

  function go(id) {
    if (id === 'end_death' || (S.hp <= 0 && !N[id].ending)) id = 'end_death';
    const node = N[id];
    if (!node) { console.error('缺少节点', id); return; }
    S.node = id;

    const before = snapshot();
    if (node.enter) {
      const fx = node.enter(S);
      if (fx) apply(fx);
    }
    if (S.hp <= 0 && !node.ending) { S.node = 'end_death'; return go('end_death'); }

    store.set(SAVE_KEY, S);
    render(node);
    showDiff(before);
  }

  function render(node) {
    const paper = $('paper');
    paper.classList.remove('show');
    setScene(node.scene);
    renderStats();

    setTimeout(() => {
      $('text').innerHTML = '';
      $('choices').innerHTML = '';
      $('scroll').scrollTop = 0;

      if (node.ending) {
        renderEnding(node);
      } else {
        $('hudChapter').textContent = node.ch || '';
        $('hudWhen').textContent = [val(node.when, S), val(node.where, S)].filter(Boolean).join(' · ');
        if (node.ch && node.ch !== render.lastCh) {
          const head = document.createElement('div');
          head.className = 'chapter-head';
          head.innerHTML = `<span class="seal">${node.ch}</span><small>${[val(node.when, S), val(node.where, S)].filter(Boolean).join(' · ')}</small>`;
          $('text').appendChild(head);
          render.lastCh = node.ch;
        }
        const paras = node.text.map(t => val(t, S)).filter(Boolean);
        paper.classList.add('show');
        startTyping(paras, () => renderChoices(node));
      }
    }, 280);
  }

  function renderChoices(node) {
    const box = $('choices');
    box.innerHTML = '';
    let list;
    if (node.choices) {
      list = node.choices.filter(c => !c.show || c.show(S));
    } else {
      list = [{ label: '继续', to: node.next }];
    }
    list.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.style.animationDelay = `${i * 80}ms`;
      const ok = !c.need || c.need(S);
      b.disabled = !ok;
      b.innerHTML = `<span class="num">${i + 1}</span><span>${val(c.label, S)}${ok ? '' : `<span class="why">（${c.needText || '条件不足'}）</span>`}</span>`;
      b.addEventListener('click', e => { e.stopPropagation(); choose(c); });
      box.appendChild(b);
    });
    keepBottom();
  }

  function choose(c) {
    if (choose.lock) return;
    choose.lock = true;
    setTimeout(() => { choose.lock = false; }, 400);
    const before = snapshot();
    apply(val(c.fx, S), val(c.set, S));
    const target = val(c.to, S);
    showDiff(before);
    if (S.hp <= 0) return go('end_death');
    go(target);
  }

  /* ───────── 结局 ───────── */

  function getEndings() { return store.get(END_KEY) || []; }

  function renderEnding(node) {
    const e = ENDINGS.find(x => x.id === node.ending);
    const got = getEndings();
    if (!got.includes(e.id)) { got.push(e.id); store.set(END_KEY, got); }
    store.del(SAVE_KEY);
    render.lastCh = null;

    const idx = ENDINGS.indexOf(e) + 1;
    $('hudChapter').textContent = '结局';
    $('hudWhen').textContent = e.title;

    const head = document.createElement('div');
    head.className = 'ending-head';
    head.innerHTML = `<span class="k">结局 ${idx} / ${ENDINGS.length}</span><span class="seal">${e.title}</span>`;
    $('text').appendChild(head);

    const paras = node.text.map(t => val(t, S)).filter(Boolean);
    $('paper').classList.add('show');
    startTyping(paras, () => {
      const after = document.createElement('p');
      after.className = 'afterword';
      after.textContent = `从清末到民国，前后有两千多万关内百姓闯了关东，其中山东人最多。他们大多没有留下名字。——已解锁结局 ${got.length} / ${ENDINGS.length}`;
      $('text').appendChild(after);

      const box = $('choices');
      box.innerHTML = '';
      [['再闯一回', () => startNew()], ['结局图鉴', () => openGallery()], ['回到标题', () => toTitle()]].forEach(([t, fn], i) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.style.animationDelay = `${i * 80}ms`;
        b.innerHTML = `<span class="num">${i + 1}</span><span>${t}</span>`;
        b.addEventListener('click', e => { e.stopPropagation(); fn(); });
        box.appendChild(b);
      });
      keepBottom();
    });
  }

  function openGallery() {
    const got = getEndings();
    $('galleryCount').textContent = `${got.length} / ${ENDINGS.length}`;
    $('endList').innerHTML = ENDINGS.map((e, i) => {
      const ok = got.includes(e.id);
      return `<li class="${ok ? '' : 'locked'}"><span class="no">${i + 1}</span><span><div class="t">${ok ? e.title : '？？？'}</div><div class="h">${e.hint}</div></span></li>`;
    }).join('');
    $('gallery').classList.add('show');
  }

  /* ───────── 流程 ───────── */

  function showGame() {
    $('title').classList.remove('show');
    $('hud').hidden = false;
    $('stage').hidden = false;
  }

  function startNew() {
    $('menu').classList.remove('show');
    $('gallery').classList.remove('show');
    S = newState();
    render.lastCh = null;
    showGame();
    go('p1');
  }

  function resume() {
    const saved = store.get(SAVE_KEY);
    if (!saved || !N[saved.node]) return startNew();
    S = saved;
    render.lastCh = null;
    showGame();
    render(N[S.node]); // 不重复结算进入效果
  }

  function toTitle() {
    if (typing) { typing.done = true; cancelAnimationFrame(typing.raf); }
    $('menu').classList.remove('show');
    $('gallery').classList.remove('show');
    $('hud').hidden = true;
    $('stage').hidden = true;
    $('paper').classList.remove('show');
    $('btnContinue').hidden = !store.get(SAVE_KEY);
    $('title').classList.add('show');
    setScene('drought');
  }

  /* ───────── 输入 ───────── */

  $('scroll').addEventListener('click', () => { if (typing && !typing.done) finishTyping(); });
  $('stage').addEventListener('click', e => {
    if (e.target === $('stage') && typing && !typing.done) finishTyping();
  });

  document.addEventListener('keydown', e => {
    if ($('title').classList.contains('show')) {
      if (e.key === 'Enter') (store.get(SAVE_KEY) ? resume : startNew)();
      return;
    }
    if (e.key === 'Escape') {
      if ($('gallery').classList.contains('show')) return $('gallery').classList.remove('show');
      return $('menu').classList.toggle('show');
    }
    if ($('menu').classList.contains('show') || $('gallery').classList.contains('show')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (typing && !typing.done) { e.preventDefault(); finishTyping(); return; }
      const btns = $('choices').querySelectorAll('.choice:not(:disabled)');
      if (btns.length === 1 && document.activeElement === document.body) { e.preventDefault(); btns[0].click(); }
      return;
    }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) {
      if (typing && !typing.done) finishTyping();
      const b = $('choices').querySelectorAll('.choice')[n - 1];
      if (b && !b.disabled) b.click();
    }
  });

  $('btnNew').addEventListener('click', () => {
    if (store.get(SAVE_KEY) && !confirm('开始新的一局会覆盖当前进度，确定吗？')) return;
    startNew();
  });
  $('btnContinue').addEventListener('click', resume);
  $('btnGallery').addEventListener('click', openGallery);
  $('btnGallery2').addEventListener('click', openGallery);
  $('btnCloseGallery').addEventListener('click', () => $('gallery').classList.remove('show'));
  $('menuBtn').addEventListener('click', () => $('menu').classList.add('show'));
  $('btnResume').addEventListener('click', () => $('menu').classList.remove('show'));
  $('btnRestart').addEventListener('click', () => { if (confirm('从头再来？当前进度会丢失。')) startNew(); });
  $('btnToTitle').addEventListener('click', toTitle);
  ['menu', 'gallery'].forEach(id => $(id).addEventListener('click', e => { if (e.target.id === id) $(id).classList.remove('show'); }));

  const speedBox = $('speed');
  function markSpeed() {
    speedBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === speed));
  }
  speedBox.addEventListener('click', e => {
    const v = e.target.dataset && e.target.dataset.v;
    if (v === undefined) return;
    speed = Number(v);
    store.set(SPEED_KEY, speed);
    markSpeed();
  });
  markSpeed();

  // 初始
  $('btnContinue').hidden = !store.get(SAVE_KEY);
  setScene('drought');
})();
