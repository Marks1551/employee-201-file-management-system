"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { UploadCloud, Paperclip, Eye } from "lucide-react";
import Layout from "@/shared/components/Layout";
import NoEmployeeLinked from "@/features/employees/components/NoEmployeeLinked";
import { Card, Button, Field, inputCls, Tag } from "@/shared/components/ui";
import { TableWrap, Th, Td } from "@/shared/components/Table";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";

// Always available regardless of HR's requirements (not tied to a required document).
const generalTypes = ["Training Certificate", "Other"];

export default function SubmitDocument() {
  const { currentEmployee, submitDocument, ready } = useApp();
  const showToast = useToast();
  const [docType, setDocType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = "docfile";

  // The documents HR currently requires (built-in + added by HR, minus anything HR has removed).
  const [required, setRequired] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents/requirements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.requirements) setRequired(d.requirements.map((r: { name: string }) => r.name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Choices = documents HR is waiting on from this employee (including one-off requests), then
  // the currently required documents, then the general types. A document HR has stopped
  // requiring no longer appears, even if a copy is still on file.
  const options = useMemo(() => {
    const docs = currentEmployee?.documents || [];
    const needed = docs.filter((d) => d.status === "missing" || d.status === "rejected").map((d) => d.name);
    return {
      needed,
      all: Array.from(new Set([...needed, ...required, ...generalTypes])),
    };
  }, [currentEmployee?.documents, required]);

  useEffect(() => {
    if (!docType && options.all.length) setDocType(options.needed[0] || options.all[0]);
  }, [docType, options]);

  if (!ready) return null;
  if (!currentEmployee) return <NoEmployeeLinked eyebrow="Faculty" title="Submit a Document" />;

  function pickFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] || null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !currentEmployee) return;
    setSubmitting(true);
    const result = await submitDocument(currentEmployee.id, docType, file);
    setSubmitting(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast("Document submitted. HR will review your upload shortly.");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Layout role="faculty" eyebrow="Faculty" title="Submit a Document">
      <p className="text-ink-muted mb-6">
        Upload a missing or updated file below. HR will review it and update your 201 file.
      </p>

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <Card>
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-admin-bg text-admin-text flex items-center justify-center flex-shrink-0">
              <UploadCloud size={22} />
            </div>
            <div>
              <h3 className="mb-0.5">Submit a document</h3>
              <p className="m-0 text-[0.86rem] text-ink-muted">Choose a document type and attach your file.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <Field label="Document type" htmlFor="doctype">
              <select
                id="doctype"
                className={inputCls}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                required
              >
                {options.all.map((d) => (
                  <option key={d} value={d}>
                    {options.needed.includes(d) ? `${d} — needed` : d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Choose file" htmlFor={fileInputId} hint="Accepted formats: PDF, JPG, PNG. Maximum 10 MB.">
              <button
                type="button"
                id={fileInputId}
                onClick={pickFile}
                className={`${inputCls} flex items-center gap-2 text-left ${file ? "text-ink" : "text-ink-faint"} bg-cream cursor-pointer`}
              >
                <Paperclip size={18} className="flex-shrink-0 text-ink-faint" />
                {file?.name || "No file chosen"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={handleFileChange}
              />
            </Field>
            <Button type="submit" disabled={!file || submitting} className="w-full">
              <UploadCloud size={18} />
              {submitting ? "Submitting…" : "Submit Document"}
            </Button>
          </form>
        </Card>

        <div>
          <h3 className="mb-3">Current document status</h3>
          <TableWrap>
            <table className="w-full border-collapse min-w-[380px]">
              <thead>
                <tr>
                  <Th>Document</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {currentEmployee.documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#FBFAF7]">
                    <Td className="font-semibold text-ink">{doc.name}</Td>
                    <Td>
                      {doc.status === "uploaded" && <Tag kind="ok">Uploaded</Tag>}
                      {doc.status === "pending" && <Tag kind="warn">Pending Review</Tag>}
                      {doc.status === "rejected" && <Tag kind="danger">Rejected — resubmit</Tag>}
                      {doc.status === "missing" && <Tag kind="danger">Missing</Tag>}
                      {doc.status === "rejected" && doc.reviewNote && (
                        <p className="mt-1 mb-0 text-[0.78rem] text-ink-faint">HR note: {doc.reviewNote}</p>
                      )}
                      {doc.status === "rejected" && doc.pendingFileUrl && (
                        <a
                          href={doc.pendingFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-navy font-semibold text-[0.82rem] no-underline hover:underline"
                        >
                          <Eye size={14} />
                          View rejected file
                        </a>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </div>
    </Layout>
  );
}
