// middleware/validate.js
// validate({ params, query, body }) valida con zod y deja los datos limpios y
// ya convertidos (números, trim...) en req.valid.{params,query,body}.
// En Express 5 req.query es de solo lectura, por eso no se reemplaza: se lee
// siempre desde req.valid.
export const validate = (schemas) => (req, _res, next) => {
    req.valid = {};

    for (const part of ["params", "query", "body"]) {
        if (schemas[part]) req.valid[part] = schemas[part].parse(req[part] ?? {});
    }

    next();
};
