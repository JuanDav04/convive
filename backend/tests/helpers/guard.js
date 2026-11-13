// tests/helpers/guard.js
// SEGURIDAD: las pruebas borran TODAS las tablas. Este archivo se importa
// primero y aborta si la base de datos no es claramente de pruebas, para que
// nunca puedas vaciar tu base de desarrollo por error.
const url = process.env.DATABASE_URL ?? "";
let dbName = "";

try {
    dbName = new URL(url).pathname.replace(/^\//, "");
} catch {
    // URL inválida: se trata abajo
}

if (process.env.NODE_ENV !== "test" || !/test/i.test(dbName)) {
    throw new Error(
        `Las pruebas solo corren con NODE_ENV=test y una BD con "test" en el nombre (actual: "${dbName || "ninguna"}"). ` +
            "Usa `npm test`, que carga .env.test."
    );
}
