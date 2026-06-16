/* ============================================================
   QUIZ LEGENDS — app.js
   Kabert Studio · LMKE
   ============================================================ */

'use strict';

/* ============================================================
   ── CONFIGURACIÓN SUPABASE ──
   Reemplaza con tus credenciales reales de supabase.com
   ============================================================ */
const SUPABASE_URL  = 'https://sdzovnnnzkctkjwnwzog.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkem92bm5uemtjdGtqd253em9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjA0NDAsImV4cCI6MjA5NzAzNjQ0MH0.pKs5KJjqI431dbxolREcCNkgXAOQ5pSAgFiKaApSLTs';
const ADMIN_KEY     = 'QL2025admin';   // Clave maestra del administrador

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ============================================================
   ── ESTADO GLOBAL ──
   ============================================================ */
const State = {
  user: null,            // { usuario, nombre_completo, curso }
  quiz: null,            // cuestionario activo
  answers: [],           // respuestas del jugador
  startTime: null,
  timerInterval: null,
  elapsedSecs: 0,
  currentQ: 0,
  editorQuiz: null,      // cuestionario en el editor
  isEditing: false,
};

/* ============================================================
   ── AUDIO (Web Audio API) ──
   ============================================================ */
const Audio = (() => {
  let ctx = null;
  const get = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  const play = (type, freq, freq2, dur, wave = 'sine', vol = 0.25) => {
    try {
      const c = get();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = wave;
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, c.currentTime + dur * 0.5);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.start(c.currentTime);
      o.stop(c.currentTime + dur);
    } catch(e) { /* silencioso */ }
  };

  return {
    click:     () => play('square', 880, null, 0.06, 'square', 0.12),
    select:    () => play('sine', 440, 660, 0.15),
    correct:   () => { play('sine',523,784,0.3); setTimeout(()=>play('sine',784,1046,0.2),150); },
    incorrect: () => play('sawtooth', 200, 100, 0.3, 'sawtooth', 0.15),
    victory:   () => {
      const notes=[523,659,784,1046];
      notes.forEach((n,i)=>setTimeout(()=>play('sine',n,n,0.35,undefined,0.2),i*120));
    },
    countdown: () => play('sine', 880, null, 0.12, 'sine', 0.3),
    go:        () => { play('sine',1046,1568,0.4,undefined,0.3); },
    achieve:   () => {
      setTimeout(()=>play('sine',659,880,0.2),0);
      setTimeout(()=>play('sine',880,1046,0.25),180);
    },
  };
})();

/* ============================================================
   ── PARTÍCULAS ──
   ============================================================ */
const Particles = (() => {
  let canvas, ctx, particles = [], animId;

  const init = () => {
    canvas = document.getElementById('particles');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 70; i++) spawn();
    loop();
  };

  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  const spawn = () => {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.4,
      dx: (Math.random() - 0.5) * 0.3,
      dy: -Math.random() * 0.5 - 0.1,
      alpha: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.5 ? '0,200,255' : '138,46,255',
    });
  };

  const loop = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
      p.x += p.dx; p.y += p.dy;
      if (p.y < -5) { particles[i] = { ...p, y: canvas.height + 5, x: Math.random() * canvas.width }; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();
    });
    animId = requestAnimationFrame(loop);
  };

  return { init };
})();

/* ============================================================
   ── UTILIDADES ──
   ============================================================ */
const Utils = {
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2),

  fmtTime: (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map(v => String(v).padStart(2,'0')).join(':');
  },

  secsFromStr: (str) => {
    // "HH:MM:SS"
    const parts = str.split(':').map(Number);
    return parts[0]*3600 + parts[1]*60 + parts[2];
  },

  // tiempo_ideal viene como minutos (ej: 10 → 600 seg)
  idealSecs: (mins) => Number(mins) * 60,

  showMsg: (id, msg, type = 'error') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = type === 'ok' ? 'msg-ok' : 'msg-error';
  },

  clearMsg: (...ids) => ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.className = 'hidden'; }
  }),

  today: () => {
    const d = new Date();
    return d.toLocaleDateString('es-BO', { year:'numeric', month:'2-digit', day:'2-digit' });
  },
};

/* ============================================================
   ── APP (navegación) ──
   ============================================================ */
const App = {
  showScreen: (id) => {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = '';
    });
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); el.style.display = 'flex'; }
    Audio.click();
  },

  openModal: (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    Audio.click();
  },

  closeModal: (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  },

  showRanking: async () => {
    App.openModal('modalRanking');
    await Ranking.load();
  },

  showProfile: async () => {
    App.openModal('modalProfile');
    await Profile.load();
  },

  showHistory: async () => {
    App.openModal('modalHistory');
    await History.load();
  },
};

/* ============================================================
   ── AUTH ──
   ============================================================ */
