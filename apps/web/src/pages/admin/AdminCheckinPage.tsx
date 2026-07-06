import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  routes,
  type AttendanceDto,
  type CheckinManifestDto,
  type ScanRequest,
  type ScanResponse,
} from "@dddtw/contracts";
import { adminApi, saveBlob, toApiRequestError } from "../../api/client";
import { EmptyState } from "../../components/ui";
import { formatDateTime } from "../../lib/format";

interface ScanEntry {
  key: number;
  response: ScanResponse;
}

function ScanResultPanel({ response }: { response: ScanResponse }): ReactNode {
  if (response.result === "success") {
    return (
      <div className="scan-result scan-success" role="status">
        <div className="scan-result-title">✓ 入場成功</div>
        <div className="scan-result-name">{response.attendeeName ?? "—"}</div>
        <div className="scan-result-sub">{response.ticketTypeName ?? ""}</div>
      </div>
    );
  }
  if (response.result === "duplicate") {
    return (
      <div className="scan-result scan-fail" role="alert">
        <div className="scan-result-title">✕ 重複入場</div>
        <div className="scan-result-name">{response.attendeeName ?? "—"}</div>
        <div className="scan-result-sub">
          首次入場時間:{response.firstScannedAt ? formatDateTime(response.firstScannedAt) : "—"}
        </div>
      </div>
    );
  }
  return (
    <div className="scan-result scan-fail" role="alert">
      <div className="scan-result-title">✕ 無效票券</div>
      <div className="scan-result-sub">此 QR code 無法辨識,請改用離線名單查驗。</div>
    </div>
  );
}

function AttendanceBar({ eventId }: { eventId: string }): ReactNode {
  const [attendance, setAttendance] = useState<AttendanceDto | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = (): void => {
      adminApi
        .get<AttendanceDto>(routes.attendance(eventId))
        .then((data) => {
          if (alive) {
            setAttendance(data);
            setFailed(false);
          }
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    };
    load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [eventId]);

  if (failed && !attendance) {
    return <div className="attendance-bar attendance-error">出席統計暫時無法取得</div>;
  }
  if (!attendance) {
    return <div className="attendance-bar">出席統計載入中…</div>;
  }
  return (
    <div className="attendance-bar">
      <strong>
        已報到 {attendance.checkedIn} / {attendance.confirmedTotal}
      </strong>
      {attendance.byTicketType.map((t) => (
        <span key={t.ticketTypeName} className="attendance-item">
          {t.ticketTypeName}:{t.checkedIn}/{t.confirmed}
        </span>
      ))}
      {failed ? <span className="attendance-stale">(統計更新失敗,顯示前次資料)</span> : null}
    </div>
  );
}

export function AdminCheckinPage(): ReactNode {
  const { eventId } = useParams<"eventId">();
  const [tokenInput, setTokenInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([]);
  const [downloadingManifest, setDownloadingManifest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanKey = useRef(0);

  if (!eventId) return <EmptyState text="缺少活動編號。" />;

  const scan = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const qrToken = tokenInput.trim();
    if (!qrToken || scanning) return;
    setScanning(true);
    setScanError(null);
    try {
      const body: ScanRequest = { qrToken };
      const res = await adminApi.post<ScanResponse>(routes.checkinScan(), body);
      setLastResult(res);
      setRecentScans((prev) => [{ key: scanKey.current++, response: res }, ...prev].slice(0, 20));
      setTokenInput("");
    } catch (err) {
      setLastResult(null);
      setScanError(toApiRequestError(err).message);
    } finally {
      setScanning(false);
      inputRef.current?.focus();
    }
  };

  const downloadManifest = async (): Promise<void> => {
    setDownloadingManifest(true);
    try {
      const manifest = await adminApi.get<CheckinManifestDto>(routes.checkinManifest(eventId));
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      saveBlob(blob, `checkin-manifest-${eventId}.json`);
    } catch (err) {
      setScanError(toApiRequestError(err).message);
    } finally {
      setDownloadingManifest(false);
    }
  };

  return (
    <div className="checkin-page">
      <p className="breadcrumb">
        <Link to="/admin">← 回活動列表</Link>
      </p>
      <div className="page-head">
        <h1>現場報到</h1>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void downloadManifest()}
          disabled={downloadingManifest}
        >
          {downloadingManifest ? "下載中…" : "離線名單下載"}
        </button>
      </div>

      <AttendanceBar eventId={eventId} />

      <form onSubmit={scan} className="scan-form card card-pad">
        <label className="field">
          <span className="field-label">掃描或貼上票券 QR code 內容</span>
          <input
            ref={inputRef}
            type="text"
            className="scan-input"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="qrToken"
            autoFocus
            autoComplete="off"
          />
        </label>
        <button type="submit" className="btn btn-primary btn-lg" disabled={scanning || !tokenInput.trim()}>
          {scanning ? "驗票中…" : "驗票"}
        </button>
      </form>

      {scanError ? (
        <div className="scan-result scan-fail" role="alert">
          <div className="scan-result-title">✕ 驗票失敗</div>
          <div className="scan-result-sub">{scanError}</div>
        </div>
      ) : null}
      {lastResult ? <ScanResultPanel response={lastResult} /> : null}

      <section className="detail-section">
        <h2 className="section-title">最近掃描</h2>
        {recentScans.length === 0 ? (
          <EmptyState text="尚無掃描紀錄。" />
        ) : (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>結果</th>
                  <th>姓名</th>
                  <th>票種</th>
                  <th>時間</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((entry) => (
                  <tr key={entry.key}>
                    <td>
                      {entry.response.result === "success" ? (
                        <span className="badge badge-green">成功</span>
                      ) : entry.response.result === "duplicate" ? (
                        <span className="badge badge-red">重複</span>
                      ) : (
                        <span className="badge badge-red">無效</span>
                      )}
                    </td>
                    <td>{entry.response.attendeeName ?? "—"}</td>
                    <td>{entry.response.ticketTypeName ?? "—"}</td>
                    <td>{formatDateTime(entry.response.scannedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
