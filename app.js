// Recuperamos la instancia global inyectada en index.html
const supabase = window.supabase;

// ==========================================================================
// AUDIO ENGINE (CON CONTROL DE RESTRICCIÓN DE AUTOPLAY)
// ==========================================================================
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    playTone(freq, type, duration, gainStart) {
        try {
            this.init();
            if (this.ctx.state === 'suspended') return;

            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    },
    btn() { this.playTone(440, 'sine', 0.1, 0.3); },
    success() {
        this.init();
        this.playTone(587.33, 'triangle', 0.15, 0.4);
        setTimeout(() => this.playTone(880, 'triangle', 0.25, 0.4), 120);
    },
    error() { this.playTone(220, 'sawtooth', 0.3, 0.5); },
    countdown() { this.playTone(600, 'sine', 0.08, 0.3); },
    victory() {
        this.init();
        [523.25, 659.25, 783.99, 1046.50].forEach((t, i) => {
            setTimeout(() => this.playTone(t, 'sine', 0.4, 0.4), i * 150);
        });
    },
    achievement() {
        this.init();
        this.playTone(392, 'square', 0.1, 0.2);
        setTimeout(() => this.playTone(523.25, 'square', 0.1, 0.2), 80);
        setTimeout(() => this.playTone(659.25, 'square', 0.1, 0.2), 160);
        setTimeout(() => this.playTone(987.77, 'square', 0.3, 0.3), 240);
    }
};

// ESTADO GLOBAL DE LA APP
let currentUser = null;
let currentQuiz = null;
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let chronometerInterval = null;
let startTime = null;
let elapsedTimeInSeconds = 0;

// Referencias a elementos del DOM del Editor
const rawEditor = document.getElementById('quiz-raw-editor');
const countBadge = document.getElementById('detected-count-badge');

function switchView(panelId) {
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.add('hidden');
        panel.classList.remove('active');
    });
    const target = document.getElementById(panelId);
    target.classList.remove('hidden');
    target.classList.add('active');
}

function initSplashScreen() {
    const container = document.getElementById('particles-container');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = Math.random() * 100 + 'vw';
        p.style.width = p.style.height = Math.random() * 6 + 3 + 'px';
        p.style.animationDelay = Math.random() * 3 + 's';
        p.style.animationDuration = Math.random() * 4 + 4 + 's';
        container.appendChild(p);
    }

    let count = 3;
    const countBox = document.getElementById('countdown-box');
    const interval = setInterval(() => {
        if (count > 0) {
            countBox.innerText = count;
            count--;
        } else if (count === 0) {
            countBox.innerText = "¡ADELANTE!";
            count--;
        } else {
            clearInterval(interval);
            document.getElementById('splash-screen').classList.add('hidden');
            document.getElementById('main-container').classList.remove('hidden');
            loadRankingGlobal();
        }
    }, 1000);
}

// ==========================================================================
// AUTENTICACIÓN PERSONALIZADA (TABLAS DE SUPABASE)
// ==========================================================================
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    AudioEngine.btn();
    const nombreCompleto = document.getElementById('reg-nombre').value.trim();
    const curso = document.getElementById('reg-curso').value;
    const usuario = document.getElementById('reg-user').value.trim().toLowerCase();
    const password = document.getElementById('reg-pass').value;

    const { data: existingUser } = await supabase
        .from('usuarios')
        .select('usuario')
        .eq('usuario', usuario)
        .maybeSingle();

    if (existingUser) {
        alert("❌ El usuario ya se encuentra registrado.");
        AudioEngine.error();
        return;
    }

    const { error: insErr } = await supabase
        .from('usuarios')
        .insert([{ usuario, nombre_completo: nombreCompleto, curso, password }]);

    if (insErr) {
        alert("Error al registrar en la base de datos.");
        return;
    }

    alert("🚀 ¡Registro completado! Inicia sesión.");
    document.getElementById('register-form').reset();
    switchView('view-login');
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    AudioEngine.btn();
    const usuario = document.getElementById('login-user').value.trim().toLowerCase();
    const password = document.getElementById('login-pass').value;

    const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('usuario', usuario)
        .maybeSingle();

    if (error || !user || user.password !== password) {
        alert("❌ Credenciales inválidas.");
        AudioEngine.error();
        return;
    }

    currentUser = {
        usuario: user.usuario,
        nombreCompleto: user.nombre_completo,
        curso: user.curso
    };
    setupUserSession();
});

