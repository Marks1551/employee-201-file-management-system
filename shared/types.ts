// Shared domain types for the Employee 201 File Management System.
// These describe the shapes the UI/API exchange (i.e. the mapped, camelCase
// objects produced by lib/models.ts) as well as the raw snake_case DB rows.

export type Role = 'admin' | 'hr' | 'faculty';
export type UserStatus = 'active' | 'deactivated';
export type EmployeeStatus = 'active' | 'inactive';
export type DocumentStatus = 'uploaded' | 'missing' | 'pending' | 'rejected';
export type CertStatus = 'on-file' | 'expiring';
export type NotificationKind = 'missing_document' | 'expiring_training' | 'pending_document';
export type NotificationStatus = 'unread' | 'read';
export type EmploymentStatusValue = 'Regular' | 'Contractual';

/** A file previously stored via saveDocumentFile / passed to the model layer. */
export interface StoredFile {
  url: string;
  name: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Mapped (camelCase) shapes — what the API returns and the UI consumes
// ---------------------------------------------------------------------------

export interface DocumentRecord {
  id: string;
  name: string;
  status: DocumentStatus;
  uploaded: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  /** Faculty's submitted file, awaiting HR review. Set only while
   *  status === 'pending'; not yet applied to fileUrl/fileName/fileType. */
  pendingFileUrl: string | null;
  pendingFileName: string | null;
  pendingFileType: string | null;
  submitted: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface TrainingRecord {
  id: string;
  course: string;
  provider: string | null;
  completed: string | null;
  certStatus: CertStatus;
  certFileUrl: string | null;
  certFileName: string | null;
  certFileType: string | null;
  /** PDS Section VII (Learning & Development) extras. `completed` above is
   *  used as the "to" date of the inclusive attendance dates. */
  fromDate: string | null;
  hours: string | null;
  ldType: string | null;
  conductedBy: string | null;
}

export interface EducationRecord {
  id: string;
  level: string | null;
  schoolName: string;
  degree: string | null;
  yearGraduated: string | null;
  honors: string | null;
}

export interface WorkExperienceRecord {
  id: string;
  company: string;
  position: string | null;
  fromDate: string | null;
  toDate: string | null;
  description: string | null;
  /** PDS Section V extras */
  statusOfAppointment: string | null;
  govtService: 'Y' | 'N' | null;
}

export interface CivilServiceEligibilityRecord {
  id: string;
  name: string;
  rating: string | null;
  examDate: string | null;
  examPlace: string | null;
  licenseNumber: string | null;
  licenseValidUntil: string | null;
}

export interface VoluntaryWorkRecord {
  id: string;
  organization: string;
  fromDate: string | null;
  toDate: string | null;
  hours: string | null;
  position: string | null;
}

export interface PdsReferenceRecord {
  id: string;
  name: string;
  address: string | null;
  contact: string | null;
}

export interface PerformanceRecord {
  id: string;
  period: string;
  rating: string | null;
  reviewer: string | null;
  remarks: string | null;
}

export interface AttendanceRecord {
  id: string;
  period: string;
  daysPresent: number | null;
  daysAbsent: number | null;
  daysLate: number | null;
  remarks: string | null;
}

export interface PdsChild {
  id: string;
  name: string;
  dob: string | null;
}

export interface PdsAddress {
  houseBlockLot: string | null;
  street: string | null;
  subdivision: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  zipCode: string | null;
}

export function emptyPdsAddress(): PdsAddress {
  return { houseBlockLot: null, street: null, subdivision: null, barangay: null, cityMunicipality: null, province: null, zipCode: null };
}

/** Additional CS Form No. 212 (Revised 2025) fields not covered by the core
 *  Employee columns — stored as one JSON blob on the employee row. Scalar
 *  fields only; repeatable sections (eligibility, voluntary work, references)
 *  are their own record lists on Employee, same pattern as education/training. */
export interface PdsDetails {
  // I. Personal Information extras
  nameExtension: string | null;
  sexAtBirth: string | null;
  placeOfBirth: string | null;
  heightM: string | null;
  weightKg: string | null;
  bloodType: string | null;
  gsisUmidNo: string | null;
  pagibigNo: string | null;
  philhealthNo: string | null;
  philsysNumber: string | null;
  tinNo: string | null;
  agencyEmployeeNo: string | null;
  dualCitizenshipCountry: string | null;
  telephoneNo: string | null;
  mobileNo: string | null;
  residentialAddress: PdsAddress;
  permanentAddress: PdsAddress;
  permanentSameAsResidential: boolean;

