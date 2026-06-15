// ============================================================
//  QUIZ LEGENDS — app.js v2.0
//  Kabert Studio · LMKE
// ============================================================

const supabase = window.supabase;

// ── AUDIO ENGINE ─────────────────────────────────────────────
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    _tone(freq, type, duration, gain, delay = 0) {
        try {
            this.init();
            if (this.ctx.state === 'suspended') return;
            const t = this.ctx.currentTime + delay;
            const osc = this.ctx.createOscillator();
            const g   = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(gain, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
            osc.connect(g); g.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + duration);
        } catch(e) {}
    },
    btn()   { this._tone(520, 'sine', 0.08, 0.25); },
    hover() { this._tone(680, 'sine', 0.05, 0.12); },

    success() {
        this._tone(659.25, 'triangle', 0.12, 0.35);
        this._tone(880,    'triangle', 0.18, 0.35, 0.10);
        this._tone(1046.5, 'triangle', 0.22, 0.3,  0.22);
    },
    error() {
        this._tone(280, 'sawtooth', 0.08, 0.4);
        this._tone(220, 'sawtooth', 0.15, 0.4, 0.09);
    },
    countdown() {
        this._tone(600, 'sine', 0.07, 0.3);
    },
    go() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
            this._tone(f, 'triangle', 0.18, 0.35, i * 0.07)
        );
    },
    victory() {
        const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
        melody.forEach((f, i) => this._tone(f, 'triangle', 0.22, 0.38, i * 0.13));
    },
    achievement() {
        [392, 523.25, 659.25, 987.77].forEach((f, i) =>
            this._tone(f, 'square', i === 3 ? 0.28 : 0.12, 0.2, i * 0.08)
        );
    },
    tick() { this._tone(440, 'sine', 0.04, 0.12); },

    // Chord-style intro jingle
    jingle() {
        const chords = [
            [261.63, 329.63, 392.00],
            [293.66, 369.99, 440.00],
            [349.23, 440.00, 523.25],
            [392.00, 493.88, 587.33],
        ];
        chords.forEach((chord, ci) => {
            chord.forEach(f => this._tone(f, 'sine', 0.45, 0.28, ci * 0.28));
        });
    }
};

// ── TOAST SYSTEM ─────────────────────────────────────────────
const Toast = {
    show(msg, type = 'info', duration = 3200) {
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
        document.getElementById('toast-container').appendChild(el);
        setTimeout(() => {
            el.classList.add('out');
            setTimeout(() => el.remove(), 320);
        }, duration);
    },
    success: (m, d) => Toast.show(m, 'success', d),
    error:   (m, d) => Toast.show(m, 'error', d),
    info:    (m, d) => Toast.show(m, 'info', d),
    warn:    (m, d) => Toast.show(m, 'warn', d),
};

// ── MODAL SYSTEM ─────────────────────────────────────────────
const Modal = {
    _resolve: null,
    show(title, message, confirmLabel = 'Confirmar') {
        return new Promise(resolve => {
            this._resolve = resolve;
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-message').textContent = message;
            document.getElementById('modal-confirm').textContent = confirmLabel;
            document.getElementById('modal-overlay').classList.remove('hidden');
        });
    },
    _close(result) {
        document.getElementById('modal-overlay').classList.add('hidden');
        if (this._resolve) { this._resolve(result); this._resolve = null; }
    }
};
document.getElementById('modal-confirm').addEventListener('click', () => { AudioEngine.btn(); Modal._close(true); });
document.getElementById('modal-cancel').addEventListener('click',  () => { AudioEngine.btn(); Modal._close(false); });

// ── GLOBAL STATE ─────────────────────────────────────────────
let currentUser            = null;
let currentQuiz            = null;
let quizQuestions          = [];
let currentQuestionIndex   = 0;
let userAnswers            = [];
let chronometerInterval    = null;
let startTime              = null;
let elapsedTimeInSeconds   = 0;

// Editor state
let editorQuestions = [];   // Array of { pregunta, opciones:[], correcta:0 }

// ── VIEW ROUTER ───────────────────────────────────────────────
function switchView(id) {
    document.querySelectorAll('.view-panel').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
}

