import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, getDocs, 
    query, where, orderBy, limit, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REEMPLAZAR CON TUS CREDENCIALES CONFIGURADAS EN FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyYourRealApiKeyHere_QD93821",
    authDomain: "quiz-legends-lmke.firebaseapp.com",
    projectId: "quiz-legends-lmke",
    storageBucket: "quiz-legends-lmke.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

// Inicialización de Servicios Core
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================================================
// MÓDULO WEB AUDIO API (SÍNTESIS DE SONIDO PURA MEDIANTE OSCILADORES)
// ==========================================================================
const AudioEngine = {
    ctx: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    playTone(freq, type, duration, gainStart) {
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
    },

    btn() { this.playTone(440, 'sine', 0.1, 0.3); },
    success() {
        this.init();
        this.playTone(587.33, 'triangle', 0.15, 0.4);
        setTimeout(() => this.playTone(880, 'triangle', 0.25, 0.4), 120);
    },
    error() {
        this.init();
        this.playTone(220, 'sawtooth', 0.3, 0.5);
    },
    countdown() { this.playTone(600, 'sine', 0.08, 0.3); },
    victory() {
        this.init();
        const tones = [523.25, 659.25, 783.99, 1046.50];
        tones.forEach((t, i) => {
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

// ==========================================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================================================
let currentUser = null;
let currentQuiz = null;
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];

let chronometerInterval = null;
let startTime = null;
let elapsedTimeInSeconds = 0;

let adminParsedQuestions = [];

// ==========================================================================
// MANEJO DE VISTAS (DOM CONTROL)
// ==========================================================================
function switchView(panelId) {
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.add('hidden');
        panel.classList.remove('active');
    });
    const target = document.getElementById(panelId);
    target.classList.remove('hidden');
    target.classList.add('active');
}

// ==========================================================================
// RENDER: ANIMACIÓN SPLASH SCREEN & CONTEO REGRESIVO INICIAL
// ==========================================================================
function initSplashScreen() {
    const container = document.getElementById('particles-container');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = Math.random() * 100 + 'vw';
        p.style.width = p.style.height = Math.random() * 6 + 3 + 'px';
        p.style.animationDelay = Math.random() * 5 + 's';
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
// MÓDULO AUTENTICACIÓN: REGISTRO Y LOGIN DIRECTO A FIRESTORE
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
            alert("❌ El nombre de usuario ya se encuentra registrado.");
            AudioEngine.error();
            return;
        }

        await setDoc(userRef, {
            nombreCompleto,
            curso,
            usuario,
            password, // Validación directa estructurada para entornos académicos controlados
            fechaRegistro: new Date().toISOString()
        });

        alert("🚀 ¡Registro de leyenda completado con éxito! Inicia sesión.");
        document.getElementById('register-form').reset();
        switchView('view-login');
    } catch (err) {
        console.error(err);
        alert("Error en base de datos al registrar.");
    }
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
    } catch (err) {
        console.error(err);
        alert("Error de conexión al validar usuario.");
    }
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

// Cierre de Sesión Seguro
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
// MÓDULO GESTIÓN DE CONTENIDOS TEXTUALES (.TXT PARSER)
// ==========================================================================
document.getElementById('quiz-file-txt').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        parseTXTData(evt.target.result);
    };
    reader.readAsText(file, "UTF-8");
});