const Auth = {
  login: async () => {
    Audio.click();
    Utils.clearMsg('loginError');
    const usuario = document.getElementById('loginUser').value.trim().toLowerCase();
    const password = document.getElementById('loginPass').value;

    if (!usuario || !password) {
      Utils.showMsg('loginError', 'Completa todos los campos.'); return;
    }

    try {
      const { data, error } = await db.from('usuarios')
        .select('*').eq('usuario', usuario).eq('password', password).single();

      if (error || !data) {
        Utils.showMsg('loginError', 'Usuario o contraseña incorrectos.'); return;
      }

      State.user = { usuario: data.usuario, nombre_completo: data.nombre_completo, curso: data.curso };
      localStorage.setItem('ql_session', JSON.stringify(State.user));
      Auth.enterDashboard();
    } catch(e) {
      Utils.showMsg('loginError', 'Error de conexión. Intenta de nuevo.');
    }
  },

  register: async () => {
    Audio.click();
    Utils.clearMsg('regError', 'regOk');
    const nombre   = document.getElementById('regName').value.trim();
    const curso    = document.getElementById('regCurso').value;
    const usuario  = document.getElementById('regUser').value.trim().toLowerCase();
    const password = document.getElementById('regPass').value;

    if (!nombre || !curso || !usuario || !password) {
      Utils.showMsg('regError', 'Completa todos los campos.'); return;
    }
    if (/\s/.test(usuario)) {
      Utils.showMsg('regError', 'El usuario no puede tener espacios.'); return;
    }
    if (!/^[a-z0-9_]+$/.test(usuario)) {
      Utils.showMsg('regError', 'El usuario solo puede tener letras minúsculas, números y guión bajo.'); return;
    }

    try {
      const { data: exist } = await db.from('usuarios').select('usuario').eq('usuario', usuario).single();
      if (exist) { Utils.showMsg('regError', 'Ese usuario ya está en uso.'); return; }

      const { error } = await db.from('usuarios').insert({
        usuario, nombre_completo: nombre, curso, password
      });
      if (error) { Utils.showMsg('regError', 'Error al registrar. Intenta de nuevo.'); return; }

      Utils.showMsg('regOk', '¡Cuenta creada! Iniciando sesión...', 'ok');
      setTimeout(() => {
        State.user = { usuario, nombre_completo: nombre, curso };
        localStorage.setItem('ql_session', JSON.stringify(State.user));
        Auth.enterDashboard();
      }, 1200);
    } catch(e) {
      Utils.showMsg('regError', 'Error de conexión.');
    }
  },

  logout: () => {
    localStorage.removeItem('ql_session');
    State.user = null;
    App.showScreen('screenLanding');
    Audio.click();
  },

  enterDashboard: async () => {
    App.showScreen('screenDashboard');
    document.getElementById('hudName').textContent = State.user.nombre_completo;
    document.getElementById('hudCurso').textContent = State.user.curso;
    await Dashboard.load();
    Audio.select();
  },

  checkSession: () => {
    const raw = localStorage.getItem('ql_session');
    if (!raw) return;
    try {
      State.user = JSON.parse(raw);
      Auth.enterDashboard();
    } catch(e) { localStorage.removeItem('ql_session'); }
  },
};

/* ============================================================
   ── DASHBOARD ──
   ============================================================ */
const Dashboard = {
  load: async () => {
    await Dashboard.loadStats();
    await Dashboard.loadQuizzes();
    Dashboard.renderAchievements();
  },

  loadStats: async () => {
    if (!State.user) return;
    try {
      const { data } = await db.from('records')
        .select('mejor_puntaje, mejor_tiempo, puntaje_final, cantidad_intentos')
        .eq('usuario', State.user.usuario);

      const records = data || [];
      const totalQ  = records.length;
      const bestScore = records.reduce((m,r)=>Math.max(m, r.mejor_puntaje||0), 0);
      const totalPts  = records.reduce((s,r)=>s+(r.puntaje_final||0), 0);
      const bestTime  = records.filter(r=>r.mejor_tiempo).map(r=>r.mejor_tiempo)
        .sort((a,b)=>Utils.secsFromStr(a)-Utils.secsFromStr(b))[0] || '--';

      document.getElementById('dashStats').innerHTML = `
        <div class="stat-chip"><span class="sc-val">${totalQ}</span><span class="sc-lbl">Cuestionarios</span></div>
        <div class="stat-chip"><span class="sc-val">${bestScore}</span><span class="sc-lbl">Mejor Puntaje</span></div>
        <div class="stat-chip"><span class="sc-val">${totalPts}</span><span class="sc-lbl">Total Puntos</span></div>
        <div class="stat-chip"><span class="sc-val">${bestTime}</span><span class="sc-lbl">Mejor Tiempo</span></div>
      `;
      // Store for achievements
      State._stats = { totalQ, totalPts, records };
    } catch(e) { /* ignore */ }
  },

  loadQuizzes: async () => {
    if (!State.user) return;
    const el = document.getElementById('quizList');
    el.innerHTML = '<p style="color:var(--muted);font-size:.9rem">Cargando...</p>';

    try {
      const { data: quizzes } = await db.from('cuestionarios')
        .select('id, nombre, curso_destinatario, puntaje_maximo, tiempo_ideal')
        .eq('curso_destinatario', State.user.curso);

      const { data: records } = await db.from('records')
        .select('cuestionario_id, cantidad_intentos, mejor_puntaje, mejor_tiempo')
        .eq('usuario', State.user.usuario);

      const recMap = {};
      (records || []).forEach(r => { recMap[r.cuestionario_id] = r; });

      if (!quizzes || !quizzes.length) {
        el.innerHTML = '<p style="color:var(--muted);font-size:.9rem">No hay cuestionarios disponibles para tu curso.</p>';
        return;
      }

      el.innerHTML = quizzes.map(q => {
        const rec   = recMap[q.id];
        const tries = rec ? rec.cantidad_intentos : 0;
        const locked = tries >= 3;
        const badge  = locked ? '💥 BLOQUEADO' : (tries > 0 ? `✏️ Intento ${tries}/3` : '🆕 Nuevo');
        const badgeClass = locked ? '' : 'ok';

        return `<div class="quiz-card ${locked?'locked':''}" onclick="${locked ? '' : `Quiz.preview('${q.id}')`}">
          <div class="qc-badge ${badgeClass}">${badge}</div>
          <div class="qc-name">${q.nombre}</div>
          <div class="qc-meta">
            📚 ${q.curso_destinatario}<br>
            ⭐ Puntaje máx: <b>${q.puntaje_maximo}</b><br>
            ⏱ Tiempo ideal: <b>${q.tiempo_ideal} min</b>
            ${rec ? `<br>🏆 Mejor: <b>${rec.mejor_puntaje}</b>` : ''}
          </div>
        </div>`;
      }).join('');
    } catch(e) {
      el.innerHTML = '<p style="color:var(--red);font-size:.9rem">Error al cargar cuestionarios.</p>';
    }
  },

  renderAchievements: () => {
    const stats = State._stats || {};
    const totalQ = stats.totalQ || 0;
    const records = stats.records || [];
    const avg = records.length
      ? records.reduce((s,r)=>s+(r.porcentaje||0),0)/records.length
      : 0;

    const defs = [
      { icon:'🥉', name:'Aprendiz',  desc:'Primer cuestionario completado', ok: totalQ >= 1 },
      { icon:'🥈', name:'Experto',   desc:'5 cuestionarios completados',    ok: totalQ >= 5 },
      { icon:'🥇', name:'Maestro',   desc:'10 cuestionarios completados',   ok: totalQ >= 10 },
      { icon:'👑', name:'Leyenda',   desc:'Promedio superior al 90%',       ok: avg >= 90 },
    ];

    document.getElementById('achievementsBar').innerHTML = defs.map(a => `
      <div class="ach-chip ${a.ok?'unlocked':''}">
        <span class="ach-icon">${a.icon}</span>
        <div>
          <span class="ach-name">${a.name}</span>
          <span class="ach-desc">${a.desc}</span>
        </div>
      </div>`).join('');
  },
};