// ── SPLASH SCREEN ─────────────────────────────────────────────
function initSplashScreen() {
    // Canvas particle field
    const canvas = document.getElementById('splash-canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 70 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.5,
        dy: -(Math.random() * 0.8 + 0.2),
        a: Math.random(),
        hue: Math.random() > 0.5 ? '200,255,255' : '138,46,255',
    }));

    let animId;
    function drawParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.hue},${p.a.toFixed(2)})`;
            ctx.fill();
            p.x += p.dx; p.y += p.dy;
            p.a += (Math.random() - 0.5) * 0.02;
            p.a = Math.max(0.05, Math.min(0.9, p.a));
            if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        });
        animId = requestAnimationFrame(drawParticles);
    }
    drawParticles();

    // Countdown logic
    const ringEl  = document.getElementById('ring-fill-el');
    const numEl   = document.getElementById('countdown-box');
    const circumf = 2 * Math.PI * 50;  // r=50
    ringEl.style.strokeDasharray  = circumf;
    ringEl.style.strokeDashoffset = '0';

    let count = 3;
    numEl.textContent = count;

    const tick = () => {
        AudioEngine.countdown();
        numEl.style.transform = 'scale(1.3)';
        setTimeout(() => { numEl.style.transform = 'scale(1)'; }, 180);

        count--;
        if (count > 0) {
            numEl.textContent = count;
            ringEl.style.strokeDashoffset = circumf * ((3 - count) / 3);
        } else if (count === 0) {
            numEl.textContent = '¡GO!';
            numEl.style.color = '#00FF99';
            ringEl.style.strokeDashoffset = circumf;
            AudioEngine.go();
        } else {
            clearInterval(interval);
            cancelAnimationFrame(animId);
            document.getElementById('splash-screen').style.transition = 'opacity 0.5s';
            document.getElementById('splash-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('splash-screen').classList.add('hidden');
                document.getElementById('splash-screen').style.opacity = '';
                document.getElementById('main-container').classList.remove('hidden');
                loadRankingGlobal();
                setTimeout(() => AudioEngine.jingle(), 400);
            }, 500);
        }
    };

    tick();
    const interval = setInterval(tick, 1000);
}

// ── REGISTER ─────────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    AudioEngine.btn();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Registrando…';

    const nombreCompleto = document.getElementById('reg-nombre').value.trim();
    const curso          = document.getElementById('reg-curso').value;
    const usuario        = document.getElementById('reg-user').value.trim().toLowerCase();
    const password       = document.getElementById('reg-pass').value;

    const { data: existing } = await supabase.from('usuarios').select('usuario').eq('usuario', usuario).maybeSingle();
    if (existing) {
        AudioEngine.error();
        Toast.error('El usuario ya existe. Elige otro nombre.');
        btn.disabled = false; btn.innerHTML = 'REGISTRARSE <span class="btn-arrow">→</span>';
        return;
    }

    const { error } = await supabase.from('usuarios').insert([{ usuario, nombre_completo: nombreCompleto, curso, password }]);
    if (error) {
        AudioEngine.error();
        Toast.error('Error al registrar. Intenta de nuevo.');
        btn.disabled = false; btn.innerHTML = 'REGISTRARSE <span class="btn-arrow">→</span>';
        return;
    }

    AudioEngine.achievement();
    Toast.success('¡Cuenta creada! Ahora inicia sesión.');
    document.getElementById('register-form').reset();
    btn.disabled = false; btn.innerHTML = 'REGISTRARSE <span class="btn-arrow">→</span>';
    switchView('view-login');
});

// ── LOGIN ─────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    AudioEngine.btn();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Verificando…';

    const usuario  = document.getElementById('login-user').value.trim().toLowerCase();
    const password = document.getElementById('login-pass').value;

    const { data: user, error } = await supabase.from('usuarios').select('*').eq('usuario', usuario).maybeSingle();

    if (error || !user || user.password !== password) {
        AudioEngine.error();
        Toast.error('Credenciales incorrectas.');
        btn.disabled = false; btn.innerHTML = 'INGRESAR AL SISTEMA <span class="btn-arrow">→</span>';
        return;
    }

    currentUser = { usuario: user.usuario, nombreCompleto: user.nombre_completo, curso: user.curso };
    btn.disabled = false; btn.innerHTML = 'INGRESAR AL SISTEMA <span class="btn-arrow">→</span>';
    setupUserSession();
});

function setupUserSession() {
    document.getElementById('nav-login-btn').classList.add('hidden');
    document.getElementById('nav-register-btn').classList.add('hidden');
    const tag = document.getElementById('user-tag');
    tag.textContent = `👤 ${currentUser.nombreCompleto.toUpperCase()}`;
    tag.classList.remove('hidden');
    document.getElementById('nav-logout-btn').classList.remove('hidden');
    AudioEngine.achievement();
    Toast.success(`¡Bienvenido, ${currentUser.nombreCompleto.split(' ')[0]}!`);
    loadStudentDashboard();
}

document.getElementById('nav-logout-btn').addEventListener('click', () => {
    AudioEngine.btn();
    currentUser = null;
    document.getElementById('nav-login-btn').classList.remove('hidden');
    document.getElementById('nav-register-btn').classList.remove('hidden');
    document.getElementById('user-tag').classList.add('hidden');
    document.getElementById('nav-logout-btn').classList.add('hidden');
    switchView('view-ranking');
    loadRankingGlobal();
});

// ── NAVIGATION ────────────────────────────────────────────────
document.getElementById('nav-logo-btn').addEventListener('click', () => {
    AudioEngine.btn();
    if (currentUser) loadStudentDashboard(); else switchView('view-ranking');
});
document.getElementById('nav-ranking-btn').addEventListener('click', () => { AudioEngine.btn(); switchView('view-ranking'); loadRankingGlobal(); });
document.getElementById('nav-login-btn').addEventListener('click',   () => { AudioEngine.btn(); switchView('view-login'); });
document.getElementById('nav-register-btn').addEventListener('click',() => { AudioEngine.btn(); switchView('view-register'); });

document.getElementById('go-login-link').addEventListener('click', e => { e.preventDefault(); AudioEngine.btn(); switchView('view-login'); });
document.getElementById('go-register-link').addEventListener('click', e => { e.preventDefault(); AudioEngine.btn(); switchView('view-register'); });

// ── RANKING ───────────────────────────────────────────────────
async function loadRankingGlobal() {
    try {
        const { data: records, error } = await supabase
            .from('records')
            .select('*')
            .order('mejor_puntaje', { ascending: false })
            .order('mejor_tiempo',  { ascending: true })
            .limit(20);

        const tbody = document.getElementById('ranking-tbody');
        tbody.innerHTML = '';

        if (error || !records?.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:30px;color:rgba(255,255,255,0.3)">Aún no se registran leyendas en el podio.</td></tr>';
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];
        records.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${medals[idx] || idx + 1}</b></td>
                <td>${row.nombre_completo}</td>
                <td>${row.curso}</td>
                <td>${row.cuestionario_nombre}</td>
                <td><b>${row.mejor_puntaje} Pts</b></td>
                <td>${row.mejor_tiempo}</td>
                <td>${row.cantidad_intentos} / 3</td>
            `;
            tbody.appendChild(tr);
        });
    } catch(err) { console.error(err); }
}

