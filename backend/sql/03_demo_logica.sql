-- ============================================================================
-- DEMOSTRACIÓN de triggers, funciones, procedimiento y transacciones.
-- Es AUTOCONTENIDO y no deja rastro: todo ocurre dentro de una transacción que
-- termina en ROLLBACK. Úsalo para las capturas del informe:
--     psql "$DATABASE_URL" -f sql/03_demo_logica.sql
-- ============================================================================
\set ON_ERROR_STOP off
\pset pager off
BEGIN;

\echo '== Datos temporales =================================================='
INSERT INTO "User" ("username", "passwordHash", "fullName", "role")
VALUES ('demo.coord', 'hash-de-demostracion', 'Coordinadora Demo', 'COORDINADOR') RETURNING "id" AS uid \gset
INSERT INTO "Student" ("code", "fullName", "grade", "group")
VALUES ('DEMO-1', 'Estudiante Demo', 'QUINTO', 1) RETURNING "id" AS sid \gset

\echo
\echo '== 1. TRIGGER DE VALIDACIÓN: un título vacío es rechazado =============='
SAVEPOINT antes_del_error;
INSERT INTO "Case" ("studentId", "title", "category", "date", "description", "createdById", "updatedAt")
VALUES (:sid, '   ', 'OTRO', CURRENT_DATE, 'x', :uid, now());
ROLLBACK TO SAVEPOINT antes_del_error;   -- la transacción sigue viva

\echo
\echo '== 2. Crear un caso (el trigger de auditoría registra CREADO) ==========='
SELECT set_config('convive.user_id', :uid::text, true);
INSERT INTO "Case" ("studentId", "title", "category", "date", "description", "createdById", "updatedAt")
VALUES (:sid, 'Caso de demostración', 'CONVIVENCIA', CURRENT_DATE, 'Descripción', :uid, now()) RETURNING "id" AS cid \gset

\echo
\echo '== 3. PROCEDIMIENTO sp_cerrar_caso: OK, luego YA_CERRADO, luego NO_EXISTE'
CALL sp_cerrar_caso(:cid, :uid, CURRENT_DATE, NULL);
CALL sp_cerrar_caso(:cid, :uid, CURRENT_DATE, NULL);
CALL sp_cerrar_caso(-1, :uid, CURRENT_DATE, NULL);
SELECT "status", "closedAt" IS NOT NULL AS tiene_fecha_de_cierre FROM "Case" WHERE "id" = :cid;
SELECT "description" AS seguimiento_automatico FROM "CaseFollowUp" WHERE "caseId" = :cid;

\echo
\echo '== 4. Historial escrito por el TRIGGER DE AUDITORÍA ====================='
SELECT "action", "oldStatus", "newStatus", "changedBy" = :uid AS lo_hizo_el_usuario
FROM "CaseAudit" WHERE "caseId" = :cid ORDER BY "id";

\echo
\echo '== 5. La auditoría es INMUTABLE (DELETE y UPDATE fallan) ================'
SAVEPOINT s2;  DELETE FROM "CaseAudit" WHERE "caseId" = :cid;       ROLLBACK TO SAVEPOINT s2;
SAVEPOINT s3;  UPDATE "CaseAudit" SET "action" = 'X' WHERE "caseId" = :cid;  ROLLBACK TO SAVEPOINT s3;

\echo
\echo '== 6. TRIGGER sobre Attendance: estudiante inactivo ====================='
UPDATE "Student" SET "active" = false WHERE "id" = :sid;
SAVEPOINT s4;
INSERT INTO "Attendance" ("studentId", "date", "status", "registeredBy") VALUES (:sid, CURRENT_DATE, 'PRESENTE', :uid);
ROLLBACK TO SAVEPOINT s4;

\echo
\echo '== 7. FUNCIONES ========================================================='
SELECT fn_contar_casos_desde(:sid, CURRENT_DATE - 90) AS casos_ultimos_90_dias,
       fn_es_reincidente(:sid, CURRENT_DATE - 90, 3)   AS es_reincidente;

\echo
\echo '== 8. ROLLBACK: nada de lo anterior se guarda ============================'
SELECT count(*) AS casos_dentro_de_la_transaccion FROM "Case" WHERE "studentId" = :sid;
ROLLBACK;
SELECT count(*) AS casos_despues_del_rollback FROM "Student" WHERE "code" = 'DEMO-1';

\echo
\echo '== 9. COMMIT: una transacción exitosa SÍ se guarda (y la deshacemos a mano)'
BEGIN;
INSERT INTO "Student" ("code", "fullName", "grade", "group") VALUES ('DEMO-2', 'Temporal', 'NOVENO', 1);
COMMIT;
SELECT count(*) AS guardado_con_commit FROM "Student" WHERE "code" = 'DEMO-2';
DELETE FROM "Student" WHERE "code" = 'DEMO-2';   -- limpieza
