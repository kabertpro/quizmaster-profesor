import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, getDocs, 
    query, where, orderBy, limit, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciales base de Firebase Firestore
const firebaseConfig = {
    apiKey: "AIzaSyYourRealApiKeyHere_QD93821",
    authDomain: "quiz-legends-lmke.firebaseapp.com",
    projectId: "quiz-legends-lmke",
    storageBucket: "quiz-legends-lmke.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================================================
// AUDIO ENGINE (WEB AUDIO API)
// ==========================================================================
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone(freq, type, duration, gainStart) {
        try {
            this.init();
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
        } catch(e) { console.warn("Contexto de audio retenido por interacción de usuario."); }
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

// ESTADO GLOBAL
let currentUser = null;
let currentQuiz = null;
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let chronometerInterval = null;
let startTime = null;
let elapsedTimeInSeconds = 0;
let adminParsedQuestions = [];

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
            AudioEngine.countdown();
            countBox.innerText = count;
            count--;
        } else if (count === 0) {
            AudioEngine.achievement();
            countBox.innerText = "¡COMIENZA!";
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
// REGISTRO & LOGIN
// ==========================================================================
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    AudioEngine.btn();
    const nombreCompleto = document.getElementById('reg-nombre').value.trim();
    const curso = document.getElementById('reg-curso').value;
    const usuario = document.getElementById('reg-user').value.trim().toLowerCase();
    const password = document.getElementById('reg-pass').value;

    try {
        const userRef = doc(db, "usuarios", usuario);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            alert("❌ El usuario ya se encuentra registrado.");
            AudioEngine.error();
            return;
        }
        await setDoc(userRef, { nombreCompleto, curso, usuario, password, fechaRegistro: new Date().toISOString() });
        alert("🚀 ¡Registro completado! Inicia sesión.");
        document.getElementById('register-form').reset();
        switchView('view-login');
    } catch (err) { alert("Error al registrar."); }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    AudioEngine.btn();
    const usuario = document.getElementById('login-user').value.trim().toLowerCase();
    const password = document.getElementById('login-pass').value;

    try {
        const userRef = doc(db, "usuarios", usuario);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || userSnap.data().password !== password) {
            alert("❌ Credenciales inválidas.");
            AudioEngine.error();
            return;
        }
        currentUser = userSnap.data();
        setupUserSession();
    } catch (err) { alert("Error de conexión al servidor."); }
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
// ARCHIVOS TXT PARSER (BLINDADO)
// ==========================================================================
document.getElementById('quiz-file-txt').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            parseTXTData(evt.target.result);
        } catch(err) { console.error("Error al procesar el archivo estructurado.", err); }
    };
    reader.readAsText(file, "UTF-8");
});

function parseTXTData(text) {
    adminParsedQuestions = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentQuestion = null;

    lines.forEach(line => {
        if (line.startsWith('¿') || !line.match(/^[A-D]\)/)) {
            if (currentQuestion) adminParsedQuestions.push(currentQuestion);
            currentQuestion = { pregunta: line, opciones: [], correcta: 0 };
        } else if (currentQuestion && line.match(/^[A-D]\)/)) {
            const isCorrect = line.toUpperCase().endsWith('R');
            let cleanOption = line.substring(2).trim();
            if (isCorrect) {
                cleanOption = cleanOption.substring(0, cleanOption.length - 1).trim();
                currentQuestion.correcta = currentQuestion.opciones.length;
            }
            currentQuestion.opciones.push(cleanOption);
        }
    });
    if (currentQuestion) adminParsedQuestions.push(currentQuestion);

    const previewContainer = document.getElementById('parsed-questions-preview');
    previewContainer.innerHTML = `<h4>Preguntas Procesadas (${adminParsedQuestions.length})</h4>`;
    adminParsedQuestions.forEach((q, idx) => {
        previewContainer.innerHTML += `<p><b>${idx+1}. ${q.pregunta}</b></p>`;
    });
}

