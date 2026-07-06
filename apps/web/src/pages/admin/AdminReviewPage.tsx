import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  routes,
  type AdminRegistrationListItemDto,
  type RegistrationDto,
  type ReviewStatsDto,
} from "@dddtw/contracts";
import { adminApi, toApiRequestError } from "../../api/client";
import { useApi } from "../../api/useApi";
import { EmptyState, ErrorBox, Loading } from "../../components/ui";
import { formatDateTime } from "../../lib/format";

interface AdminRegistrationsResponse {
  items: AdminRegistrationListItemDto[];
  stats: ReviewStatsDto;
}

export function AdminReviewPage(): ReactNode {
  const { eventId } = useParams<"eventId">();
  const data = useApi(
    () =>
      adminApi.get<AdminRegistrationsResponse>(
        `${routes.adminRegistrations(eventId ?? "")}?status=pending_review`,
      ),
    [eventId],
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  if (!eventId) return <EmptyState text="缺少活動編號。" />;

  const approve = async (id: string): Promise<void> => {
    setBusyId(id);
    setActionError(null);
    try {
      await adminApi.post<RegistrationDto>(routes.adminApprove(id), {});
      data.reload();
    } catch (err) {
      setActionError(toApiRequestError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string): Promise<void> => {
    if (!rejectReason.trim()) return;
    setBusyId(id);
    setActionError(null);
    try {
      await adminApi.post<RegistrationDto>(routes.adminReject(id), {
        reason: rejectReason.trim(),
      });
      setRejectingId(null);
      setRejectReason("");
      data.reload();
    } catch (err) {
      setActionError(toApiRequestError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <p className="breadcrumb">
        <Link to="/admin">← 回活動列表</Link>
      </p>
      <h1>志工審核</h1>

      {data.loading ? (
        <Loading text="審核名單載入中…" />
      ) : data.error ? (
        <ErrorBox error={data.error} onRetry={data.reload} />
      ) : data.data ? (
        <>
          <div className="stats-chips">
            <span className="stat-chip stat-amber">待審核 {data.data.stats.pendingReview}</span>
            <span className="stat-chip stat-green">已核准 {data.data.stats.approved}</span>
            <span className="stat-chip stat-red">已拒絕 {data.data.stats.rejected}</span>
          </div>

          {actionError ? (
            <div className="notice notice-red" role="alert">
              操作失敗:{actionError}
            </div>
          ) : null}

          {data.data.items.length === 0 ? (
            <EmptyState text="無待審核的報名。" />
          ) : (
            <div className="card table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>Email</th>
                    <th>票種</th>
                    <th>申請理由</th>
                    <th>送出時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.items.map((item) => (
                    <tr key={item.registrationId}>
                      <td>{item.attendee.name}</td>
                      <td>{item.attendee.email}</td>
                      <td>{item.ticketTypeName}</td>
                      <td className="cell-note">{item.attendee.note ?? "—"}</td>
                      <td>{formatDateTime(item.submittedAt)}</td>
                      <td>
                        {rejectingId === item.registrationId ? (
                          <div className="reject-form">
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              rows={2}
                              placeholder="拒絕理由(必填)"
                            />
                            <div className="form-actions">
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={busyId === item.registrationId || !rejectReason.trim()}
                                onClick={() => void reject(item.registrationId)}
                              >
                                確認拒絕
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={busyId === item.registrationId}
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReason("");
                                }}
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busyId !== null}
                              onClick={() => void approve(item.registrationId)}
                            >
                              {busyId === item.registrationId ? "處理中…" : "核准"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={busyId !== null}
                              onClick={() => {
                                setRejectingId(item.registrationId);
                                setRejectReason("");
                              }}
                            >
                              拒絕
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
