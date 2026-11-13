# Convive — Backend (Fases 1 a 3)

API REST de Convive: Node 22 (ESM) · Express 5 · Prisma 7.10.0 + PostgreSQL 16 · zod · JWT.

## Puesta en marcha (Linux, comandos en orden)

```bash
cd backend
npm install
cp .env.example .env
# edita .env: pon un JWT_SECRET de 32+ caracteres (comando en el propio archivo)

# 1) PostgreSQL con Docker (o usa el tuyo y ajusta DATABASE_URL)
docker run --name convive-db -e POSTGRES_USER=convive -e POSTGRES_PASSWORD=convive \
  -e POSTGRES_DB=convive -p 5432:5432 -d postgres:16

# 2) Migración inicial (crea prisma/migrations/, la aplica y la deja versionada)
npx prisma migrate dev --name init
# En Prisma 7 migrate ya NO genera el cliente ni corre el seed solo:
npx prisma generate
npm run db:seed

# 3) Arrancar
npm run dev        # http://localhost:3000/api/health
```

Usuarios de demostración (solo con `SEED_DEMO_DATA=true`): `admin/admin123`,
`coordinador/coord123`, `docente/docente123`.

## Qué hace cada archivo

| Archivo | Qué hace y por qué existe |
|---|---|
| `prisma/schema.prisma` | Tu schema, sin cambios. Es la fuente de verdad de tablas y enums. |
| `prisma.config.ts` | Prisma 7 saca la URL de la BD del schema: vive aquí (con dotenv). También dice dónde está el seed. |
| `prisma/seed.js` | Crea el admin y, en desarrollo, usuarios, estudiantes y casos de ejemplo (uno reincidente). Se puede repetir sin duplicar. |
| `src/server.js` | Punto de entrada: crea la carpeta `uploads/`, escucha en `PORT` y cierra limpio con Ctrl+C. |
| `src/app.js` | Arma Express: helmet, CORS, límites de peticiones, rutas y manejo de errores. Separado de `server.js` para poder probarlo (Fase 3). |
| `src/config/env.js` | Valida `.env` con zod al arrancar; si falta algo, dice qué y no arranca. |
| `src/lib/prisma.js` | Única instancia de PrismaClient (con el adapter de PostgreSQL). |
| `src/lib/errors.js` | `AppError` con código HTTP y mensaje seguro. |
| `src/lib/dates.js` | Convierte `"AAAA-MM-DD"` ↔ Date UTC; "hoy" en zona Colombia (no UTC). |
| `src/lib/schemas.js` | Piezas de validación reutilizables; los enums salen de Prisma. |
| `src/lib/presenters.js` | Da a cada respuesta el formato exacto del contrato (fechas solo-día, `{id, fullName}`, sin `passwordHash`/`storageKey`). |
| `src/lib/access.js` | Reglas de visibilidad: el docente solo ve lo suyo. |
| `src/lib/recurrence.js` | Reincidencia: ≥ 3 casos en 90 días (configurable). |
| `src/lib/files.js` | Borra archivos del disco sin tumbar la petición si falla. |
| `src/middleware/auth.js` | `authenticate` (valida JWT y que el usuario siga activo) y `authorize(...roles)`. |
| `src/middleware/validate.js` | Valida params/query/body con zod y deja los datos limpios en `req.valid`. |
| `src/middleware/upload.js` | multer: un archivo en el campo `file`, nombre aleatorio en disco, límite de tamaño y lista de tipos. |
| `src/middleware/errorHandler.js` | Convierte cualquier error a JSON `{ message, details? }`; el 500 no filtra detalles. |
| `src/routes/*.js` | Una por recurso (auth, users, students, cases, followUps, commitments, observations, attendance, documents, dashboard, reports); `index.js` las une y pone la frontera pública/protegida. |

## Formato de respuestas

- Éxito: `{ "data": ... }` (borrados: `{ "data": { "id": 7 } }`; creaciones: HTTP 201).
- Error: `{ "message": "…", "details": [{ "field", "message" }] }` (`details` solo en validación).
- Fechas solo-día `"AAAA-MM-DD"`; marcas de tiempo (`createdAt`, `closedAt`) en ISO 8601.
- Todo exige `Authorization: Bearer <token>` excepto `GET /api/health` y `POST /api/auth/login`.

## Permisos por rol (y por qué)