document.getElementById('quiz-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    AudioEngine.btn();
    if (adminParsedQuestions.length === 0) {
        alert("❌ Carga un archivo estructurado .TXT primero.");
        return;
    }
    const id = document.getElementById('quiz-id').value || 'quiz_' + Date.now();
    const nombre = document.getElementById('quiz-name').value.trim();
    const cursoDestinatario = document.getElementById('quiz-curso').value;
    const puntajeMaximo = parseInt(document.getElementById('quiz-max-score').value);
    const tiempoIdeal = parseInt(document.getElementById('quiz-ideal-time').value);

    try {
        await setDoc(doc(db, "cuestionarios", id), { id, nombre, cursoDestinatario, puntajeMaximo, tiempoIdeal, preguntas: adminParsedQuestions });
        alert("💾 Cuestionario sincronizado.");
        document.getElementById('quiz-form').reset();
        document.getElementById('parsed-questions-preview').innerHTML = '';
        adminParsedQuestions = [];
        loadAdminQuizzes();
    } catch (err) { alert("Error al guardar."); }
});

// ==========================================================================
// PANEL ESTUDIANTE
// ==========================================================================
async function loadStudentDashboard() {
    switchView('view-student');
    document.getElementById('student-profile-name').innerText = currentUser.nombreCompleto;
    document.getElementById('student-profile-course').innerText = currentUser.curso;

    try {
        const qHistory = query(collection(db, "records"), where("usuario", "==", currentUser.usuario));
        const snapHistory = await getDocs(qHistory);
        let totalPoints = 0, completedCount = 0;
        const historyList = document.getElementById('student-history-list');
        historyList.innerHTML = '';
        const trackingMap = {};

        snapHistory.forEach(docSnap => {
            const data = docSnap.data();
            totalPoints += data.puntajeFinal;
            completedCount++;
            const li = document.createElement('li');
            li.innerHTML = `🏁 <b>${data.cuestionarioNombre}</b><br>Puntos: ${data.puntajeFinal} | Intento: ${data.intentoNro} | Tiempo: ${data.tiempoEmpleado}`;
            historyList.appendChild(li);
            trackingMap[data.cuestionarioId] = data.cantidadIntentos;
        });

        document.getElementById('stat-completed').innerText = completedCount;
        document.getElementById('stat-points').innerText = totalPoints;

        const qQuizzes = query(collection(db, "cuestionarios"), where("cursoDestinatario", "==", currentUser.curso));
        const snapQuizzes = await getDocs(qQuizzes);
        const grid = document.getElementById('quizzes-grid');
        grid.innerHTML = '';

        if(snapQuizzes.empty) {
            grid.innerHTML = '<p class="text-center">No tienes cuestionarios activos para tu curso.</p>';
        }

        snapQuizzes.forEach(docSnap => {
            const quiz = docSnap.data();
            const intentosPrevios = trackingMap[quiz.id] || 0;
            const card = document.createElement('div');
            card.classList.add('quiz-card');
            card.innerHTML = `
                <div>
                    <h3>🎮 ${quiz.nombre}</h3>
                    <p class="quiz-meta">⏱️ Ideal: ${quiz.tiempoIdeal} min | 💯 Base: ${quiz.puntajeMaximo} Pts</p>
                    <p style="font-size:0.85rem; color:${intentosPrevios >= 3 ? 'var(--error-red)' : 'var(--neon-blue)'}">Intentos: ${intentosPrevios} / 3</p>
                </div>
                <button class="btn ${intentosPrevios >= 3 ? 'btn-secondary' : 'btn-primary'}" style="margin-top:15px;" ${intentosPrevios >= 3 ? 'disabled' : ''} id="btn-start-${quiz.id}">
                    ${intentosPrevios >= 3 ? '💥 BLOQUEADO' : '⚡ INICIAR'}
                </button>
            `;
            grid.appendChild(card);
            if (intentosPrevios < 3) {
                document.getElementById(`btn-start-${quiz.id}`).addEventListener('click', () => { startQuizEvaluation(quiz, intentosPrevios + 1); });
            }
        });
    } catch (err) { console.error(err); }
}

// ==========================================================================
// SIMULADOR: EVALUACIÓN ACTIVA
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
    if (docEl.requestFullscreen) docEl.requestFullscreen();
    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();

    elapsedTimeInSeconds = 0;
    startTime = Date.now();
    runChronometer();
    renderCurrentQuestion();
}