// ── STUDENT DASHBOARD ─────────────────────────────────────────
async function loadStudentDashboard() {
    switchView('view-student');
    document.getElementById('student-profile-name').textContent = currentUser.nombreCompleto;
    document.getElementById('student-profile-course').textContent = currentUser.curso;

    const { data: historyData } = await supabase
        .from('records').select('*').eq('usuario', currentUser.usuario);

    let totalPoints = 0, completedCount = 0;
    const historyList = document.getElementById('student-history-list');
    historyList.innerHTML = '';
    const trackingMap = {};

    (historyData || []).forEach(row => {
        totalPoints   += row.puntaje_final;
        completedCount++;
        const li = document.createElement('li');
        li.innerHTML  = `🏁 <b>${row.cuestionario_nombre}</b><br>Puntos: ${row.puntaje_final} &nbsp;|&nbsp; Intento: ${row.intento_nro} &nbsp;|&nbsp; ${row.tiempo_empleado}`;
        historyList.appendChild(li);
        trackingMap[row.cuestionario_id] = row.cantidad_intentos;
    });

    document.getElementById('stat-completed').textContent = completedCount;
    document.getElementById('stat-points').textContent    = totalPoints;

    const { data: quizzesData } = await supabase
        .from('cuestionarios').select('*').eq('curso_destinatario', currentUser.curso);

    const grid = document.getElementById('quizzes-grid');
    grid.innerHTML = '';

    if (!quizzesData?.length) {
        grid.innerHTML = '<p class="text-center" style="color:rgba(255,255,255,0.3);padding:40px">No tienes cuestionarios activos para tu curso.</p>';
        return;
    }

    quizzesData.forEach(quiz => {
        const intentosPrevios = trackingMap[quiz.id] || 0;
        const locked = intentosPrevios >= 3;
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.innerHTML = `
            <div>
                <h3>🎮 ${quiz.nombre}</h3>
                <div class="quiz-meta">
                    <span>⏱ ${quiz.tiempo_ideal} min</span>
                    <span>💯 ${quiz.puntaje_maximo} Pts base</span>
                </div>
                <p style="font-size:.82rem;color:${locked ? 'var(--error)' : 'var(--neon-blue)'}">
                    Intentos usados: ${intentosPrevios} / 3
                </p>
            </div>
            <button class="btn ${locked ? 'btn-secondary' : 'btn-primary'} btn-block"
                    style="margin-top:16px" ${locked ? 'disabled' : ''} id="btn-start-${quiz.id}">
                ${locked ? '🔒 BLOQUEADO' : '⚡ INICIAR DESAFÍO'}
            </button>
        `;
        grid.appendChild(card);
        if (!locked) {
            document.getElementById(`btn-start-${quiz.id}`).addEventListener('click', () => {
                AudioEngine.btn();
                startQuizEvaluation(quiz, intentosPrevios + 1);
            });
        }
    });
}

// ── QUIZ PLAY ─────────────────────────────────────────────────
function startQuizEvaluation(quiz, nroIntento) {
    AudioEngine.achievement();
    currentQuiz           = { ...quiz, nroIntento };
    quizQuestions         = [...quiz.preguntas];
    currentQuestionIndex  = 0;
    userAnswers           = [];

    switchView('view-quiz-play');
    document.getElementById('play-quiz-title').textContent = currentQuiz.nombre;

    const docEl = document.documentElement;
    if (docEl.requestFullscreen) docEl.requestFullscreen().catch(()=>{});

    elapsedTimeInSeconds = 0;
    startTime = Date.now();
    runChronometer();
    renderCurrentQuestion();
}

