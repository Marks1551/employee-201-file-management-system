// Server-only data access layer for the employees feature: employee CRUD,
// documents, training, educational background, work experience, performance
// reviews, and attendance. Maps MySQL rows <-> the object shapes the UI expects.
import { randomUUID } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { query, execute, withTransaction } from '@/shared/server/db';
import { fmt, initials } from '@/shared/server/format';
import { nowStamp } from '@/shared/lib/roles';
import { syncNotificationsForEmployee } from '@/features/notifications/server/service';
import type {
  Employee, EmployeeInput, EmployeeRow, DocumentRecord, DocumentRow, TrainingRecord, TrainingRow,
  EducationRecord, EducationRow, WorkExperienceRecord, WorkExperienceRow, PerformanceRecord, PerformanceRow,
  AttendanceRecord, AttendanceRow, StoredFile, Patch, EmployeeStatus,
  CivilServiceEligibilityRecord, CivilServiceEligibilityRow, VoluntaryWorkRecord, VoluntaryWorkRow,
  PdsReferenceRecord, PdsReferenceRow, PdsDetails,
} from '@/shared/types';
import { emptyPdsDetails } from '@/shared/types';

export { syncNotificationsForEmployee };

function mapEmployeeRow(row: EmployeeRow): Omit<Employee, 'documents' | 'training' | 'education' | 'workExperience' | 'performance' | 'attendance' | 'civilServiceEligibility' | 'voluntaryWork' | 'pdsReferences'> {
  let pds: PdsDetails = emptyPdsDetails();
  if (row.pds_details) {
    try {
      pds = { ...emptyPdsDetails(), ...JSON.parse(row.pds_details) };
    } catch {
      pds = emptyPdsDetails();
    }
  }
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    initials: row.initials,
    fullName: row.full_name,
    displayName: row.display_name,
    dob: row.dob,
    civilStatus: row.civil_status,
    nationality: row.nationality,
    contact: row.contact,
    email: row.email,
    address: row.address,
    department: row.department,
    position: row.position,
    employmentType: row.employment_type,
    dateHired: row.date_hired,
    employmentStatus: row.employment_status,
    contractStart: row.contract_start,
    contractEnd: row.contract_end,
    supervisor: row.supervisor,
    photoUrl: row.photo_url,
    status: row.status || 'active',
    deactivationReason: row.deactivation_reason,
    deactivatedAt: row.deactivated_at,
    pds,
  };
}

function mapDocRow(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    uploaded: row.uploaded_at,
    fileUrl: row.file_url || null,
    fileName: row.file_name || null,
    fileType: row.file_type || null,
    pendingFileUrl: row.pending_file_url || null,
    pendingFileName: row.pending_file_name || null,
    pendingFileType: row.pending_file_type || null,
    submitted: row.submitted_at || null,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    reviewNote: row.review_note || null,
  };
}

function mapTrainingRow(row: TrainingRow): TrainingRecord {
  return {
    id: row.id,
    course: row.course,
    provider: row.provider,
    completed: row.completed,
    certStatus: row.cert_status,
    certFileUrl: row.cert_file_url || null,
    certFileName: row.cert_file_name || null,
    certFileType: row.cert_file_type || null,
    fromDate: row.from_date || null,
    hours: row.hours || null,
    ldType: row.ld_type || null,
    conductedBy: row.conducted_by || null,
  };
}

function mapEducationRow(row: EducationRow): EducationRecord {
  return {
    id: row.id, level: row.level, schoolName: row.school_name, degree: row.degree,
    yearGraduated: row.year_graduated, honors: row.honors,
  };
}

function mapWorkExperienceRow(row: WorkExperienceRow): WorkExperienceRecord {
  return {
    id: row.id, company: row.company, position: row.position,
    fromDate: row.from_date, toDate: row.to_date, description: row.description,
    statusOfAppointment: row.status_of_appointment || null,
    govtService: row.govt_service || null,
  };
}

function mapCivilServiceEligibilityRow(row: CivilServiceEligibilityRow): CivilServiceEligibilityRecord {
  return {
    id: row.id, name: row.name, rating: row.rating, examDate: row.exam_date, examPlace: row.exam_place,
    licenseNumber: row.license_number, licenseValidUntil: row.license_valid_until,
  };
}

