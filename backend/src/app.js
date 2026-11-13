// app.js
// Construye la aplicación Express (sin ponerla a escuchar). Separarla de
// server.js permite que las pruebas la arranquen en un puerto aleatorio.
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";

const tooMany = { message: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." };

// Límite general por IP, y uno MÁS estricto para el login (frena fuerza bruta).
const apiLimiter = rateLimit({ windowMs: 15 * 60_000, limit: env.API_RATE_LIMIT_MAX, message: tooMany });
const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: env.LOGIN_RATE_LIMIT_MAX,
    message: tooMany,
    skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
});

export function createApp() {
    const app = express();

    app.disable("x-powered-by");
    app.use(helmet());

    // CORS: solo los orígenes de CORS_ORIGINS. Se usa Bearer (no cookies), así
    // que no se habilitan credenciales.
    app.use(
        cors({
            origin: (origin, callback) =>
                // Sin Origin = curl/Postman/servidor a servidor: se permite.
                // Origen no listado: simplemente no se envían cabeceras CORS y el
                // navegador bloquea la lectura (no es un error del servidor).
                callback(null, !origin || env.corsOrigins.includes(origin)),
            exposedHeaders: ["Content-Disposition"],
        })
    );

    app.use(express.json({ limit: "100kb" }));

    app.use("/api", apiLimiter);
    app.use("/api/auth/login", loginLimiter);
    app.use("/api", routes);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
