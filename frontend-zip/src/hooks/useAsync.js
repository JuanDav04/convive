// hooks/useAsync.js
// Carga datos asíncronos de un servicio y expone { data, loading, error, reload }.
// Ignora respuestas viejas (si cambias de estudiante rápido, gana la última).
import { useCallback, useEffect, useState } from "react";

export function useAsync(load, deps) {
    const [state, setState] = useState({ data: null, loading: true, error: null });
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let active = true;

        setState((prev) => ({ ...prev, loading: true, error: null }));

        load()
            .then((data) => active && setState({ data, loading: false, error: null }))
            .catch((error) => active && setState({ data: null, loading: false, error }));

        return () => {
            active = false;
        };
        // `load` se redefine en cada render; las dependencias reales son `deps`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);

    return { ...state, reload };
}
