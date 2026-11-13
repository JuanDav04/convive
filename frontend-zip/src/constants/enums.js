// constants/enums.js
// Contrato compartido con el backend: estos valores deben ser IDÉNTICOS a los
// enums de schema.prisma. Si cambias uno aquí, cámbialo también en Prisma.

const makeEnum = (...keys) =>
    Object.freeze(Object.fromEntries(keys.map((key) => [key, key])));

export const Role = makeEnum("ADMIN", "COORDINADOR", "DOCENTE");
export const Grade = makeEnum("QUINTO", "NOVENO");
export const CaseCategory = makeEnum("CONVIVENCIA", "ACADEMICO", "OTRO");
export const Severity = makeEnum("TIPO_I", "TIPO_II", "TIPO_III");
export const CaseStatus = makeEnum("ABIERTO", "SEGUIMIENTO", "CERRADO");
export const ObservationType = makeEnum(
    "CONVIVENCIA",
    "ACADEMICA",
    "COMPORTAMIENTO",
    "OTRA"
);
export const AttendanceStatus = makeEnum(
    "PRESENTE",
    "AUSENTE",
    "TARDE",
    "JUSTIFICADA"
);
export const DocumentType = makeEnum(
    "OBSERVADOR",
    "COMPROMISO",
    "INFORME",
    "AUTORIZACION",
    "EVIDENCIA",
    "OTRO"
);
export const CommitmentStatus = makeEnum("PENDIENTE", "CUMPLIDO", "INCUMPLIDO");

// Grupos válidos por grado (la API también los valida: 1..4).
export const GROUPS = Object.freeze([1, 2, 3, 4]);

// Textos que ve el usuario. El orden de cada objeto es el orden de los <select>.
export const LABELS = Object.freeze({
    Grade: { QUINTO: "Quinto", NOVENO: "Noveno" },
    CaseCategory: {
        CONVIVENCIA: "Situación de convivencia",
        ACADEMICO: "Situación académica",
        OTRO: "Otro",
    },
    Severity: { TIPO_I: "Tipo I", TIPO_II: "Tipo II", TIPO_III: "Tipo III" },
    CaseStatus: {
        ABIERTO: "Abierto",
        SEGUIMIENTO: "En seguimiento",
        CERRADO: "Cerrado",
    },
    ObservationType: {
        CONVIVENCIA: "Convivencia",
        ACADEMICA: "Académica",
        COMPORTAMIENTO: "Comportamiento",
        OTRA: "Otra",
    },
    AttendanceStatus: {
        PRESENTE: "Presente",
        AUSENTE: "Ausente",
        TARDE: "Llegó tarde",
        JUSTIFICADA: "Ausencia justificada",
    },
    DocumentType: {
        OBSERVADOR: "Observador",
        COMPROMISO: "Compromiso",
        INFORME: "Informe",
        AUTORIZACION: "Autorización",
        EVIDENCIA: "Evidencia",
        OTRO: "Otro",
    },
    Role: {
        ADMIN: "Administrador",
        COORDINADOR: "Coordinador",
        DOCENTE: "Docente",
    },
});

// Ayuda breve de cada tipo del Decreto 1965 de 2013 (art. 40). Revísala con tu
// asesor antes de la sustentación para que coincida con el texto de tu tesis.
export const SEVERITY_HINTS = Object.freeze({
    TIPO_I: "conflictos y situaciones esporádicas",
    TIPO_II: "agresión, acoso o ciberacoso sin ser delito",
    TIPO_III: "presunto delito",
});

export const labelOf = (name, value) => LABELS[name]?.[value] ?? value ?? "";

// Devuelve [{ value, label }] listo para pintar <option>.
export const optionsOf = (name, exclude = []) =>
    Object.entries(LABELS[name])
        .filter(([value]) => !exclude.includes(value))
        .map(([value, label]) => ({ value, label }));