/* ============================================================
   ── QUIZ ──
   ============================================================ */
const Quiz = {
  preview: async (quizId) => {
    Audio.click();
    try {
      const { data } = await db.from('cuestionarios').select('*').eq('id', quizId).single();
      if (!data) return;
      State.quiz = data;

      const { data: rec } = await db.from('records')
        .select('*').eq('usuario', State.user.usuario).eq('cuestionario_id', quizId).single();
      State.record = rec || null;

      const tries = rec ? rec.cantidad_intentos : 0;
      document.getElementById('mqTitle').textContent   = data.nombre;
      document.getElementById('mqInfo').innerHTML = `
        <b>Curso:</b> ${data.curso_destinatario}<br>
        <b>Preguntas:</b> ${(data.preguntas||[]).length}<br>
        <b>Puntaje máximo:</b> ${data.puntaje_maximo}<br>
        <b>Tiempo ideal:</b> ${data.tiempo_ideal} minutos
      `;

      let dotsHTML = '';
      for (let i=1;i<=3;i++) {
        dotsHTML += `<span class="attempt-dot ${i<=tries?'used':'avail'}">${i}</span>`;
      }
      document.getElementById('mqAttempts').innerHTML = `Intentos: ${dotsHTML}`;

      const startBtn = document.getElementById('mqStart');
      startBtn.disabled = tries >= 3;
      startBtn.textContent = tries >= 3 ? '💥 BLOQUEADO' : '⚡ INICIAR';

      App.openModal('modalQuiz');
    } catch(e) { /* ignore */ }
  },

  start: async () => {
    App.closeModal('modalQuiz');
    Audio.click();
    // Fullscreen
    try {
      await document.documentElement.requestFullscreen();
    } catch(e) { /* permitir sin fullscreen en iOS */ }
    Quiz.countdown();
  },

  countdown: () => {
    App.openModal('modalCountdown');
    const steps = ['PREPÁRATE', '3','2','1','¡COMIENZA!'];
    let i = 0;
    const tick = () => {
      const cdText = document.getElementById('cdText');
      const cdNum  = document.getElementById('cdNum');
      if (i === 0) {
        cdText.textContent = 'PREPÁRATE'; cdNum.textContent = '';
        Audio.select();
      } else if (i < 4) {
        cdText.textContent = ''; cdNum.textContent = steps[i];
        Audio.countdown();
      } else {
        cdText.textContent = '¡COMIENZA!'; cdNum.textContent = '';
        Audio.go();
        setTimeout(() => {
          App.closeModal('modalCountdown');
          Quiz.initGame();
        }, 700);
        return;
      }
      i++;
      setTimeout(tick, 900);
    };
    tick();
  },

  initGame: () => {
    State.answers    = [];
    State.currentQ   = 0;
    State.startTime  = Date.now();
    State.elapsedSecs = 0;

    App.showScreen('screenQuiz');
    Quiz.startTimer();
    Quiz.renderQuestion();

    // Fullscreen change listener
    document.addEventListener('fullscreenchange', Quiz.onFullscreenChange);
  },

  startTimer: () => {
    clearInterval(State.timerInterval);
    State.timerInterval = setInterval(() => {
      State.elapsedSecs++;
      const el = document.getElementById('qTimer');
      if (el) {
        el.textContent = Utils.fmtTime(State.elapsedSecs);
        // Urgent if > 2x ideal
        const idealS = Utils.idealSecs(State.quiz.tiempo_ideal);
        el.classList.toggle('urgent', State.elapsedSecs > idealS * 2);
      }
    }, 1000);
  },

  renderQuestion: () => {
    const q = State.quiz.preguntas[State.currentQ];
    const total = State.quiz.preguntas.length;

    document.getElementById('qProgress').textContent =
      `Pregunta ${State.currentQ + 1} / ${total}`;

    document.getElementById('questionText').textContent = q.pregunta;

    const labels = ['A','B','C','D'];
    document.getElementById('optionsGrid').innerHTML = q.opciones.map((op, i) => `
      <button class="option-btn" onclick="Quiz.answer(${i})">${labels[i]}) ${op}</button>
    `).join('');
  },

  answer: (idx) => {
    const q = State.quiz.preguntas[State.currentQ];
    const isCorrect = idx === q.correcta;

    State.answers.push({ selected: idx, correct: q.correcta, ok: isCorrect });

    // Visual feedback
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true);
    btns[idx].classList.add(isCorrect ? 'correct' : 'wrong');
    if (!isCorrect) {
      btns[q.correcta].classList.add('correct');
      if (navigator.vibrate) navigator.vibrate([80,30,80]);
    }

    isCorrect ? Audio.correct() : Audio.incorrect();

    setTimeout(() => {
      State.currentQ++;
      if (State.currentQ < State.quiz.preguntas.length) {
        Quiz.renderQuestion();
      } else {
        Quiz.finish();
      }
    }, 900);
  },

  finish: async () => {
    clearInterval(State.timerInterval);
    document.removeEventListener('fullscreenchange', Quiz.onFullscreenChange);

    // Exit fullscreen
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch(e) {}
    }

    // Calcular puntaje
    const total   = State.quiz.preguntas.length;
    const correct = State.answers.filter(a=>a.ok).length;
    const pct     = Math.round((correct / total) * 100);
    const maxPts  = State.quiz.puntaje_maximo;
    const idealS  = Utils.idealSecs(State.quiz.tiempo_ideal);
    const elapsed = State.elapsedSecs;
    const timeStr = Utils.fmtTime(elapsed);

    let bonus = 0;
    if (elapsed < idealS) {
      bonus = Math.round(((idealS - elapsed) * 0.1) * (pct / 100));
    }
    const puntajeBase  = Math.round((correct / total) * maxPts);
    const puntajeFinal = puntajeBase + bonus;

    State.result = { total, correct, pct, puntajeFinal, puntajeBase, bonus, timeStr, elapsed };

    await Quiz.saveRecord(puntajeFinal, pct, timeStr);
    Quiz.showResult();
    Audio.victory();
    Quiz.confetti();
  },

  saveRecord: async (puntajeFinal, pct, timeStr) => {
    const u = State.user;
    const q = State.quiz;
    try {
      const { data: existing } = await db.from('records')
        .select('*').eq('usuario', u.usuario).eq('cuestionario_id', q.id).single();

      const tries = existing ? existing.cantidad_intentos + 1 : 1;
      const isBetter = !existing || puntajeFinal > existing.mejor_puntaje;
      const betterTime = !existing || State.elapsedSecs < Utils.secsFromStr(existing.mejor_tiempo || '99:99:99');

      if (!existing) {
        await db.from('records').insert({
          id: Utils.uid(),
          usuario: u.usuario,
          nombre_completo: u.nombre_completo,
          curso: u.curso,
          cuestionario_id: q.id,
          cuestionario_nombre: q.nombre,
          intento1: puntajeFinal,
          intento2: null, intento3: null,
          intento_nro: 1,
          cantidad_intentos: 1,
          mejor_puntaje: puntajeFinal,
          mejor_tiempo: timeStr,
          ultimo_intento: puntajeFinal,
          tiempo_empleado: timeStr,
          porcentaje: pct,
          puntaje_final: puntajeFinal,
        });
      } else {
        const upd = {
          ultimo_intento: puntajeFinal,
          tiempo_empleado: timeStr,
          porcentaje: pct,
          puntaje_final: puntajeFinal,
          cantidad_intentos: tries,
          intento_nro: tries,
        };
        if (tries === 2) upd.intento2 = puntajeFinal;
        if (tries === 3) upd.intento3 = puntajeFinal;
        if (isBetter)   upd.mejor_puntaje = puntajeFinal;
        if (betterTime) upd.mejor_tiempo  = timeStr;

        await db.from('records')
          .update(upd)
          .eq('usuario', u.usuario)
          .eq('cuestionario_id', q.id);
      }

      State.result.intento = tries;
    } catch(e) { State.result.intento = 1; }
  },

  showResult: () => {
    const r = State.result;
    const icon = r.pct >= 90 ? '🏆' : r.pct >= 70 ? '🥈' : r.pct >= 50 ? '🥉' : '😤';
    const title = r.pct >= 90 ? '¡LEYENDA!' : r.pct >= 70 ? '¡GRAN RESULTADO!' : r.pct >= 50 ? '¡APROBADO!' : 'SIGUE INTENTANDO';

    document.getElementById('resultIcon').textContent = icon;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultStats').innerHTML = `
      <div class="rs-row"><span class="rs-lbl">Correctas</span><span class="rs-val">${r.correct} / ${r.total}</span></div>
      <div class="rs-row"><span class="rs-lbl">Porcentaje</span><span class="rs-val">${r.pct}%</span></div>
      <div class="rs-row"><span class="rs-lbl">Puntaje base</span><span class="rs-val">${r.puntajeBase}</span></div>
      <div class="rs-row"><span class="rs-lbl">Bonificación velocidad</span><span class="rs-val">+${r.bonus}</span></div>
      <div class="rs-row"><span class="rs-lbl">Puntaje final</span><span class="rs-val" style="color:var(--gold)">${r.puntajeFinal}</span></div>
      <div class="rs-row"><span class="rs-lbl">Tiempo empleado</span><span class="rs-val">${r.timeStr}</span></div>
      <div class="rs-row"><span class="rs-lbl">Intento</span><span class="rs-val">${r.intento} / 3</span></div>
    `;
    App.showScreen('screenResult');

    // Logro nuevo
    setTimeout(() => Quiz.checkAchievements(), 1200);
  },

  checkAchievements: async () => {
    if (!State.user) return;
    const { data: records } = await db.from('records')
      .select('cantidad_intentos, porcentaje').eq('usuario', State.user.usuario);
    const totalQ = (records||[]).length;
    const avg = totalQ ? (records||[]).reduce((s,r)=>s+(r.porcentaje||0),0)/totalQ : 0;

    const milestones = [
      { threshold: 1, check: totalQ >= 1 },
      { threshold: 5, check: totalQ >= 5 },
      { threshold: 10, check: totalQ >= 10 },
      { threshold: 'legend', check: avg >= 90 },
    ];
    milestones.forEach(m => {
      if (m.check) Audio.achieve();
    });
  },

  exitFullscreen: async () => {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch(e) {}
    }
  },

  reenterFullscreen: async () => {
    App.closeModal('modalFSWarn');
    try { await document.documentElement.requestFullscreen(); } catch(e) {}
  },

  forceEnd: async () => {
    App.closeModal('modalFSWarn');
    clearInterval(State.timerInterval);
    document.removeEventListener('fullscreenchange', Quiz.onFullscreenChange);
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch(e) {}
    }
    App.showScreen('screenDashboard');
    await Dashboard.load();
  },

  onFullscreenChange: () => {
    if (!document.fullscreenElement && App._activeScreen() === 'screenQuiz') {
      App.openModal('modalFSWarn');
    }
  },

  confetti: () => {
    const colors = ['#00C8FF','#8A2EFF','#FFD700','#00FF99','#FF4D4D','#fff'];
    for (let i = 0; i < 80; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.cssText = `
          left: ${Math.random()*100}vw;
          background: ${colors[Math.floor(Math.random()*colors.length)]};
          width: ${6+Math.random()*8}px;
          height: ${10+Math.random()*12}px;
          animation-duration: ${1.5+Math.random()*2}s;
          animation-delay: ${Math.random()*0.5}s;
          transform: rotate(${Math.random()*360}deg);
        `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 4000);
      }, i * 20);
    }
  },

  downloadPDF: () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const u = State.user;
    const q = State.quiz;
    const r = State.result;
    const W = 210, cx = W/2;

    // Fondo oscuro
    doc.setFillColor(8, 17, 31);
    doc.rect(0, 0, 210, 297, 'F');

    // Header gradient strip
    doc.setFillColor(0, 200, 255);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setFillColor(138, 46, 255);
    doc.rect(0, 20, 210, 12, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28); doc.setTextColor(255,255,255);
    doc.text('QUIZ LEGENDS', cx, 14, { align:'center' });
    doc.setFontSize(9); doc.setTextColor(220,220,255);
    doc.text('Kabert Studio · LMKE', cx, 26, { align:'center' });

    // Badge icon
    const icon = r.pct >= 90 ? '★ LEYENDA' : r.pct >= 70 ? '◆ EXCELENTE' : r.pct >= 50 ? '● APROBADO' : '○ INTENTO';
    doc.setFontSize(13); doc.setTextColor(255, 215, 0);
    doc.text(icon, cx, 46, { align:'center' });

    // Student card
    doc.setFillColor(16, 29, 51);
    doc.roundedRect(15, 52, 180, 70, 4, 4, 'F');
    doc.setDrawColor(0, 200, 255); doc.setLineWidth(0.4);
    doc.roundedRect(15, 52, 180, 70, 4, 4, 'S');

    const field = (label, val, y) => {
      doc.setFontSize(8); doc.setTextColor(120, 145, 180); doc.setFont('helvetica','normal');
      doc.text(label.toUpperCase(), 25, y);
      doc.setFontSize(11); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
      doc.text(String(val), 25, y+6);
    };

    field('Estudiante',  u.nombre_completo, 62);
    field('Curso',       u.curso,           78);
    field('Cuestionario',q.nombre,          94);
    field('Fecha',       Utils.today(),     110);

    // Score panel
    doc.setFillColor(16, 29, 51);
    doc.roundedRect(15, 130, 55, 40, 4, 4, 'F');
    doc.setDrawColor(255,215,0); doc.roundedRect(15,130,55,40,4,4,'S');
    doc.setFontSize(7); doc.setTextColor(120,145,180); doc.setFont('helvetica','normal');
    doc.text('PUNTAJE FINAL', 42, 140, {align:'center'});
    doc.setFontSize(26); doc.setTextColor(255,215,0); doc.setFont('helvetica','bold');
    doc.text(String(r.puntajeFinal), 42, 158, {align:'center'});

    doc.setFillColor(16,29,51);
    doc.roundedRect(77,130,55,40,4,4,'F');
    doc.setDrawColor(0,200,255); doc.roundedRect(77,130,55,40,4,4,'S');
    doc.setFontSize(7); doc.setTextColor(120,145,180); doc.setFont('helvetica','normal');
    doc.text('PORCENTAJE', 104, 140, {align:'center'});
    doc.setFontSize(26); doc.setTextColor(0,200,255); doc.setFont('helvetica','bold');
    doc.text(r.pct+'%', 104, 158, {align:'center'});

    doc.setFillColor(16,29,51);
    doc.roundedRect(139,130,56,40,4,4,'F');
    doc.setDrawColor(0,255,153); doc.roundedRect(139,130,56,40,4,4,'S');
    doc.setFontSize(7); doc.setTextColor(120,145,180); doc.setFont('helvetica','normal');
    doc.text('TIEMPO', 167, 140, {align:'center'});
    doc.setFontSize(14); doc.setTextColor(0,255,153); doc.setFont('helvetica','bold');
    doc.text(r.timeStr, 167, 158, {align:'center'});

    // Detail rows
    const rows = [
      ['Respuestas Correctas', `${r.correct} / ${r.total}`],
      ['Puntaje Base',         String(r.puntajeBase)],
      ['Bonificación Velocidad', `+${r.bonus}`],
      ['Intento',              `${r.intento} de 3`],
    ];
    let ry = 183;
    rows.forEach(([lbl, val]) => {
      doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(120,145,180);
      doc.text(lbl, 25, ry);
      doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
      doc.text(val, 185, ry, {align:'right'});
      doc.setDrawColor(30,50,80); doc.setLineWidth(0.2);
      doc.line(25, ry+3, 185, ry+3);
      ry += 12;
    });

    // Footer
    doc.setFillColor(0,200,255);
    doc.rect(0,282,210,15,'F');
    doc.setFontSize(8); doc.setTextColor(8,17,31); doc.setFont('helvetica','bold');
    doc.text('"Conquista el conocimiento. Rompe récords. Conviértate en leyenda."', cx, 291, {align:'center'});

    const fname = `QuizLegends_${u.usuario}_${q.nombre.replace(/\s+/g,'_')}.pdf`;
    doc.save(fname);
    Audio.click();
  },
};

// Helper para screen activa
App._activeScreen = () => {
  const el = document.querySelector('.screen.active');
  return el ? el.id : null;
};

/* ============================================================
   ── RANKING ──
   ============================================================ */
const Ranking = {
  load: async () => {
    const el = document.getElementById('rankingTable');
    el.innerHTML = '<p style="color:var(--muted);font-size:.9rem;padding:1rem">Cargando...</p>';

    try {
      const { data } = await db.from('records')
        .select('nombre_completo, curso, cuestionario_nombre, mejor_puntaje, mejor_tiempo, cantidad_intentos')
        .order('mejor_puntaje', { ascending: false })
        .limit(20);

      if (!data || !data.length) {
        el.innerHTML = '<p style="color:var(--muted);font-size:.9rem;padding:1rem">Aún no hay récords.</p>';
        return;
      }

      // Sort: mayor puntaje → menor tiempo
      data.sort((a,b)=> {
        if (b.mejor_puntaje !== a.mejor_puntaje) return b.mejor_puntaje - a.mejor_puntaje;
        const ta = Utils.secsFromStr(a.mejor_tiempo||'99:99:99');
        const tb = Utils.secsFromStr(b.mejor_tiempo||'99:99:99');
        return ta - tb;
      });

      const posClass = i => i===0?'gold':i===1?'silver':i===2?'bronze':'';

      el.innerHTML = `<table>
        <thead><tr>
          <th>#</th><th>Nombre</th><th>Curso</th><th>Cuestionario</th>
          <th>Puntaje</th><th>Tiempo</th><th>Intentos</th>
        </tr></thead>
        <tbody>${data.map((r,i)=>`<tr>
          <td><span class="rank-pos ${posClass(i)}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span></td>
          <td>${r.nombre_completo}</td>
          <td style="font-size:.78rem;color:var(--muted)">${r.curso}</td>
          <td style="font-size:.78rem">${r.cuestionario_nombre||''}</td>
          <td><span class="rank-score">${r.mejor_puntaje}</span></td>
          <td style="font-family:var(--font-hud);font-size:.78rem;color:var(--green)">${r.mejor_tiempo||'--'}</td>
          <td style="color:var(--muted)">${r.cantidad_intentos}</td>
        </tr>`).join('')}
        </tbody></table>`;
    } catch(e) {
      el.innerHTML = '<p style="color:var(--red);font-size:.9rem;padding:1rem">Error al cargar ranking.</p>';
    }
  },
};

/* ============================================================
   ── PROFILE ──
   ============================================================ */
const Profile = {
  load: async () => {
    const el = document.getElementById('profileContent');
    if (!State.user) return;
    try {
      const { data } = await db.from('records')
        .select('mejor_puntaje, mejor_tiempo, puntaje_final, porcentaje, cuestionario_nombre')
        .eq('usuario', State.user.usuario);

      const records = data || [];
      const totalQ  = records.length;
      const totalPts = records.reduce((s,r)=>s+(r.puntaje_final||0),0);
      const bestScore = records.reduce((m,r)=>Math.max(m,r.mejor_puntaje||0),0);
      const bestTime  = records.map(r=>r.mejor_tiempo).filter(Boolean)
        .sort((a,b)=>Utils.secsFromStr(a)-Utils.secsFromStr(b))[0]||'--';
      const avg = totalQ ? Math.round(records.reduce((s,r)=>s+(r.porcentaje||0),0)/totalQ) : 0;

      const rows = [
        ['Nombre',          State.user.nombre_completo],
        ['Curso',           State.user.curso],
        ['Usuario',         State.user.usuario],
        ['Cuestionarios',   totalQ],
        ['Total Puntos',    totalPts],
        ['Mejor Puntaje',   bestScore],
        ['Mejor Tiempo',    bestTime],
        ['Promedio',        avg+'%'],
      ];

      el.innerHTML = rows.map(([l,v])=>`
        <div class="p-row"><span class="p-lbl">${l}</span><span class="p-val">${v}</span></div>
      `).join('');
    } catch(e) {
      el.innerHTML = '<p style="color:var(--muted)">Error al cargar perfil.</p>';
    }
  },
};

/* ============================================================
   ── HISTORY ──
   ============================================================ */
const History = {
  load: async () => {
    const el = document.getElementById('historyContent');
    if (!State.user) return;
    try {
      const { data } = await db.from('records')
        .select('cuestionario_nombre, mejor_puntaje, puntaje_final, porcentaje, mejor_tiempo, tiempo_empleado, cantidad_intentos')
        .eq('usuario', State.user.usuario)
        .order('puntaje_final', { ascending: false });

      if (!data||!data.length) {
        el.innerHTML = '<p style="color:var(--muted);padding:1rem">Aún no tienes historial.</p>'; return;
      }

      el.innerHTML = `<table>
        <thead><tr>
          <th>Cuestionario</th><th>Mejor Pts</th><th>Último Pts</th>
          <th>%</th><th>Mejor Tiempo</th><th>Intentos</th>
        </tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td>${r.cuestionario_nombre}</td>
          <td style="color:var(--gold);font-weight:700">${r.mejor_puntaje}</td>
          <td>${r.puntaje_final}</td>
          <td style="color:var(--cyan)">${r.porcentaje}%</td>
          <td style="font-family:var(--font-hud);font-size:.78rem;color:var(--green)">${r.mejor_tiempo||'--'}</td>
          <td style="color:var(--muted)">${r.cantidad_intentos}</td>
        </tr>`).join('')}
        </tbody></table>`;
    } catch(e) {
      el.innerHTML = '<p style="color:var(--red);padding:1rem">Error al cargar historial.</p>';
    }
  },
};