function mapVoluntaryWorkRow(row: VoluntaryWorkRow): VoluntaryWorkRecord {
  return {
    id: row.id, organization: row.organization, fromDate: row.from_date, toDate: row.to_date,
    hours: row.hours, position: row.position,
  };
}

function mapPdsReferenceRow(row: PdsReferenceRow): PdsReferenceRecord {
  return { id: row.id, name: row.name, address: row.address, contact: row.contact };
}

function mapPerformanceRow(row: PerformanceRow): PerformanceRecord {
  return { id: row.id, period: row.period, rating: row.rating, reviewer: row.reviewer, remarks: row.remarks };
}

function mapAttendanceRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id, period: row.period, daysPresent: row.days_present, daysAbsent: row.days_absent,
    daysLate: row.days_late, remarks: row.remarks,
  };
}

// ---------- employees ----------

export async function listEmployees(): Promise<Employee[]> {
  const [employees, docs, trainings, education, workExperience, performance, attendance, eligibility, voluntaryWork, references] = await Promise.all([
    query<EmployeeRow>('SELECT * FROM employees ORDER BY display_name ASC'),
    query<DocumentRow>('SELECT * FROM documents ORDER BY id ASC'),
    query<TrainingRow>('SELECT * FROM trainings ORDER BY id ASC'),
    query<EducationRow>('SELECT * FROM education ORDER BY id ASC'),
    query<WorkExperienceRow>('SELECT * FROM work_experience ORDER BY id ASC'),
    query<PerformanceRow>('SELECT * FROM performance_reviews ORDER BY id ASC'),
    query<AttendanceRow>('SELECT * FROM attendance_records ORDER BY id ASC'),
    query<CivilServiceEligibilityRow>('SELECT * FROM civil_service_eligibility ORDER BY id ASC'),
    query<VoluntaryWorkRow>('SELECT * FROM voluntary_work ORDER BY id ASC'),
    query<PdsReferenceRow>('SELECT * FROM pds_references ORDER BY id ASC'),
  ]);
  return employees.map((e) => ({
    ...mapEmployeeRow(e),
    documents: docs.filter((d) => d.employee_id === e.id).map(mapDocRow),
    training: trainings.filter((t) => t.employee_id === e.id).map(mapTrainingRow),
    education: education.filter((r) => r.employee_id === e.id).map(mapEducationRow),
    workExperience: workExperience.filter((r) => r.employee_id === e.id).map(mapWorkExperienceRow),
    performance: performance.filter((r) => r.employee_id === e.id).map(mapPerformanceRow),
    attendance: attendance.filter((r) => r.employee_id === e.id).map(mapAttendanceRow),
    civilServiceEligibility: eligibility.filter((r) => r.employee_id === e.id).map(mapCivilServiceEligibilityRow),
    voluntaryWork: voluntaryWork.filter((r) => r.employee_id === e.id).map(mapVoluntaryWorkRow),
    pdsReferences: references.filter((r) => r.employee_id === e.id).map(mapPdsReferenceRow),
  }));
}

/** Lightweight lookup by employee number — used when an admin creates a
 *  login account by employee number instead of typing everything by hand. */
