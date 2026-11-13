# Convive — Cómo correr todo junto (Linux)

```
convive/
├── backend/            API (Express + Prisma + PostgreSQL)   → puerto 3000
├── frontend/           React + Vite                          → puerto 5173
├── docker-compose.yml  PostgreSQL 16 (BD "convive" y "convive_test") → puerto 5432
└── scripts/smoke.sh    prueba rápida de integración
```

## Puertos y quién habla con quién

| Pieza | Puerto | Habla con |
|---|---|---|
| Navegador → Frontend (Vite) | 5173 | — |
| Frontend (en el navegador) → Backend | 3000 | `VITE_API_URL` |
| Backend → PostgreSQL | 5432 | `DATABASE_URL` |

El `fetch` sale **desde el navegador**, no desde Vite. Por eso el backend debe
aceptar el origen `http://localhost:5173` en CORS.

## Variables de entorno

**`backend/.env`** (copia de `.env.example`)

| Variable | Para qué | Debe coincidir con |
|---|---|---|
| `DATABASE_URL` | conexión a PostgreSQL | usuario/clave/BD del `docker-compose.yml` |
| `PORT` | puerto de la API | el puerto de `VITE_API_URL` |
| `CORS_ORIGINS` | orígenes del frontend, separados por coma | la URL EXACTA con la que abres el frontend |
| `JWT_SECRET` | firma de los tokens (32+ caracteres) | — (secreto, nunca al repositorio) |
| `JWT_EXPIRES_IN` | duración de la sesión (`8h`) | — |
| `MAX_UPLOAD_MB` | tamaño máximo por archivo | `VITE_MAX_UPLOAD_MB` |
| `SEED_DEMO_DATA` | crea usuarios y casos de demostración | solo desarrollo |

**`frontend/.env`** (copia de `.env.example`; Vite lo lee al ARRANCAR)

| Variable | Para qué |
|---|---|
| `VITE_API_URL` | URL base de la API, termina en `/api` (`http://localhost:3000/api`) |
| `VITE_MAX_UPLOAD_MB` | solo avisa antes de subir; el límite real es el del backend |

## Primera vez (comandos en orden)

```bash
mkdir -p ~/convive && cd ~/convive
unzip ~/Descargas/convive-backend.zip -d backend
# frontend: tu proyecto Vite en ./frontend (con el src de la Fase 4 y su .env.example)

# 1) Base de datos (crea "convive" y "convive_test")
docker compose up -d
docker compose ps                      # debe decir "running"

# 2) Backend
cd backend
npm install
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # pega el resultado en JWT_SECRET
npx prisma migrate dev --name init     # crea y aplica la migración
npx prisma generate                    # Prisma 7 ya no lo hace solo
npm run db:seed                        # usuarios y datos de demostración
npm run db:test:migrate                # aplica las migraciones a convive_test
npm test                               # (opcional) 286 pruebas; usan convive_test

# 3) Frontend
cd ../frontend
npm install
cp .env.example .env
```

> Si ya tenías un contenedor `convive-db` creado con `docker run`, el compose
> chocará por el nombre: `docker rm -f convive-db` (borra sus datos) o conserva el
> tuyo y crea la BD de pruebas con `docker exec -it convive-db createdb -U convive convive_test`.

## Día a día: dos terminales

```bash
# Terminal 1 — base de datos y backend
cd ~/convive && docker compose up -d
cd backend && npm run dev              # http://localhost:3000/api/health

# Terminal 2 — frontend
cd ~/convive/frontend && npm run dev   # http://localhost:5173
```

Entra a **http://localhost:5173** (no a `127.0.0.1`: es otro origen para CORS).
Usuarios: `admin/admin123`, `coordinador/coord123`, `docente/docente123`.

Recomendado en `frontend/vite.config.js`, para que Vite NO cambie de puerto en
silencio (si 5173 está ocupado saltaría a 5174 y CORS bloquearía todo):

```js
export default defineConfig({
    plugins: [react()],
    server: { port: 5173, strictPort: true },
});
```

## Lista de integración (marca cada punto)

