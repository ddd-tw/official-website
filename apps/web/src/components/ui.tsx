import type { ReactNode } from "react";
import type { ApiRequestError } from "../api/client";

export function Loading({ text = "載入中…" }: { text?: string }): ReactNode {
  return (
    <div className="state-box state-loading" role="status">
      {text}
    </div>
  );
}

export function ErrorBox({
  error,
  onRetry,
}: {
  error: ApiRequestError;
  onRetry?: () => void;
}): ReactNode {
  return (
    <div className="state-box state-error" role="alert">
      <p>載入失敗:{error.message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          重試
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ text }: { text: string }): ReactNode {
  return <div className="state-box state-empty">{text}</div>;
}

export function Badge({ label, className }: { label: string; className: string }): ReactNode {
  return <span className={className}>{label}</span>;
}
