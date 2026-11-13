// server.js — punto de entrada: crea la carpeta de subidas, escucha en PORT y
// se apaga limpiamente (cierra conexiones) al recibir SIGINT/SIGTERM.
import fs from "node:fs/promises";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

await fs.mkdir(env.uploadDir, { recursive: true });

const server = createApp().listen(env.PORT, () => {
    console.log(`Convive API escuchando en http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
});

async function shutdown(signal) {
    console.log(`\n${signal} recibido: cerrando...`);
    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
