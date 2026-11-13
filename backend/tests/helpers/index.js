// tests/helpers/index.js
// Todo lo que comparten las pruebas: servidor en puerto aleatorio, cliente HTTP,
// reinicio de la BD con datos conocidos (fixtures) y tokens por rol.
import "./guard.js"; // SIEMPRE primero
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { addDays, parseDay, todayDay, toDay } from "../../src/lib/dates.js";
import { prisma } from "../../src/lib/prisma.js";

export { env, prisma };

// ── Fechas ──────────────────────────────────────────────────
export const today = () => todayDay();
export const dayAgo = (n) => toDay(addDays(parseDay(todayDay()), -n));

// ── Usuarios y tokens (ids fijos porque la BD se reinicia con RESTART IDENTITY) ──
export const PASSWORD = "Test1234!";
export const IDS = { admin: 1, coord: 2, docente: 3, docente2: 4 };

const sign = (id, role, options = {}) =>
    jwt.sign({ role }, env.JWT_SECRET, { algorithm: "HS256", subject: String(id), expiresIn: "1h", ...options });

export const signToken = sign;
export const tokens = {
    ADMIN: sign(IDS.admin, "ADMIN"),
    COORDINADOR: sign(IDS.coord, "COORDINADOR"),
    DOCENTE: sign(IDS.docente, "DOCENTE"),
    DOCENTE2: sign(IDS.docente2, "DOCENTE"),
};

// 4 rondas de bcrypt (en producción son 10): solo para que las pruebas sean rápidas.
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

// ── Servidor ────────────────────────────────────────────────
let server;
let baseUrl;

export async function startServer() {
    await fs.rm(env.uploadDir, { recursive: true, force: true });
    await fs.mkdir(env.uploadDir, { recursive: true });

    server = createApp().listen(0); // puerto 0 = el sistema asigna uno libre
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
}

export async function stopServer() {
    server.closeAllConnections(); // si no, las conexiones keep-alive de fetch impiden cerrar
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    await fs.rm(env.uploadDir, { recursive: true, force: true });
}

// ── Cliente HTTP ────────────────────────────────────────────
// request("POST", "/cases", { token, json }) -> { status, headers, body }
export async function request(method, urlPath, { token, json, form, headers = {} } = {}) {
    const h = { ...headers };

    if (token) h.authorization = `Bearer ${token}`;
    if (json !== undefined) h["content-type"] = "application/json";

    const res = await fetch(baseUrl + urlPath, {
        method,
        headers: h,
        body: json !== undefined ? JSON.stringify(json) : form,
    });

    const isJson = (res.headers.get("content-type") ?? "").includes("json");

    return {
        status: res.status,
        headers: res.headers,
        body: isJson ? await res.json() : Buffer.from(await res.arrayBuffer()),
    };
}

// FormData con un archivo en el campo "file" + campos de texto.
export function fileForm(fields = {}, { name = "archivo.txt", type = "text/plain", content = "hola" } = {}) {
    const form = new FormData();

    form.set("file", new Blob([content], { type }), name);
    Object.entries(fields).forEach(([key, value]) => form.set(key, String(value)));

    return form;
}

// ── Fixtures ────────────────────────────────────────────────
// Estado inicial conocido (los ids se repiten en cada reinicio):
//   usuarios 1 admin · 2 coord · 3 docente · 4 docente2
//   estudiantes 1 (6001 Quinto 1) · 2 (6002 Quinto 1) · 3 (6003 Noveno 1)
//   caso 1: del estudiante 1, creado por el DOCENTE (con seguimiento 1, compromiso 1)
//   caso 2: del estudiante 1, creado por el COORDINADOR (el docente NO lo ve)
//   observaciones: 1 (del docente) · 2 (del coordinador)
//   documentos: 1 evidencia del caso 1 (subida por el docente) · 2 del estudiante 1 (subido por coord)
export const FILES = { caseDoc: "fixture-case-doc", studentDoc: "fixture-student-doc" };

export async function resetAndSeed() {
    await prisma.$executeRawUnsafe(
        `TRUNCATE "CaseAudit","Document","Commitment","CaseFollowUp","Attendance","Observation","Case","Student","User" RESTART IDENTITY CASCADE`
    );
    await fs.rm(env.uploadDir, { recursive: true, force: true });
    await fs.mkdir(env.uploadDir, { recursive: true });

    await prisma.user.createMany({
        data: [
            { username: "admin", fullName: "Admin Prueba", role: "ADMIN", passwordHash },
            { username: "coord", fullName: "Coord Prueba", role: "COORDINADOR", passwordHash },
            { username: "docente", fullName: "Docente Prueba", role: "DOCENTE", passwordHash },
            { username: "docente2", fullName: "Docente Dos", role: "DOCENTE", passwordHash },
        ],
    });

    await prisma.student.createMany({
        data: [
            { code: "6001", fullName: "Ana Uno", grade: "QUINTO", group: 1 },
            { code: "6002", fullName: "Beto Dos", grade: "QUINTO", group: 1 },
            { code: "6003", fullName: "Carla Tres", grade: "NOVENO", group: 1 },
        ],
    });

    await prisma.case.createMany({
        data: [
            { studentId: 1, title: "Caso del docente", category: "CONVIVENCIA", date: parseDay(dayAgo(1)), description: "d", createdById: IDS.docente },
            { studentId: 1, title: "Caso del coordinador", category: "ACADEMICO", date: parseDay(dayAgo(2)), description: "d", createdById: IDS.coord },
        ],
    });

    await prisma.caseFollowUp.create({ data: { caseId: 1, date: parseDay(dayAgo(0)), description: "seg", responsibleId: IDS.docente } });
    await prisma.commitment.create({ data: { caseId: 1, description: "comp", responsibleId: IDS.coord } });

    await prisma.observation.createMany({
        data: [
            { studentId: 1, type: "CONVIVENCIA", description: "obs docente", date: parseDay(dayAgo(0)), responsibleId: IDS.docente },
            { studentId: 1, type: "OTRA", description: "obs coord", date: parseDay(dayAgo(0)), responsibleId: IDS.coord },
        ],
    });

    await prisma.attendance.create({ data: { studentId: 1, date: parseDay(dayAgo(0)), status: "PRESENTE", registeredBy: IDS.coord } });

    await prisma.document.createMany({
        data: [
            { caseId: 1, type: "EVIDENCIA", name: "evidencia.txt", mimeType: "text/plain", sizeBytes: 12, storageKey: FILES.caseDoc, uploadedById: IDS.docente },
            { studentId: 1, type: "OBSERVADOR", name: "observador.pdf", mimeType: "application/pdf", sizeBytes: 12, storageKey: FILES.studentDoc, uploadedById: IDS.coord },
        ],
    });

    await fs.writeFile(path.join(env.uploadDir, FILES.caseDoc), "archivo caso");
    await fs.writeFile(path.join(env.uploadDir, FILES.studentDoc), "archivo alum");
}

// Cuántos archivos hay ahora mismo en la carpeta de subidas.
export const filesOnDisk = async () => (await fs.readdir(env.uploadDir)).sort();