function setupUserSession() {
    document.getElementById('nav-login-btn').classList.add('hidden');
    document.getElementById('nav-register-btn').classList.add('hidden');
    const userTag = document.getElementById('user-tag');
    userTag.innerText = `👤 ${currentUser.nombreCompleto.toUpperCase()} (${currentUser.curso})`;
    userTag.classList.remove('hidden');
    document.getElementById('nav-logout-btn').classList.remove('hidden');
    AudioEngine.achievement();
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

// ==========================================================================
// MÓDULO TEXT PARSER & EDITOR INTERACTIVO DE PREGUNTAS
// ==========================================================================
if (rawEditor) {
    rawEditor.addEventListener('input', updateParsedCount);
}

document.getElementById('quiz-file-txt').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        rawEditor.value = evt.target.result;
        updateParsedCount();
    };
    reader.readAsText(file, "UTF-8");
});

function parseEditorContent() {
    if (!rawEditor) return [];
    const text = rawEditor.value;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedQuestions = [];
    let currentQuestion = null;

    lines.forEach(line => {
        if (line.startsWith('¿') || !line.match(/^[A-D]\)/i)) {
            if (currentQuestion) parsedQuestions.push(currentQuestion);
            currentQuestion = { pregunta: line, opciones: [], correcta: 0 };
        } else if (currentQuestion && line.match(/^[A-D]\)/i)) {
            const isCorrect = line.toUpperCase().endsWith('R');
            let cleanOption = line.substring(2).trim();
            if (isCorrect) {
                cleanOption = cleanOption.substring(0, cleanOption.length - 1).trim();
                currentQuestion.correcta = currentQuestion.opciones.length;
            }
            currentQuestion.opciones.push(cleanOption);
        }
    });
    if (currentQuestion) parsedQuestions.push(currentQuestion);
    return parsedQuestions;
}

function updateParsedCount() {
    const questions = parseEditorContent();
    if (countBadge) {
        countBadge.innerText = `Preguntas detectadas: ${questions.length}`;
    }
}

document.getElementById('btn-clear-editor').addEventListener('click', () => {
    AudioEngine.error();
    if(confirm("¿Vaciar el editor actual? Perderás los cambios no guardados.")) {
        rawEditor.value = '';
        document.getElementById('quiz-file-txt').value = '';
        updateParsedCount();
    }
});

function injectQuizToEditor(quiz) {
    document.getElementById('quiz-id').value = quiz.id;
    document.getElementById('quiz-name').value = quiz.nombre;
    document.getElementById('quiz-curso').value = quiz.curso_destinatario;
    document.getElementById('quiz-max-score').value = quiz.puntaje_maximo;
    document.getElementById('quiz-ideal-time').value = quiz.tiempo_ideal;
    
    let rawText = "";
    quiz.preguntas.forEach(q => {
        rawText += `${q.pregunta}\n`;
        q.opciones.forEach((op, i) => {
            rawText += `${String.fromCharCode(65 + i)}) ${op}${i === q.correcta ? ' R' : ''}\n`;
        });
        rawText += "\n";
    });
    
    rawEditor.value = rawText.trim();
    updateParsedCount();
}

document.getElementById('quiz-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    AudioEngine.btn();
    
    const finalQuestions = parseEditorContent();
    if (finalQuestions.length === 0) {
        alert("❌ El editor está vacío o el formato .TXT no es válido.");
        return;
    }

    const id = document.getElementById('quiz-id').value || 'quiz_' + Date.now();
    const nombre = document.getElementById('quiz-name').value.trim();
    const cursoDestinatario = document.getElementById('quiz-curso').value;
    const puntajeMaximo = parseInt(document.getElementById('quiz-max-score').value);
    const tiempoIdeal = parseInt(document.getElementById('quiz-ideal-time').value);

    const { error } = await supabase
        .from('cuestionarios')
        .upsert([{ 
            id, nombre, curso_destinatario: cursoDestinatario, 
            puntaje_maximo: puntajeMaximo, tiempo_ideal: tiempoIdeal, preguntas: finalQuestions 
        }]);

    if (error) {
        alert("Error al guardar en Supabase.");
        return;
    }

    alert("💾 ¡Cuestionario guardado y sincronizado!");
    document.getElementById('quiz-form').reset();
    rawEditor.value = '';
    updateParsedCount();
    loadAdminQuizzes();
});

