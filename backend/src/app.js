// app.js
// Construye la aplicación Express (sin ponerla a escuchar). Separarla de
// server.js permite que las pruebas la arranquen en un puerto aleatorio.
import fs from "node:fs";
import path from "node:path";
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

export function createApp({ frontendDist = env.frontendDist } = {}) {
    const app = express();

    app.disable("x-powered-by");
    // Detrás del proxy de Render hay un salto: sin esto todos los usuarios
    // compartirían IP (y el rate-limit los bloquearía juntos).
    if (env.isProduction) app.set("trust proxy", 1);
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    "default-src": ["'self'"],
                    "script-src": ["'self'"],
                    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
                    "img-src": ["'self'", "data:", "blob:"],
                    "connect-src": ["'self'"],
                    "frame-src": ["'self'", "blob:"],
                    "object-src": ["'none'"],
                },
            },
        })
    );

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

    // Frontend (SPA): archivos estáticos y, para cualquier otra ruta GET que no
    // sea /api, index.html (así React Router resuelve /casos/3 al recargar).
    if (frontendDist && fs.existsSync(path.join(frontendDist, "index.html"))) {
        app.use(express.static(frontendDist, { index: false, maxAge: env.isProduction ? "1h" : 0 }));
        app.use((req, res, next) => {
            if (req.method !== "GET" || req.path.startsWith("/api")) return next();
            res.sendFile(path.join(frontendDist, "index.html"));
        });
    }

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