  // II. Family Background
  spouseSurname: string | null;
  spouseFirstName: string | null;
  spouseMiddleName: string | null;
  spouseNameExtension: string | null;
  spouseOccupation: string | null;
  spouseEmployer: string | null;
  spouseBusinessAddress: string | null;
  spouseTelephone: string | null;
  children: PdsChild[];
  fatherSurname: string | null;
  fatherFirstName: string | null;
  fatherMiddleName: string | null;
  fatherNameExtension: string | null;
  motherMaidenSurname: string | null;
  motherFirstName: string | null;
  motherMiddleName: string | null;

  // VIII. Other Information
  specialSkillsHobbies: string | null;
  nonAcademicDistinctions: string | null;
  orgMemberships: string | null;

  // Questions 34–40 (declarations)
  q34RelatedThirdDegree: boolean | null;
  q34RelatedFourthDegree: boolean | null;
  q34Details: string | null;
  q35aAdminOffense: boolean | null;
  q35aDetails: string | null;
  q35bCriminalCharge: boolean | null;
  q35bDetails: string | null;
  q35bDateFiled: string | null;
  q35bStatus: string | null;
  q36Convicted: boolean | null;
  q36Details: string | null;
  q37Separated: boolean | null;
  q37Details: string | null;
  q38aCandidate: boolean | null;
  q38aDetails: string | null;
  q38bResigned: boolean | null;
  q38bDetails: string | null;
  q39Immigrant: boolean | null;
  q39Country: string | null;
  q40aIndigenous: boolean | null;
  q40aDetails: string | null;
  q40bPwd: boolean | null;
  q40bIdNo: string | null;
  q40cSoloParent: boolean | null;
  q40cIdNo: string | null;

