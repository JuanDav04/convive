// pages/Dashboard.jsx
// Pantalla de inicio. Todos ven la bienvenida y los accesos a los cursos; el resumen
// con cifras (solo lectura) lo ven administración y coordinación, igual que en el backend.
import { Link } from "react-router-dom";
import escudo from "../assets/escudo.png";
import Loading from "../components/Loading";
import { CaseStatus, GROUPS, Grade, labelOf } from "../constants/enums";
import { useAsync } from "../hooks/useAsync";
import * as auth from "../services/auth";
import * as dashboard from "../services/dashboard";
import { courseLabel, gradeParam } from "../utils/courses";
import { isStaff } from "../utils/permissions";
import "../styles/Dashboard.css";

const TZ = "America/Bogota";

function greeting() {
    const hour = Number(new Intl.DateTimeFormat("es-CO", { hour: "numeric", hour12: false, timeZone: TZ }).format(new Date()));
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
}

function longDate() {
    const text = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date());
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// "2026-11" -> "nov"
const monthLabel = (month) => {
    const [y, m] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1))).replace(".", "");
};

// "2026-11-05" -> "05/11/2026" (sin pasar por Date para no correr el día por la zona horaria)
const formatDay = (iso) => iso.split("-").reverse().join("/");

function Hero() {
    const user = auth.getCurrentUser();
    const firstName = user?.fullName?.split(" ")[0] ?? "";

    return (
        <header className="home-hero">
            <img className="home-hero-shield" src={escudo} alt="Escudo del Colegio Los Periodistas IED" />

            <div className="home-hero-text">
                <p className="home-hero-eyebrow">Colegio Los Periodistas · IED</p>
                <h1>
                    {greeting()}, {firstName}
                </h1>
                <p className="home-hero-date">{longDate()}</p>
                <p className="home-hero-lead">
                    Observador digital de convivencia escolar, según la Ley 1620 de 2013.
                </p>
            </div>
        </header>
    );
}

function Stat({ icon, label, value, tone }) {
    return (
        <div className={`home-stat home-stat-${tone}`}>
            <span className="home-stat-icon" aria-hidden="true">{icon}</span>
            <div>
                <strong>{value}</strong>
                <span>{label}</span>
            </div>
        </div>
    );
}

function MonthChart({ data }) {
    const max = Math.max(1, ...data.map((m) => m.count));
    const summary = data.map((m) => `${monthLabel(m.month)}: ${m.count}`).join(", ");

    return (
        <div className="home-chart" role="img" aria-label={`Casos por mes. ${summary}`}>
            {data.map((m) => (
                <div className="home-chart-col" key={m.month}>
                    <span className="home-chart-value">{m.count}</span>
                    <div className="home-chart-track">
                        <div className="home-chart-bar" style={{ height: `${(m.count / max) * 100}%` }} />
                    </div>
                    <span className="home-chart-label">{monthLabel(m.month)}</span>
                </div>
            ))}
        </div>
    );
}

function StatusBar({ counts }) {
    const entries = Object.values(CaseStatus).map((status) => ({ status, count: counts[status] ?? 0 }));
    const total = entries.reduce((sum, e) => sum + e.count, 0);

    if (total === 0) return <p className="home-empty">Aún no hay casos registrados.</p>;

    return (
        <>
            <div className="home-status-bar" role="img" aria-label={entries.map((e) => `${labelOf("CaseStatus", e.status)}: ${e.count}`).join(", ")}>
                {entries.map((e) =>
                    e.count > 0 ? (
                        <span key={e.status} className={`home-seg home-seg-${e.status.toLowerCase()}`} style={{ flexGrow: e.count }} />
                    ) : null
                )}
            </div>
            <ul className="home-legend">
                {entries.map((e) => (
                    <li key={e.status}>
                        <span className={`home-dot home-seg-${e.status.toLowerCase()}`} aria-hidden="true" />
                        {labelOf("CaseStatus", e.status)}
                        <strong>{e.count}</strong>
                    </li>
                ))}
            </ul>
        </>
    );
}

function Summary() {
    const { data, loading, error } = useAsync(() => dashboard.summary(), []);

    return (
        <section className="home-section" aria-labelledby="home-summary-title">
            <h2 id="home-summary-title">Resumen del colegio</h2>

            {loading && <Loading text="Cargando resumen..." />}
            {error && <p className="home-error">{error.message}</p>}

            {data && (
                <>
                    <div className="home-stats">
                        <Stat icon="🎓" tone="blue" label="Estudiantes activos" value={data.totals.students} />
                        <Stat icon="📋" tone="violet" label="Casos registrados" value={data.totals.cases} />
                        <Stat icon="📂" tone="amber" label="Casos sin cerrar" value={data.totals.openCases} />
                    </div>

                    <div className="home-grid">
                        <article className="home-panel home-panel-wide">
                            <h3>Casos por mes</h3>
                            <MonthChart data={data.casesByMonth} />
                        </article>

                        <article className="home-panel">
                            <h3>Casos por estado</h3>
                            <StatusBar counts={data.casesByStatus} />
                        </article>

                        <article className="home-panel home-panel-wide">
                            <h3>Casos recientes</h3>
                            {data.recentCases.length === 0 ? (
                                <p className="home-empty">Aún no hay casos registrados.</p>
                            ) : (
                                <ul className="home-list">
                                    {data.recentCases.map((c) => (
                                        <li key={c.id}>
                                            <Link to={`/estudiante/${c.studentId}/seguimiento/caso/${c.id}`}>
                                                <span className="home-list-main">{c.title}</span>
                                                <span className="home-list-sub">
                                                    {c.student.fullName} · {formatDay(c.date)}
                                                </span>
                                            </Link>
                                            <span className={`home-badge home-badge-${c.status.toLowerCase()}`}>
                                                {labelOf("CaseStatus", c.status)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </article>
                        <article className="home-panel">
                            <h3>Estudiantes con reincidencia</h3>
                            {data.recurrentStudents.length === 0 ? (
                                <p className="home-empty">Ningún estudiante con reincidencia por ahora.</p>
                            ) : (
                                <ul className="home-list">
                                    {data.recurrentStudents.map(({ student, count }) => (
                                        <li key={student.id}>
                                            <Link to={`/estudiante/${student.id}`}>
                                                <span className="home-list-main">{student.fullName}</span>
                                                <span className="home-list-sub">{courseLabel(student)}</span>
                                            </Link>
                                            <span className="home-badge home-badge-alert">{count} casos</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </article>

                    </div>
                </>
            )}
        </section>
    );
}

function Courses() {
    return (
        <section className="home-section" aria-labelledby="home-courses-title">
            <h2 id="home-courses-title">Cursos</h2>
            <p className="home-section-note">Selecciona un curso para ver a sus estudiantes.</p>

            {Object.values(Grade).map((grade) => (
                <div className="home-course-row" key={grade}>
                    <h3>{labelOf("Grade", grade)}</h3>
                    <div className="home-course-tiles">
                        {GROUPS.map((group) => (
                            <Link key={group} className="home-course" to={`/curso/${gradeParam(grade)}/${group}`}>
                                <strong>{labelOf("Grade", grade)} {group}</strong>
                                <span>Ver estudiantes →</span>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </section>
    );
}

function Dashboard() {
    return (
        <div className="dashboard-content-page">
            <Hero />
            {isStaff() && <Summary />}
            <Courses />
        </div>
    );
}

export default Dashboard;
