import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  routes,
  type AttendeeInfoDto,
  type EventDetailDto,
  type RegistrationDto,
  type SubmitRegistrationRequest,
  type TicketTypeDto,
} from "@dddtw/contracts";
import { api, toApiRequestError } from "../api/client";
import { useApi } from "../api/useApi";
import { Badge, EmptyState, ErrorBox, Loading } from "../components/ui";
import { formatDateTime, formatPrice } from "../lib/format";

function ticketSaleState(ticket: TicketTypeDto): "on_sale" | "sold_out" | "not_yet" | "closed" {
  const now = Date.now();
  if (now < new Date(ticket.salesOpensAt).getTime()) return "not_yet";
  if (now > new Date(ticket.salesClosesAt).getTime()) return "closed";
  if (ticket.remaining <= 0) return "sold_out";
  return "on_sale";
}

const saleStateLabel: Record<ReturnType<typeof ticketSaleState>, string> = {
  on_sale: "可報名",
  sold_out: "已額滿",
  not_yet: "尚未開賣",
  closed: "已截止",
};

function TicketPicker({
  tickets,
  selectedId,
  onSelect,
}: {
  tickets: TicketTypeDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): ReactNode {
  if (tickets.length === 0) return <EmptyState text="這個活動目前沒有可報名的票種。" />;
  return (
    <div className="ticket-picker">
      {tickets.map((ticket) => {
        const state = ticketSaleState(ticket);
        const selectable = state === "on_sale";
        const selected = ticket.ticketTypeId === selectedId;
        return (
          <button
            type="button"
            key={ticket.ticketTypeId}
            className={`ticket-option${selected ? " ticket-option-selected" : ""}`}
            disabled={!selectable}
            onClick={() => onSelect(ticket.ticketTypeId)}
          >
            <span className="ticket-option-head">
              <strong>{ticket.name}</strong>
              {ticket.requiresApproval ? (
                <Badge label="需審核" className="badge badge-amber" />
              ) : null}
              {!selectable ? (
                <Badge label={saleStateLabel[state]} className="badge badge-gray" />
              ) : null}
            </span>
            {ticket.description ? (
              <span className="ticket-option-desc">{ticket.description}</span>
            ) : null}
            <span className="ticket-option-meta">
              {formatPrice(ticket.price)}・剩餘 {ticket.remaining} 名額・售至{" "}
              {formatDateTime(ticket.salesClosesAt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function RegisterPage(): ReactNode {
  const { eventId } = useParams<"eventId">();
  const navigate = useNavigate();
  const detail = useApi(
    () => api.get<EventDetailDto>(routes.eventDetail(eventId ?? "")),
    [eventId],
  );

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [diet, setDiet] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!eventId) return <EmptyState text="缺少活動編號。" />;
  if (detail.loading) return <Loading text="活動資料載入中…" />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <EmptyState text="找不到這個活動。" />;

  const event = detail.data;
  const selectedTicket =
    event.ticketTypes.find((t) => t.ticketTypeId === selectedTicketId) ?? null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!selectedTicket || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const attendee: AttendeeInfoDto = { name: name.trim(), email: email.trim() };
    if (phone.trim()) attendee.phone = phone.trim();
    if (diet.trim()) attendee.diet = diet.trim();
    if (selectedTicket.requiresApproval && note.trim()) attendee.note = note.trim();

    const body: SubmitRegistrationRequest = {
      ticketTypeId: selectedTicket.ticketTypeId,
      attendee,
    };

    try {
      const reg = await api.post<RegistrationDto>(routes.submitRegistration(eventId), body);
      navigate(
        `/registrations/${reg.registrationId}?email=${encodeURIComponent(attendee.email)}`,
      );
    } catch (err) {
      const apiErr = toApiRequestError(err);
      if (apiErr.code === "SOLD_OUT") {
        setSubmitError("很抱歉,此票種已額滿。請回上一步選擇其他票種。");
      } else if (apiErr.code === "SALES_CLOSED") {
        setSubmitError("很抱歉,此票種售票已截止。請回上一步選擇其他票種。");
      } else {
        setSubmitError(`報名失敗:${apiErr.message}`);
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="register-page">
      <p className="breadcrumb">
        <Link to={`/events/${eventId}`}>← 回活動頁</Link>
      </p>
      <h1>報名:{event.title}</h1>

      <ol className="steps">
        <li className={step === 1 ? "step step-current" : "step step-done"}>1. 選擇票種</li>
        <li className={step === 2 ? "step step-current" : "step"}>2. 填寫報名資料</li>
      </ol>

      {step === 1 ? (
        <section className="card card-pad">
          <h2>選擇票種</h2>
          <TicketPicker
            tickets={event.ticketTypes}
            selectedId={selectedTicketId}
            onSelect={(id) => {
              setSelectedTicketId(id);
              setSubmitError(null);
            }}
          />
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedTicket}
              onClick={() => setStep(2)}
            >
              下一步
            </button>
          </div>
        </section>
      ) : selectedTicket ? (
        <section className="card card-pad">
          <h2>填寫報名資料</h2>
          <p className="selected-ticket">
            已選票種:<strong>{selectedTicket.name}</strong>({formatPrice(selectedTicket.price)})
          </p>

          {selectedTicket.requiresApproval ? (
            <div className="notice notice-amber">
              此票種需審核:送出後將進入審核程序,結果將以 Email 通知。
            </div>
          ) : selectedTicket.price > 0 ? (
            <div className="notice notice-info">
              本活動採「現場繳費」:送出報名即保留名額,活動當天於現場繳費即可
              (不需要在此輸入信用卡資料)。
            </div>
          ) : (
            <div className="notice notice-info">此票種為免費票,送出後即完成報名。</div>
          )}

          <form onSubmit={handleSubmit} className="form">
            <label className="field">
              <span className="field-label">
                姓名 <span className="required">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
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
                maxLength={255}
              />
            </label>
            <label className="field">
              <span className="field-label">電話</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
              />
            </label>
            <label className="field">
              <span className="field-label">飲食需求</span>
              <input
                type="text"
                value={diet}
                onChange={(e) => setDiet(e.target.value)}
                placeholder="例:素食"
                maxLength={100}
              />
            </label>
            {selectedTicket.requiresApproval ? (
              <label className="field">
                <span className="field-label">
                  申請理由 <span className="required">*</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                  rows={4}
                  maxLength={1000}
                  placeholder="請簡述你想擔任志工的理由與相關經驗"
                />
              </label>
            ) : null}

            {submitError ? (
              <div className="notice notice-red" role="alert">
                {submitError}
              </div>
            ) : null}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setStep(1);
                  setSubmitError(null);
                }}
                disabled={submitting}
              >
                上一步
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "送出中…" : "送出報名"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <EmptyState text="請先選擇票種。" />
      )}
    </div>
  );
}