function parseTXTData(text) {
    adminParsedQuestions = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let currentQuestion = null;

    lines.forEach(line => {
        if (line.startsWith('¿') || !line.match(/^[A-D]\)/)) {
            if (currentQuestion) {
                adminParsedQuestions.push(currentQuestion);
            }
            currentQuestion = {
                pregunta: line,
                opciones: [],
                correcta: 0
            };
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

    if (currentQuestion) {
        adminParsedQuestions.push(currentQuestion);
    }

    // Render de validación visual inmediata en el panel de control
    const previewContainer = document.getElementById('parsed-questions-preview');
    previewContainer.innerHTML = `<h4>Preguntas Procesadas (${adminParsedQuestions.length})</h4>`;
    adminParsedQuestions.forEach((q, idx) => {
        previewContainer.innerHTML += `<p><b>${idx+1}. ${q.pregunta}</b> (Index Correcto: ${q.correcta})</p>`;
    });
}

// Guardar/Crear Cuestionario Completo
document.getElementById('quiz-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    AudioEngine.btn();

    if (adminParsedQuestions.length === 0) {
        alert("❌ Por favor, carga un archivo estructurado .TXT con preguntas válidas.");
        return;
    }

    const id = document.getElementById('quiz-id').value || 'quiz_' + Date.now();
    const nombre = document.getElementById('quiz-name').value.trim();
    const cursoDestinatario = document.getElementById('quiz-curso').value;
    const puntajeMaximo = parseInt(document.getElementById('quiz-max-score').value);
    const tiempoIdeal = parseInt(document.getElementById('quiz-ideal-time').value);

    try {
        await setDoc(doc(db, "cuestionarios", id), {
            id, nombre, cursoDestinatario, puntajeMaximo, tiempoIdeal,
            preguntas: adminParsedQuestions
        });
        alert("💾 Cuestionario guardado y sincronizado de forma segura.");
        document.getElementById('quiz-form').reset();
        document.getElementById('parsed-questions-preview').innerHTML = '';
        adminParsedQuestions = [];
        loadAdminQuizzes();
    } catch (err) {
        console.error(err);
        alert("Error de escritura en base de datos.");
    }
});

// ==========================================================================
// RENDERS DINÁMICOS: DASHBOARD ESTUDIANTE Y ACCESO EXCLUSIVO POR CURSO
// ==========================================================================
async function loadStudentDashboard() {
    switchView('view-student');
    document.getElementById('student-profile-name').innerText = currentUser.nombreCompleto;
    document.getElementById('student-profile-course').innerText = currentUser.curso;

    // Obtener estadísticas agregadas del perfil desde la colección de records
    try {
        const qHistory = query(collection(db, "records"), where("usuario", "==", currentUser.usuario));
        const snapHistory = await getDocs(qHistory);
        
        let totalPoints = 0;
        let completedCount = 0;
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

        // Cargar cuestionarios asignados a su curso específico
        const qQuizzes = query(collection(db, "cuestionarios"), where("cursoDestinatario", "==", currentUser.curso));
        const snapQuizzes = await getDocs(qQuizzes);
        
        const grid = document.getElementById('quizzes-grid');
        grid.innerHTML = '';

        if(snapQuizzes.empty) {
            grid.innerHTML = '<p class="text-center">No hay cuestionarios activos asignados a tu curso actualmente.</p>';
        }

        snapQuizzes.forEach(docSnap => {
            const quiz = docSnap.data();
            const intentosPrevios = trackingMap[quiz.id] || 0;

            const card = document.createElement('div');
            card.classList.add('quiz-card');
            card.innerHTML = `
                <div>
                    <h3>🎮 ${quiz.nombre}</h3>
                    <p class="quiz-meta">⏱️ Tiempo Ideal: ${quiz.tiempoIdeal} min | 💯 Base: ${quiz.puntajeMaximo} Pts</p>
                    <p style="font-size: 0.85rem; color: ${intentosPrevios >= 3 ? 'var(--error-red)' : 'var(--neon-blue)'}">
                        Intentos consumidos: ${intentosPrevios} / 3
                    </p>
                </div>
                <button class="btn ${intentosPrevios >= 3 ? 'btn-secondary' : 'btn-primary'}" 
                        style="margin-top:15px;" 
                        ${intentosPrevios >= 3 ? 'disabled' : ''} 
                        id="btn-start-${quiz.id}">
                    ${intentosPrevios >= 3 ? '💥 BLOQUEADO' : '⚡ INICIAR'}
                </button>
            `;
            grid.appendChild(card);

            if (intentosPrevios < 3) {
                document.getElementById(`btn-start-${quiz.id}`).addEventListener('click', () => {
                    startQuizEvaluation(quiz, intentosPrevios + 1);
                });
            }
        });

    } catch (err) {
        console.error(err);
    }
}

// ==========================================================================
// MÓDULO SIMULADOR: CONTROL DE EVALUACIÓN Y FULLSCREEN API
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
    
    // Solicitud forzosa de Pantalla Completa según requerimientos tácticos
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) docEl.requestFullscreen();
    else if (docEl.mozRequestFullScreen) docEl.mozRequestFullScreen();
    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();

    // Lanzamiento del Cronómetro de Precisión
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

    // Progreso visual superior
    const progressText = `Pregunta ${currentQuestionIndex + 1} de ${quizQuestions.length}`;
    document.getElementById('play-quiz-progress').innerText = progressText;
    const percentFill = ((currentQuestionIndex) / quizQuestions.length) * 100;
    document.getElementById('quiz-progress-fill').style.width = `${percentFill}%`;

    const q = quizQuestions[currentQuestionIndex];
    document.getElementById('play-question-text').innerText = q.pregunta;
    
    const optionsContainer = document.getElementById('play-options-container');
    optionsContainer.innerHTML = '';

    q.opciones.forEach((op, index) => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.innerText = op;
        btn.addEventListener('click', () => evaluateSelectedOption(index, btn));
        optionsContainer.appendChild(btn);
    });
}

