// utils/pdfReport.js
// Generación de los PDF (curso e individual). Antes estaban en Reports.jsx como
// dos funciones de ~200 líneas casi idénticas; ahora comparten el "escritor"
// y la sección de cada estudiante.
// jsPDF se importa dinámicamente: solo se descarga al generar un reporte.
import { labelOf } from "../constants/enums";
import { courseLabel } from "./courses";

const MARGIN = 18;
const COLOR = {
    brand: [76, 85, 216],
    title: [31, 42, 90],
    body: [52, 64, 84],
    muted: [120, 128, 145],
    line: [225, 227, 238],
};

const safe = (value, fallback = "Sin información registrada") =>
    value === undefined || value === null || value === "" ? fallback : String(value);

// Crea el documento y las funciones para escribir texto con salto de página.
async function createWriter() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = 20;

    function ensureSpace(height) {
        if (y + height > pageHeight - MARGIN) {
            pdf.addPage();
            y = MARGIN;
        }
    }

    function text(content, { size = 10, bold = false, color = COLOR.body, indent = 0, after = 3 } = {}) {
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(size);
        pdf.setTextColor(...color);

        const lines = pdf.splitTextToSize(safe(content), pageWidth - MARGIN * 2 - indent);
        const height = lines.length * (size >= 14 ? 6.5 : 5) + after;

        ensureSpace(height);
        pdf.text(lines, MARGIN + indent, y);
        y += height;
    }

    function separator() {
        ensureSpace(8);
        pdf.setDrawColor(...COLOR.line);
        pdf.line(MARGIN, y, pageWidth - MARGIN, y);
        y += 7;
    }

    // Numera las páginas y descarga el archivo.
    function save(footerLabel, fileName) {
        const total = pdf.getNumberOfPages();

        for (let page = 1; page <= total; page += 1) {
            pdf.setPage(page);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(...COLOR.muted);
            pdf.text(`Convive | ${footerLabel} | Página ${page} de ${total}`, MARGIN, pageHeight - 9);
        }

        pdf.save(fileName);
    }

    return { text, separator, save };
}

const heading = (w, content) => w.text(content, { bold: true, color: COLOR.brand });

function rangeText({ from, to }) {
    if (!from && !to) return "Período: todo el historial";

    return `Período: ${from ? `desde ${from}` : "desde el inicio"} ${to ? `hasta ${to}` : "hasta hoy"}`;
}

const fileDate = () => new Date().toISOString().slice(0, 10);
const fileSafe = (value) => value.replace(/[^a-z0-9]/gi, "_");

// Asistencia, observaciones y casos (con sus seguimientos) de un estudiante.
function writeStudentSections(w, data) {
    heading(w, "Historial de asistencia");

    if (data.attendance.length === 0) {
        w.text("No hay asistencias registradas.", { indent: 3 });
    }

    data.attendance.forEach((row) =>
        w.text(`${row.date}: ${labelOf("AttendanceStatus", row.status)}`, { indent: 3 })
    );

    heading(w, "Observaciones");

    if (data.observations.length === 0) {
        w.text("No hay observaciones registradas.", { indent: 3 });
    }

    data.observations.forEach((row) => {
        w.text(`${row.date} | ${labelOf("ObservationType", row.type)}`, { bold: true, indent: 3 });
        w.text(row.description, { indent: 6 });
        w.text(`Responsable: ${row.responsible?.fullName}`, { indent: 6 });
    });

    heading(w, "Casos de convivencia y seguimiento");

    if (data.cases.length === 0) {
        w.text("No hay casos registrados.", { indent: 3 });
    }

    data.cases.forEach((caso) => {
        w.text(
            `Caso #${caso.id} | ${caso.title} | ${labelOf("CaseCategory", caso.category)} | ${labelOf("Severity", caso.severity)} | ${labelOf("CaseStatus", caso.status)}`,
            { bold: true, indent: 3 }
        );
        w.text(`Fecha: ${caso.date}`, { indent: 6 });
        w.text(`Descripción: ${caso.description}`, { indent: 6 });
        w.text(`Acciones realizadas: ${caso.actions}`, { indent: 6 });

        const caseFollowUps = data.followUps.filter((f) => f.caseId === caso.id);

        if (caseFollowUps.length === 0) {
            w.text("No hay seguimientos adicionales registrados.", { indent: 6 });
        }

        caseFollowUps.forEach((f) => {
            w.text(`Seguimiento | Fecha: ${f.date}`, { bold: true, indent: 6 });
            w.text(f.description, { indent: 9 });
        });
    });
}

export async function downloadCourseReport({ courseName, students, byStudent, totals, range }) {
    const w = await createWriter();

    w.text("CONVIVE", { size: 20, bold: true, color: COLOR.brand, after: 2 });
    w.text(`Reporte general del curso ${courseName}`, { size: 16, bold: true, color: COLOR.title });
    w.text(`Generado el: ${new Date().toLocaleString("es-CO")}`);
    w.text(rangeText(range));
    w.separator();

    heading(w, "Resumen del curso");
    w.text(`Estudiantes: ${totals.students}`);
    w.text(`Registros de asistencia: ${totals.attendance}`);
    w.text(`Casos registrados: ${totals.cases}`);
    w.text(`Observaciones registradas: ${totals.observations}`);
    w.text(`Seguimientos asociados: ${totals.followUps}`);
    w.separator();

    if (students.length === 0) w.text("No hay estudiantes registrados en este curso.");

    students.forEach((student) => {
        w.text(`${student.fullName} | ID: ${student.code}`, { size: 13, bold: true, color: COLOR.title, after: 4 });
        w.text(`Curso: ${courseLabel(student)}`, { bold: true });
        writeStudentSections(w, byStudent.get(student.id));
        w.separator();
    });

    w.save(courseName, `Reporte_${fileSafe(courseName)}_${fileDate()}.pdf`);
}

export async function downloadStudentReport({ student, data, range }) {
    const w = await createWriter();

    w.text("CONVIVE", { size: 20, bold: true, color: COLOR.brand, after: 2 });
    w.text("Reporte individual del estudiante", { size: 16, bold: true, color: COLOR.title });
    w.text(`Generado el: ${new Date().toLocaleString("es-CO")}`);
    w.text(rangeText(range));
    w.separator();

    heading(w, "Información del estudiante");
    w.text(`Nombre: ${student.fullName}`);
    w.text(`Identificador: ${student.code}`);
    w.text(`Curso: ${courseLabel(student)}`);
    w.separator();

    writeStudentSections(w, data);

    w.save(student.fullName, `Reporte_${fileSafe(student.fullName)}_${fileDate()}.pdf`);
}
