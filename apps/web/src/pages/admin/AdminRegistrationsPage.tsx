import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  routes,
  type AdminRegistrationListItemDto,
  type RegistrationDto,
  type RegistrationStatus,
  type ReviewStatsDto,
} from "@dddtw/contracts";
import { adminApi, saveBlob, toApiRequestError } from "../../api/client";
import { useApi } from "../../api/useApi";
import { Badge, EmptyState, ErrorBox, Loading } from "../../components/ui";
import { formatDateTime, paymentStatusMeta, registrationStatusMeta } from "../../lib/format";

interface AdminRegistrationsResponse {
  items: AdminRegistrationListItemDto[];
  stats: ReviewStatsDto;
}

const STATUS_OPTIONS: Array<{ value: RegistrationStatus | ""; label: string }> = [
  { value: "", label: "全部狀態" },
  { value: "submitted", label: "已送出" },
  { value: "pending_review", label: "待審核" },
  { value: "confirmed", label: "已確認" },
  { value: "rejected", label: "已拒絕" },
  { value: "cancelled", label: "已取消" },
  { value: "checked_in", label: "已報到" },
  { value: "no_show", label: "未出席" },
];

export function AdminRegistrationsPage(): ReactNode {
  const { eventId } = useParams<"eventId">();
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | "">("");
  const data = useApi(() => {
    const base = routes.adminRegistrations(eventId ?? "");
    return adminApi.get<AdminRegistrationsResponse>(
      statusFilter ? `${base}?status=${statusFilter}` : base,
    );
  }, [eventId, statusFilter]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (!eventId) return <EmptyState text="缺少活動編號。" />;

  const markPaid = async (id: string): Promise<void> => {
    setBusyId(id);
    setActionError(null);
    try {
      await adminApi.post<RegistrationDto>(routes.adminOnsitePayment(id), {});
      data.reload();
    } catch (err) {
      setActionError(toApiRequestError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const downloadCsv = async (): Promise<void> => {
    setDownloading(true);
    setActionError(null);
    try {
      const blob = await adminApi.blob(routes.adminRegistrationsCsv(eventId));
      saveBlob(blob, `registrations-${eventId}.csv`);
    } catch (err) {
      setActionError(toApiRequestError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <p className="breadcrumb">
        <Link to="/admin">← 回活動列表</Link>
      </p>
      <div className="page-head">
        <h1>報名名單</h1>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void downloadCsv()}
          disabled={downloading}
        >
          {downloading ? "下載中…" : "下載 CSV"}
        </button>
      </div>

      <div className="filter-bar">
        <label className="field field-inline">
          <span className="field-label">狀態篩選</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RegistrationStatus | "")}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {actionError ? (
        <div className="notice notice-red" role="alert">
          操作失敗:{actionError}
        </div>
      ) : null}

      {data.loading ? (
        <Loading text="名單載入中…" />
      ) : data.error ? (
        <ErrorBox error={data.error} onRetry={data.reload} />
      ) : data.data && data.data.items.length > 0 ? (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>Email</th>
                <th>票種</th>
                <th>狀態</th>
                <th>付款</th>
                <th>送出時間</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((item) => {
                const statusMeta = registrationStatusMeta[item.status];
                const payMeta = paymentStatusMeta[item.payment];
                return (
                  <tr key={item.registrationId}>
                    <td>{item.attendee.name}</td>
                    <td>{item.attendee.email}</td>
                    <td>{item.ticketTypeName}</td>
                    <td>
                      <Badge label={statusMeta.label} className={statusMeta.className} />
                      {item.status === "rejected" && item.rejectReason ? (
                        <div className="cell-subtext">理由:{item.rejectReason}</div>
                      ) : null}
                    </td>
                    <td>
                      <Badge label={payMeta.label} className={payMeta.className} />
                    </td>
                    <td>{formatDateTime(item.submittedAt)}</td>
                    <td>
                      {item.status === "confirmed" && item.payment === "unpaid" ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId !== null}
                          onClick={() => void markPaid(item.registrationId)}
                        >
                          {busyId === item.registrationId ? "處理中…" : "現場繳費"}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="目前沒有符合條件的報名。" />
      )}
    </div>
  );
}