  // Government ID (for the signature/oath block)
  govIdType: string | null;
  govIdNumber: string | null;
  govIdDateIssued: string | null;
  govIdPlaceIssued: string | null;
}

export function emptyPdsDetails(): PdsDetails {
  return {
    nameExtension: null, sexAtBirth: null, placeOfBirth: null, heightM: null, weightKg: null, bloodType: null,
    gsisUmidNo: null, pagibigNo: null, philhealthNo: null, philsysNumber: null, tinNo: null, agencyEmployeeNo: null,
    dualCitizenshipCountry: null, telephoneNo: null, mobileNo: null,
    residentialAddress: emptyPdsAddress(), permanentAddress: emptyPdsAddress(), permanentSameAsResidential: false,
    spouseSurname: null, spouseFirstName: null, spouseMiddleName: null, spouseNameExtension: null,
    spouseOccupation: null, spouseEmployer: null, spouseBusinessAddress: null, spouseTelephone: null,
    children: [],
    fatherSurname: null, fatherFirstName: null, fatherMiddleName: null, fatherNameExtension: null,
    motherMaidenSurname: null, motherFirstName: null, motherMiddleName: null,
    specialSkillsHobbies: null, nonAcademicDistinctions: null, orgMemberships: null,
    q34RelatedThirdDegree: null, q34RelatedFourthDegree: null, q34Details: null,
    q35aAdminOffense: null, q35aDetails: null,
    q35bCriminalCharge: null, q35bDetails: null, q35bDateFiled: null, q35bStatus: null,
    q36Convicted: null, q36Details: null,
    q37Separated: null, q37Details: null,
    q38aCandidate: null, q38aDetails: null,
    q38bResigned: null, q38bDetails: null,
    q39Immigrant: null, q39Country: null,
    q40aIndigenous: null, q40aDetails: null,
    q40bPwd: null, q40bIdNo: null,
    q40cSoloParent: null, q40cIdNo: null,
    govIdType: null, govIdNumber: null, govIdDateIssued: null, govIdPlaceIssued: null,
  };
}

export interface Employee {
  id: string;
  employeeNumber: string;
  initials: string;
  fullName: string;
  displayName: string;
  dob: string | null;
  civilStatus: string | null;
  nationality: string | null;
  contact: string | null;
  email: string | null;
  address: string | null;
  department: string | null;
  position: string | null;
  employmentType: string | null;
  dateHired: string | null;
  employmentStatus: EmploymentStatusValue | string | null;
  contractStart: string | null;
  contractEnd: string | null;
  supervisor: string | null;
  photoUrl: string | null;
  status: EmployeeStatus;
  deactivationReason: string | null;
  deactivatedAt: string | null;
  documents: DocumentRecord[];
  training: TrainingRecord[];
  education: EducationRecord[];
  workExperience: WorkExperienceRecord[];
  performance: PerformanceRecord[];
  attendance: AttendanceRecord[];
  civilServiceEligibility: CivilServiceEligibilityRecord[];
  voluntaryWork: VoluntaryWorkRecord[];
  pdsReferences: PdsReferenceRecord[];
  pds: PdsDetails;
}

/** Fields accepted when creating/updating an employee. All optional/partial —
 *  the model layer fills in sensible defaults for missing values. */
export interface EmployeeInput {
  employeeNumber?: string;
  fullName?: string;
  displayName?: string;
  dob?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  contact?: string | null;
  email?: string | null;
  address?: string | null;
  department?: string | null;
  position?: string | null;
  employmentType?: string | null;
  dateHired?: string | null;
  employmentStatus?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  supervisor?: string | null;
  photoUrl?: string | null;
  status?: EmployeeStatus;
  deactivationReason?: string | null;
  deactivatedAt?: string | null;
  pds?: Partial<PdsDetails>;
}

export interface User {
  id: string;
  name: string;
  initials: string | null;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  employeeId: string | null;
  lastActive: string;
  /** True for auto-created accounts still waiting on the person to set a
   *  password via their emailed setup link. */
  needsPasswordSetup: boolean;
}

export interface UserInput {
  name: string;
  username: string;
  email: string;
  role: Role;
  employeeId?: string | null;
  password?: string;
}

export interface AuditLogEntry {
  id: string;
  who: string | null;
  role: string | null;
  action: string | null;
  when: string | null;
}

export interface Notification {
  id: string;
  employeeId: string;
  documentId: string | null;
  trainingId: string | null;
  kind: NotificationKind;
  title: string;
  detail: string | null;
  status: NotificationStatus;
  when: string | null;
}

export interface AppMeta {
  lastBackup: string;
  [key: string]: string;
}

// ---------------------------------------------------------------------------
// Raw MySQL row shapes (snake_case, as returned by mysql2)
// ---------------------------------------------------------------------------

export interface EmployeeRow {
  id: string;
  employee_number: string;
  initials: string;
  full_name: string;
  display_name: string;
  dob: string | null;
  civil_status: string | null;
  nationality: string | null;
  contact: string | null;
  email: string | null;
  address: string | null;
  department: string | null;
  position: string | null;
  employment_type: string | null;
  date_hired: string | null;
  employment_status: string | null;
  contract_start: string | null;
  contract_end: string | null;
  supervisor: string | null;
  photo_url: string | null;
  status: EmployeeStatus;
  deactivation_reason: string | null;
  deactivated_at: string | null;
  pds_details: string | null;
  created_at?: string;
}

export interface DocumentRow {
  id: string;
  employee_id: string;
  name: string;
  status: DocumentStatus;
  uploaded_at: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  pending_file_url: string | null;
  pending_file_name: string | null;
  pending_file_type: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface TrainingRow {
  id: string;
  employee_id: string;
  course: string;
  provider: string | null;
  completed: string | null;
  cert_status: CertStatus;
  cert_file_url: string | null;
  cert_file_name: string | null;
  cert_file_type: string | null;
  from_date: string | null;
  hours: string | null;
  ld_type: string | null;
  conducted_by: string | null;
}

export interface EducationRow {
  id: string;
  employee_id: string;
  level: string | null;
  school_name: string;
  degree: string | null;
  year_graduated: string | null;
  honors: string | null;
}

export interface WorkExperienceRow {
  id: string;
  employee_id: string;
  company: string;
  position: string | null;
  from_date: string | null;
  to_date: string | null;
  description: string | null;
  status_of_appointment: string | null;
  govt_service: 'Y' | 'N' | null;
}

export interface CivilServiceEligibilityRow {
  id: string;
  employee_id: string;
  name: string;
  rating: string | null;
  exam_date: string | null;
  exam_place: string | null;
  license_number: string | null;
  license_valid_until: string | null;
}

export interface VoluntaryWorkRow {
  id: string;
  employee_id: string;
  organization: string;
  from_date: string | null;
  to_date: string | null;
  hours: string | null;
  position: string | null;
}

export interface PdsReferenceRow {
  id: string;
  employee_id: string;
  name: string;
  address: string | null;
  contact: string | null;
}

export interface PerformanceRow {
  id: string;
  employee_id: string;
  period: string;
  rating: string | null;
  reviewer: string | null;
  remarks: string | null;
}

export interface AttendanceRow {
  id: string;
  employee_id: string;
  period: string;
  days_present: number | null;
  days_absent: number | null;
  days_late: number | null;
  remarks: string | null;
}

export interface UserRow {
  id: string;
  name: string;
  initials: string | null;
  username: string;
  email: string;
  password_hash: string;
  role: Role;
  status: UserStatus;
  needs_password_setup: number | boolean;
  employee_id: string | null;
  last_active: string | null;
  created_at?: string;
}

export interface AuditLogRow {
  id: string;
  who: string | null;
  role: string | null;
  action: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  employee_id: string;
  document_id: string | null;
  training_id: string | null;
  kind: NotificationKind;
  title: string;
  detail: string | null;
  status: NotificationStatus;
  created_at: string;
}

export interface AppMetaRow {
  meta_key: string;
  meta_value: string | null;
}

/** Generic patch object: partial record keyed by camelCase field names. */
export type Patch<T> = Partial<T>;
