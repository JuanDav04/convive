// Buscador de estudiantes de la barra superior.
// Consulta GET /students?search=... (nombre o código, sin distinguir mayúsculas)
// con una pausa de 300 ms entre teclas, y lleva al perfil del estudiante elegido.
// Teclado: ↑ ↓ para moverse, Enter para abrir, Esc para cerrar.
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as estudiantes from "../services/estudiantes";
import { courseLabel } from "../utils/courses";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

function StudentSearch() {
    const navigate = useNavigate();
    const listId = useId();
    const boxRef = useRef(null);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [status, setStatus] = useState("idle"); // idle | loading | done | error
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const term = query.trim();

    // Busca al dejar de escribir. `cancelled` evita que una respuesta lenta y
    // vieja pise a una más reciente (condición de carrera).
    useEffect(() => {
        if (term.length < MIN_CHARS) {
            setResults([]);
            setStatus("idle");
            return;
        }

        let cancelled = false;
        setStatus("loading");

        const timer = setTimeout(async () => {
            try {
                const found = await estudiantes.list({ search: term });

                if (cancelled) return;
                setResults(found.slice(0, MAX_RESULTS));
                setActive(0);
                setStatus("done");
            } catch {
                if (!cancelled) setStatus("error");
            }
        }, DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [term]);

    // Cerrar al hacer clic fuera del buscador.
    useEffect(() => {
        function onPointerDown(event) {
            if (!boxRef.current?.contains(event.target)) setOpen(false);
        }

        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, []);

    function choose(student) {
        setQuery("");
        setResults([]);
        setOpen(false);
        navigate(`/estudiante/${student.id}`);
    }

    function handleKeyDown(event) {
        if (event.key === "Escape") {
            setOpen(false);
        } else if (event.key === "ArrowDown" && results.length) {
            event.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % results.length);
        } else if (event.key === "ArrowUp" && results.length) {
            event.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
        } else if (event.key === "Enter" && open && results[active]) {
            event.preventDefault();
            choose(results[active]);
        }
    }

    const showPanel = open && term.length >= MIN_CHARS;

    return (
        <div className="navbar-search" ref={boxRef}>
            <div className="student-search">
                <input
                    type="search"
                    placeholder="Buscar estudiante por nombre o código..."
                    aria-label="Buscar estudiante"
                    role="combobox"
                    aria-expanded={showPanel}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                />

                {showPanel && (
                    <ul className="student-search-panel" id={listId} role="listbox">
                        {status === "loading" && <li className="student-search-note">Buscando...</li>}

                        {status === "error" && (
                            <li className="student-search-note">No se pudo buscar. Intenta de nuevo.</li>
                        )}

                        {status === "done" && results.length === 0 && (
                            <li className="student-search-note">Sin resultados para «{term}».</li>
                        )}

                        {status === "done" &&
                            results.map((student, index) => (
                                <li
                                    key={student.id}
                                    role="option"
                                    aria-selected={index === active}
                                    className={index === active ? "student-search-option active" : "student-search-option"}
                                    onMouseEnter={() => setActive(index)}
                                    onClick={() => choose(student)}
                                >
                                    <strong>{student.fullName}</strong>
                                    <span>
                                        {student.code} · {courseLabel(student)}
                                    </span>
                                </li>
                            ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default StudentSearch;
