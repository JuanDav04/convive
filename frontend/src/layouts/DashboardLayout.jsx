import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../styles/DashboardLayout.css";

function DashboardLayout() {
    return (
        <div className="dashboard-layout">

            <Navbar />

            <div className="dashboard-layout-body">

                <Sidebar />

                <main className="dashboard-layout-content">
                    <Outlet />
                </main>

            </div>

        </div>
    );
}

export default DashboardLayout;