import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";
import { clearAdminToken, getAdminToken, setAdminToken } from "../../api/client";

export function AdminGuard(): ReactNode {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const [tokenInput, setTokenInput] = useState("");

  if (!token) {
    const submit = (e: FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      const value = tokenInput.trim();
      if (!value) return;
      setAdminToken(value);
      setToken(value);
    };
    return (
      <div className="card card-pad narrow-card">
        <h1>管理後台登入</h1>
        <p>請輸入管理者 token 以進入後台。</p>
        <form onSubmit={submit} className="form">
          <label className="field">
            <span className="field-label">
              管理者 Token <span className="required">*</span>
            </span>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              登入
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <Link to="/admin" className="admin-bar-title">
          管理後台
        </Link>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            clearAdminToken();
            setToken(null);
          }}
        >
          登出
        </button>
      </div>
      <Outlet />
    </div>
  );
}