// ==========================================================================
// DASHBOARD DEL ESTUDIANTE
// ==========================================================================
async function loadStudentDashboard() {
    switchView('view-student');
    document.getElementById('student-profile-name').innerText = currentUser.nombreCompleto;
    document.getElementById('student-profile-course').innerText = currentUser.curso;

    const { data: historyData } = await supabase
        .from('records')
        .select('*')
        .eq('usuario', currentUser.usuario);

    let totalPoints = 0, completedCount = 0;
    const historyList = document.getElementById('student-history-list');
    historyList.innerHTML = '';
    const trackingMap = {};

    if (historyData) {
        historyData.forEach(row => {
            totalPoints += row.puntaje_final;
            completedCount++;
            const li = document.createElement('li');
            li.innerHTML = `🏁 <b>${row.cuestionario_nombre}</b><br>Puntos: ${row.puntaje_final} | Intento: ${row.intento_nro} | Tiempo: ${row.tiempo_empleado}`;
            historyList.appendChild(li);
            trackingMap[row.cuestionario_id] = row.cantidad_intentos;
        });
    }

    document.getElementById('stat-completed').innerText = completedCount;
    document.getElementById('stat-points').innerText = totalPoints;

    const { data: quizzesData } = await supabase
        .from('cuestionarios')
        .select('*')
        .eq('curso_destinatario', currentUser.curso);

    const grid = document.getElementById('quizzes-grid');
    grid.innerHTML = '';

    if (!quizzesData || quizzesData.length === 0) {
        grid.innerHTML = '<p class="text-center">No tienes cuestionarios activos asignados.</p>';
        return;
    }

    quizzesData.forEach(quiz => {
        const intentosPrevios = trackingMap[quiz.id] || 0;
        const card = document.createElement('div');
        card.classList.add('quiz-card');
        card.innerHTML = `
            <div>
                <h3>🎮 ${quiz.nombre}</h3>
                <p class="quiz-meta">⏱️ Ideal: ${quiz.tiempo_ideal} min | 💯 Base: ${quiz.puntaje_maximo} Pts</p>
                <p style="font-size:0.85rem; color:${intentosPrevios >= 3 ? 'var(--error-red)' : 'var(--neon-blue)'}">Intentos realizados: ${intentosPrevios} / 3</p>
            </div>
            <button class="btn ${intentosPrevios >= 3 ? 'btn-secondary' : 'btn-primary'}" style="margin-top:15px;" ${intentosPrevios >= 3 ? 'disabled' : ''} id="btn-start-${quiz.id}">
                ${intentosPrevios >= 3 ? '💥 BLOQUEADO' : '⚡ INICIAR EVALUACIÓN'}
            </button>
        `;
        grid.appendChild(card);
        if (intentosPrevios < 3) {
            document.getElementById(`btn-start-${quiz.id}`).addEventListener('click', () => { startQuizEvaluation(quiz, intentosPrevios + 1); });
        }
    });
}

// ==========================================================================
// SIMULADOR DE EVALUACIÓN (CRONÓMETRO Y PANTALLA COMPLETA)
// ==========================================================================
function startQuizEvaluation(quiz, nroIntento) {
    AudioEngine.achievement();
    currentQuiz = quiz;
    currentQuiz.nroIntento = nroIntento;
    quizQuestions = [...quiz.preguntas];
    currentQuestionIndex = 0;
    userAnswers = [];
    
    switchView('view-quiz-play');
    document.getElementById('play-quiz-title').innerText = currentQuiz.nombre;
    
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    }

    elapsedTimeInSeconds = 0;
    startTime = Date.now();
    runChronometer();
    renderCurrentQuestion();
}

