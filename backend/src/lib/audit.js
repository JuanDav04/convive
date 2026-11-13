// lib/audit.js
// Los triggers de PostgreSQL guardan en "CaseAudit" QUIÉN hizo cada cambio, pero
// la base de datos no sabe qué usuario de la aplicación está actuando. Este
// ayudante abre una transacción y fija la variable de sesión `convive.user_id`
// (set_config con `true` = vale solo dentro de esta transacción); el trigger la lee.
import { prisma } from "./prisma.js";

export function withAuditUser(userId, work) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('convive.user_id', ${String(userId)}, true)`;

        return work(tx);
    });
}
