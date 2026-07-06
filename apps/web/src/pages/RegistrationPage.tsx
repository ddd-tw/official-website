import { useState, type FormEvent, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { routes, type RegistrationDto, type RegistrationStatus } from "@dddtw/contracts";
import { api, toApiRequestError } from "../api/client";
import { useApi } from "../api/useApi";
import { Badge, EmptyState, ErrorBox, Loading } from "../components/ui";
import { formatDateTime, paymentStatusMeta, registrationStatusMeta } from "../lib/format";

type StepState = "done" | "current" | "bad" | "todo";

interface TimelineStep {
  label: string;
  state: StepState;
}

function timelineFor(status: RegistrationStatus): TimelineStep[] {
  switch (status) {
    case "submitted":
      return [
        { label: "已送出", state: "done" },
        { label: "處理中", state: "current" },
        { label: "已確認", state: "todo" },
      ];
    case "pending_review":
      return [
        { label: "已送出", state: "done" },
        { label: "審核中", state: "current" },
        { label: "已確認", state: "todo" },
      ];
    case "confirmed":
      return [
        { label: "已送出", state: "done" },
        { label: "審核/處理", state: "done" },
        { label: "已確認", state: "done" },
      ];
    case "checked_in":
      return [
        { label: "已送出", state: "done" },
        { label: "已確認", state: "done" },
        { label: "已報到", state: "done" },
      ];
    case "rejected":
      return [
        { label: "已送出", state: "done" },
        { label: "審核中", state: "done" },
        { label: "已拒絕", state: "bad" },
      ];
    case "cancelled":
      return [
        { label: "已送出", state: "done" },
        { label: "已取消", state: "bad" },
      ];
    case "no_show":
      return [
        { label: "已送出", state: "done" },
        { label: "已確認", state: "done" },
        { label: "未出席", state: "bad" },
      ];
  }
}

function StatusTimeline({ status }: { status: RegistrationStatus }): ReactNode {
  const steps = timelineFor(status);
  return (
    <ol className="timeline">
      {steps.map((s) => (
        <li key={s.label} className={`timeline-step timeline-${s.state}`}>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function TicketCard({ qrToken }: { qrToken: string }): ReactNode {
  const [copied, setCopied] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrToken)}`;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(qrToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — token text is visible below the QR */
    }
  };

  return (
    <div className="ticket-card">
      <h3>票券</h3>
      <p className="ticket-card-hint">入場時請出示此 QR code</p>
      <img className="ticket-qr" src={qrUrl} alt="入場 QR code" width={220} height={220} />
      <code className="ticket-token">{qrToken}</code>
      <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
        {copied ? "已複製!" : "複製票券代碼"}
      </button>
    </div>
  );
}

function RegistrationView({
  registrationId,
  email,
}: {
  registrationId: string;
  email: string;
}): ReactNode {
  const reg = useApi(
    () =>
      api.get<RegistrationDto>(
        `${routes.registration(registrationId)}?email=${encodeURIComponent(email)}`,
      ),
    [registrationId, email],
  );
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (reg.loading) return <Loading text="報名資料載入中…" />;
  if (reg.error) return <ErrorBox error={reg.error} onRetry={reg.reload} />;
  if (!reg.data) return <EmptyState text="找不到這筆報名。" />;

  const r = reg.data;
  const statusMeta = registrationStatusMeta[r.status];
  const payMeta = paymentStatusMeta[r.payment];
  const cancellable =
    r.status === "submitted" || r.status === "pending_review" || r.status === "confirmed";

  const doCancel = async (): Promise<void> => {
    setCancelling(true);
    setCancelError(null);
    try {
      await api.post<RegistrationDto>(routes.cancelRegistration(r.registrationId), { email });
      setConfirmingCancel(false);
      reg.reload();
    } catch (err) {
      setCancelError(toApiRequestError(err).message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="registration-view">
      <div className="card card-pad">
        <div className="registration-head">
          <h1>{r.eventTitle}</h1>
          <div className="event-card-badges">
            <Badge label={statusMeta.label} className={statusMeta.className} />
            <Badge label={payMeta.label} className={payMeta.className} />
          </div>
        </div>

        <StatusTimeline status={r.status} />

        {r.status === "pending_review" ? (
          <div className="notice notice-amber">此票種需審核,審核結果將以 Email 通知你。</div>
        ) : null}
        {r.status === "confirmed" && r.payment === "unpaid" ? (
          <div className="notice notice-info">
            已為你保留名額,請於活動當天於現場繳費。
          </div>
        ) : null}

        <dl className="detail-list">
          <div>
            <dt>報名編號</dt>
            <dd>
              <code>{r.registrationId}</code>
            </dd>
          </div>
          <div>
            <dt>票種</dt>
            <dd>{r.ticketTypeName}</dd>
          </div>
          <div>
            <dt>姓名</dt>
            <dd>{r.attendee.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{r.attendee.email}</dd>
          </div>
          {r.attendee.phone ? (
            <div>
              <dt>電話</dt>
              <dd>{r.attendee.phone}</dd>
            </div>
          ) : null}
          {r.attendee.diet ? (
            <div>
              <dt>飲食需求</dt>
              <dd>{r.attendee.diet}</dd>
            </div>
          ) : null}
          <div>
            <dt>送出時間</dt>
            <dd>{formatDateTime(r.submittedAt)}</dd>
          </div>
        </dl>

        {r.ticket ? <TicketCard qrToken={r.ticket.qrToken} /> : null}

        {cancellable ? (
          <div className="cancel-area">
            {confirmingCancel ? (
              <div className="notice notice-red">
                <p>確定要取消這筆報名嗎?取消後名額將釋出,無法復原。</p>
                {cancelError ? <p className="cancel-error">取消失敗:{cancelError}</p> : null}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void doCancel()}
                    disabled={cancelling}
                  >
                    {cancelling ? "取消中…" : "確定取消報名"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setConfirmingCancel(false);
                      setCancelError(null);
                    }}
                    disabled={cancelling}
                  >
                    返回
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmingCancel(true)}
              >
                取消報名
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RegistrationPage(): ReactNode {
  const { registrationId } = useParams<"registrationId">();
  const [searchParams, setSearchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [emailInput, setEmailInput] = useState("");

  if (!registrationId) return <EmptyState text="缺少報名編號。" />;

  if (!email) {
    const submit = (e: FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      if (emailInput.trim()) setSearchParams({ email: emailInput.trim() });
    };
    return (
      <div className="card card-pad narrow-card">
        <h1>查看報名</h1>
        <p>為保護個資,請輸入報名時填寫的 Email 以查看報名內容。</p>
        <form onSubmit={submit} className="form">
          <label className="field">
            <span className="field-label">
              Email <span className="required">*</span>
            </span>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              查看報名
            </button>
          </div>
        </form>
      </div>
    );
  }

  return <RegistrationView registrationId={registrationId} email={email} />;
}