function runChronometer() {
    clearInterval(chronometerInterval);
    chronometerInterval = setInterval(() => {
        elapsedTimeInSeconds = Math.floor((Date.now() - startTime) / 1000);
        const hrs = Math.floor(elapsedTimeInSeconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((elapsedTimeInSeconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (elapsedTimeInSeconds % 60).toString().padStart(2, '0');
        document.getElementById('quiz-chronometer').innerText = `${hrs}:${mins}:${secs}`;
    }, 1000);
}

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
        if (navigator.vibrate) navigator.vibrate(250);
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
    const tiempoIdealSegundos = currentQuiz.tiempoIdeal * 60;
    if (elapsedTimeInSeconds < tiempoIdealSegundos && correctCount > 0) {
        bonificacion = Math.round(((tiempoIdealSegundos - elapsedTimeInSeconds) * 0.1) * (porcentaje / 100));
    }

    const puntajeFinalTotal = Math.round(((correctCount / quizQuestions.length) * currentQuiz.puntajeMaximo) + bonificacion);
    const stringTiempo = `${Math.floor(elapsedTimeInSeconds / 60).toString().padStart(2, '0')}:${(elapsedTimeInSeconds % 60).toString().padStart(2, '0')}`;

    const recordId = `${currentUser.usuario}_${currentQuiz.id}`;
    const recordRef = doc(db, "records", recordId);

    try {
        const recordSnap = await getDoc(recordRef);
        let dataToSave = {};

        if (!recordSnap.exists()) {
            dataToSave = {
                usuario: currentUser.usuario, nombreCompleto: currentUser.nombreCompleto, curso: currentUser.curso,
                cuestionarioId: currentQuiz.id, cuestionarioNombre: currentQuiz.nombre, intento1: puntajeFinalTotal,
                intentoNro: currentQuiz.nroIntento, cantidadIntentos: 1, mejorPuntaje: puntajeFinalTotal,
                mejorTiempo: stringTiempo, ultimoIntento: puntajeFinalTotal, tiempoEmpleado: stringTiempo, porcentaje, puntajeFinal: puntajeFinalTotal, fechaRegistro: new Date().toISOString()
            };
        } else {
            const currentData = recordSnap.data();
            const nuevoIntento = currentData.cantidadIntentos + 1;
            dataToSave = { ...currentData, cantidadIntentos: nuevoIntento, intentoNro: nuevoIntento, ultimoIntento: puntajeFinalTotal, tiempoEmpleado: stringTiempo, porcentaje, puntajeFinal: puntajeFinalTotal, fechaRegistro: new Date().toISOString() };
            dataToSave[`intento${nuevoIntento}`] = puntajeFinalTotal;
            if (puntajeFinalTotal > currentData.mejorPuntaje) { dataToSave.mejorPuntaje = puntajeFinalTotal; dataToSave.mejorTiempo = stringTiempo; }
        }

        await setDoc(recordRef, dataToSave);

        window.currentEvaluationReport = {
            estudiante: currentUser.nombreCompleto, curso: currentUser.curso, cuestionario: currentQuiz.nombre,
            puntaje: puntajeFinalTotal, maximoBase: currentQuiz.puntajeMaximo, porcentaje, tiempo: stringTiempo, intento: dataToSave.cantidadIntentos, fecha: new Date().toLocaleDateString()
        };

        document.getElementById('res-score').innerText = `${puntajeFinalTotal} / ${currentQuiz.puntajeMaximo}`;
        document.getElementById('res-percent').innerText = `${porcentaje}%`;
        document.getElementById('res-time').innerText = stringTiempo;
        document.getElementById('res-bonus').innerText = `+${bonificacion} Pts`;
        document.getElementById('result-quiz-name').innerText = currentQuiz.nombre;

        switchView('view-results');
        triggerConfetti();
    } catch (err) { console.error(err); }
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
// GENERACIÓN CERTIFICADO PDF CORREGIDO (ESM INTEROP)
// ==========================================================================
document.getElementById('btn-download-pdf').addEventListener('click', () => {
    AudioEngine.achievement();
    const r = window.currentEvaluationReport;
    if (!r) return;

    // Extracción segura desde la inyección limpia del HTML
    const { jsPDF } = window.jspPDF; 
    const docPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    docPdf.setFillColor(8, 17, 31); docPdf.rect(0, 0, 210, 297, 'F');
    docPdf.setDrawColor(0, 200, 255); docPdf.setLineWidth(1); docPdf.rect(10, 10, 190, 277);

    docPdf.setTextColor(255, 255, 255); docPdf.setFont("helvetica", "bold"); docPdf.setFontSize(28);
    docPdf.text("QUIZ LEGENDS", 105, 35, { align: "center" });

    docPdf.setFontSize(10); docPdf.setTextColor(138, 46, 255);
    docPdf.text("CONQUISTA EL CONOCIMIENTO. ROMPE RÉCORDS. CONVIÉRTETE EN LEYENDA.", 105, 43, { align: "center" });
    docPdf.setDrawColor(138, 46, 255); docPdf.line(25, 50, 185, 50);

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

    docPdf.line(70, 230, 140, 230); docPdf.text("Firma de Certificación Automatizada", 105, 236, { align: "center" });
    docPdf.setFontSize(8); docPdf.setTextColor(100, 110, 120);
    docPdf.text(`Fecha: ${r.fecha} | Ecosistema desarrollado por Kabert Studio - LMKE`, 105, 275, { align: "center" });

    docPdf.save(`QuizLegends_${r.estudiante.replace(/\s+/g, '_')}.pdf`);
});

document.getElementById('btn-result-close').addEventListener('click', () => { AudioEngine.btn(); loadStudentDashboard(); });

// ==========================================================================
// RANKING GLOBAL PÚBLICO
// ==========================================================================
async function loadRankingGlobal() {
    try {
        const q = query(collection(db, "records"), orderBy("mejorPuntaje", "desc"), orderBy("mejorTiempo", "asc"), limit(20));
        const snap = await getDocs(q);
        const tbody = document.getElementById('ranking-tbody');
        tbody.innerHTML = '';

        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Aún no se registran leyendas en el podio.</td></tr>';
            return;
        }
        let pos = 1;
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><b>${pos}</b></td><td>${data.nombreCompleto}</td><td>${data.curso}</td><td>${data.cuestionarioNombre}</td><td>${data.mejorPuntaje} Pts</td><td>${data.mejorTiempo}</td><td>${data.cantidadIntentos} / 3</td>`;
            tbody.appendChild(tr);
            pos++;
        });
    } catch (err) { console.error(err); }
}

// NAVEGACIÓN
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
        const snap = await getDocs(collection(db, "cuestionarios"));
        const container = document.getElementById('admin-quizzes-list');
        container.innerHTML = '';
        snap.forEach(docSnap => {
            const quiz = docSnap.data();
            const div = document.createElement('div');
            div.classList.add('admin-list-item');
            div.innerHTML = `<div><b>${quiz.nombre}</b> [${quiz.cursoDestinatario}]</div><div class="admin-list-actions"><button class="btn btn-sm btn-secondary" id="edit-${quiz.id}">📝</button><button class="btn btn-sm btn-danger" id="del-${quiz.id}">🗑️</button></div>`;
            container.appendChild(div);

            document.getElementById(`edit-${quiz.id}`).addEventListener('click', () => {
                document.getElementById('quiz-id').value = quiz.id;
                document.getElementById('quiz-name').value = quiz.nombre;
                document.getElementById('quiz-curso').value = quiz.cursoDestinatario;
                document.getElementById('quiz-max-score').value = quiz.puntajeMaximo;
                document.getElementById('quiz-ideal-time').value = quiz.tiempoIdeal;
                adminParsedQuestions = quiz.preguntas;
            });
            document.getElementById(`del-${quiz.id}`).addEventListener('click', async () => {
                if(confirm("¿Eliminar cuestionario?")) { await deleteDoc(doc(db, "cuestionarios", quiz.id)); loadAdminQuizzes(); }
            });
        });
    } catch(e){}
}

document.getElementById('btn-reset-ranking-global').addEventListener('click', async () => {
    AudioEngine.error();
    if (confirm("⚠️ ¿Deseas reiniciar a cero el ranking global?")) {
        const snap = await getDocs(collection(db, "records"));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "records", d.id))));
        alert("Ranking purgado.");
        loadAdminQuizzes();
    }
});

// Inicialización asíncrona segura para evitar colisiones de extensiones
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        try { initSplashScreen(); } catch(e) { console.warn(e); }
    }, 60);
});