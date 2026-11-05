"use client";

import { useEffect, useState, type FormEvent } from "react";
import Modal from "@/shared/components/Modal";
import { Button, Field, Tag, inputCls } from "@/shared/components/ui";
import { toInputDate } from "@/shared/lib/dateFormat";
import { documentExpiry, documentNeedsExpiry, expiryPhrase } from "@/shared/lib/documentExpiry";
import type { DocumentRecord } from "@/shared/types";

/** The "Expires" cell of a documents table: the date plus a status tag once it is close or past. */
export function DocumentExpiryCell({ doc }: { doc: DocumentRecord }) {
  if (!documentNeedsExpiry(doc.name)) return <span className="text-ink-faint">N/A</span>;

  if (doc.status === "pending" && doc.pendingExpiresOn) {
    return (
      <span className="text-[0.86rem]">
        {doc.pendingExpiresOn}
        <span className="block text-[0.76rem] text-ink-faint">Awaiting approval</span>
      </span>
    );
  }
  if (doc.status !== "uploaded") return <span className="text-ink-faint">—</span>;
  if (!doc.expiresOn) return <Tag kind="warn">No expiry date</Tag>;

  const expiry = documentExpiry(doc);
  return (
    <span className="text-[0.86rem]">
      {doc.expiresOn}
      {expiry && (expiry.expired || expiry.expiringSoon) ? (
        <span className="block mt-1">
          <Tag kind={expiry.expired ? "danger" : "warn"}>{expiryPhrase(expiry)}</Tag>
        </span>
      ) : null}
    </span>
  );
}

interface ExpiryDateModalProps {
  open: boolean;
  title: string;
  description?: string;
  /** Stored-format date to start from (e.g. when editing). */
  initialDate?: string | null;
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  /** Called with the chosen date as yyyy-mm-dd. */
  onConfirm: (isoDate: string) => void;
}

/** Asks HR for the expiry date of a PRC / NBI Clearance before uploading it, or to correct it later. */
export function ExpiryDateModal({
  open,
  title,
  description,
  initialDate,
  confirmLabel,
  busy = false,
  onClose,
  onConfirm,
}: ExpiryDateModalProps) {
  const [date, setDate] = useState("");

  useEffect(() => {
    if (open) setDate(toInputDate(initialDate));
  }, [open, initialDate]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (date) onConfirm(date);
  }

  return (
    <Modal open={open} onClose={() => (busy ? null : onClose())} title={title}>
      <form onSubmit={handleSubmit}>
        {description && <p className="text-[0.86rem] text-ink-muted mb-4">{description}</p>}
        <Field label="Expiry date" htmlFor="docExpiryDate" hint="The “valid until” date printed on the document.">
          <input
            id="docExpiryDate"
            type="date"
            className={inputCls}
            value={date}
            min="2000-01-01"
            max="2100-12-31"
            onChange={(e) => setDate(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <div className="flex gap-3 mt-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={busy || !date}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