function runChronometer() {
    clearInterval(chronometerInterval);
    chronometerInterval = setInterval(() => {
        elapsedTimeInSeconds = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsedTimeInSeconds / 60).toString().padStart(2, '0');
        const secs = (elapsedTimeInSeconds % 60).toString().padStart(2, '0');
        document.getElementById('quiz-chronometer').innerText = `${mins}:${secs}`;
    }, 1000);
}

document.getElementById('btn-force-exit-fullscreen').addEventListener('click', () => {
    AudioEngine.btn();
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(()=>{});
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    }
    clearInterval(chronometerInterval);
    loadStudentDashboard();
});

function renderCurrentQuestion() {
    if (currentQuestionIndex >= quizQuestions.length) {
        finishQuizEvaluation();
        return;
    }
    document.getElementById('play-quiz-progress').innerText = `Pregunta ${currentQuestionIndex + 1} de ${quizQuestions.length}`;
    document.getElementById('quiz-progress-fill').style.width = `${(currentQuestionIndex / quizQuestions.length) * 100}%`;

    const q = quizQuestions[currentQuestionIndex];
    document.getElementById('play-question-text').innerText = q.pregunta;
    const container = document.getElementById('play-options-container');
    container.innerHTML = '';

    q.opciones.forEach((op, idx) => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.innerText = op;
        btn.addEventListener('click', () => evaluateSelectedOption(idx, btn));
        container.appendChild(btn);
    });
}

function evaluateSelectedOption(idx, btn) {
    const q = quizQuestions[currentQuestionIndex];
    const optionButtons = document.getElementById('play-options-container').children;
    for(let b of optionButtons) b.style.pointerEvents = 'none';

    const isCorrect = (idx === q.correcta);
    userAnswers.push({ selectedIndex: idx, isCorrect });

    if (isCorrect) {
        AudioEngine.success();
        btn.classList.add('correct-flash');
    } else {
        AudioEngine.error();
        btn.classList.add('wrong-flash');
        optionButtons[q.correcta].classList.add('correct-flash');
    }

    setTimeout(() => { currentQuestionIndex++; renderCurrentQuestion(); }, 1400);
}

async function finishQuizEvaluation() {
    clearInterval(chronometerInterval);
    AudioEngine.victory();
    if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});

    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    const porcentaje = Math.round((correctCount / quizQuestions.length) * 100);
    
    let bonificacion = 0;
    const tiempoIdealSegundos = currentQuiz.tiempo_ideal * 60;
    if (elapsedTimeInSeconds < tiempoIdealSegundos && correctCount > 0) {
        bonificacion = Math.round(((tiempoIdealSegundos - elapsedTimeInSeconds) * 0.1) * (porcentaje / 100));
    }

    const puntajeFinalTotal = Math.round(((correctCount / quizQuestions.length) * currentQuiz.puntaje_maximo) + bonificacion);
    const stringTiempo = `${Math.floor(elapsedTimeInSeconds / 60).toString().padStart(2, '0')}:${(elapsedTimeInSeconds % 60).toString().padStart(2, '0')}`;
    const recordId = `${currentUser.usuario}_${currentQuiz.id}`;

    const { data: currentRecord } = await supabase
        .from('records')
        .select('*')
        .eq('id', recordId)
        .maybeSingle();

    let payload = {};

    if (!currentRecord) {
        payload = {
            id: recordId, usuario: currentUser.usuario, nombre_completo: currentUser.nombreCompleto, curso: currentUser.curso,
            cuestionario_id: currentQuiz.id, cuestionario_nombre: currentQuiz.nombre, intento1: puntajeFinalTotal,
            intento_nro: 1, cantidad_intentos: 1, mejor_puntaje: puntajeFinalTotal,
            mejor_tiempo: stringTiempo, ultimo_intento: puntajeFinalTotal, tiempo_empleado: stringTiempo, porcentaje, puntaje_final: puntajeFinalTotal
        };
    } else {
        const nuevoIntento = currentRecord.cantidad_intentos + 1;
        payload = {
            ...currentRecord,
            cantidad_intentos: nuevoIntento,
            intento_nro: nuevoIntento,
            ultimo_intento: puntajeFinalTotal,
            tiempo_empleado: stringTiempo,
            porcentaje,
            puntaje_final: puntajeFinalTotal
        };
        payload[`intento${nuevoIntento}`] = puntajeFinalTotal;
        if (puntajeFinalTotal > currentRecord.mejor_puntaje) {
            payload.mejor_puntaje = puntajeFinalTotal;
            payload.mejor_tiempo = stringTiempo;
        }
    }

    await supabase.from('records').upsert([payload]);

    window.currentEvaluationReport = {
        estudiante: currentUser.nombreCompleto, curso: currentUser.curso, cuestionario: currentQuiz.nombre,
        puntaje: puntajeFinalTotal, maximoBase: currentQuiz.puntaje_maximo, porcentaje, tiempo: stringTiempo, intento: payload.cantidad_intentos
    };

    document.getElementById('res-score').innerText = `${puntajeFinalTotal} / ${currentQuiz.puntaje_maximo}`;
    document.getElementById('res-percent').innerText = `${porcentaje}%`;
    document.getElementById('res-time').innerText = stringTiempo;
    document.getElementById('res-bonus').innerText = `+${bonificacion} Pts`;
    document.getElementById('result-quiz-name').innerText = currentQuiz.nombre;

    switchView('view-results');
    triggerConfetti();
}

