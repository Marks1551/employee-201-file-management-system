import { NextResponse, type NextRequest } from "next/server";
import { requireRole, saveDocumentFile, deleteDocumentFile } from "@/shared/server/api-helpers";
import {
  getEmployee,
  markDocumentUploaded,
  clearDocumentFile,
  updateDocumentExpiry,
} from "@/features/employees/server/service";
import { documentNeedsExpiry, parseExpiryInput } from "@/shared/lib/documentExpiry";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";
import type { StoredFile } from "@/shared/types";

type RouteParams = { params: Promise<{ id: string; docId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id, docId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");

  // PRC and NBI Clearance carry an expiry date (yyyy-mm-dd from the date picker).
  const docRecord = employee.documents.find((d) => d.id === docId);
  const expiry = parseExpiryInput(formData.get("expiresOn"));
  if (!expiry.ok) return NextResponse.json({ error: "Enter a valid expiry date." }, { status: 400 });
  if (documentNeedsExpiry(docRecord?.name) && !expiry.value) {
    return NextResponse.json({ error: `An expiry date is required for ${docRecord?.name}.` }, { status: 400 });
  }

  let fileInfo: StoredFile | undefined;
  if (file && typeof file !== "string") {
    const saved = await saveDocumentFile(file, id, docId);
    if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
    fileInfo = saved;
  }

  const keptRejectedFile = employee.documents.find((d) => d.id === docId)?.pendingFileUrl;
  const docName = await markDocumentUploaded(
    id,
    docId,
    fileInfo,
    documentNeedsExpiry(docRecord?.name) ? expiry.value : null,
  );
  await deleteDocumentFile(keptRejectedFile);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Uploaded "${docName || "a document"}" for ${employee.displayName} (#${employee.employeeNumber})` +
      (documentNeedsExpiry(docRecord?.name) && expiry.value ? ` — expires ${expiry.value}` : ""),
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id, docId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const doc = employee.documents.find((d) => d.id === docId);
  const oldFileUrl = await clearDocumentFile(id, docId);
  await deleteDocumentFile(oldFileUrl);
  await deleteDocumentFile(doc?.pendingFileUrl);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Removed "${doc?.name || "a document"}" for ${employee.displayName} (#${employee.employeeNumber})`,
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

/** HR sets or corrects the expiry date of an approved document. Body: { expiresOn: "yyyy-mm-dd" }. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id, docId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const expiry = parseExpiryInput(body?.expiresOn);
  if (!expiry.ok || !expiry.value) return NextResponse.json({ error: "Enter a valid expiry date." }, { status: 400 });

  const docName = await updateDocumentExpiry(id, docId, expiry.value);
  if (!docName) {
    return NextResponse.json({ error: "Only an approved document can have its expiry date changed." }, { status: 400 });
  }
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Set expiry of "${docName}" for ${employee.displayName} (#${employee.employeeNumber}) to ${expiry.value}`,
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