function runChronometer() {
    clearInterval(chronometerInterval);
    chronometerInterval = setInterval(() => {
        elapsedTimeInSeconds = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(elapsedTimeInSeconds / 3600).toString().padStart(2,'0');
        const m = Math.floor((elapsedTimeInSeconds % 3600) / 60).toString().padStart(2,'0');
        const s = (elapsedTimeInSeconds % 60).toString().padStart(2,'0');
        document.getElementById('quiz-chronometer').textContent = `${h}:${m}:${s}`;
    }, 1000);
}

function renderCurrentQuestion() {
    if (currentQuestionIndex >= quizQuestions.length) { finishQuizEvaluation(); return; }

    const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;
    document.getElementById('play-quiz-progress').textContent  = `Pregunta ${currentQuestionIndex + 1} de ${quizQuestions.length}`;
    document.getElementById('quiz-progress-fill').style.width  = `${(currentQuestionIndex / quizQuestions.length) * 100}%`;
    document.getElementById('question-number-tag').textContent = `Q${currentQuestionIndex + 1}`;

    const q   = quizQuestions[currentQuestionIndex];
    const qEl = document.getElementById('play-question-text');
    qEl.style.opacity = '0';
    qEl.textContent   = q.pregunta;
    setTimeout(() => { qEl.style.transition = 'opacity 0.3s'; qEl.style.opacity = '1'; }, 50);

    const container = document.getElementById('play-options-container');
    container.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    q.opciones.forEach((op, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span style="font-family:var(--font-display);font-size:.75rem;color:rgba(0,200,255,0.5);min-width:22px">${letters[idx]}</span>${op}`;
        btn.addEventListener('mouseenter', () => AudioEngine.hover());
        btn.addEventListener('click', () => evaluateOption(idx, btn));
        container.appendChild(btn);
    });
}

function evaluateOption(idx, btn) {
    const q       = quizQuestions[currentQuestionIndex];
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.style.pointerEvents = 'none');

    const isCorrect = idx === q.correcta;
    userAnswers.push({ selectedIndex: idx, isCorrect });

    if (isCorrect) {
        AudioEngine.success();
        btn.classList.add('correct-flash');
    } else {
        AudioEngine.error();
        btn.classList.add('wrong-flash');
        allBtns[q.correcta].classList.add('correct-flash');
    }

    setTimeout(() => {
        currentQuestionIndex++;
        renderCurrentQuestion();
    }, 1400);
}

document.getElementById('btn-force-exit-fullscreen').addEventListener('click', () => {
    if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
});

// ── FINISH QUIZ ───────────────────────────────────────────────
async function finishQuizEvaluation() {
    clearInterval(chronometerInterval);
    AudioEngine.victory();
    if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});

    const correctCount        = userAnswers.filter(a => a.isCorrect).length;
    const porcentaje          = Math.round((correctCount / quizQuestions.length) * 100);
    const tiempoIdealSegundos = currentQuiz.tiempo_ideal * 60;
    let bonificacion          = 0;

    if (elapsedTimeInSeconds < tiempoIdealSegundos && correctCount > 0) {
        bonificacion = Math.round(((tiempoIdealSegundos - elapsedTimeInSeconds) * 0.1) * (porcentaje / 100));
    }

    const puntajeFinalTotal = Math.round(((correctCount / quizQuestions.length) * currentQuiz.puntaje_maximo) + bonificacion);
    const mm = Math.floor(elapsedTimeInSeconds / 60).toString().padStart(2,'0');
    const ss = (elapsedTimeInSeconds % 60).toString().padStart(2,'0');
    const stringTiempo = `${mm}:${ss}`;
    const recordId     = `${currentUser.usuario}_${currentQuiz.id}`;

    const { data: currentRecord } = await supabase.from('records').select('*').eq('id', recordId).maybeSingle();
    let payload = {};

    if (!currentRecord) {
        payload = {
            id: recordId, usuario: currentUser.usuario, nombre_completo: currentUser.nombreCompleto,
            curso: currentUser.curso, cuestionario_id: currentQuiz.id, cuestionario_nombre: currentQuiz.nombre,
            intento1: puntajeFinalTotal, intento_nro: 1, cantidad_intentos: 1, mejor_puntaje: puntajeFinalTotal,
            mejor_tiempo: stringTiempo, ultimo_intento: puntajeFinalTotal, tiempo_empleado: stringTiempo,
            porcentaje, puntaje_final: puntajeFinalTotal
        };
    } else {
        const nuevoIntento = currentRecord.cantidad_intentos + 1;
        payload = {
            ...currentRecord, cantidad_intentos: nuevoIntento, intento_nro: nuevoIntento,
            ultimo_intento: puntajeFinalTotal, tiempo_empleado: stringTiempo, porcentaje, puntaje_final: puntajeFinalTotal
        };
        payload[`intento${nuevoIntento}`] = puntajeFinalTotal;
        if (puntajeFinalTotal > currentRecord.mejor_puntaje) {
            payload.mejor_puntaje = puntajeFinalTotal;
            payload.mejor_tiempo  = stringTiempo;
        }
    }

    await supabase.from('records').upsert([payload]);

    window.currentEvaluationReport = {
        estudiante: currentUser.nombreCompleto, curso: currentUser.curso,
        cuestionario: currentQuiz.nombre, puntaje: puntajeFinalTotal,
        maximoBase: currentQuiz.puntaje_maximo, porcentaje, tiempo: stringTiempo,
        intento: payload.cantidad_intentos, fecha: new Date().toLocaleDateString()
    };

    document.getElementById('res-score').textContent   = `${puntajeFinalTotal} / ${currentQuiz.puntaje_maximo}`;
    document.getElementById('res-percent').textContent = `${porcentaje}%`;
    document.getElementById('res-time').textContent    = stringTiempo;
    document.getElementById('res-bonus').textContent   = `+${bonificacion} Pts`;
    document.getElementById('result-quiz-name').textContent = currentQuiz.nombre;

    switchView('view-results');
    triggerConfetti();
}

function triggerConfetti() {
    const wrapper = document.getElementById('confetti-wrapper');
    wrapper.innerHTML = '';
    for (let i = 0; i < 60; i++) {
        const c = document.createElement('div');
        const colors = ['#00C8FF','#8A2EFF','#FFD700','#00FF99','#FF4060','#00FFE5'];
        const size   = Math.random() * 10 + 5;
        c.style.cssText = `
            position:absolute;
            width:${size}px; height:${size * (Math.random() > 0.5 ? 1 : 0.4)}px;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            left:${Math.random()*100}%; top:0;
            border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        `;
        const anim = c.animate([
            { transform: `translateY(0) rotate(0deg) translateX(0)`, opacity: 1 },
            { transform: `translateY(${350 + Math.random()*200}px) rotate(${Math.random()*720}deg) translateX(${(Math.random()-0.5)*80}px)`, opacity: 0 }
        ], { duration: 2000 + Math.random() * 2000, delay: Math.random() * 400 });
        wrapper.appendChild(c);
        anim.onfinish = () => c.remove();
    }
}

// ── PDF CERTIFICATE ───────────────────────────────────────────
document.getElementById('btn-download-pdf').addEventListener('click', () => {
    AudioEngine.achievement();
    const r = window.currentEvaluationReport;
    if (!r) return;
    const { jsPDF } = window.jspPDF;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // Background
    doc.setFillColor(6, 13, 26);
    doc.rect(0, 0, 210, 297, 'F');

    // Decorative borders
    doc.setDrawColor(0, 200, 255); doc.setLineWidth(1.5);
    doc.rect(10, 10, 190, 277);
    doc.setDrawColor(138, 46, 255); doc.setLineWidth(0.5);
    doc.rect(14, 14, 182, 269);

    // Header
    doc.setTextColor(0, 200, 255); doc.setFont("helvetica","bold"); doc.setFontSize(32);
    doc.text("QUIZ LEGENDS", 105, 38, { align:"center" });
    doc.setFontSize(9); doc.setTextColor(138,46,255);
    doc.text("CONQUISTA EL CONOCIMIENTO · ROMPE RÉCORDS · CONVIÉRTETE EN LEYENDA", 105, 46, { align:"center" });

    // Separator line
    doc.setDrawColor(255,215,0); doc.setLineWidth(0.5);
    doc.line(30, 54, 180, 54);

    // Body
    doc.setFontSize(11); doc.setTextColor(180,200,220);
    doc.text("Este certificado acredita que:", 30, 68);
    doc.setFontSize(24); doc.setTextColor(255,215,0);
    doc.text(r.estudiante.toUpperCase(), 105, 82, { align:"center" });
    doc.setFontSize(10); doc.setTextColor(200,220,240);
    doc.text(`Curso: ${r.curso}`, 105, 92, { align:"center" });

    // Result box
    doc.setFillColor(12, 24, 41);
    doc.setDrawColor(0,200,255); doc.setLineWidth(0.8);
    doc.roundedRect(28, 100, 154, 72, 4, 4, 'FD');

    doc.setFontSize(9); doc.setTextColor(0,200,255);
    doc.text("RESULTADO OFICIAL DE EVALUACIÓN", 105, 110, { align:"center" });
    doc.setDrawColor(0,200,255,0.3); doc.setLineWidth(0.3);
    doc.line(28, 114, 182, 114);

    doc.setFontSize(11); doc.setTextColor(255,255,255);
    doc.text(`Cuestionario:`, 36, 124);
    doc.setTextColor(0,200,255); doc.text(r.cuestionario, 80, 124);

    doc.setTextColor(255,255,255); doc.text(`Puntaje Final:`, 36, 134);
    doc.setTextColor(255,215,0);   doc.text(`${r.puntaje} Pts  (Base: ${r.maximoBase})`, 80, 134);

    doc.setTextColor(255,255,255); doc.text(`Rendimiento:`, 36, 144);
    doc.setTextColor(0,255,153);   doc.text(`${r.porcentaje}% de efectividad`, 80, 144);

    doc.setTextColor(255,255,255); doc.text(`Tiempo:`, 36, 154);
    doc.setTextColor(255,255,255); doc.text(`${r.tiempo} minutos`, 80, 154);

    doc.setTextColor(255,255,255); doc.text(`Intento Nro:`, 36, 164);
    doc.setTextColor(255,255,255); doc.text(`${r.intento} / 3`, 80, 164);

    // Footer
    doc.setFontSize(8); doc.setTextColor(80,100,130);
    doc.text(`Emitido el ${r.fecha} · Quiz Legends v2.0 · Kabert Studio – LMKE`, 105, 272, { align:"center" });

    doc.save(`QuizLegends_${r.estudiante.replace(/\s+/g,'_')}_${r.fecha.replace(/\//g,'-')}.pdf`);
});

document.getElementById('btn-result-close').addEventListener('click', () => {
    AudioEngine.btn();
    loadStudentDashboard();
});

// ── ADMIN: ACCESS ─────────────────────────────────────────────
document.getElementById('secret-admin-trigger').addEventListener('click', () => {
    AudioEngine.btn();
    const clave = prompt("🔒 Clave de acceso:");
    if (clave === "LMKE2026") {
        resetEditorState();
        switchView('view-admin');
        loadAdminQuizzes();
        AudioEngine.achievement();
    } else {
        AudioEngine.error();
        Toast.error('Acceso denegado.');
    }
});

document.getElementById('btn-admin-close').addEventListener('click', () => {
    AudioEngine.btn();
    if (currentUser) loadStudentDashboard(); else switchView('view-ranking');
});

// ─────────────────────────────────────────────────────────────
// ██████  QUESTION EDITOR ENGINE  ██████
// ─────────────────────────────────────────────────────────────

function resetEditorState() {
    editorQuestions = [];
    renderEditorCards();
    updateEditorStats();
    document.getElementById('btn-save-quiz').disabled = true;
}

// ── IMPORT ZONE: Drag & Drop + File picker ────────────────────
const dropZone = document.getElementById('import-drop-zone');
const filePicker = document.getElementById('quiz-file-txt');

dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.txt')) processFile(file);
    else Toast.warn('Solo se aceptan archivos .TXT');
});

filePicker.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
});