Automática, con el backend corriendo:

```bash
bash scripts/smoke.sh        # debe terminar en "Todo bien."
```

A mano, en el navegador:

- [ ] `curl localhost:3000/api/health` responde `"database":"up"`.
- [ ] Abrir `/estudiante/1` sin sesión te manda al login y, al entrar, vuelve ahí.
- [ ] Login con clave mala muestra "Usuario o contraseña incorrectos." (sin revelar cuál falló).
- [ ] En DevTools → Network, las peticiones llevan `Authorization: Bearer …` y no hay errores de CORS en la consola.
- [ ] Coordinador: crea caso → seguimiento → cerrar → editar (no se reabre).
- [ ] Un caso con 3+ en 90 días aparece como reincidente (el estudiante 6001 de la demo ya lo es).
- [ ] Subir un documento y descargarlo: mismo contenido; el archivo aparece en `backend/uploads/` con nombre aleatorio.
- [ ] Borrar un caso con evidencia (como admin) elimina también el archivo de `backend/uploads/`.
- [ ] Docente: no ve selector de estado, ni Documentos del estudiante, ni Reportes; no ve casos de otros docentes.
- [ ] Asistencia: guardar, recargar y ver que persiste.
- [ ] Reportes: PDF del curso y del estudiante se descargan; un rango sin datos da 0.
- [ ] Cambiar el token en Local Storage por texto basura y recargar → vuelve al login con "Tu sesión expiró".
- [ ] Apagar el backend → el login dice "No se pudo conectar con el servidor".
- [ ] `npm test` en `backend/` en verde.

## Errores típicos

| Síntoma | Causa | Solución |
|---|---|---|
| Consola: `blocked by CORS policy` | el origen no está en `CORS_ORIGINS` (ej. abriste `127.0.0.1:5173` o Vite saltó a 5174) | agrega ese origen exacto a `CORS_ORIGINS` y reinicia el backend |
| "No se pudo conectar con el servidor" | backend apagado, puerto distinto o `VITE_API_URL` mal | revisa `curl localhost:3000/api/health` y `frontend/.env`; reinicia Vite |
| Cambié `frontend/.env` y no pasa nada | Vite lee las variables al arrancar | detén y vuelve a correr `npm run dev` |
| `EADDRINUSE :3000` | otro proceso usa el puerto | `fuser -k 3000/tcp` (o cambia `PORT` y `VITE_API_URL`) |
| `P1001 Can't reach database` | PostgreSQL apagado o puerto/clave distintos | `docker compose up -d`; revisa `DATABASE_URL` |
| `Environment variable not found: DATABASE_URL` al migrar | falta `.env` en `backend/` | `cp .env.example .env` |
| Backend no arranca y lista variables inválidas | `JWT_SECRET` corto o falta alguna | léelo: dice cuál variable y por qué |
| `429 Demasiadas solicitudes` al probar login | límite de intentos (`LOGIN_RATE_LIMIT_MAX`) | espera unos minutos o súbelo solo en desarrollo |
| Subida falla con 413 | archivo mayor que `MAX_UPLOAD_MB` | sube el límite en el backend (y `VITE_MAX_UPLOAD_MB`) |
| Te saca al login enseguida tras entrar | reloj del PC desfasado o token vencido | sincroniza la hora; vuelve a entrar |
| Con `docker compose` no existe `convive_test` | el volumen ya existía antes del script | `docker exec -it convive-db createdb -U convive convive_test` |

## Cuando lo publiques (resumen)

- `JWT_SECRET` nuevo y largo; `NODE_ENV=production`; `SEED_DEMO_DATA=false` y `SEED_ADMIN_PASSWORD` de 12+ caracteres.
- Frontend: `npm run build` y servir `dist/` con HTTPS; `VITE_API_URL` apunta a la API pública (se fija al compilar).
- `CORS_ORIGINS` = solo el dominio real del frontend.
- Migraciones con `npm run db:deploy` (no `migrate dev`).
- Respaldar `backend/uploads/` junto con la base de datos: los archivos no viven en PostgreSQL.
