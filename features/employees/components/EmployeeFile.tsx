'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Pencil, Eye, Camera, Trash2, Plus, UploadCloud, FileDown } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import Tabs from '@/shared/components/Tabs';
import { Card, Button, Tag, Field, inputCls, Avatar } from '@/shared/components/ui';
import { TableWrap, Th, Td } from '@/shared/components/Table';
import Modal from '@/shared/components/Modal';
import RecordManager from '@/features/employees/components/RecordManager';
import PdsDetailsForm from '@/features/employees/components/PdsDetailsForm';
import GovernmentBenefitsForm from '@/features/employees/components/GovernmentBenefitsForm';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';
import { DEACTIVATION_REASONS, EMPLOYMENT_STATUSES, DEPARTMENTS } from '@/shared/lib/roles';
import { exportEmployeeProfile } from '@/shared/lib/employeeExport';
import { documentCompletion } from '@/shared/lib/documentCompletion';
import type { Employee, DocumentRecord, TrainingRecord } from '@/shared/types';

export default function HREmployeeFile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    employees, updateEmployee, setEmployeeStatus, deleteEmployee, uploadDocument, removeDocument,
    approveDocument, rejectDocument,
    uploadEmployeePhoto, removeEmployeePhoto,
    addTraining, updateTraining, deleteTraining, uploadTrainingCertificate, removeTrainingCertificate,
    addEducation, updateEducation, deleteEducation,
    addWorkExperience, updateWorkExperience, deleteWorkExperience,
    addPerformanceReview, updatePerformanceReview, deletePerformanceReview,
    addAttendanceRecord, updateAttendanceRecord, deleteAttendanceRecord,
    currentUser, ready,
  } = useApp();
  const showToast = useToast();
  const employee = employees.find((e) => e.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocumentRecord | null>(null);
  const [viewCert, setViewCert] = useState<TrainingRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [form, setForm] = useState<Employee | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const pendingDocId = useRef<string | null>(null);
  const [docBusyId, setDocBusyId] = useState<string | null>(null);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const certInputRef = useRef<HTMLInputElement>(null);
  const pendingCertTrainingId = useRef<string | null>(null);
  const [certBusyId, setCertBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !employee) router.replace('/hr/employees');
  }, [ready, employee, router]);

  if (!employee) return null;

  const { missingCount, rejectedCount, isComplete } = documentCompletion(employee.documents);
  const pendingCount = employee.documents.filter((d) => d.status === 'pending').length;

  function openEdit() {
    if (!employee) return;
    setForm({ ...employee });
    setEditOpen(true);
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!employee || !form) return;
    updateEmployee(employee.id, form);
    setEditOpen(false);
    showToast(`Saved changes for ${employee.displayName}.`);
  }

  function handleUploadClick(docId: string) {
    pendingDocId.current = docId;
    docInputRef.current?.click();
  }

  async function handleDocFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const docId = pendingDocId.current;
    pendingDocId.current = null;
    if (!file || !docId || !employee) return;
    setDocBusyId(docId);
    const result = await uploadDocument(employee.id, docId, file);
    setDocBusyId(null);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Document uploaded.');
  }

  async function handleRemoveDoc(docId: string) {
    if (!employee) return;
    setDocBusyId(docId);
    const result = await removeDocument(employee.id, docId);
    setDocBusyId(null);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Document removed.');
  }

  async function handleApproveDoc(docId: string) {
    if (!employee) return;
    setDocBusyId(docId);
    const result = await approveDocument(employee.id, docId);
    setDocBusyId(null);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Document approved and applied to the 201 file.');
  }

  function openRejectModal(docId: string) {
    setRejectDocId(docId);
    setRejectNote('');
  }

  function closeRejectModal() {
    setRejectDocId(null);
    setRejectNote('');
  }

  async function handleConfirmReject(e: FormEvent) {
    e.preventDefault();
    if (!employee || !rejectDocId) return;
    setRejectBusy(true);
    const result = await rejectDocument(employee.id, rejectDocId, rejectNote);
    setRejectBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Document rejected. Faculty will be asked to resubmit.');
    closeRejectModal();
  }

  function handleUploadCertClick(trainingId: string) {
    pendingCertTrainingId.current = trainingId;
    certInputRef.current?.click();
  }

  async function handleCertFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const trainingId = pendingCertTrainingId.current;
    pendingCertTrainingId.current = null;
    if (!file || !trainingId || !employee) return;
    setCertBusyId(trainingId);
    const result = await uploadTrainingCertificate(employee.id, trainingId, file);
    setCertBusyId(null);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Certificate uploaded.');
  }

  async function handleRemoveCert(trainingId: string) {
    if (!employee) return;
    setCertBusyId(trainingId);
    const result = await removeTrainingCertificate(employee.id, trainingId);
    setCertBusyId(null);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Certificate removed.');
  }

  function handleExportProfile() {
    if (!employee) return;
    exportEmployeeProfile(employee);
    showToast('Opening the employee 201 file summary for export…');
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !employee) return;
    setPhotoBusy(true);
    const result = await uploadEmployeePhoto(employee.id, file);
    setPhotoBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Photo updated.');
  }

  async function handlePhotoRemove() {
    if (!employee) return;
    setPhotoBusy(true);
    const result = await removeEmployeePhoto(employee.id);
    setPhotoBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast('Photo removed.');
  }

  function closeDeactivate() {
    setDeactivateOpen(false);
    setDeactivateReason('');
  }

  async function handleDeactivate(e: FormEvent) {
    e.preventDefault();
    if (!deactivateReason || !employee) return;
    setStatusBusy(true);
    const result = await setEmployeeStatus(employee.id, 'inactive', deactivateReason);
    setStatusBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`${employee.displayName} was marked inactive (${deactivateReason}).`);
    closeDeactivate();
  }

  async function handleReactivate() {
    if (!employee) return;
    setStatusBusy(true);
    const result = await setEmployeeStatus(employee.id, 'active');
    setStatusBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`${employee.displayName} was reactivated.`);
  }

  async function handleDelete() {
    if (!employee) return;
    setDeleting(true);
    const result = await deleteEmployee(employee.id);
    setDeleting(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    setDeleteOpen(false);
    showToast(`Deleted the record for ${employee.displayName}.`);
    router.push('/hr/employees');
  }

  return (
    <Layout role="hr" eyebrow="HR › Employee Records" title="201 File">
      <div className="flex items-center gap-2 text-[0.86rem] text-ink-faint mb-3.5">
        <Link href="/hr/employees" className="text-ink-muted no-underline hover:text-navy hover:underline font-medium">Employee Records</Link>
        <ChevronRight size={14} />
        <span>{employee.displayName}</span>
      </div>

      <Card className="flex gap-5 items-center flex-wrap mb-6">
        <div className="relative group flex-shrink-0">
          <Avatar photoUrl={employee.photoUrl} initials={employee.initials} color="hr" size="lg" />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoBusy}
            title="Change photo"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center border-2 border-white hover:bg-navy-dark disabled:opacity-50 cursor-pointer"
          >
            <Camera size={14} />
          </button>
          {employee.photoUrl && (
            <button
              type="button"
              onClick={handlePhotoRemove}
              disabled={photoBusy}
              title="Remove photo"
              className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-white text-danger-text flex items-center justify-center border-2 border-white shadow-card hover:bg-danger-bg disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          )}
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
          <input ref={docInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={handleDocFileChange} />
          <input ref={certInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={handleCertFileChange} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <h2 className="mb-1">{employee.displayName}</h2>
          <p className="text-ink-muted text-[0.86rem] m-0">
            Employee #{employee.employeeNumber} &nbsp;&middot;&nbsp; {employee.position} &nbsp;&middot;&nbsp; {employee.department}
          </p>
        </div>
        {(employee.status || 'active') === 'active' ? <Tag kind="ok">Active</Tag> : <Tag kind="neutral">Inactive</Tag>}
        {isComplete ? (
          <Tag kind="ok">Complete</Tag>
        ) : (
          <Tag kind="danger">
            {[
              missingCount > 0 ? `${missingCount} document${missingCount > 1 ? 's' : ''} missing` : null,
              rejectedCount > 0 ? `${rejectedCount} rejected` : null,
            ]
              .filter(Boolean)
              .join(', ')}
          </Tag>
        )}
        {pendingCount > 0 && <Tag kind="warn">{pendingCount} awaiting review</Tag>}
        <Button variant="secondary" onClick={handleExportProfile}>
          <FileDown size={18} />
          Export
        </Button>
        <Button variant="secondary" onClick={openEdit}>
          <Pencil size={18} />
          Edit
        </Button>
        {(employee.status || 'active') === 'active' ? (
          <Button variant="danger" onClick={() => setDeactivateOpen(true)}>Deactivate</Button>
        ) : (
          <Button variant="secondary" onClick={handleReactivate} disabled={statusBusy}>Reactivate</Button>
        )}
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={18} />
          Delete
        </Button>
      </Card>

      <Tabs
        tabs={[
          {
            key: 'personal',
            label: 'Personal Info',
            content: (
              <Card>
                <div className="grid gap-x-8 md:grid-cols-2">
                  <div>
                    <InfoRow label="Full name" value={employee.fullName} />
                    <InfoRow label="Date of birth" value={employee.dob} />
                    <InfoRow label="Civil status" value={employee.civilStatus} />
                    <InfoRow label="Nationality" value={employee.nationality} last />
                  </div>
                  <div>
                    <InfoRow label="Contact number" value={employee.contact} />
                    <InfoRow label="Email address" value={employee.email} />
                    <InfoRow label="Address" value={employee.address} last />
                  </div>
                </div>
              </Card>
            ),
          },
          {
            key: 'employment',
            label: 'Employment',
            content: (
              <Card>
                <div className="grid gap-x-8 md:grid-cols-2">
                  <div>
                    <InfoRow label="Employee number" value={employee.employeeNumber} />
                    <InfoRow label="Department" value={employee.department} />
                    <InfoRow label="Position" value={employee.position} />
                    <InfoRow label="Employment type" value={employee.employmentType} />
                    <InfoRow label="Contract start" value={employee.contractStart || '—'} last />
                  </div>
                  <div>
                    <InfoRow label="Date hired" value={employee.dateHired} />
                    <InfoRow label="Employment status" value={<Tag kind={employee.employmentStatus === 'Regular' ? 'ok' : 'warn'}>{employee.employmentStatus}</Tag>} />
                    <InfoRow
                      label="Contract end"
                      value={employee.employmentStatus === 'Regular' ? 'Not applicable' : (employee.contractEnd || '—')}
                    />
                    <InfoRow
                      label="Record status"
                      value={
                        (employee.status || 'active') === 'active'
                          ? <Tag kind="ok">Active</Tag>
                          : <Tag kind="neutral">Inactive — {employee.deactivationReason} ({employee.deactivatedAt})</Tag>
                      }
                    />
                    <InfoRow label="Immediate supervisor" value={employee.supervisor} last />
                  </div>
                </div>
              </Card>
            ),
          },
          {
            key: 'documents',
            label: 'Documents',
            content: (
              <TableWrap>
                <table className="w-full border-collapse min-w-[560px]">
                  <thead>
                    <tr>
                      <Th>Document</Th>
                      <Th>Status</Th>
                      <Th>Uploaded</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee.documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#FBFAF7]">
                        <Td className="font-semibold text-ink">{doc.name}</Td>
                        <Td>
                          {doc.status === 'uploaded' && <Tag kind="ok">Uploaded</Tag>}
                          {doc.status === 'pending' && <Tag kind="warn">Pending Review</Tag>}
                          {doc.status === 'rejected' && <Tag kind="danger">Rejected</Tag>}
                          {doc.status === 'missing' && <Tag kind="danger">Missing</Tag>}
                        </Td>
                        <Td>{doc.uploaded || '—'}</Td>
                        <Td>
                          {doc.status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button variant="secondary" sm onClick={() => setViewDoc(doc)}><Eye size={16} />Review</Button>
                              <Button variant="primary" sm onClick={() => handleApproveDoc(doc.id)} disabled={docBusyId === doc.id}>
                                {docBusyId === doc.id ? 'Approving…' : 'Approve'}
                              </Button>
                              <Button variant="danger" sm onClick={() => openRejectModal(doc.id)} disabled={docBusyId === doc.id}>
                                Reject
                              </Button>
                            </div>
                          ) : doc.status === 'uploaded' ? (
                            <div className="flex gap-2">
                              <Button variant="ghost" sm onClick={() => setViewDoc(doc)}><Eye size={16} />View</Button>
                              <Button variant="danger" sm onClick={() => handleRemoveDoc(doc.id)} disabled={docBusyId === doc.id}>
                                <Trash2 size={14} />
                                {docBusyId === doc.id ? 'Removing…' : 'Remove'}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button variant="secondary" sm onClick={() => handleUploadClick(doc.id)} disabled={docBusyId === doc.id}>
                                <UploadCloud size={14} />
                                {docBusyId === doc.id ? 'Uploading…' : 'Upload'}
                              </Button>
                              {doc.status === 'rejected' && doc.reviewNote && (
                                <span className="text-[0.78rem] text-ink-faint" title={doc.reviewNote}>Reason: {doc.reviewNote}</span>
                              )}
                            </div>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ),
          },
          {
            key: 'training',
            label: 'Training',
            content: (
              <RecordManager
                items={employee.training}
                typeLabel="training record"
                addButtonLabel="Add Training"
                emptyMessage="No training records on file yet."
                employeeName={employee.displayName}
                itemLabel={(t) => t.course}
                fields={[
                  { key: 'course', label: 'Course / training title', required: true },
                  { key: 'provider', label: 'Provider' },
                  { key: 'fromDate', label: 'From', hint: 'e.g. August 2026' },
                  { key: 'completed', label: 'To / Date completed', hint: 'e.g. August 2026' },
                  { key: 'hours', label: 'Number of hours' },
                  { key: 'ldType', label: 'Type of L&D', hint: 'Managerial, Supervisory, Technical, etc.' },
                  { key: 'conductedBy', label: 'Conducted / Sponsored by' },
                  { key: 'certStatus', label: 'Certificate status', type: 'select', options: [{ value: 'on-file', label: 'On file' }, { value: 'expiring', label: 'Expiring soon' }] },
                ]}
                emptyForm={{ course: '', provider: '', fromDate: '', completed: '', hours: '', ldType: '', conductedBy: '', certStatus: 'on-file' }}
                columns={[
                  { key: 'course', label: 'Training / Course' },
                  { key: 'provider', label: 'Provider' },
                  { key: 'completed', label: 'Completed' },
                  { key: 'certStatus', label: 'Certificate', render: (t) => (t.certStatus === 'on-file' ? <Tag kind="ok">On file</Tag> : <Tag kind="warn">Expiring soon</Tag>) },
                  { key: 'certFile', label: 'Certificate File', render: (t) => (t.certFileUrl ? <Tag kind="ok">Uploaded</Tag> : <Tag kind="neutral">Not uploaded</Tag>) },
                ]}
                onAdd={(data) => addTraining(employee.id, data)}
                onUpdate={(recordId, patch) => updateTraining(employee.id, recordId, patch)}
                onDelete={(recordId) => deleteTraining(employee.id, recordId)}
                rowActions={(t) => (
                  t.certFileUrl ? (
                    <>
                      <Button variant="ghost" sm onClick={() => setViewCert(t)}><Eye size={14} />View Cert</Button>
                      <Button variant="danger" sm onClick={() => handleRemoveCert(t.id)} disabled={certBusyId === t.id}>
                        <Trash2 size={14} />
                        {certBusyId === t.id ? 'Removing…' : 'Remove Cert'}
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" sm onClick={() => handleUploadCertClick(t.id)} disabled={certBusyId === t.id}>
                      <UploadCloud size={14} />
                      {certBusyId === t.id ? 'Uploading…' : 'Upload Certificate'}
                    </Button>
                  )
                )}
              />
            ),
          },
          {
            key: 'education',
            label: 'Educational Background',
            content: (
              <RecordManager
                items={employee.education}
                typeLabel="education record"
                addButtonLabel="Add Education"
                emptyMessage="No educational background on file yet."
                employeeName={employee.displayName}
                itemLabel={(r) => r.schoolName}
                fields={[
                  { key: 'level', label: 'Level', type: 'select', options: ['Elementary', 'Secondary', 'Vocational / Trade', 'College', 'Graduate Studies'] },
                  { key: 'schoolName', label: 'School / institution', required: true },
                  { key: 'degree', label: 'Degree / course', hint: 'e.g. BS Computer Science' },
                  { key: 'yearGraduated', label: 'Year graduated', hint: 'e.g. 2015' },
                  { key: 'honors', label: 'Honors / awards', hint: 'e.g. Cum Laude (optional)' },
                ]}
                emptyForm={{ level: 'College', schoolName: '', degree: '', yearGraduated: '', honors: '' }}
                columns={[
                  { key: 'level', label: 'Level' },
                  { key: 'schoolName', label: 'School' },
                  { key: 'degree', label: 'Degree / Course' },
                  { key: 'yearGraduated', label: 'Year Graduated' },
                  { key: 'honors', label: 'Honors' },
                ]}
                onAdd={(data) => addEducation(employee.id, data)}
                onUpdate={(recordId, patch) => updateEducation(employee.id, recordId, patch)}
                onDelete={(recordId) => deleteEducation(employee.id, recordId)}
              />
            ),
          },
          {
            key: 'workExperience',
            label: 'Work Experience',
            content: (
              <RecordManager
                items={employee.workExperience}
                typeLabel="work experience record"
                addButtonLabel="Add Work Experience"
                emptyMessage="No prior work experience on file yet."
                employeeName={employee.displayName}
                itemLabel={(r) => `${r.position ? `${r.position} at ` : ''}${r.company}`}
                fields={[
                  { key: 'company', label: 'Company / employer', required: true },
                  { key: 'position', label: 'Position' },
                  { key: 'fromDate', label: 'From', hint: 'e.g. June 2015' },
                  { key: 'toDate', label: 'To', hint: 'e.g. May 2019 — leave blank if current' },
                  { key: 'statusOfAppointment', label: 'Status of Appointment', hint: 'e.g. Permanent, Contractual, Casual' },
                  { key: 'govtService', label: 'Government Service?', type: 'select', options: [{ value: '', label: '—' }, { value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }] },
                  { key: 'description', label: 'Description', type: 'textarea', hint: 'Key responsibilities (optional)' },
                ]}
                emptyForm={{ company: '', position: '', fromDate: '', toDate: '', statusOfAppointment: '', govtService: '', description: '' }}
                columns={[
                  { key: 'company', label: 'Company' },
                  { key: 'position', label: 'Position' },
                  { key: 'fromDate', label: 'From' },
                  { key: 'toDate', label: 'To', render: (r) => r.toDate || 'Present' },
                ]}
                onAdd={(data) => addWorkExperience(employee.id, data)}
                onUpdate={(recordId, patch) => updateWorkExperience(employee.id, recordId, patch)}
                onDelete={(recordId) => deleteWorkExperience(employee.id, recordId)}
              />
            ),
          },
          {
            key: 'performance',
            label: 'Performance',
            content: (
              <RecordManager
                items={employee.performance}
                typeLabel="performance review"
                addButtonLabel="Add Performance Review"
                emptyMessage="No performance reviews on file yet."
                employeeName={employee.displayName}
                itemLabel={(r) => r.period}
                fields={[
                  { key: 'period', label: 'Review period', required: true, hint: 'e.g. SY 2025–2026, 1st Semester' },
                  { key: 'rating', label: 'Rating', type: 'select', options: ['Outstanding', 'Very Satisfactory', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory'] },
                  { key: 'reviewer', label: 'Reviewed by' },
                  { key: 'remarks', label: 'Remarks', type: 'textarea' },
                ]}
                emptyForm={{ period: '', rating: 'Satisfactory', reviewer: '', remarks: '' }}
                columns={[
                  { key: 'period', label: 'Period' },
                  { key: 'rating', label: 'Rating', render: (r) => <Tag kind={r.rating === 'Outstanding' || r.rating === 'Very Satisfactory' ? 'ok' : r.rating === 'Needs Improvement' || r.rating === 'Unsatisfactory' ? 'danger' : 'neutral'}>{r.rating || '—'}</Tag> },
                  { key: 'reviewer', label: 'Reviewed By' },
                  { key: 'remarks', label: 'Remarks' },
                ]}
                onAdd={(data) => addPerformanceReview(employee.id, data)}
                onUpdate={(recordId, patch) => updatePerformanceReview(employee.id, recordId, patch)}
                onDelete={(recordId) => deletePerformanceReview(employee.id, recordId)}
              />
            ),
          },
          {
            key: 'pds',
            label: 'PDS Details',
            content: <PdsDetailsForm employee={employee} />,
          },
          {
            key: 'benefits',
            label: 'Government Benefits',
            content: <GovernmentBenefitsForm employee={employee} />,
          },
          {
            key: 'attendance',
            label: 'Attendance',
            content: (
              <RecordManager
                items={employee.attendance}
                typeLabel="attendance record"
                addButtonLabel="Add Attendance Record"
                emptyMessage="No attendance records on file yet."
                employeeName={employee.displayName}
                itemLabel={(r) => r.period}
                fields={[
                  { key: 'period', label: 'Period', required: true, hint: 'e.g. August 2026' },
                  { key: 'daysPresent', label: 'Days present', type: 'number' },
                  { key: 'daysAbsent', label: 'Days absent', type: 'number' },
                  { key: 'daysLate', label: 'Days late', type: 'number' },
                  { key: 'remarks', label: 'Remarks' },
                ]}
                emptyForm={{ period: '', daysPresent: '', daysAbsent: '', daysLate: '', remarks: '' }}
                columns={[
                  { key: 'period', label: 'Period' },
                  { key: 'daysPresent', label: 'Present' },
                  { key: 'daysAbsent', label: 'Absent' },
                  { key: 'daysLate', label: 'Late' },
                  { key: 'remarks', label: 'Remarks' },
                ]}
                onAdd={(data) => addAttendanceRecord(employee.id, data)}
                onUpdate={(recordId, patch) => updateAttendanceRecord(employee.id, recordId, patch)}
                onDelete={(recordId) => deleteAttendanceRecord(employee.id, recordId)}
              />
            ),
          },
        ]}
      />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit — ${employee.displayName}`} wide>
        {form && (
          <form onSubmit={handleSave}>
            <p className="text-[0.78rem] font-bold uppercase tracking-wide text-ink-faint mb-2 mt-0">Personal Information</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Employee number"><input className={inputCls} value={form.employeeNumber || ''} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} /></Field>
              <Field label="Full name"><input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
              <Field label="Display name"><input className={inputCls} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
              <Field label="Date of birth" hint="e.g. March 14, 1989">
                <input className={inputCls} value={form.dob || ''} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </Field>
              <Field label="Civil status" hint="e.g. Single, Married">
                <input className={inputCls} value={form.civilStatus || ''} onChange={(e) => setForm({ ...form, civilStatus: e.target.value })} />
              </Field>
              <Field label="Nationality"><input className={inputCls} value={form.nationality || ''} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></Field>
              <Field label="Contact number"><input className={inputCls} value={form.contact || ''} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
              <Field label="Email address"><input className={inputCls} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            <Field label="Address"><input className={inputCls} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>

            <p className="text-[0.78rem] font-bold uppercase tracking-wide text-ink-faint mb-2 mt-5">Employment Information</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Department">
                <select className={inputCls} value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {form.department && !DEPARTMENTS.includes(form.department as (typeof DEPARTMENTS)[number]) && (
                    <option value={form.department}>{form.department}</option>
                  )}
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Position"><input className={inputCls} value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
              <Field label="Employment type" hint="e.g. Full-time, Part-time">
                <input className={inputCls} value={form.employmentType || ''} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} />
              </Field>
              <Field label="Date hired" hint="e.g. August 5, 2020">
                <input className={inputCls} value={form.dateHired || ''} onChange={(e) => setForm({ ...form, dateHired: e.target.value })} />
              </Field>
              <Field label="Supervisor"><input className={inputCls} value={form.supervisor || ''} onChange={(e) => setForm({ ...form, supervisor: e.target.value })} /></Field>
              <Field label="Employment status">
                <select
                  className={inputCls}
                  value={form.employmentStatus || ''}
                  onChange={(e) => {
                    const employmentStatus = e.target.value;
                    setForm({ ...form, employmentStatus, contractEnd: employmentStatus === 'Regular' ? '' : form.contractEnd });
                  }}
                >
                  {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Contract start" hint="e.g. August 5, 2026">
                <input className={inputCls} value={form.contractStart || ''} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} />
              </Field>
              <Field label="Contract end" hint={form.employmentStatus === 'Regular' ? 'Not applicable for Regular employees' : 'e.g. August 5, 2027'}>
                <input
                  className={inputCls}
                  value={form.contractEnd || ''}
                  onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
                  disabled={form.employmentStatus === 'Regular'}
                />
              </Field>
            </div>
            <Button type="submit" className="w-full mt-4">Save Changes</Button>
          </form>
        )}
      </Modal>

      <Modal open={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.name || ''} wide>
        {viewDoc?.status === 'pending' && viewDoc.pendingFileUrl ? (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Tag kind="warn">Pending Review</Tag>
              <span className="text-[0.86rem] text-ink-muted">Submitted {viewDoc.submitted}. Not yet applied to the 201 file.</span>
            </div>
            {viewDoc.pendingFileType?.startsWith('image/') ? (
              <img src={viewDoc.pendingFileUrl} alt={viewDoc.name} className="w-full max-h-[60vh] object-contain rounded-xl border border-border bg-navy-100" />
            ) : (
              <iframe src={viewDoc.pendingFileUrl} title={viewDoc.name} className="w-full h-[60vh] rounded-xl border border-border" />
            )}
            <div className="flex items-center justify-between mt-3">
              <a href={viewDoc.pendingFileUrl} download={viewDoc.pendingFileName || undefined} className="text-navy font-semibold text-[0.86rem] no-underline hover:underline">
                Download
              </a>
              <div className="flex gap-2">
                <Button
                  variant="primary" sm
                  onClick={() => { if (viewDoc) { handleApproveDoc(viewDoc.id); setViewDoc(null); } }}
                  disabled={docBusyId === viewDoc.id}
                >
                  Approve
                </Button>
                <Button
                  variant="danger" sm
                  onClick={() => { if (viewDoc) { openRejectModal(viewDoc.id); setViewDoc(null); } }}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        ) : viewDoc?.fileUrl ? (
          <div>
            {viewDoc.fileType?.startsWith('image/') ? (
              <img src={viewDoc.fileUrl} alt={viewDoc.name} className="w-full max-h-[70vh] object-contain rounded-xl border border-border bg-navy-100" />
            ) : (
              <iframe src={viewDoc.fileUrl} title={viewDoc.name} className="w-full h-[70vh] rounded-xl border border-border" />
            )}
            <div className="flex items-center justify-between mt-3">
              <p className="text-[0.86rem] text-ink-muted m-0">Uploaded {viewDoc.uploaded}</p>
              <a href={viewDoc.fileUrl} download={viewDoc.fileName || undefined} className="text-navy font-semibold text-[0.86rem] no-underline hover:underline">
                Download
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-navy-100 border border-border rounded-xl p-8 text-center text-ink-muted">
            <p className="mb-1 font-medium">No file on record</p>
            <p className="text-[0.86rem] m-0">Uploaded {viewDoc?.uploaded}. This document was marked uploaded without an attached file.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!rejectDocId} onClose={closeRejectModal} title="Reject document">
        <form onSubmit={handleConfirmReject}>
          <p className="text-[0.86rem] text-ink-muted mb-4">
            The submitted file will be discarded and never applied to the 201 file. Faculty will see this document as rejected and can resubmit.
          </p>
          <Field label="Reason (optional)" htmlFor="rejectNote" hint="Shown to faculty so they know what to fix.">
            <textarea
              id="rejectNote"
              className={inputCls}
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Image is blurry, please re-scan and resubmit."
            />
          </Field>
          <div className="flex gap-3 mt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeRejectModal}>Cancel</Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={rejectBusy}>
              {rejectBusy ? 'Rejecting…' : 'Reject Document'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewCert} onClose={() => setViewCert(null)} title={viewCert ? `Certificate — ${viewCert.course}` : ''} wide>
        {viewCert?.certFileUrl ? (
          <div>
            {viewCert.certFileType?.startsWith('image/') ? (
              <img src={viewCert.certFileUrl} alt={viewCert.course} className="w-full max-h-[70vh] object-contain rounded-xl border border-border bg-navy-100" />
            ) : (
              <iframe src={viewCert.certFileUrl} title={viewCert.course} className="w-full h-[70vh] rounded-xl border border-border" />
            )}
            <div className="flex items-center justify-end mt-3">
              <a href={viewCert.certFileUrl} download={viewCert.certFileName || undefined} className="text-navy font-semibold text-[0.86rem] no-underline hover:underline">
                Download
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-navy-100 border border-border rounded-xl p-8 text-center text-ink-muted">
            <p className="mb-1 font-medium">No certificate on record</p>
          </div>
        )}
      </Modal>

      <Modal open={deactivateOpen} onClose={closeDeactivate} title={`Deactivate — ${employee.displayName}`}>
        <form onSubmit={handleDeactivate}>
          <p className="text-ink-muted text-[0.9rem] mt-0 mb-4">
            This marks the 201 file for <strong>{employee.displayName}</strong> as inactive. The record and its documents are kept — you can reactivate it later.
          </p>
          <Field label="Reason for deactivating">
            <select
              className={inputCls}
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              required
            >
              <option value="" disabled>Select a reason</option>
              {DEACTIVATION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <div className="flex gap-3 mt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeDeactivate} disabled={statusBusy}>Cancel</Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={statusBusy || !deactivateReason}>
              {statusBusy ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete employee record">
        <p className="text-ink mb-1">
          Are you sure you want to permanently delete the record for <strong>{employee.displayName}</strong> (#{employee.employeeNumber})?
        </p>
        <p className="text-[0.86rem] text-ink-muted mb-5">
          This removes all of their documents, training records, and notifications. This cannot be undone.
          {employee && ' Any user account linked to this employee will stay active, just unlinked.'}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Permanently'}
          </Button>
        </div>
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
    <div className={last ? '' : 'mb-4'}>
      <p className="text-[0.82rem] text-ink-faint mb-0.5">{label}</p>
      <p className="mb-0">{value}</p>
    </div>
  );
}