function processFile(file) {
    const reader = new FileReader();
    reader.onload = evt => {
        const parsed = parseTXT(evt.target.result);
        if (parsed.length === 0) {
            Toast.warn('No se detectaron preguntas en el archivo. Verifica el formato.');
            return;
        }
        editorQuestions = parsed;
        renderEditorCards();
        updateEditorStats();
        AudioEngine.achievement();
        Toast.success(`${parsed.length} preguntas importadas correctamente.`);
    };
    reader.readAsText(file, 'UTF-8');
}

// ── TXT PARSER ────────────────────────────────────────────────
function parseTXT(text) {
    const result = [];
    const lines  = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let current  = null;

    lines.forEach(line => {
        if (!line.match(/^[A-D]\)/i)) {
            // New question line
            if (current) result.push(current);
            current = { pregunta: line, opciones: ['','','',''], correcta: 0 };
        } else if (current && line.match(/^[A-D]\)/i)) {
            const letterIdx = ['A','B','C','D'].indexOf(line[0].toUpperCase());
            if (letterIdx === -1) return;
            const isCorrect = line.trimEnd().toUpperCase().endsWith(' R') || line.trimEnd().toUpperCase().endsWith('R');
            let cleanOpt    = line.substring(2).trim();
            if (isCorrect) {
                cleanOpt = cleanOpt.replace(/\s*R\s*$/i, '').trim();
                current.correcta = letterIdx;
            }
            current.opciones[letterIdx] = cleanOpt;
        }
    });
    if (current) result.push(current);
    return result;
}