function evaluateSelectedOption(selectedIndex, selectedButton) {
    const q = quizQuestions[currentQuestionIndex];
    const optionButtons = document.getElementById('play-options-container').children;
    
    // Deshabilitar clics adicionales durante la animación de feedback
    for(let b of optionButtons) b.style.pointerEvents = 'none';

    const isCorrect = (selectedIndex === q.correcta);
    userAnswers.push({ selectedIndex, isCorrect });

    if (isCorrect) {
        AudioEngine.success();
        selectedButton.classList.add('correct-flash');
    } else {
        AudioEngine.error();
        selectedButton.classList.add('wrong-flash');
        optionButtons[q.correcta].classList.add('correct-flash'); // Mostrar respuesta correcta como pedagogía activa
        
        // Soporte nativo para vibración en dispositivos móviles Android háticos
        if (navigator.vibrate) {
            navigator.vibrate(250);
        }
    }

    setTimeout(() => {
        currentQuestionIndex++;
        renderCurrentQuestion();
    }, 1400); // Latencia exacta para visualizar el destello de color
}

// Escucha activa ante salidas no deseadas de pantalla completa corporativa
document.addEventListener('fullscreenchange', handleFullscreenTampering);
document.addEventListener('webkitfullscreenchange', handleFullscreenTampering);

function handleFullscreenTampering() {
    const isNowFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const activeView = document.getElementById('view-quiz-play').classList.contains('active');
    if (!isNowFullscreen && activeView) {
        alert("⚠️ ATENCIÓN: Has salido del modo de pantalla completa obligatoria. Por favor presiona el botón para reingresar o se auditará la sesión.");
    }
}

document.getElementById('btn-force-exit-fullscreen').addEventListener('click', () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
});