export async function findEmployeeByNumber(employeeNumber: string): Promise<{ id: string; displayName: string; email: string | null; employeeNumber: string } | null> {
  const rows = await query<EmployeeRow>('SELECT * FROM employees WHERE employee_number = ?', [employeeNumber.trim()]);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, displayName: row.display_name, email: row.email, employeeNumber: row.employee_number };
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const [rows, docs, trainings, education, workExperience, performance, attendance, eligibility, voluntaryWork, references] = await Promise.all([
    query<EmployeeRow>('SELECT * FROM employees WHERE id = ?', [id]),
    query<DocumentRow>('SELECT * FROM documents WHERE employee_id = ? ORDER BY id ASC', [id]),
    query<TrainingRow>('SELECT * FROM trainings WHERE employee_id = ? ORDER BY id ASC', [id]),
    query<EducationRow>('SELECT * FROM education WHERE employee_id = ? ORDER BY id ASC', [id]),
    query<WorkExperienceRow>('SELECT * FROM work_experience WHERE employee_id = ? ORDER BY id ASC', [id]),
    query<PerformanceRow>('SELECT * FROM performance_reviews WHERE employee_id = ? ORDER BY id ASC', [id]),
    query<AttendanceRow>('SELECT * FROM attendance_records WHERE employee_id = ? ORDER BY id ASC', [id]),
    query<CivilServiceEligibilityRow>('SELECT * FROM civil_service_eligibility WHERE employee_id = ? ORDER BY id ASC', [id]),
    query<VoluntaryWorkRow>('SELECT * FROM voluntary_work WHERE employee_id = ? ORDER BY id ASC', [id]),
    query<PdsReferenceRow>('SELECT * FROM pds_references WHERE employee_id = ? ORDER BY id ASC', [id]),
  ]);
  if (!rows.length) return null;
  return {
    ...mapEmployeeRow(rows[0]),
    documents: docs.map(mapDocRow),
    training: trainings.map(mapTrainingRow),
    education: education.map(mapEducationRow),
    workExperience: workExperience.map(mapWorkExperienceRow),
    performance: performance.map(mapPerformanceRow),
    attendance: attendance.map(mapAttendanceRow),
    civilServiceEligibility: eligibility.map(mapCivilServiceEligibilityRow),
    voluntaryWork: voluntaryWork.map(mapVoluntaryWorkRow),
    pdsReferences: references.map(mapPdsReferenceRow),
  };
}

const DEFAULT_DOC_TYPES = ['Government-Issued ID', 'Diploma / Transcript of Records', 'NBI Clearance', 'Employment Contract'];

/** Contract end date only makes sense for contractual staff — clear it for Regular. */
function normalizeContractDates<T extends { employmentStatus?: string | null; contractEnd?: string | null }>(data: T): T {
  if (data.employmentStatus === 'Regular') {
    return { ...data, contractEnd: null };
  }
  return data;
}

