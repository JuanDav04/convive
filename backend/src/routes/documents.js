// routes/documents.js — archivos de un estudiante o de un caso
//   GET    /api/documents?studentId=  | ?caseId=   listar
//   POST   /api/documents        (multipart: file + type + studentId|caseId [+ name, description])
//   GET    /api/documents/:id/download
//   DELETE /api/documents/:id
//
// Permisos:
//  - Documentos de un ESTUDIANTE (observador, autorizaciones...): ADMIN y COORDINADOR.
//  - Evidencias de un CASO: quien pueda ver el caso (el docente, solo en los suyos).
//  - Borrar: ADMIN/COORD, o quien lo subió.
// En la BD solo van los metadatos; el archivo vive en UPLOAD_DIR (storageKey).
import { Router } from "express";
import { z } from "zod";
import { findCaseOr404, findStudentOr404, isStaff } from "../lib/access.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { filePath, removeFiles } from "../lib/files.js";
import { prisma } from "../lib/prisma.js";
import { WHO, presentDocument } from "../lib/presenters.js";
import { enums, id, idParams, nullableText } from "../lib/schemas.js";
import { uploadSingle } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Exactamente uno de los dos: studentId o caseId.
const oneOwner = (o) => Boolean(o.studentId) !== Boolean(o.caseId);
const ownerMessage = { message: "Indica studentId o caseId (uno solo)", path: ["studentId"] };

const listQuery = z.object({ studentId: id.optional(), caseId: id.optional() }).refine(oneOwner, ownerMessage);

const createBody = z
    .object({
        type: enums.documentType,
        studentId: id.optional(),
        caseId: id.optional(),
        name: z.string().trim().min(1).max(200).optional(),
        description: nullableText(2000),
    })
    .refine(oneOwner, ownerMessage);

// Comprueba que el usuario puede acceder a los documentos del dueño indicado.
async function assertOwnerAccess({ studentId, caseId }, user) {
    if (caseId) {
        await findCaseOr404(caseId, user);
    } else {
        if (!isStaff(user)) throw forbidden("Solo coordinación puede ver los documentos de un estudiante.");

        await findStudentOr404(studentId);
    }
}

async function findDocumentOr404(documentId, user) {
    const found = await prisma.document.findUnique({ where: { id: documentId }, include: { uploadedBy: WHO } });

    if (!found) throw notFound("Documento");

    await assertOwnerAccess(found, user);

    return found;
}

router.get("/documents", validate({ query: listQuery }), async (req, res) => {
    const { studentId, caseId } = req.valid.query;

    await assertOwnerAccess({ studentId, caseId }, req.user);

    const documents = await prisma.document.findMany({
        // Los de estudiante no incluyen las evidencias de sus casos.
        where: caseId ? { caseId } : { studentId, caseId: null },
        include: { uploadedBy: WHO },
        orderBy: { id: "desc" },
    });

    res.json({ data: documents.map(presentDocument) });
});

// multer primero (lee el multipart), después validamos los campos de texto.
router.post("/documents", uploadSingle, async (req, res) => {
    const file = req.file;

    try {
        if (!file) throw badRequest("Adjunta un archivo en el campo 'file'.");

        const body = createBody.parse(req.body);

        await assertOwnerAccess(body, req.user);

        const created = await prisma.document.create({
            data: {
                studentId: body.studentId ?? null,
                caseId: body.caseId ?? null,
                type: body.type,
                // El nombre que llega en multipart puede venir en latin1; solo es informativo.
                name: body.name ?? Buffer.from(file.originalname, "latin1").toString("utf8"),
                description: body.description ?? null,
                mimeType: file.mimetype,
                sizeBytes: file.size,
                storageKey: file.filename,
                uploadedById: req.user.id,
            },
            include: { uploadedBy: WHO },
        });

        res.status(201).json({ data: presentDocument(created) });
    } catch (error) {
        // Si algo falló, no dejar el archivo huérfano en disco.
        if (file) await removeFiles([file.filename]);

        throw error;
    }
});

router.get("/documents/:id/download", validate({ params: idParams }), async (req, res) => {
    const found = await findDocumentOr404(req.valid.params.id, req.user);

    if (!found.storageKey) throw notFound("Archivo");

    res.download(filePath(found.storageKey), found.name, (error) => {
        if (error && !res.headersSent) res.status(404).json({ message: "El archivo ya no está disponible." });
    });
});

router.delete("/documents/:id", validate({ params: idParams }), async (req, res) => {
    const found = await findDocumentOr404(req.valid.params.id, req.user);

    if (!isStaff(req.user) && found.uploadedBy.id !== req.user.id) throw forbidden();

    await prisma.document.delete({ where: { id: found.id } });
    await removeFiles([found.storageKey]);

    res.json({ data: { id: found.id } });
});

export default router;