// ==========================================================================
// CÁLCULO DE MÉTRICAS, PERSISTENCIA EN FIRESTORE Y CASCADA DE CONFETI
// ==========================================================================
async function finishQuizEvaluation() {
    clearInterval(chronometerInterval);
    AudioEngine.victory();

    if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});

    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    const porcentaje = Math.round((correctCount / quizQuestions.length) * 100);
    
    // Cálculo avanzado de bonificaciones gamer
    let bonificacion = 0;
    const tiempoMaximoPermitidoSegundos = currentQuiz.tiempoIdeal * 60;
    if (elapsedTimeInSeconds < tiempoMaximoPermitidoSegundos && correctCount > 0) {
        const segundosAhorrados = tiempoMaximoPermitidoSegundos - elapsedTimeInSeconds;
        bonificacion = Math.round((segundosAhorrados * 0.1) * (porcentaje / 100));
    }

    const puntajeBaseCalculado = (correctCount / quizQuestions.length) * currentQuiz.puntajeMaximo;
    const puntajeFinalTotal = Math.round(puntajeBaseCalculado + bonificacion);

    // Formatear tiempos para el reporte
    const minReport = Math.floor(elapsedTimeInSeconds / 60).toString().padStart(2, '0');
    const secReport = (elapsedTimeInSeconds % 60).toString().padStart(2, '0');
    const stringTiempoEmpleado = `${minReport}:${secReport}`;

    // Almacenamiento y estructuración en base de datos Firestore
    const recordId = `${currentUser.usuario}_${currentQuiz.id}`;
    const recordRef = doc(db, "records", recordId);

    try {
        const recordSnap = await getDoc(recordRef);
        let dataToSave = {};

        if (!recordSnap.exists()) {
            dataToSave = {
                usuario: currentUser.usuario,
                nombreCompleto: currentUser.nombreCompleto,
                curso: currentUser.curso,
                cuestionarioId: currentQuiz.id,
                cuestionarioNombre: currentQuiz.nombre,
                intento1: puntajeFinalTotal,
                intentoNro: currentQuiz.nroIntento,
                cantidadIntentos: 1,
                mejorPuntaje: puntajeFinalTotal,
                mejorTiempo: stringTiempoEmpleado,
                ultimoIntento: puntajeFinalTotal,
                tiempoEmpleado: stringTiempoEmpleado,
                porcentaje,
                puntajeFinal: puntajeFinalTotal,
                fechaRegistro: new Date().toISOString()
            };
        } else {
            const currentData = recordSnap.data();
            const nuevoIntentoNro = currentData.cantidadIntentos + 1;
            
            dataToSave = {
                ...currentData,
                cantidadIntentos: nuevoIntentoNro,
                intentoNro: nuevoIntentoNro,
                ultimoIntento: puntajeFinalTotal,
                tiempoEmpleado: stringTiempoEmpleado,
                porcentaje,
                puntajeFinal: puntajeFinalTotal,
                fechaRegistro: new Date().toISOString()
            };

            dataToSave[`intento${nuevoIntentoNro}`] = puntajeFinalTotal;

            if (puntajeFinalTotal > currentData.mejorPuntaje) {
                dataToSave.mejorPuntaje = puntajeFinalTotal;
                dataToSave.mejorTiempo = stringTiempoEmpleado;
            }
        }

        await setDoc(recordRef, dataToSave);

        // Guardar referencia exacta para render de PDF posterior
        window.currentEvaluationReport = {
            estudiante: currentUser.nombreCompleto,
            curso: currentUser.curso,
            cuestionario: currentQuiz.nombre,
            puntaje: puntajeFinalTotal,
            maximoBase: currentQuiz.puntajeMaximo,
            porcentaje: porcentaje,
            tiempo: stringTiempoEmpleado,
            intento: dataToSave.cantidadIntentos,
            fecha: new Date().toLocaleDateString()
        };

        // Renderizado en pantalla de resultados
        document.getElementById('res-score').innerText = `${puntajeFinalTotal} / ${currentQuiz.puntajeMaximo}`;
        document.getElementById('res-percent').innerText = `${porcentaje}%`;
        document.getElementById('res-time').innerText = stringTiempoEmpleado;
        document.getElementById('res-bonus').innerText = `+${bonificacion} Pts`;
        document.getElementById('result-quiz-name').innerText = currentQuiz.nombre;

        switchView('view-results');
        triggerConfettiCSSAnimation();

    } catch (err) {
        console.error("Error al guardar récord del juego:", err);
    }
}

function triggerConfettiCSSAnimation() {
    const wrapper = document.getElementById('confetti-wrapper');
    wrapper.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const confeti = document.createElement('div');
        confeti.style.position = 'absolute';
        confeti.style.width = '10px';
        confeti.style.height = '10px';
        confeti.style.backgroundColor = ['#00C8FF','#8A2EFF','#FFD700','#00FF99'][Math.floor(Math.random()*4)];
        confeti.style.left = Math.random() * 100 + '%';
        confeti.style.top = '0px';
        confeti.style.transform = `rotate(${Math.random()*360}deg)`;
        
        // Animación inyectada por hardware
        const anim = confeti.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: `translateY(400px) translateX(${Math.random()*40-20}px) rotate(${Math.random()*720}deg)`, opacity: 0 }
        ], { duration: 2000 + Math.random()*2000, iterations: 1 });
        
        wrapper.appendChild(confeti);
        anim.onfinish = () => confeti.remove();
    }
}

document.getElementById('btn-result-close').addEventListener('click', () => {
    AudioEngine.btn();
    loadStudentDashboard();
});

