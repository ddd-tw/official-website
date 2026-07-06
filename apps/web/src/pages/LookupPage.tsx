import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export function LookupPage(): ReactNode {
  const navigate = useNavigate();
  const [registrationId, setRegistrationId] = useState("");
  const [email, setEmail] = useState("");

  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const id = registrationId.trim();
    const mail = email.trim();
    if (!id || !mail) return;
    navigate(`/registrations/${encodeURIComponent(id)}?email=${encodeURIComponent(mail)}`);
  };

  return (
    <div className="card card-pad narrow-card">
      <h1>查詢我的報名</h1>
      <p>請輸入報名編號與報名時填寫的 Email,即可查看報名狀態與票券。</p>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span className="field-label">
            報名編號 <span className="required">*</span>
          </span>
          <input
            type="text"
            value={registrationId}
            onChange={(e) => setRegistrationId(e.target.value)}
            required
            placeholder="報名成功時提供的編號"
          />
        </label>
        <label className="field">
          <span className="field-label">
            Email <span className="required">*</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            查詢
          </button>
        </div>
      </form>
    </div>
  );
}