function triggerConfetti() {
    const wrapper = document.getElementById('confetti-wrapper');
    if(!wrapper) return;
    wrapper.innerHTML = '';
    for (let i = 0; i < 40; i++) {
        const c = document.createElement('div');
        c.style.position = 'absolute'; c.style.width = '10px'; c.style.height = '10px';
        c.style.backgroundColor = ['#00C8FF','#8A2EFF','#FFD700','#00FF99'][Math.floor(Math.random()*4)];
        c.style.left = Math.random() * 100 + '%'; c.style.top = '0px';
        const anim = c.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: `translateY(350px) translateX(${Math.random()*40-20}px) rotate(720deg)`, opacity: 0 }
        ], { duration: 2000 + Math.random()*1500 });
        wrapper.appendChild(c);
        anim.onfinish = () => c.remove();
    }
}

// ==========================================================================
// GENERACIÓN CERTIFICADO PDF
// ==========================================================================
document.getElementById('btn-download-pdf').addEventListener('click', () => {
    AudioEngine.achievement();
    const r = window.currentEvaluationReport;
    if (!r) return;

    const { jsPDF } = window.jspPDF; 
    const docPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    docPdf.setFillColor(8, 17, 31); docPdf.rect(0, 0, 210, 297, 'F');
    docPdf.setDrawColor(0, 200, 255); docPdf.setLineWidth(1); docPdf.rect(10, 10, 190, 277);

    docPdf.setTextColor(255, 255, 255); docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(28);
    docPdf.text("QUIZ LEGENDS", 105, 35, { align: "center" });

    docPdf.setFontSize(10); docPdf.setTextColor(138, 46, 255);
    docPdf.text("CONQUISTA EL CONOCIMIENTO. ROMPE RÉCORDS. CONVIÉRTETE EN LEYENDA.", 105, 43, { align: "center" });

    docPdf.setFontSize(14); docPdf.setTextColor(255, 255, 255); docPdf.text("Certificado oficial otorgado a:", 30, 70);
    docPdf.setFontSize(22); docPdf.setTextColor(255, 215, 0); docPdf.text(r.estudiante.toUpperCase(), 30, 82);

    docPdf.setFontSize(12); docPdf.setTextColor(255, 255, 255);
    docPdf.text(`Curso: ${r.curso}`, 30, 95); docPdf.text(`Evaluación: ${r.cuestionario}`, 30, 105);

    docPdf.setFillColor(16, 29, 51); docPdf.rect(25, 120, 160, 60, 'F');
    docPdf.setDrawColor(0, 200, 255); docPdf.rect(25, 120, 160, 60);

    docPdf.setFontSize(14); docPdf.setTextColor(0, 200, 255); docPdf.text("MÉTRICAS LOGRADAS", 35, 130);
    docPdf.setFontSize(12); docPdf.setTextColor(255, 255, 255);
    docPdf.text(`• Puntaje Final: ${r.puntaje} Puntos (Base Máxima: ${r.maximoBase})`, 35, 142);
    docPdf.text(`• Rendimiento Total: ${r.porcentaje}% de efectividad`, 35, 150);
    docPdf.text(`• Tiempo Empleado: ${r.tiempo} min`, 35, 158);
    docPdf.text(`• Intento Evaluado: Intento Nro. ${r.intento}`, 35, 166);

    docPdf.save(`QuizLegends_${r.estudiante.replace(/\s+/g, '_')}.pdf`);
});