// ==========================================================================
// GENERACIÓN DE ARCHIVOS EXPORTABLES (JSPDF INTEGRATION)
// ==========================================================================
document.getElementById('btn-download-pdf').addEventListener('click', () => {
    AudioEngine.achievement();
    const r = window.currentEvaluationReport;
    if (!r) return;

    const { jsPDF } = window.jspPDF;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // Fondo Tecnológico Premium
    doc.setFillColor(8, 17, 31);
    doc.rect(0, 0, 210, 297, 'F');

    // Marcos de vectores neón
    doc.setDrawColor(0, 200, 255);
    doc.setLineWidth(1);
    doc.rect(10, 10, 190, 277);

    // Cabecera Institucional
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("QUIZ LEGENDS", 105, 35, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(138, 46, 255);
    doc.text("CONQUISTA EL CONOCIMIENTO. ROMPE RÉCORDS. CONVIÉRTETE EN LEYENDA.", 105, 43, { align: "center" });

    // Línea divisoria
    doc.setDrawColor(138, 46, 255);
    doc.line(25, 50, 185, 50);

    // Bloque central de datos procesados
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`Certificado oficial otorgado a:`, 30, 70);
    
    doc.setFontSize(22);
    doc.setTextColor(255, 215, 0); // Oro Épico
    doc.text(r.estudiante.toUpperCase(), 30, 82);

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(`Curso: ${r.curso}`, 30, 95);
    doc.text(`Evaluación Realizada: ${r.cuestionario}`, 30, 105);

    // Caja de Estadísticas Técnicas Obtenidas
    doc.setFillColor(16, 29, 51);
    doc.rect(25, 120, 160, 60, 'F');
    doc.setDrawColor(0, 200, 255);
    doc.rect(25, 120, 160, 60);

    doc.setFontSize(14);
    doc.setTextColor(0, 200, 255);
    doc.text("MÉTRICAS LOGRADAS", 35, 130);

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(`• Puntaje Final: ${r.score} Puntos (Base Máxima: ${r.maximoBase})`, 35, 142);
    doc.text(`• Rendimiento Total: ${r.porcentaje}% de efectividad`, 35, 150);
    doc.text(`• Tiempo Empleado: ${r.tiempo} minutos`, 35, 158);
    doc.text(`• Número de Intento Evaluado: Intento Nro. ${r.intento}`, 35, 166);

    // Pie de página de validez del ecosistema
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setDrawColor(255, 255, 255);
    doc.line(70, 230, 140, 230);
    doc.text("Firma de Certificación Automatizada", 105, 236, { align: "center" });

    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text(`Fecha del Reporte: ${r.fecha} | Ecosistema de Software desarrollado por Kabert Studio - LMKE`, 105, 275, { align: "center" });

    doc.save(`QuizLegends_Certificado_${r.estudiante.replace(/\s+/g, '_')}.pdf`);
});

