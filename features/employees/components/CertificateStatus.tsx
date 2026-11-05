import { Tag } from "@/shared/components/ui";
import { certExpiry } from "@/shared/lib/trainingExpiry";
import type { TrainingRecord } from "@/shared/types";

/** Certificate status tag; for "expiring soon" it also shows the exact expiry date and how many
 *  days are left (or that it has already expired). */
export default function CertificateStatus({ training }: { training: TrainingRecord }) {
  if (training.certStatus === "on-file") return <Tag kind="ok">On file</Tag>;

  const expiry = certExpiry(training);
  let note = "";
  if (training.expiresOn) {
    if (expiry?.expired) note = `Expired on ${training.expiresOn}`;
    else if (expiry)
      note = `Expires ${training.expiresOn} · ${expiry.daysLeft} day${expiry.daysLeft === 1 ? "" : "s"} left`;
    else note = `Expires ${training.expiresOn}`;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {expiry?.expired ? <Tag kind="danger">Expired</Tag> : <Tag kind="warn">Expiring soon</Tag>}
      {note && <span className="text-[0.78rem] text-ink-muted">{note}</span>}
    </div>
  );
}
