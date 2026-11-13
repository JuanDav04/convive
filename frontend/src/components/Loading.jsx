// Mensaje de carga común (los datos ahora llegan de forma asíncrona).
function Loading({ text = "Cargando..." }) {
    return (
        <p className="page-loading" role="status">
            {text}
        </p>
    );
}

export default Loading;