// ==========================================================================
// RANKING PÚBLICO GLOBAL (TOP 20 - ACTUALIZACIONES REMOTAS)
// ==========================================================================
async function loadRankingGlobal() {
    try {
        const q = query(collection(db, "records"), orderBy("mejorPuntaje", "desc"), orderBy("mejorTiempo", "asc"), limit(20));
        const querySnapshot = await getDocs(q);
        
        const tbody = document.getElementById('ranking-tbody');
        tbody.innerHTML = '';

        if(querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Aún no se registran leyendas en el podio global.</td></tr>';
            return;
        }

        let posicion = 1;
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${posicion}</b></td>
                <td>${data.nombreCompleto}</td>
                <td>${data.curso}</td>
                <td>${data.cuestionarioNombre}</td>
                <td>${data.mejorPuntaje} Pts</td>
                <td>${data.mejorTiempo}</td>
                <td>${data.cantidadIntentos} / 3</td>
            `;
            tbody.appendChild(tr);
            posicion++;
        });
    } catch (err) {
        console.error("Error cargando ranking:", err);
    }
}

// Controladores Básicos de Menú Superior de Navegación
document.getElementById('nav-logo-btn').addEventListener('click', () => { AudioEngine.btn(); if(currentUser) loadStudentDashboard(); else switchView('view-ranking'); });
document.getElementById('nav-ranking-btn').addEventListener('click', () => { AudioEngine.btn(); switchView('view-ranking'); loadRankingGlobal(); });
document.getElementById('nav-login-btn').addEventListener('click', () => { AudioEngine.btn(); switchView('view-login'); });
document.getElementById('nav-register-btn').addEventListener('click', () => { AudioEngine.btn(); switchView('view-register'); });

// ==========================================================================
// CONTROLADOR COMPLETO DEL BACKOFFICE DEL ADMINISTRADOR
// ==========================================================================
document.getElementById('secret-admin-trigger').addEventListener('click', () => {
    AudioEngine.btn();
    const claveMaestra = prompt("🔒 INGRESE LA CLAVE MAESTRA DE COMANDO:");
    if (claveMaestra === "LMKE2026") {
        switchView('view-admin');
        loadAdminQuizzes();
    } else {
        AudioEngine.error();
        alert("Clave incorrecta. Acceso Denegado.");
    }
});

document.getElementById('btn-admin-close').addEventListener('click', () => {
    AudioEngine.btn();
    if (currentUser) loadStudentDashboard();
    else switchView('view-ranking');
});

async function loadAdminQuizzes() {
    try {
        const snap = await getDocs(collection(db, "cuestionarios"));
        const listContainer = document.getElementById('admin-quizzes-list');
        listContainer.innerHTML = '';

        snap.forEach(docSnap => {
            const quiz = docSnap.data();
            const div = document.createElement('div');
            div.classList.add('admin-list-item');
            div.innerHTML = `
                <div>
                    <b>${quiz.nombre}</b> [${quiz.cursoDestinatario}]
                </div>
                <div class="admin-list-actions">
                    <button class="btn btn-sm btn-secondary" id="edit-${quiz.id}">📝 Editar</button>
                    <button class="btn btn-sm btn-danger" id="del-${quiz.id}">🗑️ Eliminar</button>
                </div>
            `;
            listContainer.appendChild(div);

            document.getElementById(`edit-${quiz.id}`).addEventListener('click', () => {
                document.getElementById('quiz-id').value = quiz.id;
                document.getElementById('quiz-name').value = quiz.nombre;
                document.getElementById('quiz-curso').value = quiz.cursoDestinatario;
                document.getElementById('quiz-max-score').value = quiz.puntajeMaximo;
                document.getElementById('quiz-ideal-time').value = quiz.tiempoIdeal;
                adminParsedQuestions = quiz.preguntas;
                
                const previewContainer = document.getElementById('parsed-questions-preview');
                previewContainer.innerHTML = `<h4>Preguntas Cargadas (${adminParsedQuestions.length})</h4>`;
                adminParsedQuestions.forEach((q, idx) => {
                    previewContainer.innerHTML += `<p><b>${idx+1}. ${q.pregunta}</b></p>`;
                });
            });

            document.getElementById(`del-${quiz.id}`).addEventListener('click', async () => {
                if(confirm(`¿Estás completamente seguro de eliminar "${quiz.nombre}"?`)) {
                    await deleteDoc(doc(db, "cuestionarios", quiz.id));
                    loadAdminQuizzes();
                }
            });
        });
    } catch (err) {
        console.error(err);
    }
}

// Acción de borrado global del Ranking
document.getElementById('btn-reset-ranking-global').addEventListener('click', async () => {
    AudioEngine.error();
    if (confirm("⚠️ ALERTA CRÍTICA: ¿Deseas purgar y reiniciar a cero el tablero global de records?")) {
        try {
            const snap = await getDocs(collection(db, "records"));
            const batchDeletes = snap.docs.map(docSnap => deleteDoc(doc(db, "records", docSnap.id)));
            await Promise.all(batchDeletes);
            alert("🧹 Tablero de control de clasificaciones purgado con éxito.");
            loadAdminQuizzes();
        } catch(err) {
            console.error(err);
        }
    }
});

// Inicialización asíncrona controlada por eventos del ciclo de vida web
window.addEventListener('DOMContentLoaded', () => {
    initSplashScreen();
});