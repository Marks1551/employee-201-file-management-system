"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { UploadCloud, Paperclip, Eye, X, ChevronUp, ChevronDown } from "lucide-react";
import Layout from "@/shared/components/Layout";
import NoEmployeeLinked from "@/features/employees/components/NoEmployeeLinked";
import InactiveRecordNotice, { isRecordInactive } from "@/features/employees/components/InactiveRecordNotice";
import { Card, Button, Field, inputCls, Tag } from "@/shared/components/ui";
import { TableWrap, Th, Td } from "@/shared/components/Table";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";
import { DocumentExpiryCell } from "@/features/employees/components/DocumentExpiry";
import { documentNeedsExpiry } from "@/shared/lib/documentExpiry";
import { imagesToPdf } from "@/shared/lib/imagesToPdf";

const MAX_BYTES = 10 * 1024 * 1024;

// Always available regardless of HR's requirements (not tied to a required document).
const generalTypes = ["Training Certificate", "Other"];

export default function SubmitDocument() {
  const { currentEmployee, submitDocument, ready } = useApp();
  const showToast = useToast();
  const [docType, setDocType] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [expiresOn, setExpiresOn] = useState("");
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

  const needsExpiry = documentNeedsExpiry(docType);
  // Any document may be several pages: let the user pick many images at once and merge them into ONE PDF.
  const isMultiPage = true;
  const file = files[0] ?? null;

  if (!ready) return null;
  if (!currentEmployee) return <NoEmployeeLinked eyebrow="Faculty" title="Submit a Document" />;
  if (isRecordInactive(currentEmployee)) {
    return (
      <Layout role="faculty" eyebrow="Faculty" title="Submit a Document">
        <InactiveRecordNotice employee={currentEmployee} />
      </Layout>
    );
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // allow picking the same file again
    if (!picked.length) return;
    if (!isMultiPage) {
      setFiles([picked[0]]);
      return;
    }
    // Multi-page document: several images are added in order; a PDF must be the only file.
    const isPdf = (f: File) => f.type === "application/pdf";
    const next = [...files, ...picked];
    if (next.some(isPdf) && next.length > 1) {
      showToast("Upload either one PDF or several images — not both.");
      return;
    }
    setFiles(next);
  }

  function moveFile(i: number, dir: -1 | 1) {
    setFiles((fs) => {
      const j = i + dir;
      if (j < 0 || j >= fs.length) return fs;
      const copy = [...fs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!files.length || !currentEmployee) return;
    if (needsExpiry && !expiresOn) {
      showToast(`Please enter the expiry date of your ${docType}.`);
      return;
    }
    setSubmitting(true);
    let upload: File = files[0];
    if (files.length > 1) {
      // Several page images → one PDF (the system keeps a single file per document).
      try {
        upload = await imagesToPdf(files, `${docType.replace(/[^\w-]+/g, "_")}.pdf`);
      } catch (err) {
        setSubmitting(false);
        showToast(err instanceof Error ? err.message : "Could not combine the images. Please try again.");
        return;
      }
    }
    if (upload.size > MAX_BYTES) {
      setSubmitting(false);
      showToast("The files are too large (max 10 MB in total). Use fewer or smaller images, or upload a PDF.");
      return;
    }
    const result = await submitDocument(currentEmployee.id, docType, upload, needsExpiry ? expiresOn : undefined);
    setSubmitting(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast("Document submitted. HR will review your upload shortly.");
    setFiles([]);
    setExpiresOn("");
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
            <Field
              label="Choose file"
              htmlFor={fileInputId}
              hint={
                isMultiPage
                  ? "Accepted formats: PDF, JPG, PNG, WEBP. Select as many images as needed. Maximum 10 MB in total."
                  : "Accepted formats: PDF, JPG, PNG. Maximum 10 MB."
              }
            >
              <button
                type="button"
                id={fileInputId}
                onClick={pickFile}
                className={`${inputCls} flex items-center gap-2 text-left ${file ? "text-ink" : "text-ink-faint"} bg-cream cursor-pointer`}
              >
                <Paperclip size={18} className="flex-shrink-0 text-ink-faint" />
                {files.length > 1 ? `${files.length} images selected` : file?.name || "No file chosen"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                multiple={isMultiPage}
                className="hidden"
                onChange={handleFileChange}
              />
            </Field>
            {isMultiPage && (
              <>
                {files.length > 0 && !(files.length === 1 && files[0].type === "application/pdf") && (
                  <ol className="list-none m-0 mb-3 p-0 flex flex-col gap-1.5">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-[0.84rem]"
                      >
                        <span className="font-semibold text-ink-muted w-12 flex-shrink-0">Page {i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => moveFile(i, -1)}
                          className="p-0.5 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={i === files.length - 1}
                          onClick={() => moveFile(i, 1)}
                          className="p-0.5 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => setFiles((fs) => fs.filter((_, k) => k !== i))}
                          className="p-0.5 text-danger-text cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-0 mb-4 p-3 rounded-xl bg-navy-100 text-navy text-[0.84rem]">
                  <strong>Note:</strong> You can select <strong>multiple images</strong> at once (one per page) and
                  reorder them with the arrows; we will combine them into one file. You can also upload{" "}
                  <strong>one PDF</strong> instead.
                </p>
              </>
            )}
            {needsExpiry && (
              <Field
                label="Expiry date"
                htmlFor="docexpiry"
                hint="The “valid until” date printed on your document. HR will be reminded before it expires."
              >
                <input
                  id="docexpiry"
                  type="date"
                  className={inputCls}
                  value={expiresOn}
                  min="2000-01-01"
                  max="2100-12-31"
                  onChange={(e) => setExpiresOn(e.target.value)}
                  required
                />
              </Field>
            )}
            <Button type="submit" disabled={!file || submitting || (needsExpiry && !expiresOn)} className="w-full">
              <UploadCloud size={18} />
              {submitting ? "Submitting…" : "Submit Document"}
            </Button>
          </form>
        </Card>

        <div>
          <h3 className="mb-3">Current document status</h3>
          <TableWrap>
            <table className="w-full border-collapse min-w-[460px]">
              <thead>
                <tr>
                  <Th>Document</Th>
                  <Th>Status</Th>
                  <Th>Expires</Th>
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
                    <Td>
                      <DocumentExpiryCell doc={doc} />
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