| Acción | ADMIN | COORDINADOR | DOCENTE |
|---|:-:|:-:|:-:|
| Ver estudiantes, tomar asistencia, escribir observaciones | ✔ | ✔ | ✔ |
| Registrar casos | ✔ | ✔ | ✔ (solo ABIERTO) |
| Ver casos / seguimientos / compromisos | todos | todos | **solo los que registró** |
| Ver observaciones de un estudiante | todas | todas | **solo las suyas** |
| Agregar seguimientos | ✔ | ✔ | ✔ (en sus casos) |
| Editar/borrar seguimientos y observaciones | ✔ | ✔ | solo los que escribió |
| Editar casos, cambiar estado/cerrar | ✔ | ✔ | ✘ |
| Crear/editar compromisos | ✔ | ✔ | ✘ |
| Documentos de un estudiante | ✔ | ✔ | ✘ |
| Evidencias de un caso | ✔ | ✔ | ✔ (en sus casos) |
| Crear/editar estudiantes | ✔ | ✔ | ✘ |
| Dashboard y reportes | ✔ | ✔ | ✘ |
| **Borrar casos** | ✔ | ✘ | ✘ |
| Gestionar usuarios | ✔ | ✘ | ✘ |

Justificación: los casos de convivencia involucran datos de menores (Ley 1620 y
protección de datos personales), así que se aplica mínimo privilegio. El
docente **reporta** y da seguimiento a lo suyo; la **decisión** (cambiar
estado, cerrar, comprometer, borrar) es de coordinación, y borrar es solo del
administrador por ser irreversible. Para un docente un recurso ajeno responde
404 (no 403) para no revelar que existe.

## Endpoints

```
POST /api/auth/login            GET  /api/auth/me
GET  /api/users                 POST /api/users                 PATCH /api/users/:id
GET  /api/students[?grade&group&active&search]   GET /api/students/:id (+recurrence)
POST /api/students              PATCH /api/students/:id
GET  /api/cases[?studentId&status&severity&category&from&to&limit]
GET  /api/cases/:id             POST /api/cases   PATCH /api/cases/:id   DELETE /api/cases/:id
GET|POST /api/cases/:id/follow-ups        PATCH|DELETE /api/follow-ups/:id
GET|POST /api/cases/:id/commitments       PATCH|DELETE /api/commitments/:id
GET|POST /api/students/:id/observations   DELETE /api/observations/:id
GET  /api/attendance?(studentId | grade&group)[&date | &from&to]
PUT  /api/attendance            { date, records: [{ studentId, status }] }
GET  /api/documents?(studentId | caseId)  POST /api/documents (multipart)
GET  /api/documents/:id/download          DELETE /api/documents/:id
GET  /api/dashboard             GET /api/reports/course?grade&group[&from&to]
GET  /api/reports/student/:id[?from&to]   GET /api/health
```

## Lógica en PostgreSQL (funciones, triggers, procedimiento, transacciones)

Vive en `prisma/migrations/20261113060000_logica_sql/migration.sql` (copia legible en `sql/02_logica_postgresql.sql`). Se aplica con `npx prisma migrate dev` (o `migrate deploy`).

| Objeto | Qué hace |
|---|---|
| Tabla `CaseAudit` | Historial de cambios de los casos. Sin llave foránea: sobrevive si se borra el caso. |
| Trigger `trg_case_validar` (BEFORE INSERT/UPDATE en `Case`) | Título no vacío y `closedAt` coherente con el estado. |
| Trigger `trg_case_auditar` (AFTER INSERT/UPDATE/DELETE en `Case`) | Escribe en `CaseAudit` qué pasó y quién lo hizo. |
| Trigger `trg_audit_inmutable` | `CaseAudit` es de solo lectura: UPDATE y DELETE fallan. |
| Trigger `trg_asistencia_validar` (en `Attendance`) | No permite asistencia de estudiantes inactivos. |
| Función `fn_contar_casos_desde` / `fn_es_reincidente` | Conteo de casos y reincidencia; la API la usa en `GET /students/:id`. |
| Procedimiento `sp_cerrar_caso` | Cierra un caso en una transacción: bloquea la fila (`FOR UPDATE`), cambia el estado, registra un seguimiento y audita. Lo llama `POST /api/cases/:id/close`. |

**Transacciones:** `sp_cerrar_caso`, el guardado de asistencia (`$transaction`) y `withAuditUser` se ejecutan como una sola unidad: o se guarda todo (COMMIT) o nada (ROLLBACK). `sql/03_demo_logica.sql` lo demuestra con `BEGIN`, `SAVEPOINT`, `COMMIT` y `ROLLBACK` sin dejar datos.

