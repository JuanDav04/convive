import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { GROUPS, Grade, labelOf } from "../constants/enums";
import { gradeParam } from "../utils/courses";
import "../styles/Sidebar.css";

function Sidebar() {
    // Un solo estado en lugar de uno por grado: { QUINTO: true, NOVENO: false }
    const [open, setOpen] = useState({});

    const toggle = (grade) =>
        setOpen((prev) => ({ ...prev, [grade]: !prev[grade] }));

    return (
        <aside className="sidebar">
            <h2>Grados</h2>

            <nav>
                {Object.values(Grade).map((grade) => (
                    <Fragment key={grade}>
                        <button
                            className="course-button"
                            aria-expanded={Boolean(open[grade])}
                            onClick={() => toggle(grade)}
                        >
                            {labelOf("Grade", grade)}
                            <span>{open[grade] ? "🔺" : "🔻"}</span>
                        </button>

                        {open[grade] && (
                            <div className="groups">
                                {GROUPS.map((group) => (
                                    <Link
                                        key={group}
                                        to={`/curso/${gradeParam(grade)}/${group}`}
                                    >
                                        {labelOf("Grade", grade)} {group}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </Fragment>
                ))}
            </nav>
        </aside>
    );
}

export default Sidebar;
