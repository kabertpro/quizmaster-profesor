# 🎮 QUIZ LEGENDS
**"Conquista el conocimiento. Rompe récords. Conviértate en leyenda."**

**Kabert Studio · LMKE**

---

## 📋 INSTRUCCIONES DE INSTALACIÓN

### 1. Crear proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto.
3. En el panel lateral ve a **SQL Editor**.
4. Ejecuta el SQL que está abajo en el paso 2.

---

### 2. Crear las tablas (SQL Editor de Supabase)

Copia y pega este bloque completo en el SQL Editor y ejecútalo:

```sql
-- ============================================================
-- QUIZ LEGENDS — Schema Supabase
-- ============================================================

-- TABLA: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  usuario          TEXT PRIMARY KEY,
  nombre_completo  TEXT NOT NULL,
  curso            TEXT NOT NULL,
  password         TEXT NOT NULL
);

-- TABLA: cuestionarios
CREATE TABLE IF NOT EXISTS cuestionarios (
  id                 TEXT PRIMARY KEY,
  nombre             TEXT NOT NULL,
  curso_destinatario TEXT NOT NULL,
  puntaje_maximo     INTEGER NOT NULL DEFAULT 100,
  tiempo_ideal       INTEGER NOT NULL DEFAULT 10,
  preguntas          JSONB NOT NULL DEFAULT '[]'
);

-- TABLA: records
CREATE TABLE IF NOT EXISTS records (
  id                  TEXT PRIMARY KEY,
  usuario             TEXT NOT NULL,
  nombre_completo     TEXT NOT NULL,
  curso               TEXT NOT NULL,
  cuestionario_id     TEXT NOT NULL,
  cuestionario_nombre TEXT NOT NULL,
  intento1            INTEGER,
  intento2            INTEGER,
  intento3            INTEGER,
  intento_nro         INTEGER DEFAULT 1,
  cantidad_intentos   INTEGER DEFAULT 1,
  mejor_puntaje       INTEGER DEFAULT 0,
  mejor_tiempo        TEXT,
  ultimo_intento      INTEGER DEFAULT 0,
  tiempo_empleado     TEXT,
  porcentaje          INTEGER DEFAULT 0,
  puntaje_final       INTEGER DEFAULT 0,
  -- Detalle de respuestas por intento (para generar PDF desde el perfil)
  detalle_intento1    JSONB,
  detalle_intento2    JSONB,
  detalle_intento3    JSONB
);

-- ============================================================
-- POLÍTICAS RLS (Row Level Security)
-- Permitir acceso público anónimo (necesario para app sin Auth)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuestionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE records      ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT USING (true);
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT WITH CHECK (true);

-- Políticas para cuestionarios
CREATE POLICY "cuestionarios_select" ON cuestionarios FOR SELECT USING (true);
CREATE POLICY "cuestionarios_insert" ON cuestionarios FOR INSERT WITH CHECK (true);
CREATE POLICY "cuestionarios_update" ON cuestionarios FOR UPDATE USING (true);
CREATE POLICY "cuestionarios_delete" ON cuestionarios FOR DELETE USING (true);

-- Políticas para records
CREATE POLICY "records_select" ON records FOR SELECT USING (true);
CREATE POLICY "records_insert" ON records FOR INSERT WITH CHECK (true);
CREATE POLICY "records_update" ON records FOR UPDATE USING (true);
```

---

### 3. Configurar las credenciales en app.js

Abre `app.js` y reemplaza las líneas al inicio:

```js
const SUPABASE_URL  = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON = 'TU_ANON_KEY';
```

Con tus datos reales. Los encuentras en:
**Supabase → Settings → API → Project URL** y **anon public key**.

---

### 4. (Opcional) Cambiar la clave del administrador

En `app.js`, línea:
```js
const ADMIN_KEY = 'QL2025admin';
```
Cámbiala por la clave que quieras.

---

### 5. Publicar en Netlify o Vercel

#### Netlify (más fácil):
1. Ve a [https://netlify.com](https://netlify.com)
2. Arrastra la carpeta `quiz-legends` al panel de Deploy.
3. ¡Listo! Te dará una URL pública.

#### Vercel:
1. Sube la carpeta a un repositorio GitHub.
2. Importa el proyecto desde [https://vercel.com](https://vercel.com).
3. Deploy automático.

---

## 🔑 ACCESO ADMINISTRADOR

- Botón **⚙** en la esquina inferior derecha de la pantalla.
- Clave por defecto: `QL2025admin`
- Funciones: crear/editar/eliminar cuestionarios, importar TXT, ver estadísticas.

---

## 📂 FORMATO TXT PARA IMPORTAR PREGUNTAS

```
1. ¿Cuál es la capital de Bolivia?

A) La Paz
B) Sucre R
C) Santa Cruz
D) Oruro

2. ¿En qué continente está Bolivia?

A) Europa
B) Asia
C) América del Sur R
D) África
```

La letra **R** después de una opción indica la respuesta correcta.

---

## 📁 ARCHIVOS

```
quiz-legends/
├── index.html   — Estructura HTML de la app
├── styles.css   — Estilos gamer (Orbitron + Rajdhani)
├── app.js       — Toda la lógica (Auth, Quiz, Admin, PDF, Audio)
└── README.md    — Este archivo
```

---

## 🎮 FUNCIONALIDADES INCLUIDAS

- ✅ Registro e inicio de sesión (sin email, solo usuario/contraseña)
- ✅ Sesión persistente con localStorage
- ✅ Dashboard personalizado por curso
- ✅ Cuestionarios filtrados por curso del estudiante
- ✅ Máximo 3 intentos por cuestionario
- ✅ Modo evaluación en pantalla completa (Fullscreen API)
- ✅ Cuenta regresiva animada con sonido
- ✅ Cronómetro horas:minutos:segundos
- ✅ Bonificación por velocidad
- ✅ Sistema de logros (Aprendiz / Experto / Maestro / Leyenda)
- ✅ Ranking Global Top 20
- ✅ Historial personal
- ✅ Perfil del estudiante
- ✅ Descarga de resultados en PDF (jsPDF)
- ✅ Efectos de confeti al finalizar
- ✅ Sonidos Web Audio API (sin archivos externos)
- ✅ Partículas animadas en el fondo
- ✅ Panel administrador oculto (botón ⚙)
- ✅ Importador de preguntas desde TXT
- ✅ Editor visual de preguntas
- ✅ Estadísticas básicas del administrador
- ✅ Responsive: PC, Tablet, Android, iPhone
- ✅ Bloqueo en orientación horizontal en móviles

---

*Quiz Legends © 2025 — Kabert Studio · LMKE*