document.getElementById('btn-result-close').addEventListener('click', () => { AudioEngine.btn(); loadStudentDashboard(); });

// ==========================================================================
// RANKING GLOBAL PÚBLICO
// ==========================================================================
async function loadRankingGlobal() {
    try {
        const { data: records, error } = await supabase
            .from('records')
            .select('*')
            .order('mejor_puntaje', { ascending: false })
            .order('mejor_tiempo', { ascending: true })
            .limit(20);

        const tbody = document.getElementById('ranking-tbody');
        tbody.innerHTML = '';

        if (error || !records || records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Aún no se registran leyendas en el podio.</td></tr>';
            return;
        }

        records.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><b>${idx + 1}</b></td><td>${row.nombre_completo}</td><td>${row.curso}</td><td>${row.cuestionario_nombre}</td><td>${row.mejor_puntaje} Pts</td><td>${row.mejor_tiempo}</td><td>${row.cantidad_intentos} / 3</td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {}
}

// NAVEGACIÓN GENERAL
document.getElementById('nav-logo-btn').addEventListener('click', () => { AudioEngine.btn(); if(currentUser) loadStudentDashboard(); else switchView('view-ranking'); });
document.getElementById('nav-ranking-btn').addEventListener('click', () => { AudioEngine.btn(); switchView('view-ranking'); loadRankingGlobal(); });
document.getElementById('nav-login-btn').addEventListener('click', () => { AudioEngine.btn(); switchView('view-login'); });
document.getElementById('nav-register-btn').addEventListener('click', () => { AudioEngine.btn(); switchView('view-register'); });

// ==========================================================================
// CONTROLADOR PANEL ADMINISTRADOR
// ==========================================================================
document.getElementById('secret-admin-trigger').addEventListener('click', () => {
    AudioEngine.btn();
    const clave = prompt("🔒 INGRESE LA CLAVE MAESTRA DE COMANDO:");
    if (clave === "LMKE2026") { switchView('view-admin'); loadAdminQuizzes(); }
    else { AudioEngine.error(); alert("Acceso Denegado."); }
});

document.getElementById('btn-admin-close').addEventListener('click', () => { AudioEngine.btn(); if (currentUser) loadStudentDashboard(); else switchView('view-ranking'); });

async function loadAdminQuizzes() {
    try {
        const { data: quizzes } = await supabase.from('cuestionarios').select('*');
        const container = document.getElementById('admin-quizzes-list');
        container.innerHTML = '';
        
        if (!quizzes) return;

        quizzes.forEach(quiz => {
            const div = document.createElement('div');
            div.classList.add('admin-list-item');
            div.innerHTML = `<div><b>${quiz.nombre}</b> [${quiz.curso_destinatario}]</div><div class="admin-list-actions"><button class="btn btn-sm btn-secondary" id="edit-${quiz.id}">编</button><button class="btn btn-sm btn-danger" id="del-${quiz.id}">🗑</button></div>`;
            container.appendChild(div);

            document.getElementById(`edit-${quiz.id}`).addEventListener('click', () => {
                injectQuizToEditor(quiz);
            });
            
            document.getElementById(`del-${quiz.id}`).addEventListener('click', async () => {
                if(confirm("¿Eliminar este cuestionario permanentemente?")) { 
                    await supabase.from('cuestionarios').delete().eq('id', quiz.id); 
                    loadAdminQuizzes(); 
                }
            });
        });
    } catch(e){}
}

document.getElementById('btn-reset-ranking-global').addEventListener('click', async () => {
    AudioEngine.error();
    if (confirm("⚠️ ¿Deseas reiniciar a cero el ranking global de PostgreSQL?")) {
        await supabase.from('records').delete().neq('id', 'void');
        alert("Ranking purgado.");
        loadRankingGlobal();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { initSplashScreen(); } catch(e) {} }, 60);
});

window.addEventListener('click', () => { AudioEngine.init(); }, { once: true });