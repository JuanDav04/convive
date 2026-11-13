// prisma/seed.js — datos iniciales (se puede correr varias veces sin duplicar).
//   npm run db:seed
// - Siempre: el usuario admin.
// - Si SEED_DEMO_DATA=true y NO es producción: coordinador, docente, estudiantes
//   y algunos casos de ejemplo (uno reincidente para ver la alerta).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const isProduction = process.env.NODE_ENV === "production";
const withDemo = process.env.SEED_DEMO_DATA === "true" && !isProduction;

const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? (isProduction ? "" : "admin123");

if (isProduction && adminPassword.length < 12) {
    console.error("En producción define SEED_ADMIN_PASSWORD con al menos 12 caracteres.");
    process.exit(1);
}

// Crea el usuario solo si no existe (no pisa contraseñas ya cambiadas).
async function ensureUser({ username, password, fullName, role }) {
    return prisma.user.upsert({
        where: { username },
        update: {},
        create: { username, fullName, role, passwordHash: await bcrypt.hash(password, 10) },
    });
}

const dayOffset = (days) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - days);
    return d;
};

try {
    const admin = await ensureUser({ username: "admin", password: adminPassword, fullName: "Administrador", role: "ADMIN" });
    console.log("✔ usuario admin listo");

    if (withDemo) {
        const coordinator = await ensureUser({ username: "coordinador", password: "coord123", fullName: "Coordinador", role: "COORDINADOR" });
        await ensureUser({ username: "docente", password: "docente123", fullName: "Docente", role: "DOCENTE" });

        const students = [
            { code: "6001", fullName: "Juan David Ramirez Lopez", grade: "QUINTO", group: 1 },
            { code: "6002", fullName: "Maria Fernanda Gomez", grade: "QUINTO", group: 2 },
            { code: "6003", fullName: "Sofia Martinez", grade: "NOVENO", group: 1 },
            { code: "6004", fullName: "Samuel Rodriguez", grade: "NOVENO", group: 2 },
            { code: "6005", fullName: "Valentina Torres", grade: "QUINTO", group: 1 },
            { code: "6006", fullName: "Andres Castro", grade: "NOVENO", group: 1 },
        ];

        for (const s of students) {
            await prisma.student.upsert({ where: { code: s.code }, update: {}, create: s });
        }

        // Casos de ejemplo solo si todavía no hay ninguno.
        if ((await prisma.case.count()) === 0) {
            const juan = await prisma.student.findUniqueOrThrow({ where: { code: "6001" } });
            const sofia = await prisma.student.findUniqueOrThrow({ where: { code: "6003" } });

            // Juan: 3 casos en los últimos 90 días => aparece como reincidente.
            await prisma.case.createMany({
                data: [
                    { studentId: juan.id, title: "Agresión verbal durante clase", category: "CONVIVENCIA", severity: "TIPO_I", date: dayOffset(5), description: "Insultos a un compañero durante la clase de matemáticas.", actions: "Diálogo con el estudiante.", status: "SEGUIMIENTO", createdById: coordinator.id },
                    { studentId: juan.id, title: "Empujones en el descanso", category: "CONVIVENCIA", severity: "TIPO_II", date: dayOffset(30), description: "Empujó a un compañero en el patio.", status: "ABIERTO", createdById: coordinator.id },
                    { studentId: juan.id, title: "Incumplimiento de tareas", category: "ACADEMICO", severity: "TIPO_I", date: dayOffset(60), description: "No entregó tareas en dos semanas.", status: "CERRADO", closedAt: new Date(), createdById: admin.id },
                    { studentId: sofia.id, title: "Llegadas tarde reiteradas", category: "OTRO", severity: "TIPO_I", date: dayOffset(12), description: "Tres retardos en una semana.", status: "ABIERTO", createdById: coordinator.id },
                ],
            });
        }

        console.log("✔ datos de demostración listos (usuarios: admin/admin123, coordinador/coord123, docente/docente123)");
    }
} finally {
    await prisma.$disconnect();
}
