"use client";

import { useState, type ReactNode } from "react";
import { FileDown, Eye, Download } from "lucide-react";
import Layout from "@/shared/components/Layout";
import NoEmployeeLinked from "@/features/employees/components/NoEmployeeLinked";
import Tabs from "@/shared/components/Tabs";
import { Card, Tag, Avatar, Button } from "@/shared/components/ui";
import { TableWrap, Th, Td } from "@/shared/components/Table";
import { useApp } from "@/shared/context/AppContext";
import { exportPds } from "@/shared/lib/pds";
import { documentCompletion } from "@/shared/lib/documentCompletion";
import Modal from "@/shared/components/Modal";
import { downloadHref } from "@/shared/lib/downloadUrl";
import type { DocumentRecord } from "@/shared/types";
import PdsDetailsForm from "@/features/employees/components/PdsDetailsForm";
import RecordManager from "@/features/employees/components/RecordManager";
import GovernmentBenefitsForm from "@/features/employees/components/GovernmentBenefitsForm";

interface ReadOnlyColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
}

/** The file a faculty member can open for one of their documents: the approved file, or the
 *  copy they submitted that is still pending / was rejected. */
function fileFor(d: DocumentRecord): { url: string; name: string | null; type: string | null; note: string } | null {
  if (d.status === "uploaded" && d.fileUrl)
    return { url: d.fileUrl, name: d.fileName, type: d.fileType, note: "Approved file on your 201 file." };
  if (d.status === "pending" && d.pendingFileUrl)
    return {
      url: d.pendingFileUrl,
      name: d.pendingFileName,
      type: d.pendingFileType,
      note: "Your submission — waiting for HR to review.",
    };
  if (d.status === "rejected" && d.pendingFileUrl)
    return {
      url: d.pendingFileUrl,
      name: d.pendingFileName,
      type: d.pendingFileType,
      note: "This submission was rejected. Please submit a corrected copy.",
    };
  if (d.fileUrl) return { url: d.fileUrl, name: d.fileName, type: d.fileType, note: "Current file on your 201 file." };
  return null;
}

