// lib/files.js
// Borrado de archivos en disco. Es "best effort": si un archivo ya no existe no
// es un error (la BD es la fuente de verdad); cualquier otro fallo solo se
// registra para no tumbar la petición ya completada.
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

// storageKey siempre es un UUID generado por nosotros; basename es un seguro extra.
export const filePath = (storageKey) => path.join(env.uploadDir, path.basename(storageKey));

export async function removeFiles(storageKeys) {
    await Promise.all(
        storageKeys.filter(Boolean).map(async (key) => {
            try {
                await fs.unlink(filePath(key));
            } catch (error) {
                if (error.code !== "ENOENT") console.error("[files] no se pudo borrar", key, error);
            }
        })
    );
}