**Concurrencia:** (1) PostgreSQL usa MVCC: lectores y escritores no se bloquean entre sí. (2) `sp_cerrar_caso` toma un bloqueo de fila: si dos personas cierran el mismo caso a la vez, la segunda espera y recibe 409 (`YA_CERRADO`). (3) Bloqueo optimista: `PATCH /api/cases/:id` acepta `expectedUpdatedAt`; si el caso cambió desde que se leyó, responde 409 en lugar de pisar los cambios. (4) La restricción única (estudiante + fecha) de `Attendance` evita duplicados aunque dos docentes guarden a la vez.

Nuevos endpoints: `POST /api/cases/:id/close` y `GET /api/cases/:id/history` (ADMIN y COORDINADOR).

## Pruebas automáticas

Usan `node:test` (incluido en Node 22, sin librerías extra) contra una BD **aparte** (`convive_test`). Nunca tocan tu BD de desarrollo: `tests/helpers/guard.js` aborta si `NODE_ENV` no es `test` o si el nombre de la BD no contiene "test".

Comandos en orden (una sola vez):

```bash
# 1. Crear la BD de pruebas (ajusta según cómo corras PostgreSQL)
docker exec -it convive-db createdb -U convive convive_test
#    o, con PostgreSQL local:  createdb -U convive convive_test

# 2. Aplicar las migraciones a esa BD
npm run db:test:migrate
```

Y cada vez que quieras correrlas:

```bash
npm test
```

Qué cubren (286 pruebas): `permissions.test.js` recorre **cada ruta × cada rol** (permitido y prohibido) y falla si registras una ruta nueva sin ponerla en la matriz; `auth`, `cases`, `records` (seguimientos, compromisos, observaciones, asistencia), `documents`, `students-users`, `reports` (reincidencia, dashboard, reportes) y `rate-limit` y `database` (triggers, función, procedimiento, transacciones y concurrencia).

Cada prueba reinicia la BD con datos fijos (TRUNCATE + fixtures), por eso corren en serie (`--test-concurrency=1`). Los archivos subidos en pruebas van a `uploads-test/`.

## Qué probar a mano (Postman o curl)

1. `POST /api/auth/login` con `coordinador/coord123` → copia el `token`.
2. `GET /api/students/1` con `Authorization: Bearer <token>` → `recurrence.isRecurrent` debe ser `true` (Juan tiene 3 casos).
3. Entra como `docente` y crea un caso; luego intenta `PATCH` sobre él → 403; y pide un caso de otro → 404.
4. Como coordinador: `PATCH` con `{"status":"CERRADO"}` (aparece `closedAt`), luego `PATCH` con solo `{"title":"…"}` → el estado NO cambia.
5. Sube un PDF a `POST /api/documents` (form-data: `file`, `type`, `caseId`) y descárgalo; borra el caso como admin y comprueba que `uploads/` quedó vacío.
6. Equivócate a propósito (fecha `2026-02-31`, enum inválido, sin token) y mira los mensajes.

## Errores típicos

- **`Variables de entorno inválidas`** al arrancar: falta `JWT_SECRET` (mínimo 32 caracteres) o `DATABASE_URL`.
- **`ECONNREFUSED 5432`**: PostgreSQL no está corriendo (`docker start convive-db`).
- **`@prisma/client did not initialize` / `PrismaClient` sin modelos**: falta `npx prisma generate` (en Prisma 7 no se ejecuta solo).
- **Tablas inexistentes (`relation "User" does not exist`)**: falta `npx prisma migrate dev --name init`.
- **`Origen no permitido por CORS`** desde el frontend: agrega su URL a `CORS_ORIGINS` (el dev server de Vite usa `http://localhost:5173`).
- **401 con un token que antes funcionaba**: expiró (`JWT_EXPIRES_IN`) o el usuario fue desactivado.
- **429 en el login**: más de 10 intentos fallidos en 15 minutos desde la misma IP.
- **Subida rechazada**: tipo no permitido (solo PDF, imágenes, Word, Excel, texto) o supera `MAX_UPLOAD_MB`.

## Decisiones que conviene que revises

- **Mensaje de error**: el contrato solo decía "JSON con mensaje claro"; elegí `{ message, details? }`.
- **Reincidencia**: cuenta casos de cualquier estado con `date` en los últimos 90 días (un caso cerrado también cuenta).
- **Tipos de archivo**: el `mimetype` lo declara el cliente; la lista filtra errores comunes pero no reemplaza un antivirus.
- **Contraseñas**: mínimo 8 caracteres (máximo 72, límite de bcrypt). Las de demostración son débiles a propósito: solo desarrollo.