function readOnlyTable<T extends { id: string }>(items: T[], columns: ReadOnlyColumn<T>[], emptyMessage: string) {
  return (
    <TableWrap>
      <table className="w-full border-collapse min-w-[500px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <Th key={c.key}>{c.label}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <Td colSpan={columns.length} className="text-ink-faint">
                {emptyMessage}
              </Td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-[#FBFAF7]">
              {columns.map((c, i) => (
                <Td key={c.key} className={i === 0 ? "font-semibold text-ink" : ""}>
                  {c.render ? c.render(item) : (item as Record<string, ReactNode>)[c.key] || "—"}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export default function Faculty201File() {
  const {
    currentEmployee,
    ready,
    addEducation,
    updateEducation,
    deleteEducation,
    addWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,
  } = useApp();
  const [viewDoc, setViewDoc] = useState<DocumentRecord | null>(null);
  if (!ready) return null;
  if (!currentEmployee) return <NoEmployeeLinked eyebrow="Faculty" title="My 201 File" />;
  const { missingCount, rejectedCount, isComplete } = documentCompletion(currentEmployee.documents);
  const pendingCount = currentEmployee.documents.filter((d) => d.status === "pending").length;

  return (
    <Layout role="faculty" eyebrow="Faculty" title="My 201 File">
      <Card className="flex gap-5 items-center flex-wrap mb-6">
        <Avatar photoUrl={currentEmployee.photoUrl} initials={currentEmployee.initials} color="faculty" size="lg" />
        <div className="flex-1 min-w-[200px]">
          <h2 className="mb-1">{currentEmployee.displayName}</h2>
          <p className="text-ink-muted text-[0.86rem] m-0">
            Employee #{currentEmployee.employeeNumber} &nbsp;&middot;&nbsp; {currentEmployee.position}{" "}
            &nbsp;&middot;&nbsp; {currentEmployee.department}
          </p>
        </div>
        {isComplete ? (
          <Tag kind="ok">Complete</Tag>
        ) : (
          <Tag kind="danger">
            {[
              missingCount > 0 ? `${missingCount} document${missingCount > 1 ? "s" : ""} missing` : null,
              rejectedCount > 0 ? `${rejectedCount} rejected` : null,
            ]
              .filter(Boolean)
              .join(", ")}
          </Tag>
        )}
        {pendingCount > 0 && <Tag kind="warn">{pendingCount} awaiting HR review</Tag>}
        <Button variant="secondary" onClick={() => exportPds(currentEmployee)}>
          <FileDown size={18} />
          Export PDS
        </Button>
      </Card>

      <p className="text-ink-muted text-[0.86rem] mb-5">
        This is your personal record. You can update your own PDS details, educational background and work experience
        &mdash; HR is notified whenever you do. For anything else that looks incorrect, please contact HR.
      </p>

      <Tabs
        tabs={[
          {
            key: "info",
            label: "Employment Info",
            content: (
              <Card>
                <div className="grid gap-x-8 md:grid-cols-2">
                  <div>
                    <InfoRow label="Full name" value={currentEmployee.fullName} />
                    <InfoRow label="Date of birth" value={currentEmployee.dob} />
                    <InfoRow label="Civil status" value={currentEmployee.civilStatus} />
                    <InfoRow label="Contact number" value={currentEmployee.contact} />
                    <InfoRow label="Email address" value={currentEmployee.email} last />
                  </div>
                  <div>
                    <InfoRow label="Department" value={currentEmployee.department} />
                    <InfoRow label="Position" value={currentEmployee.position} />
                    <InfoRow label="Date hired" value={currentEmployee.dateHired} />
                    <InfoRow
                      label="Employment status"
                      value={
                        <Tag kind={currentEmployee.employmentStatus === "Regular" ? "ok" : "warn"}>
                          {currentEmployee.employmentStatus}
                        </Tag>
                      }
                    />
                    {currentEmployee.employmentStatus !== "Regular" && (
                      <>
                        <InfoRow label="Contract start" value={currentEmployee.contractStart || "—"} />
                        <InfoRow label="Contract end" value={currentEmployee.contractEnd || "—"} last />
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ),
          },
          {
            key: "documents",
            label: "My Documents",
            content: readOnlyTable(
              currentEmployee.documents,
              [
                { key: "name", label: "Document" },
                {
                  key: "status",
                  label: "Status",
                  render: (d) =>
                    d.status === "uploaded" ? (
                      <Tag kind="ok">Uploaded</Tag>
                    ) : d.status === "pending" ? (
                      <Tag kind="warn">Pending Review</Tag>
                    ) : d.status === "rejected" ? (
                      <Tag kind="danger">Rejected</Tag>
                    ) : (
                      <Tag kind="danger">Missing</Tag>
                    ),
                },
                { key: "uploaded", label: "Uploaded" },
                {
                  key: "reviewNote",
                  label: "Note",
                  render: (d) => (d.status === "rejected" && d.reviewNote ? d.reviewNote : "—"),
                },
                {
                  key: "file",
                  label: "File",
                  render: (d) => {
                    const f = fileFor(d);
                    return f ? (
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setViewDoc(d)}
                          className="inline-flex items-center gap-1 text-navy font-semibold bg-transparent border-none p-0 cursor-pointer hover:underline"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <a
                          href={downloadHref(f.url, f.name)}
                          className="inline-flex items-center gap-1 text-navy font-semibold no-underline hover:underline"
                        >
                          <Download size={14} />
                          Download
                        </a>
                      </span>
                    ) : (
                      "—"
                    );
                  },
                },
              ],
              "No documents on file yet.",
            ),
          },
          {
            key: "education",
            label: "Educational Background",
            content: (
              <RecordManager
                items={currentEmployee.education}
                typeLabel="education record"
                addButtonLabel="Add Education"
                emptyMessage="No educational background on file yet."
                employeeName={currentEmployee.displayName}
                itemLabel={(r) => r.schoolName}
                fields={[
                  {
                    key: "level",
                    label: "Level",
                    type: "select",
                    options: ["Elementary", "Secondary", "Vocational / Trade", "College", "Graduate Studies"],
                  },
                  { key: "schoolName", label: "School / institution", required: true },
                  { key: "degree", label: "Degree / course", hint: "e.g. BS Computer Science" },
                  { key: "yearGraduated", label: "Year graduated", hint: "e.g. 2015" },
                  { key: "honors", label: "Honors / awards", hint: "e.g. Cum Laude (optional)" },
                ]}
                emptyForm={{ level: "College", schoolName: "", degree: "", yearGraduated: "", honors: "" }}
                columns={[
                  { key: "level", label: "Level" },
                  { key: "schoolName", label: "School" },
                  { key: "degree", label: "Degree / Course" },
                  { key: "yearGraduated", label: "Year Graduated" },
                  { key: "honors", label: "Honors" },
                ]}
                onAdd={(data) => addEducation(currentEmployee.id, data)}
                onUpdate={(recordId, patch) => updateEducation(currentEmployee.id, recordId, patch)}
                onDelete={(recordId) => deleteEducation(currentEmployee.id, recordId)}
              />
            ),
          },
          {
            key: "training",
            label: "Training",
            content: readOnlyTable(
              currentEmployee.training,
              [
                { key: "course", label: "Training / Course" },
                { key: "provider", label: "Provider" },
                { key: "completed", label: "Completed" },
                {
                  key: "certStatus",
                  label: "Certificate",
                  render: (t) =>
                    t.certStatus === "on-file" ? <Tag kind="ok">On file</Tag> : <Tag kind="warn">Expiring soon</Tag>,
                },
              ],
              "No training records on file yet.",
            ),
          },
          {
            key: "workExperience",
            label: "Work Experience",
            content: (
              <RecordManager
                items={currentEmployee.workExperience}
                typeLabel="work experience record"
                addButtonLabel="Add Work Experience"
                emptyMessage="No prior work experience on file yet."
                employeeName={currentEmployee.displayName}
                itemLabel={(r) => `${r.position ? `${r.position} at ` : ""}${r.company}`}
                fields={[
                  { key: "company", label: "Company / employer", required: true },
                  { key: "position", label: "Position" },
                  { key: "fromDate", label: "From", type: "date" },
                  { key: "toDate", label: "To", type: "date", hint: "Leave blank if current" },
                  {
                    key: "statusOfAppointment",
                    label: "Status of Appointment",
                    hint: "e.g. Permanent, Contractual, Casual",
                  },
                  {
                    key: "govtService",
                    label: "Government Service?",
                    type: "select",
                    options: [
                      { value: "", label: "—" },
                      { value: "Y", label: "Yes" },
                      { value: "N", label: "No" },
                    ],
                  },
                  {
                    key: "description",
                    label: "Description",
                    type: "textarea",
                    hint: "Key responsibilities (optional)",
                  },
                ]}
                emptyForm={{
                  company: "",
                  position: "",
                  fromDate: "",
                  toDate: "",
                  statusOfAppointment: "",
                  govtService: "",
                  description: "",
                }}
                columns={[
                  { key: "company", label: "Company" },
                  { key: "position", label: "Position" },
                  { key: "fromDate", label: "From" },
                  { key: "toDate", label: "To", render: (r) => r.toDate || "Present" },
                ]}
                onAdd={(data) => addWorkExperience(currentEmployee.id, data)}
                onUpdate={(recordId, patch) => updateWorkExperience(currentEmployee.id, recordId, patch)}
                onDelete={(recordId) => deleteWorkExperience(currentEmployee.id, recordId)}
              />
            ),
          },
          {
            key: "performance",
            label: "Performance",
            content: readOnlyTable(
              currentEmployee.performance,
              [
                { key: "period", label: "Period" },
                {
                  key: "rating",
                  label: "Rating",
                  render: (r) => (
                    <Tag
                      kind={
                        r.rating === "Outstanding" || r.rating === "Very Satisfactory"
                          ? "ok"
                          : r.rating === "Needs Improvement" || r.rating === "Unsatisfactory"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {r.rating || "—"}
                    </Tag>
                  ),
                },
                { key: "reviewer", label: "Reviewed By" },
                { key: "remarks", label: "Remarks" },
              ],
              "No performance reviews on file yet.",
            ),
          },
          {
            key: "pds",
            label: "PDS Details",
            content: <PdsDetailsForm employee={currentEmployee} />,
          },
          {
            key: "benefits",
            label: "Government Benefits",
            content: <GovernmentBenefitsForm employee={currentEmployee} readOnly />,
          },
          {
            key: "attendance",
            label: "Attendance",
            content: readOnlyTable(
              currentEmployee.attendance,
              [
                { key: "period", label: "Period" },
                { key: "daysPresent", label: "Present" },
                { key: "daysAbsent", label: "Absent" },
                { key: "daysLate", label: "Late" },
                { key: "remarks", label: "Remarks" },
              ],
              "No attendance records on file yet.",
            ),
          },
        ]}
      />

      <Modal open={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.name || ""} wide>
        {(() => {
          const f = viewDoc ? fileFor(viewDoc) : null;
          if (!viewDoc || !f) return null;
          return (
            <div>
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                {viewDoc.status === "uploaded" && <Tag kind="ok">Uploaded</Tag>}
                {viewDoc.status === "pending" && <Tag kind="warn">Pending Review</Tag>}
                {viewDoc.status === "rejected" && <Tag kind="danger">Rejected</Tag>}
                <span className="text-[0.86rem] text-ink-muted">{f.note}</span>
              </div>
              {viewDoc.status === "rejected" && viewDoc.reviewNote && (
                <p className="text-[0.86rem] text-ink-muted mb-3">Reason: {viewDoc.reviewNote}</p>
              )}
              {f.type?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.url}
                  alt={viewDoc.name}
                  className="w-full max-h-[70vh] object-contain rounded-xl border border-border bg-navy-100"
                />
              ) : (
                <iframe src={f.url} title={viewDoc.name} className="w-full h-[70vh] rounded-xl border border-border" />
              )}
              <div className="mt-3">
                <a
                  href={downloadHref(f.url, f.name)}
                  className="text-navy font-semibold text-[0.86rem] no-underline hover:underline"
                >
                  Download
                </a>
              </div>
            </div>
          );
        })()}
      </Modal>
    </Layout>
  );
}

interface InfoRowProps {
  label: string;
  value: ReactNode;
  last?: boolean;
}

function InfoRow({ label, value, last }: InfoRowProps) {
  return (
    <div className={last ? "" : "mb-4"}>
      <p className="text-[0.82rem] text-ink-faint mb-0.5">{label}</p>
      <p className="mb-0">{value}</p>
    </div>
  );
}
