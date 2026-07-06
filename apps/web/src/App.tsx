import type { ReactNode } from "react";
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RegistrationPage } from "./pages/RegistrationPage";
import { LookupPage } from "./pages/LookupPage";
import { AdminGuard } from "./pages/admin/AdminGuard";
import { AdminHomePage } from "./pages/admin/AdminHomePage";
import { AdminReviewPage } from "./pages/admin/AdminReviewPage";
import { AdminRegistrationsPage } from "./pages/admin/AdminRegistrationsPage";
import { AdminCheckinPage } from "./pages/admin/AdminCheckinPage";

function Layout(): ReactNode {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container site-header-inner">
          <Link to="/" className="site-logo">
            DDD TAIWAN
          </Link>
          <nav className="site-nav">
            <NavLink to="/" end>
              近期活動
            </NavLink>
            <NavLink to="/lookup">查詢我的報名</NavLink>
          </nav>
        </div>
      </header>
      <main className="site-main container">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>DDD Taiwan — Domain-Driven Design Taiwan 社群</p>
          <p className="footer-muted">© {new Date().getFullYear()} DDD Taiwan Community</p>
        </div>
      </footer>
    </div>
  );
}

function NotFoundPage(): ReactNode {
  return (
    <div className="state-box state-empty">
      <p>找不到這個頁面。</p>
      <Link to="/" className="btn btn-secondary">
        回到首頁
      </Link>
    </div>
  );
}

export function App(): ReactNode {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/events/:eventId/register" element={<RegisterPage />} />
          <Route path="/registrations/:registrationId" element={<RegistrationPage />} />
          <Route path="/lookup" element={<LookupPage />} />
          <Route path="/admin" element={<AdminGuard />}>
            <Route index element={<AdminHomePage />} />
            <Route path="events/:eventId/review" element={<AdminReviewPage />} />
            <Route path="events/:eventId/registrations" element={<AdminRegistrationsPage />} />
            <Route path="events/:eventId/checkin" element={<AdminCheckinPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
