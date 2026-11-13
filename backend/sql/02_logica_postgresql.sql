-- ─── 1. Tabla de auditoría
 
CREATE TABLE "CaseAudit" (
    "id" SERIAL NOT NULL,
    "caseId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "oldStatus" "CaseStatus",
    "newStatus" "CaseStatus",
    "changedBy" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseAudit_caseId_idx" ON "CaseAudit"("caseId");

-- ─── 2. FUNCIONES ────────────────────────────────────────────────────────────
-- Cuenta los casos de un estudiante desde una fecha
CREATE OR REPLACE FUNCTION fn_contar_casos_desde(p_student_id integer, p_desde date)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
    SELECT count(*)::integer
    FROM "Case"
    WHERE "studentId" = p_student_id
      AND "date" >= p_desde;
$$;

-- ¿Es reincidente? - p_minimo o más casos desde p_desde
CREATE OR REPLACE FUNCTION fn_es_reincidente(p_student_id integer, p_desde date, p_minimo integer)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT fn_contar_casos_desde(p_student_id, p_desde) >= p_minimo;
$$;

-- ─── 3. TRIGGER DE VALIDACIÓN sobre "Case" ───────────────────────────────────
-- Antes de guardar un caso: el título no puede quedar vacío y closedAt debe ser
-- coherente con el estado
CREATE OR REPLACE FUNCTION fn_case_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF length(btrim(NEW."title")) = 0 THEN
        RAISE EXCEPTION 'El título del caso no puede estar vacío'
            USING ERRCODE = '23514';
    END IF;

    IF NEW."status" = 'CERRADO' THEN
        IF NEW."closedAt" IS NULL THEN
            NEW."closedAt" := now() AT TIME ZONE 'UTC';
        END IF;
    ELSE
        NEW."closedAt" := NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_validar
    BEFORE INSERT OR UPDATE ON "Case"
    FOR EACH ROW EXECUTE FUNCTION fn_case_validar();

-- ─── 4. TRIGGER DE AUDITORÍA sobre "Case" ────────────────────────────────────
-- Después de crear, cambiar de estado, editar o borrar un caso, guarda una fila
-- en "CaseAudit". Quién lo hizo llega por la variable de sesión convive.user_id
-- la API la fija dentro de la misma transacción, si no llega, queda NULL.
CREATE OR REPLACE FUNCTION fn_case_auditar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_user integer := NULLIF(current_setting('convive.user_id', true), '')::integer;
    v_now  timestamp(3) := now() AT TIME ZONE 'UTC';
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO "CaseAudit" ("caseId", "action", "newStatus", "changedBy", "changedAt")
        VALUES (NEW."id", 'CREADO', NEW."status", v_user, v_now);

    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."status" IS DISTINCT FROM OLD."status" THEN
            INSERT INTO "CaseAudit" ("caseId", "action", "oldStatus", "newStatus", "changedBy", "changedAt")
            VALUES (NEW."id", 'ESTADO', OLD."status", NEW."status", v_user, v_now);
        ELSIF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
            INSERT INTO "CaseAudit" ("caseId", "action", "oldStatus", "newStatus", "changedBy", "changedAt")
            VALUES (NEW."id", 'EDITADO', OLD."status", NEW."status", v_user, v_now);
        END IF;

    ELSE -- DELETE
        INSERT INTO "CaseAudit" ("caseId", "action", "oldStatus", "changedBy", "changedAt")
        VALUES (OLD."id", 'ELIMINADO', OLD."status", v_user, v_now);
    END IF;

    RETURN NULL; -- en un trigger AFTER el valor de retorno se ignora
END;
$$;

CREATE TRIGGER trg_case_auditar
    AFTER INSERT OR UPDATE OR DELETE ON "Case"
    FOR EACH ROW EXECUTE FUNCTION fn_case_auditar();

-- ─── 5. La auditoría es inmutable ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La tabla de auditoría es de solo lectura (% no permitido)', TG_OP
        USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_audit_inmutable
    BEFORE UPDATE OR DELETE ON "CaseAudit"
    FOR EACH ROW EXECUTE FUNCTION fn_audit_inmutable();

-- ─── 6. TRIGGER DE VALIDACIÓN sobre "Attendance" ─────────────────────────────
-- Defensa en la base de datos: no se registra asistencia de estudiantes inactivos,
-- aunque alguien salte la API.
CREATE OR REPLACE FUNCTION fn_asistencia_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "Student" WHERE "id" = NEW."studentId" AND "active") THEN
        RAISE EXCEPTION 'No se puede registrar asistencia de un estudiante inactivo (id %)', NEW."studentId"
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_asistencia_validar
    BEFORE INSERT OR UPDATE ON "Attendance"
    FOR EACH ROW EXECUTE FUNCTION fn_asistencia_validar();

-- ─── 7. PROCEDIMIENTO ALMACENADO: cerrar un caso de forma atómica ────────────
-- Todo ocurre en UNA transacción: si algo falla, PostgreSQL hace ROLLBACK de todo.
--   1) bloquea la fila del caso (SELECT ... FOR UPDATE): control de concurrencia;
--      si dos personas cierran el mismo caso a la vez, la segunda espera y luego
--      ve que ya está cerrado.
--   2) cambia el estado a CERRADO los triggers validan y auditan,
--   3) registra un seguimiento automático.
-- p_resultado (salida): 'OK' | 'YA_CERRADO' | 'NO_EXISTE'
CREATE OR REPLACE PROCEDURE sp_cerrar_caso(
    p_case_id integer,
    p_user_id integer,
    p_fecha date,
    INOUT p_resultado text
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status "CaseStatus";
    v_now    timestamp(3) := now() AT TIME ZONE 'UTC';
BEGIN
    -- quién actúa (lo lee el trigger de auditoría); true = solo dura esta transacción
    PERFORM set_config('convive.user_id', p_user_id::text, true);

    SELECT "status" INTO v_status
    FROM "Case"
    WHERE "id" = p_case_id
    FOR UPDATE;

    IF NOT FOUND THEN
        p_resultado := 'NO_EXISTE';
        RETURN;
    END IF;

    IF v_status = 'CERRADO' THEN
        p_resultado := 'YA_CERRADO';
        RETURN;
    END IF;

    UPDATE "Case"
    SET "status" = 'CERRADO', "closedAt" = v_now, "updatedAt" = v_now
    WHERE "id" = p_case_id;

    INSERT INTO "CaseFollowUp" ("caseId", "date", "description", "responsibleId", "createdAt")
    VALUES (p_case_id, p_fecha, 'Caso cerrado.', p_user_id, v_now);

    p_resultado := 'OK';
END;
$$;