/* ============================================================
   ── ADMIN ──
   ============================================================ */
const Admin = {
  _currentTab: 'quizzes',
  _importedQuestions: null,
  _editingId: null,

  requestAccess: () => {
    const key = prompt('🔐 Clave Maestra:');
    if (key === ADMIN_KEY) {
      App.openModal('modalAdmin');
      Admin.tab('quizzes');
    } else if (key !== null) {
      alert('Clave incorrecta.');
    }
  },

  tab: (name) => {
    Admin._currentTab = name;
    document.querySelectorAll('.tab-btn').forEach((b,i)=>{
      const tabs = ['quizzes','create','import','stats'];
      b.classList.toggle('active', tabs[i]===name);
    });
    const el = document.getElementById('adminContent');

    switch(name) {
      case 'quizzes': Admin.renderQuizList(); break;
      case 'create':  Admin.renderCreateForm(); break;
      case 'import':  Admin.renderImporter(); break;
      case 'stats':   Admin.renderStats(); break;
    }
  },

  renderQuizList: async () => {
    const el = document.getElementById('adminContent');
    el.innerHTML = '<p style="color:var(--muted);font-size:.9rem">Cargando...</p>';
    try {
      const { data } = await db.from('cuestionarios')
        .select('id, nombre, curso_destinatario, puntaje_maximo, preguntas');
      el.innerHTML = (data||[]).map(q=>`
        <div class="admin-quiz-row">
          <div>
            <div class="aqr-name">${q.nombre}</div>
            <div class="aqr-sub">${q.curso_destinatario} · ${(q.preguntas||[]).length} preguntas · Máx ${q.puntaje_maximo} pts</div>
          </div>
          <div class="aqr-actions">
            <button class="btn-xs edit" onclick="Admin.editQuiz('${q.id}')">✏️ Editar</button>
            <button class="btn-xs del" onclick="Admin.deleteQuiz('${q.id}','${q.nombre.replace(/'/g,"\\'")}')">🗑️</button>
          </div>
        </div>`).join('') || '<p style="color:var(--muted)">No hay cuestionarios.</p>';
    } catch(e) {
      el.innerHTML = '<p style="color:var(--red)">Error al cargar.</p>';
    }
  },

  renderCreateForm: () => {
    Admin._editingId = null;
    Admin._importedQuestions = [{ pregunta:'', opciones:['','','',''], correcta:0 }];
    App.openModal('modalEditor');
    Admin.renderEditor('Nuevo Cuestionario');
  },

  renderImporter: () => {
    const el = document.getElementById('adminContent');
    el.innerHTML = `
      <p style="color:var(--muted);font-size:.85rem;margin-bottom:.75rem">
        Formato esperado: pregunta numerada, opciones A/B/C/D, marca <b style="color:var(--green)">R</b> en la correcta.
      </p>
      <div class="form-group">
        <label>Archivo TXT</label>
        <input type="file" id="importFile" accept=".txt" style="color:var(--text)" onchange="Admin.parseTXT()" />
      </div>
      <div id="importPreview"></div>
      <button id="importGoBtn" class="btn btn-primary hidden" onclick="Admin.openEditorFromImport()">✏️ Editar Preguntas</button>
    `;
  },

  parseTXT: () => {
    const file = document.getElementById('importFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => Admin.analyzeText(e.target.result);
    reader.readAsText(file, 'utf-8');
  },

  analyzeText: (text) => {
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
    const questions = [];
    const warnings  = [];

    let current = null;
    lines.forEach(line => {
      // Detect question line: starts with number + dot/parenthesis
      const qMatch = line.match(/^\d+[\.\)]\s+(.+)/);
      if (qMatch) {
        if (current) questions.push(current);
        current = { pregunta: qMatch[1], opciones: [], correcta: -1 };
        return;
      }
      // Detect option line: A) B) C) D) with optional R
      const opMatch = line.match(/^([A-D])\)\s+(.+?)(\s+R\s*)?$/i);
      if (opMatch && current) {
        const text = opMatch[2].trim();
        const isCorrect = !!opMatch[3];
        if (isCorrect) {
          if (current.correcta !== -1) {
            warnings.push(`⚠️ Pregunta ${questions.length+1} tiene más de una respuesta correcta.`);
          }
          current.correcta = current.opciones.length;
        }
        current.opciones.push(text);
      }
    });
    if (current) questions.push(current);

    // Validate
    questions.forEach((q, i) => {
      if (q.correcta === -1) warnings.push(`⚠️ Pregunta ${i+1} sin respuesta correcta.`);
      if (q.opciones.length < 4) warnings.push(`⚠️ Pregunta ${i+1} tiene menos de 4 opciones.`);
      if (q.opciones.length > 4) warnings.push(`⚠️ Pregunta ${i+1} tiene más de 4 opciones.`);
    });

    const previewEl = document.getElementById('importPreview');
    previewEl.innerHTML = `
      <div class="import-preview">
        <div class="import-stat">Preguntas detectadas: <span class="is-val">${questions.length}</span></div>
        <div class="import-stat">Opciones detectadas: <span class="is-val">${questions.reduce((s,q)=>s+q.opciones.length,0)}</span></div>
        <div class="import-stat">Respuestas correctas: <span class="is-val">${questions.filter(q=>q.correcta>=0).length}</span></div>
        ${warnings.length ? `<div class="import-warnings">${warnings.join('<br>')}</div>` : ''}
      </div>
    `;

    const btn = document.getElementById('importGoBtn');
    if (warnings.length === 0 && questions.length > 0) {
      btn.classList.remove('hidden');
      Admin._importedQuestions = questions;
    } else {
      btn.classList.add('hidden');
    }
  },

  openEditorFromImport: () => {
    Admin._editingId = null;
    App.closeModal('modalAdmin');
    App.openModal('modalEditor');
    Admin.renderEditor('Importar Cuestionario');
  },

  editQuiz: async (id) => {
    try {
      const { data } = await db.from('cuestionarios').select('*').eq('id', id).single();
      Admin._editingId = id;
      Admin._importedQuestions = data.preguntas || [];
      Admin._editMeta = { nombre: data.nombre, curso: data.curso_destinatario, max: data.puntaje_maximo, tiempo: data.tiempo_ideal };
      App.openModal('modalEditor');
      Admin.renderEditor('Editar Cuestionario');
    } catch(e) { alert('Error al cargar cuestionario.'); }
  },

  deleteQuiz: async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await db.from('cuestionarios').delete().eq('id', id);
      Admin.renderQuizList();
    } catch(e) { alert('Error al eliminar.'); }
  },

  renderEditor: (title) => {
    const qs = Admin._importedQuestions || [];
    const meta = Admin._editMeta || {};
    const cursos = [
      '1ro Primaria','2do Primaria','3ro Primaria','4to Primaria','5to Primaria','6to Primaria',
      '1ro Secundaria','2do Secundaria','3ro Secundaria','4to Secundaria','5to Secundaria','6to Secundaria',
    ];

    document.getElementById('editorContent').innerHTML = `
      <div class="editor-summary">
        <b>${qs.length}</b> preguntas cargadas.
        <button class="btn-xs edit" style="margin-left:1rem" onclick="Admin.addQuestion()">+ Nueva Pregunta</button>
      </div>
      <div class="editor-meta">
        <div class="form-group">
          <label>Nombre del Cuestionario</label>
          <input class="qei-input" id="edName" value="${meta.nombre||''}" placeholder="Nombre..." />
        </div>
        <div class="form-group">
          <label>Curso Destinatario</label>
          <select class="qei-input" id="edCurso">
            ${cursos.map(c=>`<option ${c===(meta.curso||'')?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Puntaje Máximo</label>
          <input class="qei-input" id="edMax" type="number" value="${meta.max||100}" />
        </div>
        <div class="form-group">
          <label>Tiempo Ideal (minutos)</label>
          <input class="qei-input" id="edTime" type="number" value="${meta.tiempo||10}" />
        </div>
      </div>
      <div id="qEditorList">${qs.map((q,i)=>Admin.questionHTML(q,i)).join('')}</div>
    `;
  },

  questionHTML: (q, i) => {
    const labels = ['A','B','C','D'];
    return `<div class="q-editor-item" id="qei-${i}">
      <div class="qei-header">
        <span class="qei-num">Pregunta ${i+1}</span>
        <div class="qei-actions">
          <button class="btn-xs edit" onclick="Admin.dupQuestion(${i})">⧉ Duplicar</button>
          <button class="btn-xs del"  onclick="Admin.delQuestion(${i})">🗑️</button>
        </div>
      </div>
      <textarea class="qei-input" onchange="Admin.updateQ(${i},'p',this.value)">${q.pregunta}</textarea>
      <div class="options-edit">
        ${(q.opciones||['','','','']).map((op,j)=>`
          <div class="opt-edit-row">
            <input type="radio" class="opt-radio" name="correct-${i}" ${q.correcta===j?'checked':''}
              onchange="Admin.updateQ(${i},'c',${j})" />
            <span class="opt-lbl">${labels[j]})</span>
            <input class="opt-edit-input" value="${op}" placeholder="Opción ${labels[j]}"
              onchange="Admin.updateQ(${i},'o',{j:${j},v:this.value})" />
          </div>`).join('')}
      </div>
    </div>`;
  },

  updateQ: (i, field, val) => {
    const qs = Admin._importedQuestions;
    if (!qs[i]) return;
    if (field === 'p') qs[i].pregunta = val;
    if (field === 'c') qs[i].correcta = val;
    if (field === 'o') qs[i].opciones[val.j] = val.v;
  },

  addQuestion: () => {
    if (!Admin._importedQuestions) Admin._importedQuestions = [];
    Admin._importedQuestions.push({ pregunta:'', opciones:['','','',''], correcta:0 });
    const i = Admin._importedQuestions.length - 1;
    const list = document.getElementById('qEditorList');
    list.insertAdjacentHTML('beforeend', Admin.questionHTML(Admin._importedQuestions[i], i));
    document.getElementById('editorContent').querySelector('.editor-summary b').textContent =
      Admin._importedQuestions.length;
  },

  dupQuestion: (i) => {
    const q = JSON.parse(JSON.stringify(Admin._importedQuestions[i]));
    Admin._importedQuestions.splice(i+1, 0, q);
    Admin.renderEditor();
  },

  delQuestion: (i) => {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    Admin._importedQuestions.splice(i, 1);
    Admin.renderEditor();
  },

  saveQuiz: async () => {
    const nombre = document.getElementById('edName').value.trim();
    const curso  = document.getElementById('edCurso').value;
    const max    = parseInt(document.getElementById('edMax').value) || 100;
    const tiempo = parseInt(document.getElementById('edTime').value) || 10;
    const qs     = Admin._importedQuestions || [];

    if (!nombre)  { alert('Ingresa el nombre del cuestionario.'); return; }
    if (!qs.length){ alert('El cuestionario debe tener al menos 1 pregunta.'); return; }

    // Validate
    const invalid = qs.filter(q=>!q.pregunta||q.opciones.some(o=>!o)||q.correcta<0||q.correcta>=q.opciones.length);
    if (invalid.length) { alert('Hay preguntas incompletas. Revisa todas las preguntas y sus opciones.'); return; }

    try {
      if (Admin._editingId) {
        await db.from('cuestionarios').update({
          nombre, curso_destinatario:curso, puntaje_maximo:max, tiempo_ideal:tiempo, preguntas:qs
        }).eq('id', Admin._editingId);
      } else {
        await db.from('cuestionarios').insert({
          id: Utils.uid(), nombre, curso_destinatario:curso,
          puntaje_maximo:max, tiempo_ideal:tiempo, preguntas:qs
        });
      }
      App.closeModal('modalEditor');
      App.openModal('modalAdmin');
      Admin.tab('quizzes');
      Audio.achieve();
    } catch(e) {
      alert('Error al guardar: ' + (e.message||'Intenta de nuevo.'));
    }
  },

  renderStats: async () => {
    const el = document.getElementById('adminContent');
    el.innerHTML = '<p style="color:var(--muted);font-size:.9rem">Cargando...</p>';
    try {
      const [{ count: uCount }, { count: qCount }, { data: records }] = await Promise.all([
        db.from('usuarios').select('*', { count:'exact', head:true }),
        db.from('cuestionarios').select('*', { count:'exact', head:true }),
        db.from('records').select('porcentaje, puntaje_final'),
      ]);
      const totalR   = (records||[]).length;
      const avgScore = totalR ? Math.round((records||[]).reduce((s,r)=>s+(r.puntaje_final||0),0)/totalR) : 0;

      el.innerHTML = `
        <div class="stats-grid">
          <div class="stats-chip"><span class="s-val">${uCount||0}</span><span class="s-lbl">Estudiantes</span></div>
          <div class="stats-chip"><span class="s-val">${qCount||0}</span><span class="s-lbl">Cuestionarios</span></div>
          <div class="stats-chip"><span class="s-val">${totalR}</span><span class="s-lbl">Evaluaciones realizadas</span></div>
          <div class="stats-chip"><span class="s-val">${avgScore}</span><span class="s-lbl">Puntaje promedio</span></div>
        </div>`;
    } catch(e) {
      el.innerHTML = '<p style="color:var(--red)">Error al cargar estadísticas.</p>';
    }
  },
};

/* ============================================================
   ── INIT ──
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Particles.init();
  Auth.checkSession();

  // Resume modal: re-show if needed
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      // handled in Quiz.onFullscreenChange
    }
  });
});