// ── RENDER EDITOR CARDS ───────────────────────────────────────
function renderEditorCards() {
    const container = document.getElementById('questions-editor-container');
    const emptyEl   = document.getElementById('editor-empty-state');

    if (editorQuestions.length === 0) {
        container.innerHTML = '';
        container.appendChild(emptyEl);
        emptyEl.style.display = '';
        return;
    }
    emptyEl.style.display = 'none';
    container.innerHTML   = '';

    editorQuestions.forEach((q, idx) => {
        const card = buildQuestionCard(q, idx);
        container.appendChild(card);
    });
}

const LETTERS = ['A','B','C','D'];

function buildQuestionCard(q, idx) {
    const card = document.createElement('div');
    card.className  = 'q-editor-card';
    card.dataset.idx = idx;

    // ── Header (question text) ──
    const header = document.createElement('div');
    header.className = 'q-card-header';

    const numBadge = document.createElement('span');
    numBadge.className   = 'q-num-badge';
    numBadge.textContent = `Q${idx + 1}`;

    const questionInput = document.createElement('input');
    questionInput.type        = 'text';
    questionInput.value       = q.pregunta;
    questionInput.placeholder = '¿Escribe la pregunta aquí?';
    questionInput.addEventListener('input', e => {
        editorQuestions[idx].pregunta = e.target.value;
        validateCard(card, idx);
        updateEditorStats();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'q-card-delete';
    deleteBtn.title     = 'Eliminar pregunta';
    deleteBtn.innerHTML = '✕';
    deleteBtn.addEventListener('click', () => {
        AudioEngine.btn();
        editorQuestions.splice(idx, 1);
        renderEditorCards();
        updateEditorStats();
    });

    header.append(numBadge, questionInput, deleteBtn);

    // ── Options ──
    const optContainer = document.createElement('div');
    optContainer.className = 'q-card-options';

    q.opciones.forEach((opt, oIdx) => {
        const row = document.createElement('div');
        row.className = 'q-option-row';

        const letterLabel = document.createElement('span');
        letterLabel.className   = 'q-option-letter';
        letterLabel.textContent = LETTERS[oIdx];

        const optInput = document.createElement('input');
        optInput.type        = 'text';
        optInput.className   = `q-option-input${oIdx === q.correcta ? ' is-correct' : ''}`;
        optInput.value       = opt;
        optInput.placeholder = `Opción ${LETTERS[oIdx]}`;
        optInput.addEventListener('input', e => {
            editorQuestions[idx].opciones[oIdx] = e.target.value;
            validateCard(card, idx);
            updateEditorStats();
        });

        const radio = document.createElement('input');
        radio.type    = 'radio';
        radio.name    = `correct-${idx}`;
        radio.className = 'q-correct-radio';
        radio.checked = oIdx === q.correcta;
        radio.title   = 'Marcar como correcta';
        radio.addEventListener('change', () => {
            if (radio.checked) {
                editorQuestions[idx].correcta = oIdx;
                // Update visual state of all inputs in this card
                card.querySelectorAll('.q-option-input').forEach((el, i) => {
                    el.classList.toggle('is-correct', i === oIdx);
                });
                validateCard(card, idx);
                updateEditorStats();
            }
        });

        row.append(letterLabel, optInput, radio);
        optContainer.appendChild(row);
    });

    card.append(header, optContainer);
    validateCard(card, idx);
    return card;
}

function validateCard(card, idx) {
    const q = editorQuestions[idx];
    const hasQuestion = q.pregunta.trim().length > 0;
    const filledOpts  = q.opciones.filter(o => o.trim().length > 0);
    const valid       = hasQuestion && filledOpts.length >= 2;

    card.classList.toggle('has-error',  !valid);
    card.classList.toggle('is-complete', valid);
}

// ── UPDATE STATS BADGE ────────────────────────────────────────
function updateEditorStats() {
    const total     = editorQuestions.length;
    const complete  = editorQuestions.filter(q =>
        q.pregunta.trim() && q.opciones.filter(o => o.trim()).length >= 2
    ).length;
    const errors    = total - complete;

    document.getElementById('q-count-num').textContent = total;

    const statusEl = document.getElementById('q-status-badge');
    if (total === 0) {
        statusEl.textContent  = '';
        statusEl.className    = 'q-status';
    } else if (errors === 0) {
        statusEl.textContent  = `✓ ${total} listas`;
        statusEl.className    = 'q-status ok';
    } else if (complete > 0) {
        statusEl.textContent  = `⚠ ${errors} incompletas`;
        statusEl.className    = 'q-status warn';
    } else {
        statusEl.textContent  = `✕ Todas incompletas`;
        statusEl.className    = 'q-status error';
    }

    document.getElementById('btn-save-quiz').disabled = (total === 0 || errors > 0);
}

// ── ADD BLANK QUESTION ────────────────────────────────────────
document.getElementById('btn-add-question').addEventListener('click', () => {
    AudioEngine.btn();
    editorQuestions.push({ pregunta: '', opciones: ['','','',''], correcta: 0 });
    renderEditorCards();
    updateEditorStats();
    // Scroll to bottom of editor
    const c = document.getElementById('questions-editor-container');
    c.scrollTop = c.scrollHeight;
    // Focus the new question input
    const cards = c.querySelectorAll('.q-card-header input');
    if (cards.length) cards[cards.length - 1].focus();
});

// ── CLEAR EDITOR ──────────────────────────────────────────────
document.getElementById('btn-clear-editor').addEventListener('click', async () => {
    if (editorQuestions.length === 0) return;
    AudioEngine.btn();
    const confirmed = await Modal.show('Limpiar Editor', '¿Eliminar todas las preguntas del editor?', 'Limpiar todo');
    if (confirmed) {
        AudioEngine.error();
        resetEditorState();
        Toast.info('Editor limpiado.');
    }
});

// ── SAVE QUIZ ─────────────────────────────────────────────────
document.getElementById('quiz-form').addEventListener('submit', async e => {
    e.preventDefault();
    AudioEngine.btn();

    const complete = editorQuestions.filter(q =>
        q.pregunta.trim() && q.opciones.filter(o => o.trim()).length >= 2
    ).length;

    if (complete === 0) {
        Toast.error('Agrega al menos una pregunta completa antes de guardar.');
        return;
    }
    if (complete < editorQuestions.length) {
        const ok = await Modal.show(
            'Preguntas incompletas',
            `${editorQuestions.length - complete} pregunta(s) están incompletas y serán descartadas. ¿Continuar?`,
            'Continuar'
        );
        if (!ok) return;
    }

    const finalQuestions = editorQuestions.filter(q =>
        q.pregunta.trim() && q.opciones.filter(o => o.trim()).length >= 2
    );

    const id              = document.getElementById('quiz-id').value || `quiz_${Date.now()}`;
    const nombre          = document.getElementById('quiz-name').value.trim();
    const cursoDestinatario = document.getElementById('quiz-curso').value;
    const puntajeMaximo   = parseInt(document.getElementById('quiz-max-score').value);
    const tiempoIdeal     = parseInt(document.getElementById('quiz-ideal-time').value);

    const btn = document.getElementById('btn-save-quiz');
    btn.disabled = true; btn.textContent = 'Sincronizando…';

    const { error } = await supabase.from('cuestionarios').upsert([{
        id, nombre, curso_destinatario: cursoDestinatario,
        puntaje_maximo: puntajeMaximo, tiempo_ideal: tiempoIdeal,
        preguntas: finalQuestions
    }]);

    btn.disabled = false; btn.innerHTML = 'SINCRONIZAR CON SUPABASE <span class="btn-arrow">↑</span>';

    if (error) {
        AudioEngine.error();
        Toast.error('Error al sincronizar. Intenta de nuevo.');
        return;
    }

    AudioEngine.achievement();
    Toast.success(`"${nombre}" guardado con ${finalQuestions.length} preguntas.`);
    document.getElementById('quiz-form').reset();
    document.getElementById('quiz-id').value = '';
    resetEditorState();
    loadAdminQuizzes();
});

// ── LOAD ADMIN QUIZZES ────────────────────────────────────────
async function loadAdminQuizzes() {
    const container = document.getElementById('admin-quizzes-list');
    container.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:.85rem;padding:10px">Cargando…</p>';

    try {
        const { data: quizzes } = await supabase.from('cuestionarios').select('*');
        container.innerHTML = '';

        if (!quizzes?.length) {
            container.innerHTML = '<p style="color:rgba(255,255,255,0.25);font-size:.85rem;padding:10px;text-align:center">No hay cuestionarios guardados.</p>';
            return;
        }

        quizzes.forEach(quiz => {
            const div = document.createElement('div');
            div.className = 'admin-list-item';
            div.innerHTML = `
                <div>
                    <b>${quiz.nombre}</b>
                    <div class="quiz-course-tag">📚 ${quiz.curso_destinatario} · ${(quiz.preguntas||[]).length} preguntas</div>
                </div>
                <div class="admin-list-actions">
                    <button class="btn btn-sm btn-secondary" id="edit-${quiz.id}" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-danger"    id="del-${quiz.id}"  title="Eliminar">🗑</button>
                </div>
            `;
            container.appendChild(div);

            document.getElementById(`edit-${quiz.id}`).addEventListener('click', () => {
                AudioEngine.btn();
                document.getElementById('quiz-id').value        = quiz.id;
                document.getElementById('quiz-name').value      = quiz.nombre;
                document.getElementById('quiz-curso').value     = quiz.curso_destinatario;
                document.getElementById('quiz-max-score').value = quiz.puntaje_maximo;
                document.getElementById('quiz-ideal-time').value= quiz.tiempo_ideal;
                editorQuestions = (quiz.preguntas || []).map(q => ({
                    pregunta: q.pregunta || '',
                    opciones: (q.opciones || ['','','','']).concat(['','','','']).slice(0,4),
                    correcta: q.correcta || 0
                }));
                renderEditorCards();
                updateEditorStats();
                AudioEngine.achievement();
                Toast.info(`Editando: "${quiz.nombre}"`);
                // Scroll to form
                document.getElementById('quiz-form').scrollIntoView({ behavior: 'smooth' });
            });

            document.getElementById(`del-${quiz.id}`).addEventListener('click', async () => {
                AudioEngine.btn();
                const ok = await Modal.show('Eliminar Cuestionario', `¿Eliminar permanentemente "${quiz.nombre}"?`, 'Eliminar');
                if (ok) {
                    await supabase.from('cuestionarios').delete().eq('id', quiz.id);
                    AudioEngine.error();
                    Toast.warn(`"${quiz.nombre}" eliminado.`);
                    loadAdminQuizzes();
                }
            });
        });
    } catch(e) { console.error(e); }
}

// ── RESET RANKING ─────────────────────────────────────────────
document.getElementById('btn-reset-ranking-global').addEventListener('click', async () => {
    AudioEngine.btn();
    const ok = await Modal.show('⚠️ Reiniciar Ranking', 'Esta acción eliminará TODOS los registros del ranking global. Es irreversible.', '🔥 Reiniciar todo');
    if (ok) {
        await supabase.from('records').delete().neq('id', 'void');
        AudioEngine.error();
        Toast.success('Ranking global purgado.');
        loadRankingGlobal();
    }
});

// ── BOOT ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { initSplashScreen(); } catch(e) { console.error(e); } }, 80);
});
window.addEventListener('click', () => AudioEngine.init(), { once: true });
