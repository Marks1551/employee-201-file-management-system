import { NextResponse, type NextRequest } from "next/server";
import { requireRole, requireUser, deleteDocumentFile } from "@/shared/server/api-helpers";
import {
  requestNewDocument,
  listRequiredDocTypeDetails,
  removeRequiredDocument,
} from "@/features/employees/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

/** The documents currently required of every employee. */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ requirements: await listRequiredDocTypeDetails() });
}

/** HR asks for a new document. Body: { name: string, employeeId?: string }.
 *  Without employeeId every active employee is asked; with it, only that employee. */
export async function POST(request: NextRequest) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const data = await request.json().catch(() => ({}));
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Document name is required." }, { status: 400 });
  if (name.length > 150)
    return NextResponse.json({ error: "Document name is too long (150 characters max)." }, { status: 400 });
  const employeeId = typeof data.employeeId === "string" && data.employeeId ? data.employeeId : null;

  const result = await requestNewDocument(name, user.name, employeeId);
  if (result.requested === 0) {
    return NextResponse.json(
      {
        error: employeeId
          ? "That employee already has this document."
          : "Everyone already has this document requirement.",
      },
      { status: 409 },
    );
  }

  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Requested new document "${name}" from ${employeeId ? "one employee" : `${result.requested} employees`}`,
  );
  return NextResponse.json({ ok: true, ...result });
}

/** HR stops requiring a document. Body: { name: string, deleteSubmitted?: boolean }.
 *  Removes the requirement and everyone's "missing" row for it; files already submitted are kept
 *  unless deleteSubmitted is true. */
export async function DELETE(request: NextRequest) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const data = await request.json().catch(() => ({}));
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Document name is required." }, { status: 400 });
  const deleteSubmitted = data.deleteSubmitted === true;

  const result = await removeRequiredDocument(name, user.name, deleteSubmitted);
  for (const url of result.fileUrls) await deleteDocumentFile(url);

  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Removed required document "${name}"${deleteSubmitted ? " and deleted submitted files" : ""} (${result.removedRows} record(s) removed)`,
  );
  return NextResponse.json({ ok: true, removedRows: result.removedRows, keptSubmitted: result.keptSubmitted });
}
