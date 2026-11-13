/*App.jsx*/
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Loading from "./components/Loading";
import RequireAuth from "./components/RequireAuth";
import DashboardLayout from "./layouts/DashboardLayout";
import Attendance from "./pages/Attendance";
import CaseDetail from "./pages/CaseDetail";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import EditCase from "./pages/EditCase";
import FollowUp from "./pages/FollowUp";
import Login from "./pages/Login";
import NewCase from "./pages/NewCase";
import Observations from "./pages/Observations";
import StudentProfile from "./pages/StudentProfile";
import Students from "./pages/Students";

// Reportes arrastra jsPDF (pesado): solo se descarga cuando se entra a esa página.
const Reports = lazy(() => import("./pages/Reports"));

function App() {
    return (
        <BrowserRouter>
            <Suspense fallback={<Loading />}>
                <Routes>
                    {/* Inicio de sesión */}
                    <Route path="/" element={<Login />} />

                    {/* Todo lo demás exige sesión vigente */}
                    <Route element={<RequireAuth />}>
                        <Route element={<DashboardLayout />}>
                            <Route path="/dashboard" element={<Dashboard />} />

                            {/* Cursos de quinto y noveno */}
                            <Route path="/curso/:grado/:grupo" element={<Students />} />

                            {/* Perfil del estudiante (:id = id de la base de datos) */}
                            <Route path="/estudiante/:id" element={<StudentProfile />} />
                            <Route path="/estudiante/:id/seguimiento" element={<FollowUp />} />
                            <Route path="/estudiante/:id/seguimiento/nuevo" element={<NewCase />} />
                            <Route path="/estudiante/:id/seguimiento/caso/:caseId" element={<CaseDetail />} />
                            <Route path="/estudiante/:id/seguimiento/caso/:caseId/editar" element={<EditCase />} />
                            <Route path="/estudiante/:id/observaciones" element={<Observations />} />
                            <Route path="/estudiante/:id/documentos" element={<Documents />} />

                            <Route path="/asistencia" element={<Attendance />} />
                            <Route path="/reportes" element={<Reports />} />
                        </Route>
                    </Route>

                    {/* Cualquier ruta desconocida vuelve al inicio */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}

export default App;