export async function createEmployee(rawData: EmployeeInput): Promise<string> {
  const data = normalizeContractDates(rawData);
  const id = `emp-${randomUUID()}`;
  await withTransaction(async (conn: PoolConnection) => {
    await conn.execute(
      `INSERT INTO employees (id, employee_number, initials, full_name, display_name, dob, civil_status, nationality, contact, email, address, department, position, employment_type, date_hired, employment_status, contract_start, contract_end, supervisor)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, data.employeeNumber, initials(data.displayName || ''), data.fullName || data.displayName, data.displayName,
        data.dob || null, data.civilStatus || null, data.nationality || null, data.contact || null, data.email || null,
        data.address || null, data.department || null, data.position || null, data.employmentType || null,
        data.dateHired || null, data.employmentStatus || null, data.contractStart || null, data.contractEnd || null,
        data.supervisor || null,
      ] as any[]
    );
    for (const name of DEFAULT_DOC_TYPES) {
      await conn.execute('INSERT INTO documents (id, employee_id, name, status, uploaded_at) VALUES (?,?,?,?,?)', [
        `d-${randomUUID()}`, id, name, 'missing', null,
      ] as any[]);
    }
  });
  await syncNotificationsForEmployee(id);
  return id;
}

const EMPLOYEE_COLUMNS: Record<string, string> = {
  employeeNumber: 'employee_number', fullName: 'full_name', displayName: 'display_name', dob: 'dob',
  civilStatus: 'civil_status', nationality: 'nationality', contact: 'contact', email: 'email', address: 'address',
  department: 'department', position: 'position', employmentType: 'employment_type', dateHired: 'date_hired',
  employmentStatus: 'employment_status', contractStart: 'contract_start', contractEnd: 'contract_end',
  supervisor: 'supervisor', photoUrl: 'photo_url',
  status: 'status', deactivationReason: 'deactivation_reason', deactivatedAt: 'deactivated_at',
};

export async function updateEmployee(id: string, rawPatch: Patch<EmployeeInput> & { status?: EmployeeStatus }): Promise<void> {
  const patch = normalizeContractDates(rawPatch);
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(EMPLOYEE_COLUMNS)) {
    if (key in patch) {
      sets.push(`${col} = ?`);
      params.push((patch as Record<string, unknown>)[key]);
    }
  }
  if (patch.displayName) {
    sets.push('initials = ?');
    params.push(initials(patch.displayName));
  }
  if (!sets.length) return;
  params.push(id);
  await execute(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, params);
}

/** Merges a partial PdsDetails patch into the employee's stored JSON blob
 *  (rather than overwriting it), so the PDS Details form can be saved one
 *  section at a time without clobbering the rest. */
export async function updateEmployeePds(id: string, patch: Partial<PdsDetails>): Promise<void> {
  const rows = await query<EmployeeRow>('SELECT pds_details FROM employees WHERE id = ?', [id]);
  let current: Partial<PdsDetails> = {};
  if (rows[0]?.pds_details) {
    try {
      current = JSON.parse(rows[0].pds_details);
    } catch {
      current = {};
    }
  }
  const merged = { ...emptyPdsDetails(), ...current, ...patch };
  await execute('UPDATE employees SET pds_details = ? WHERE id = ?', [JSON.stringify(merged), id]);
}

/** Sets an employee's file to active or inactive. When deactivating, `reason`
 *  must be one of DEACTIVATION_REASONS; when reactivating, the prior reason
 *  and timestamp are cleared. */
export async function setEmployeeStatus(id: string, status: EmployeeStatus, reason?: string | null): Promise<void> {
  if (status === 'inactive') {
    await execute('UPDATE employees SET status = ?, deactivation_reason = ?, deactivated_at = ? WHERE id = ?', [
      'inactive', reason || null, nowStamp(), id,
    ]);
  } else {
    await execute('UPDATE employees SET status = ?, deactivation_reason = NULL, deactivated_at = NULL WHERE id = ?', [
      'active', id,
    ]);
  }
}

export async function setEmployeePhoto(id: string, photoUrl: string | null): Promise<void> {
  await execute('UPDATE employees SET photo_url = ? WHERE id = ?', [photoUrl, id]);
}

/** Permanently deletes an employee and everything tied to them (documents,
 *  trainings, notifications cascade via FK; any linked user account is
 *  unlinked, not deleted, via ON DELETE SET NULL). */
export async function deleteEmployee(id: string): Promise<boolean> {
  const result = await execute('DELETE FROM employees WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/** Marks a document as uploaded. `file` is optional: { url, name, type } from
 *  an actual stored file. Without it, the row is just flagged uploaded (legacy
 *  "mark as uploaded" behavior). */
export async function markDocumentUploaded(employeeId: string, docId: string, file?: StoredFile | null): Promise<string | null> {
  const stamp = nowStamp();
  await execute(
    'UPDATE documents SET status = ?, uploaded_at = ?, file_url = ?, file_name = ?, file_type = ? WHERE id = ? AND employee_id = ?',
    ['uploaded', stamp, file?.url || null, file?.name || null, file?.type || null, docId, employeeId]
  );
  const rows = await query<DocumentRow>('SELECT name FROM documents WHERE id = ?', [docId]);
  await syncNotificationsForEmployee(employeeId);
  return rows[0]?.name || null;
}

/** Clears a document's stored file and reverts it to missing. Returns the
 *  previous file_url (if any) so the caller can delete it from disk. */
export async function clearDocumentFile(employeeId: string, docId: string): Promise<string | null> {
  const rows = await query<DocumentRow>('SELECT file_url FROM documents WHERE id = ? AND employee_id = ?', [docId, employeeId]);
  await execute(
    'UPDATE documents SET status = ?, uploaded_at = NULL, file_url = NULL, file_name = NULL, file_type = NULL WHERE id = ? AND employee_id = ?',
    ['missing', docId, employeeId]
  );
  await syncNotificationsForEmployee(employeeId);
  return rows[0]?.file_url || null;
}

/** Faculty-facing submission. Stores the file under `pending_file_*` and
 *  flips the document to `pending` — it is NOT applied to the employee's
 *  record of file (file_url/file_name/file_type) until HR approves it via
 *  approveDocument(). `file` is optional: { url, name, type }. */
export async function submitEmployeeDocument(employeeId: string, docTypeName: string, file?: StoredFile | null): Promise<string> {
  const existing = await query<DocumentRow>('SELECT id FROM documents WHERE employee_id = ? AND name = ?', [employeeId, docTypeName]);
  const stamp = nowStamp();
  let docId = existing[0]?.id;
  if (existing.length) {
    await execute(
      'UPDATE documents SET status = ?, submitted_at = ?, pending_file_url = ?, pending_file_name = ?, pending_file_type = ?, reviewed_by = NULL, reviewed_at = NULL, review_note = NULL WHERE id = ?',
      ['pending', stamp, file?.url || null, file?.name || null, file?.type || null, existing[0].id]
    );
  } else {
    docId = `d-${randomUUID()}`;
    await execute(
      'INSERT INTO documents (id, employee_id, name, status, submitted_at, pending_file_url, pending_file_name, pending_file_type) VALUES (?,?,?,?,?,?,?,?)',
      [docId, employeeId, docTypeName, 'pending', stamp, file?.url || null, file?.name || null, file?.type || null]
    );
  }
  await syncNotificationsForEmployee(employeeId);
  return docId as string;
}

/** HR approves a pending submission: the faculty-submitted file becomes the
 *  file of record and the document is marked uploaded. Returns the document
 *  name, or null if no pending submission was found for that id. */
export async function approveEmployeeDocument(employeeId: string, docId: string, reviewerName: string): Promise<string | null> {
  const rows = await query<DocumentRow>('SELECT * FROM documents WHERE id = ? AND employee_id = ?', [docId, employeeId]);
  const doc = rows[0];
  if (!doc || doc.status !== 'pending') return null;
  const stamp = nowStamp();
  await execute(
    `UPDATE documents SET status = 'uploaded', uploaded_at = ?, file_url = ?, file_name = ?, file_type = ?,
       pending_file_url = NULL, pending_file_name = NULL, pending_file_type = NULL, submitted_at = NULL,
       reviewed_by = ?, reviewed_at = ?, review_note = NULL WHERE id = ?`,
    [stamp, doc.pending_file_url, doc.pending_file_name, doc.pending_file_type, reviewerName, stamp, docId]
  );
  await syncNotificationsForEmployee(employeeId);
  return doc.name;
}

/** HR rejects a pending submission: the submitted file is discarded (the
 *  caller should also delete it from disk — see deleteDocumentFile) and the
 *  document reverts to whatever it was before (uploaded, if a prior
 *  approved file exists, otherwise missing), tagged `rejected` with a note
 *  so faculty knows to resubmit. Returns { name, previousFileUrl } for the
 *  caller, or null if no pending submission was found. */
export async function rejectEmployeeDocument(employeeId: string, docId: string, reviewerName: string, note?: string | null): Promise<{ name: string; previousPendingFileUrl: string | null } | null> {
  const rows = await query<DocumentRow>('SELECT * FROM documents WHERE id = ? AND employee_id = ?', [docId, employeeId]);
  const doc = rows[0];
  if (!doc || doc.status !== 'pending') return null;
  const stamp = nowStamp();
  await execute(
    `UPDATE documents SET status = 'rejected', pending_file_url = NULL, pending_file_name = NULL, pending_file_type = NULL,
       submitted_at = NULL, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?`,
    [reviewerName, stamp, note || null, docId]
  );
  await syncNotificationsForEmployee(employeeId);
  return { name: doc.name, previousPendingFileUrl: doc.pending_file_url };
}

// ---------- training ----------

export interface TrainingInput {
  course: string;
  provider?: string | null;
  completed?: string | null;
  certStatus?: string | null;
  fromDate?: string | null;
  hours?: string | null;
  ldType?: string | null;
  conductedBy?: string | null;
}

export async function addTraining(employeeId: string, data: TrainingInput): Promise<string> {
  const id = `t-${randomUUID()}`;
  await execute(
    'INSERT INTO trainings (id, employee_id, course, provider, completed, cert_status, from_date, hours, ld_type, conducted_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, employeeId, data.course, data.provider || null, data.completed || null, data.certStatus || 'on-file',
      data.fromDate || null, data.hours || null, data.ldType || null, data.conductedBy || null]
  );
  await syncNotificationsForEmployee(employeeId);
  return id;
}

const TRAINING_COLUMNS: Record<string, string> = {
  course: 'course', provider: 'provider', completed: 'completed', certStatus: 'cert_status',
  fromDate: 'from_date', hours: 'hours', ldType: 'ld_type', conductedBy: 'conducted_by',
};

export async function updateTraining(employeeId: string, trainingId: string, patch: Patch<TrainingInput>): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(TRAINING_COLUMNS)) {
    if (key in patch) {
      sets.push(`${col} = ?`);
      params.push((patch as Record<string, unknown>)[key]);
    }
  }
  if (sets.length) {
    params.push(trainingId, employeeId);
    await execute(`UPDATE trainings SET ${sets.join(', ')} WHERE id = ? AND employee_id = ?`, params);
  }
  await syncNotificationsForEmployee(employeeId);
}

export async function deleteTraining(employeeId: string, trainingId: string): Promise<void> {
  await execute('DELETE FROM trainings WHERE id = ? AND employee_id = ?', [trainingId, employeeId]);
  await syncNotificationsForEmployee(employeeId);
}

/** Attaches an uploaded certificate file to a training record and marks it
 *  "on-file". Returns the course name (for audit logging). */
export async function setTrainingCertificate(employeeId: string, trainingId: string, file?: StoredFile | null): Promise<string | null> {
  await execute(
    "UPDATE trainings SET cert_status = 'on-file', cert_file_url = ?, cert_file_name = ?, cert_file_type = ? WHERE id = ? AND employee_id = ?",
    [file?.url || null, file?.name || null, file?.type || null, trainingId, employeeId]
  );
  const rows = await query<TrainingRow>('SELECT course FROM trainings WHERE id = ?', [trainingId]);
  await syncNotificationsForEmployee(employeeId);
  return rows[0]?.course || null;
}

/** Removes a training's attached certificate file (cert_status is left as-is
 *  so HR can still mark it on-file/expiring by hand). Returns the previous
 *  file URL so the stored file can be deleted from disk. */
export async function clearTrainingCertificate(employeeId: string, trainingId: string): Promise<string | null> {
  const rows = await query<TrainingRow>('SELECT cert_file_url FROM trainings WHERE id = ? AND employee_id = ?', [trainingId, employeeId]);
  await execute(
    'UPDATE trainings SET cert_file_url = NULL, cert_file_name = NULL, cert_file_type = NULL WHERE id = ? AND employee_id = ?',
    [trainingId, employeeId]
  );
  return rows[0]?.cert_file_url || null;
}

/** Builds add/update/delete functions for a simple per-employee record table
 *  (education, work experience, performance reviews, attendance) — same shape
 *  as the training functions above, minus notification syncing. */
function makeRecordCrud<TInput extends Record<string, unknown>>(table: string, idPrefix: string, columns: Record<keyof TInput & string, string>) {
  const keys = Object.keys(columns) as (keyof TInput & string)[];

  async function add(employeeId: string, data: TInput): Promise<string> {
    const id = `${idPrefix}-${randomUUID()}`;
    const cols = ['id', 'employee_id', ...keys.map((k) => columns[k])];
    const values: unknown[] = [id, employeeId, ...keys.map((k) => data[k] ?? null)];
    await execute(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(',')})`,
      values
    );
    return id;
  }

  async function update(employeeId: string, recordId: string, patch: Patch<TInput>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of keys) {
      if (key in patch) {
        sets.push(`${columns[key]} = ?`);
        const value = (patch as Record<string, unknown>)[key];
        params.push(value === '' ? null : value);
      }
    }
    if (!sets.length) return;
    params.push(recordId, employeeId);
    await execute(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ? AND employee_id = ?`, params);
  }

  async function remove(employeeId: string, recordId: string): Promise<void> {
    await execute(`DELETE FROM ${table} WHERE id = ? AND employee_id = ?`, [recordId, employeeId]);
  }

  return { add, update, remove };
}

// ---------- educational background ----------

export interface EducationInput {
  [key: string]: unknown;
  level?: string | null;
  schoolName: string;
  degree?: string | null;
  yearGraduated?: string | null;
  honors?: string | null;
}

const educationCrud = makeRecordCrud<EducationInput>('education', 'edu', {
  level: 'level', schoolName: 'school_name', degree: 'degree', yearGraduated: 'year_graduated', honors: 'honors',
});
export const addEducation = educationCrud.add;
export const updateEducation = educationCrud.update;
export const deleteEducation = educationCrud.remove;

// ---------- work experience ----------

export interface WorkExperienceInput {
  [key: string]: unknown;
  company: string;
  position?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  description?: string | null;
  statusOfAppointment?: string | null;
  govtService?: string | null;
}

const workExperienceCrud = makeRecordCrud<WorkExperienceInput>('work_experience', 'we', {
  company: 'company', position: 'position', fromDate: 'from_date', toDate: 'to_date', description: 'description',
  statusOfAppointment: 'status_of_appointment', govtService: 'govt_service',
});
export const addWorkExperience = workExperienceCrud.add;
export const updateWorkExperience = workExperienceCrud.update;
export const deleteWorkExperience = workExperienceCrud.remove;

// ---------- civil service eligibility ----------

export interface CivilServiceEligibilityInput {
  [key: string]: unknown;
  name: string;
  rating?: string | null;
  examDate?: string | null;
  examPlace?: string | null;
  licenseNumber?: string | null;
  licenseValidUntil?: string | null;
}

const eligibilityCrud = makeRecordCrud<CivilServiceEligibilityInput>('civil_service_eligibility', 'cse', {
  name: 'name', rating: 'rating', examDate: 'exam_date', examPlace: 'exam_place',
  licenseNumber: 'license_number', licenseValidUntil: 'license_valid_until',
});
export const addCivilServiceEligibility = eligibilityCrud.add;
export const updateCivilServiceEligibility = eligibilityCrud.update;
export const deleteCivilServiceEligibility = eligibilityCrud.remove;

// ---------- voluntary work ----------

export interface VoluntaryWorkInput {
  [key: string]: unknown;
  organization: string;
  fromDate?: string | null;
  toDate?: string | null;
  hours?: string | null;
  position?: string | null;
}

const voluntaryWorkCrud = makeRecordCrud<VoluntaryWorkInput>('voluntary_work', 'vw', {
  organization: 'organization', fromDate: 'from_date', toDate: 'to_date', hours: 'hours', position: 'position',
});
export const addVoluntaryWork = voluntaryWorkCrud.add;
export const updateVoluntaryWork = voluntaryWorkCrud.update;
export const deleteVoluntaryWork = voluntaryWorkCrud.remove;

// ---------- PDS references ----------

export interface PdsReferenceInput {
  [key: string]: unknown;
  name: string;
  address?: string | null;
  contact?: string | null;
}

const pdsReferenceCrud = makeRecordCrud<PdsReferenceInput>('pds_references', 'ref', {
  name: 'name', address: 'address', contact: 'contact',
});
export const addPdsReference = pdsReferenceCrud.add;
export const updatePdsReference = pdsReferenceCrud.update;
export const deletePdsReference = pdsReferenceCrud.remove;

// ---------- performance ----------

export interface PerformanceInput {
  [key: string]: unknown;
  period: string;
  rating?: string | null;
  reviewer?: string | null;
  remarks?: string | null;
}

const performanceCrud = makeRecordCrud<PerformanceInput>('performance_reviews', 'perf', {
  period: 'period', rating: 'rating', reviewer: 'reviewer', remarks: 'remarks',
});
export const addPerformanceReview = performanceCrud.add;
export const updatePerformanceReview = performanceCrud.update;
export const deletePerformanceReview = performanceCrud.remove;

// ---------- attendance ----------

export interface AttendanceInput {
  [key: string]: unknown;
  period: string;
  daysPresent?: number | string | null;
  daysAbsent?: number | string | null;
  daysLate?: number | string | null;
  remarks?: string | null;
}

const attendanceCrud = makeRecordCrud<AttendanceInput>('attendance_records', 'att', {
  period: 'period', daysPresent: 'days_present', daysAbsent: 'days_absent', daysLate: 'days_late', remarks: 'remarks',
});
export const addAttendanceRecord = attendanceCrud.add;
export const updateAttendanceRecord = attendanceCrud.update;
export const deleteAttendanceRecord = attendanceCrud.remove;
