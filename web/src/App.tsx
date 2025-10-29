import { NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { AlertsPage } from "./pages/AlertsPage";
import { CustomerPage } from "./pages/CustomerPage";
import { EvalsPage } from "./pages/EvalsPage";
import styles from "./styles/App.module.css";

const navItems = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/alerts", label: "Alerts" },
  { path: "/evals", label: "Evals" }
];

export default function App() {
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar} aria-label="Main navigation">
        <h1 className={styles.brand}>Sentinel Support</h1>
        <nav>
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/customer/:id" element={<CustomerPage />} />
          <Route path="/evals" element={<EvalsPage />} />
        </Routes>
      </main>
    </div>
  );
}
