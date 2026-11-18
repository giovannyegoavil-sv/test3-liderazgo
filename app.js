(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $('#app');
  const TOPIC = Object.fromEntries(TOPICS.map(t => [t.id, t]));
  QUESTIONS.forEach((q, i) => { q.id = q.t + '-' + i; });

  /* ---------- storage (best effort) ---------- */
  const KEY = 'test3-liderazgo-v1';
  let S = { read: {}, wrong: {}, right: {}, exams: [], answered: 0 };
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  /* ---------- theme ---------- */
  try { const th = localStorage.getItem(KEY + '-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* ignore */ }
  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY + '-theme', next); } catch (e) { /* ignore */ }
  });

  /* ---------- Spanish subtitles toggle ---------- */
  let showTr = true;
  try { if (localStorage.getItem(KEY + '-tr') === '0') showTr = false; } catch (e) { /* ignore */ }
  const applyTr = () => {
    document.documentElement.classList.toggle('no-tr', !showTr);
    const b = $('#trBtn');
    b.classList.toggle('on', showTr);
    b.setAttribute('aria-pressed', String(showTr));
    b.title = showTr ? 'Ocultar traducción al español' : 'Mostrar traducción al español';
  };
  $('#trBtn').addEventListener('click', () => {
    showTr = !showTr;
    try { localStorage.setItem(KEY + '-tr', showTr ? '1' : '0'); } catch (e) { /* ignore */ }
    applyTr();
  });
  applyTr();

  /* ---------- helpers ---------- */
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const unwrap = s => { s = String(s).trim(); return /^\(.*\)$/s.test(s) ? s.slice(1, -1) : s; };
  const tr = s => s ? `<span class="tr">(${esc(unwrap(s))})</span>` : '';      // plain-text translation
  const trH = s => s ? `<span class="tr">(${unwrap(s)})</span>` : '';          // translation that may contain <b>/<i>
  const L = 'ABCDEF';
  const col = id => `style="--c:var(--c-${id})"`;
  const tagHTML = id => `<span class="tag" ${col(id)}>${esc(TOPIC[id].short)}</span>`;
  const KEEP_ORDER = /^(all|none|both) (of the above|of them|a and b)|^(a|b) and (b|c)\b/i;

  function prep(q) {
    const keep = q.fixed || q.o.some(o => KEEP_ORDER.test(o));
    const order = keep ? q.o.map((_, i) => i) : shuffle(q.o.map((_, i) => i));
    return { q, opts: order.map(i => q.o[i]), optsEs: order.map(i => (q.o_es || [])[i] || ''), correct: order.indexOf(q.a), chosen: null };
  }
  function record(item) {
    const id = item.q.id;
    S.answered = (S.answered || 0) + 1;
    if (item.chosen === item.correct) { S.right[id] = (S.right[id] || 0) + 1; delete S.wrong[id]; }
    else { S.wrong[id] = (S.wrong[id] || 0) + 1; }
  }
  const sectionsOf = t => t.sections.map((s, i) => t.id + ':' + i);
  const readCount = t => sectionsOf(t).filter(k => S.read[k]).length;

  /* ---------- router ---------- */
  const views = { home: viewHome, review: viewReview, cheat: viewCheat, cards: viewCards, practice: viewPractice, exam: viewExam };
  function render() {
    const [view, arg] = (location.hash.slice(1) || 'home').split('/');
    const active = view === 'cheat' ? 'review' : view;
    $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === active));
    (views[view] || viewHome)(arg);
    window.scrollTo(0, 0);
  }
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    if (location.hash === '#' + b.dataset.view) render(); else location.hash = b.dataset.view;
  });
  window.addEventListener('hashchange', render);

  /* ---------- HOME ---------- */
  function topicCard(t) {
    const total = t.sections.length, done = readCount(t);
    const nq = QUESTIONS.filter(q => q.t === t.id).length;
    return `<div class="card topic-card" ${col(t.id)}>
      <span class="tag" ${col(t.id)}>Tema ${t.n}</span>
      <h3 style="margin-top:8px">${esc(t.name)}${tr(t.name_es)}</h3>
      <div class="muted small">${esc(t.desc)}</div>
      <div class="progress"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
      <div class="muted small">${done}/${total} secciones repasadas · ${nq} preguntas</div>
      <div class="actions">
        <a class="btn" href="#review/${t.id}">📖 Repasar</a>
        <a class="btn" href="#practice/${t.id}">✍️ Practicar</a>
      </div>
    </div>`;
  }
  function viewHome() {
    const wrongN = Object.keys(S.wrong).length;
    const best = S.exams.length ? Math.max(...S.exams.map(e => e.score)) : null;
    const last = S.exams.length ? S.exams[S.exams.length - 1].score : null;
    app.innerHTML = `
      <section class="card">
        <span class="pill">📅 Miércoles 18 de noviembre · al inicio de la clase</span>
        <h1>Test N°3 — qué va a venir y cómo prepararte</h1>
        <div class="facts">
          <div><b>20</b><span>preguntas opción múltiple</span></div>
          <div><b>40</b><span>minutos<br>(≈2 min c/u)</span></div>
          <div><b>4</b><span>temas<br>(≈5 c/u)</span></div>
        </div>
        <div class="note warn">⚠️ <b>Llega temprano.</b> El test es al inicio de la clase; si llegas tarde y alguien ya salió del aula, <b>no te dejan entrar</b>.</div>
        <div class="note info">📌 Fuente oficial: <b>las diapositivas (PPT) y las grabaciones de Zoom</b>. Todo lo de esta web sale de las 4 PPT del curso. El examen está en <b>inglés</b>, así que las definiciones están en inglés con explicación en español.</div>
      </section>

      <h2>Ruta rápida de estudio</h2>
      <ol class="steps">
        <li><a href="#cheat"><b>Repaso exprés</b></a> — lo esencial de los 4 temas en una sola página (10 min).</li>
        <li><a href="#review"><b>Repaso completo</b></a> por tema: definiciones, listas y trampas (30–40 min).</li>
        <li><a href="#cards"><b>Flashcards</b></a> para memorizar términos y listas (10 min).</li>
        <li><a href="#practice"><b>Práctica por tema</b></a> con la explicación al instante.</li>
        <li><a href="#exam"><b>Simulacro</b></a>: 20 preguntas en 40 minutos, como el real.</li>
        <li><a href="#practice/errors"><b>Repite tus errores</b></a> hasta dejarlos en cero.</li>
      </ol>

      <h2>Los 4 temas del examen</h2>
      <div class="topic-grid">${TOPICS.map(topicCard).join('')}</div>

      <h2>Tu progreso</h2>
      <div class="stats">
        <div class="stat"><b>${QUESTIONS.length}</b><span>preguntas en el banco</span></div>
        <div class="stat"><b>${S.answered || 0}</b><span>respuestas practicadas</span></div>
        <div class="stat"><b>${wrongN}</b><span>errores por repasar</span></div>
        <div class="stat"><b>${best === null ? '—' : best + '/20'}</b><span>mejor simulacro${last === null ? '' : ' (último: ' + last + ')'}</span></div>
      </div>
      ${wrongN ? `<a class="btn primary block mt" href="#practice/errors">🔁 Practicar mis ${wrongN} errores</a>` : ''}
      <div class="actions mt"><button class="btn" id="resetBtn">Reiniciar progreso</button></div>`;
    $('#resetBtn').onclick = () => {
      if (confirm('¿Borrar tu progreso (secciones leídas, errores y simulacros)?')) {
        S = { read: {}, wrong: {}, right: {}, exams: [], answered: 0 }; save(); render();
      }
    };
  }

  /* ---------- REVIEW ---------- */
  function viewReview(id) {
    const t = TOPIC[id];
    if (!t) {
      app.innerHTML = `
        <h1>Repaso por tema</h1>
        <p class="muted">Empieza por el <b>repaso exprés</b> si tienes poco tiempo, luego entra a cada tema.</p>
        <a class="btn primary block" href="#cheat">⚡ Repaso exprés (los 4 temas en 1 página)</a>
        <div class="topic-grid mt">${TOPICS.map(topicCard).join('')}</div>`;
      return;
    }
    const idx = TOPICS.indexOf(t);
    const nextT = TOPICS[idx + 1];
    app.innerHTML = `
      <div class="topic-head" ${col(t.id)}>
        <span class="tag">Tema ${t.n} de ${TOPICS.length}</span>
        <h1>${esc(t.name)}${tr(t.name_es)}</h1>
        <p>${esc(t.desc)}</p>
      </div>
      <div class="card" ${col(t.id)}>
        <h3>⚡ Lo esencial en 60 segundos</h3>
        <ul>${t.quick.map(x => `<li>${x}</li>`).join('')}</ul>
      </div>
      <div class="toc">${t.sections.map((s, i) => `<a href="#" data-jump="${i}">${i + 1}. ${esc(s.title)}</a>`).join('')}</div>
      ${t.sections.map((s, i) => {
        const k = t.id + ':' + i;
        return `<details class="card section" id="sec-${i}" ${col(t.id)} ${i === 0 ? 'open' : ''}>
          <summary><span class="num">${i + 1}</span><span>${esc(s.title)}${tr(s.title_es)}</span>${S.read[k] ? '<span class="done-dot" title="Repasado"></span>' : ''}<span class="chev">›</span></summary>
          <div class="body">${s.body}
            ${s.es ? `<div class="note es">🇪🇸 <b>En simple:</b> ${s.es}</div>` : ''}
            ${s.trap ? `<div class="note trap">🎯 <b>Ojo en el examen:</b> ${s.trap}</div>` : ''}
            <label class="check"><input type="checkbox" data-k="${k}" ${S.read[k] ? 'checked' : ''}> Ya lo repasé</label>
          </div>
        </details>`;
      }).join('')}
      ${t.traps && t.traps.length ? `<div class="card"><h3>🎯 Trampas típicas de este tema</h3><ul>${t.traps.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      <div class="actions mt">
        <a class="btn primary" href="#practice/${t.id}">✍️ Practicar este tema</a>
        ${nextT ? `<a class="btn" href="#review/${nextT.id}">Siguiente tema →</a>` : `<a class="btn" href="#exam">🏁 Ir al simulacro</a>`}
      </div>`;
    $$('input[data-k]').forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) S.read[cb.dataset.k] = 1; else delete S.read[cb.dataset.k];
      save();
      const sum = cb.closest('details').querySelector('summary');
      const dot = sum.querySelector('.done-dot');
      if (cb.checked && !dot) sum.querySelector('.chev').insertAdjacentHTML('beforebegin', '<span class="done-dot"></span>');
      if (!cb.checked && dot) dot.remove();
    }));
    $$('[data-jump]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const d = $('#sec-' + a.dataset.jump); d.open = true; d.scrollIntoView({ behavior: 'smooth' });
    }));
  }

  function viewCheat() {
    app.innerHTML = `
      <h1>⚡ Repaso exprés</h1>
      <p class="muted">Lo que más probablemente pregunten, tema por tema. Léelo justo antes del examen.</p>
      ${TOPICS.map(t => `<div class="card cheat" ${col(t.id)} style="border-left:5px solid var(--c)">
        <h3>${t.n}. ${esc(t.name)}${tr(t.name_es)}</h3>
        <ul>${t.quick.map(x => `<li>${x}</li>`).join('')}</ul>
        <a class="small" href="#review/${t.id}">Ver tema completo →</a>
      </div>`).join('')}
      <a class="btn primary block mt" href="#exam">🏁 Hacer el simulacro</a>`;
  }

  /* ---------- FLASHCARDS ---------- */
  const F = { topic: 'all', deck: [], i: 0 };
  function buildDeck() { F.deck = shuffle(FLASH.filter(c => F.topic === 'all' || c.t === F.topic)); F.i = 0; }
  function viewCards() {
    if (!F.deck.length) buildDeck();
    const c = F.deck[F.i];
    app.innerHTML = `
      <h1>🃏 Flashcards</h1>
      <div class="chips">
        <button class="chip ${F.topic === 'all' ? 'on' : ''}" data-t="all">Todos</button>
        ${TOPICS.map(t => `<button class="chip ${F.topic === t.id ? 'on' : ''}" data-t="${t.id}">${esc(t.short)}</button>`).join('')}
      </div>
      <div class="qhead"><span>${tagHTML(c.t)}</span><span>${F.i + 1} / ${F.deck.length}</span></div>
      <div class="flash" id="flash" ${col(c.t)}>
        <div class="flash-inner">
          <div class="face front"><div class="term">${c.f}</div>${tr(c.f_es)}<div class="hint">Toca para ver la respuesta</div></div>
          <div class="face back"><div>${c.b}${trH(c.b_es)}</div></div>
        </div>
      </div>
      <div class="flash-nav">
        <button class="btn" id="fPrev">‹ Atrás</button>
        <button class="btn" id="fFlip">Voltear</button>
        <button class="btn primary" id="fNext">Sigue ›</button>
      </div>
      <div class="actions mt"><button class="btn" id="fShuf">🔀 Barajar</button></div>
      <div class="kbd-hint">Teclado: espacio = voltear · ← → = navegar</div>`;
    const flip = () => $('#flash').classList.toggle('flipped');
    const go = d => { F.i = (F.i + d + F.deck.length) % F.deck.length; viewCards(); };
    $('#flash').onclick = flip; $('#fFlip').onclick = flip;
    $('#fPrev').onclick = () => go(-1); $('#fNext').onclick = () => go(1);
    $('#fShuf').onclick = () => { buildDeck(); viewCards(); };
    $$('.chip[data-t]').forEach(b => b.onclick = () => { F.topic = b.dataset.t; buildDeck(); viewCards(); });
  }

  /* ---------- PRACTICE ---------- */
  let P = null; // {items, i, answered}
  const Pset = { topics: new Set(TOPICS.map(t => t.id)), n: 10 };
  function viewPractice(arg) {
    if (arg === 'errors') { startPractice(QUESTIONS.filter(q => S.wrong[q.id]), true); return; }
    if (arg && TOPIC[arg]) { Pset.topics = new Set([arg]); P = null; history.replaceState(null, '', '#practice'); }
    if (P) { renderQ(); return; }
    const wrongN = Object.keys(S.wrong).length;
    const avail = QUESTIONS.filter(q => Pset.topics.has(q.t)).length;
    app.innerHTML = `
      <h1>✍️ Práctica</h1>
      <p class="muted">Respondes y ves al instante si acertaste y <b>por qué</b>. Tus errores se guardan para repetirlos.</p>
      <div class="card">
        <h3>1. Elige los temas</h3>
        <div class="chips">${TOPICS.map(t => `<button class="chip ${Pset.topics.has(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.short)}</button>`).join('')}</div>
        <h3>2. ¿Cuántas preguntas?</h3>
        <div class="chips">${[10, 20, 0].map(n => `<button class="chip ${Pset.n === n ? 'on' : ''}" data-n="${n}">${n || 'Todas (' + avail + ')'}</button>`).join('')}</div>
        <button class="btn primary block mt" id="pStart" ${avail ? '' : 'disabled'}>Empezar práctica</button>
      </div>
      <button class="btn block" id="pErr" ${wrongN ? '' : 'disabled'}>🔁 Practicar solo mis errores (${wrongN})</button>`;
    $$('.chip[data-t]').forEach(b => b.onclick = () => {
      const t = b.dataset.t;
      if (Pset.topics.has(t) && Pset.topics.size > 1) Pset.topics.delete(t); else Pset.topics.add(t);
      viewPractice();
    });
    $$('.chip[data-n]').forEach(b => b.onclick = () => { Pset.n = +b.dataset.n; viewPractice(); });
    $('#pStart').onclick = () => {
      let pool = shuffle(QUESTIONS.filter(q => Pset.topics.has(q.t)));
      if (Pset.n) pool = pool.slice(0, Pset.n);
      startPractice(pool);
    };
    $('#pErr').onclick = () => startPractice(QUESTIONS.filter(q => S.wrong[q.id]), true);
  }
  function startPractice(pool, isErr) {
    if (!pool.length) { location.hash = 'practice'; return; }
    P = { items: shuffle(pool).map(prep), i: 0, err: !!isErr };
    if (location.hash !== '#practice') history.replaceState(null, '', '#practice');
    renderQ();
  }
  function renderQ() {
    const it = P.items[P.i];
    if (!it) { renderPracticeEnd(); return; }
    const n = P.items.length, answered = it.chosen !== null;
    const ok = answered && it.chosen === it.correct;
    app.innerHTML = `
      <div class="qhead"><span>${tagHTML(it.q.t)} ${P.err ? '<span class="tag" style="--c:var(--bad)">Mis errores</span>' : ''}</span><span>${P.i + 1} / ${n}</span></div>
      <div class="progress"><i style="width:${Math.round(P.i / n * 100)}%"></i></div>
      <div class="qtext">${esc(it.q.q)}${tr(it.q.q_es)}</div>
      <div class="opts">${it.opts.map((o, j) => {
        let cls = '';
        if (answered) { if (j === it.correct) cls = 'right'; else if (j === it.chosen) cls = 'wrong'; }
        return `<button class="opt ${cls}" data-j="${j}" ${answered ? 'disabled' : ''}><span class="letter">${L[j]}</span><span>${esc(o)}${tr(it.optsEs[j])}</span></button>`;
      }).join('')}</div>
      ${answered ? `<div class="feedback ${ok ? 'ok' : 'bad'}"><b class="res">${ok ? '✓ ¡Correcto!' : '✗ Incorrecto — la respuesta es ' + L[it.correct]}</b>${it.q.e}</div>` : ''}
      <div class="quiz-foot">
        <button class="btn" id="qQuit">Salir</button>
        ${answered ? `<button class="btn primary" id="qNext">${P.i + 1 < n ? 'Siguiente →' : 'Ver resultado'}</button>` : ''}
      </div>
      <div class="kbd-hint">Teclado: 1-4 o A-D para responder · Enter = siguiente</div>`;
    $$('.opt').forEach(b => b.onclick = () => answerPractice(+b.dataset.j));
    $('#qQuit').onclick = () => { if (confirm('¿Salir de la práctica?')) { P = null; viewPractice(); } };
    if (answered) { $('#qNext').onclick = () => { P.i++; renderQ(); window.scrollTo(0, 0); }; $('#qNext').focus({ preventScroll: true }); }
  }
  function answerPractice(j) {
    const it = P.items[P.i];
    if (it.chosen !== null) return;
    it.chosen = j; record(it); save(); renderQ();
    const fb = $('.feedback'); if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function renderPracticeEnd() {
    const n = P.items.length, right = P.items.filter(x => x.chosen === x.correct).length;
    const missed = P.items.filter(x => x.chosen !== x.correct);
    app.innerHTML = `
      <div class="card center">
        <div class="muted">Resultado</div>
        <div class="score-big">${right}/${n}</div>
        <div class="muted">${Math.round(right / n * 100)}% de aciertos</div>
      </div>
      <div class="actions">
        ${missed.length ? '<button class="btn primary" id="again">🔁 Repetir las que fallé</button>' : ''}
        <button class="btn" id="newP">Nueva práctica</button>
        <a class="btn" href="#exam">🏁 Simulacro</a>
      </div>
      ${missed.length ? `<h2>Repasa lo que fallaste</h2>${missed.map(reviewItem).join('')}` : '<p class="note key mt">¡Perfecto! No fallaste ninguna. 🎉</p>'}`;
    const again = $('#again');
    if (again) again.onclick = () => startPractice(missed.map(x => x.q), true);
    $('#newP').onclick = () => { P = null; viewPractice(); };
  }
  function reviewItem(x, k) {
    const ok = x.chosen === x.correct;
    return `<div class="card review-item ${ok ? 'r' : 'w'}">
      <div class="qhead"><span>${tagHTML(x.q.t)}</span><span>${typeof k === 'number' ? '#' + (k + 1) : ''}</span></div>
      <div class="qtext">${esc(x.q.q)}${tr(x.q.q_es)}</div>
      ${x.chosen === null ? '<div class="ans-line w">✗ Sin responder</div>' : ok ? '' : `<div class="ans-line w">✗ Tu respuesta: ${esc(x.opts[x.chosen])}${tr(x.optsEs[x.chosen])}</div>`}
      <div class="ans-line r">✓ Correcta: ${esc(x.opts[x.correct])}${tr(x.optsEs[x.correct])}</div>
      <div class="note es small">${x.q.e}</div>
    </div>`;
  }

  /* ---------- EXAM SIMULATION ---------- */
  let E = null; // {items, i, end, done, flags:Set}
  let tick = null;
  const EXAM_N = 20, EXAM_MIN = 40;
  function buildExam() {
    const per = Math.floor(EXAM_N / TOPICS.length);
    let picked = [];
    TOPICS.forEach(t => { picked = picked.concat(shuffle(QUESTIONS.filter(q => q.t === t.id)).slice(0, per)); });
    const rest = shuffle(QUESTIONS.filter(q => !picked.includes(q)));
    picked = picked.concat(rest.slice(0, EXAM_N - picked.length));
    return shuffle(picked).map(prep);
  }
  function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function startTick() {
    clearInterval(tick);
    tick = setInterval(() => {
      if (!E || E.done) { clearInterval(tick); return; }
      const left = E.end - Date.now();
      const el = $('#timer');
      if (el) { el.textContent = '⏱ ' + fmt(left); el.classList.toggle('low', left < 5 * 60 * 1000); }
      if (left <= 0) { submitExam(true); }
    }, 500);
  }
  function viewExam() {
    if (E && !E.done) { renderExamQ(); return; }
    if (E && E.done) { renderExamResult(); return; }
    const hist = S.exams.slice(-5).reverse();
    app.innerHTML = `
      <h1>🏁 Simulacro del Test N°3</h1>
      <div class="card">
        <div class="facts">
          <div><b>20</b><span>preguntas</span></div>
          <div><b>40</b><span>minutos</span></div>
          <div><b>5</b><span>por tema</span></div>
        </div>
        <ul class="small">
          <li>Igual que el real: opción múltiple, una sola respuesta correcta.</li>
          <li>No ves si acertaste hasta <b>entregar</b>. Puedes cambiar respuestas y marcar 🚩 las dudosas.</li>
          <li>Al terminar: nota sobre 20, resultado por tema y explicación de cada pregunta.</li>
          <li>Cada simulacro sale con preguntas y orden distintos.</li>
          <li>💡 Para practicar como el examen real (solo inglés), apaga la traducción con el botón <b>ES</b> de arriba.</li>
        </ul>
        <button class="btn primary block" id="eStart">Empezar simulacro (40:00)</button>
      </div>
      ${hist.length ? `<div class="card"><h3>Tus últimos simulacros</h3><ul>${hist.map(h => `<li>${new Date(h.date).toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} — <b>${h.score}/20</b> (${fmt(h.time)} usados)</li>`).join('')}</ul></div>` : ''}`;
    $('#eStart').onclick = () => {
      E = { items: buildExam(), i: 0, start: Date.now(), end: Date.now() + EXAM_MIN * 60000, done: false, flags: new Set() };
      startTick(); renderExamQ();
    };
  }
  function renderExamQ() {
    const it = E.items[E.i], n = E.items.length;
    const answeredN = E.items.filter(x => x.chosen !== null).length;
    app.innerHTML = `
      <div class="sticky-bar">
        <div class="qhead"><span id="timer" class="timer">⏱ ${fmt(E.end - Date.now())}</span><span><b>${answeredN}</b>/${n} respondidas</span></div>
        <div class="progress"><i style="width:${Math.round(answeredN / n * 100)}%"></i></div>
      </div>
      <div class="qhead mt"><span>Pregunta ${E.i + 1} de ${n}</span>
        <button class="chip ${E.flags.has(E.i) ? 'on' : ''}" id="eFlag">🚩 ${E.flags.has(E.i) ? 'Marcada' : 'Marcar duda'}</button></div>
      <div class="qtext">${esc(it.q.q)}${tr(it.q.q_es)}</div>
      <div class="opts">${it.opts.map((o, j) => `<button class="opt ${it.chosen === j ? 'sel' : ''}" data-j="${j}"><span class="letter">${L[j]}</span><span>${esc(o)}${tr(it.optsEs[j])}</span></button>`).join('')}</div>
      <div class="quiz-foot">
        <button class="btn" id="ePrev" ${E.i === 0 ? 'disabled' : ''}>← Anterior</button>
        ${E.i + 1 < n ? '<button class="btn primary" id="eNext">Siguiente →</button>' : '<button class="btn primary" id="eSubmit2">Entregar ✓</button>'}
      </div>
      <div class="grid-nav">${E.items.map((x, k) => `<button data-k="${k}" class="${x.chosen !== null ? 'ans' : ''} ${k === E.i ? 'cur' : ''} ${E.flags.has(k) ? 'flag' : ''}">${k + 1}</button>`).join('')}</div>
      <button class="btn block" id="eSubmit">Entregar examen</button>
      <div class="kbd-hint">Teclado: 1-4 o A-D para responder · ← → para moverte</div>`;
    $$('.opt').forEach(b => b.onclick = () => { it.chosen = +b.dataset.j; renderExamQ(); });
    $('#eFlag').onclick = () => { E.flags.has(E.i) ? E.flags.delete(E.i) : E.flags.add(E.i); renderExamQ(); };
    $('#ePrev').onclick = () => { if (E.i > 0) { E.i--; renderExamQ(); } };
    const nx = $('#eNext'); if (nx) nx.onclick = () => { E.i++; renderExamQ(); };
    $$('.grid-nav button').forEach(b => b.onclick = () => { E.i = +b.dataset.k; renderExamQ(); });
    const sub = () => {
      const blank = E.items.filter(x => x.chosen === null).length;
      if (confirm(blank ? `Tienes ${blank} pregunta(s) sin responder. ¿Entregar de todas formas?` : '¿Entregar el simulacro?')) submitExam(false);
    };
    $('#eSubmit').onclick = sub;
    const s2 = $('#eSubmit2'); if (s2) s2.onclick = sub;
  }
  function submitExam(timeout) {
    if (!E || E.done) return;
    E.done = true; E.timeout = timeout; clearInterval(tick);
    E.used = Math.min(Date.now(), E.end) - E.start;
    E.items.forEach(x => { if (x.chosen !== null) record(x); else { S.wrong[x.q.id] = (S.wrong[x.q.id] || 0) + 1; } });
    E.score = E.items.filter(x => x.chosen === x.correct).length;
    S.exams.push({ date: Date.now(), score: E.score, time: E.used });
    save();
    if (location.hash !== '#exam') location.hash = 'exam'; else renderExamResult();
  }
  function renderExamResult() {
    const n = E.items.length, sc = E.score;
    const msg = sc >= 18 ? '¡Excelente! Estás listo. 🎉' : sc >= 14 ? 'Muy bien. Repasa los errores y vuelve a intentarlo.' : sc >= 11 ? 'Aprobado, pero hay temas por reforzar.' : 'Toca repasar: revisa los temas en rojo y vuelve a practicar.';
    const by = TOPICS.map(t => {
      const its = E.items.filter(x => x.q.t === t.id);
      return { t, n: its.length, r: its.filter(x => x.chosen === x.correct).length };
    });
    app.innerHTML = `
      <div class="card center">
        ${E.timeout ? '<div class="note warn">⏱ Se acabó el tiempo: el simulacro se entregó automáticamente.</div>' : ''}
        <div class="muted">Tu nota</div>
        <div class="score-big">${sc}/${n}</div>
        <div class="muted">${Math.round(sc / n * 100)}% · tiempo usado ${fmt(E.used)}</div>
        <p><b>${msg}</b></p>
      </div>
      <div class="card"><h3>Resultado por tema</h3><div class="breakdown">
        ${by.map(b => `<div ${col(b.t.id)}><div class="row"><span>${esc(b.t.short)}</span><b>${b.r}/${b.n}</b></div><div class="progress"><i style="width:${b.n ? Math.round(b.r / b.n * 100) : 0}%"></i></div></div>`).join('')}
      </div></div>
      <div class="grid-nav">${E.items.map((x, k) => `<button data-k="${k}" class="${x.chosen === x.correct ? 'r' : 'w'}">${k + 1}</button>`).join('')}</div>
      <div class="actions">
        <button class="btn primary" id="eAgain">🔁 Nuevo simulacro</button>
        <a class="btn" href="#practice/errors">Practicar mis errores</a>
      </div>
      <h2>Revisión pregunta por pregunta</h2>
      ${E.items.map((x, k) => `<div id="rv-${k}">${reviewItem(x, k)}</div>`).join('')}`;
    $$('.grid-nav button').forEach(b => b.onclick = () => $('#rv-' + b.dataset.k).scrollIntoView({ behavior: 'smooth' }));
    $('#eAgain').onclick = () => { E = null; viewExam(); };
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const view = (location.hash.slice(1) || 'home').split('/')[0];
    const k = e.key.toLowerCase();
    const idx = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
    if (view === 'practice' && P && P.items[P.i]) {
      if (idx >= 0 && P.items[P.i].chosen === null && idx < P.items[P.i].opts.length) { e.preventDefault(); answerPractice(idx); }
      else if (e.key === 'Enter' && P.items[P.i].chosen !== null) { e.preventDefault(); P.i++; renderQ(); window.scrollTo(0, 0); }
    } else if (view === 'exam' && E && !E.done) {
      const it = E.items[E.i];
      if (idx >= 0 && idx < it.opts.length) { it.chosen = idx; renderExamQ(); }
      else if (e.key === 'ArrowRight' && E.i + 1 < E.items.length) { E.i++; renderExamQ(); }
      else if (e.key === 'ArrowLeft' && E.i > 0) { E.i--; renderExamQ(); }
    } else if (view === 'cards' && F.deck.length) {
      if (e.key === ' ') { e.preventDefault(); $('#flash').classList.toggle('flipped'); }
      else if (e.key === 'ArrowRight') { F.i = (F.i + 1) % F.deck.length; viewCards(); }
      else if (e.key === 'ArrowLeft') { F.i = (F.i - 1 + F.deck.length) % F.deck.length; viewCards(); }
    }
  });

  window.addEventListener('beforeunload', e => { if (E && !E.done) { e.preventDefault(); e.returnValue = ''; } });
  render();
})();
