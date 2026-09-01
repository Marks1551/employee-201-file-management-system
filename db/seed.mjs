// Creates the database/tables from db/schema.sql (if they don't exist yet) and
// loads demo data. Safe to re-run — it wipes and reloads the demo tables each time,
// so use this to reset your local data at any point during development/demos.
//
// Usage: npm run db:seed
// Reads DB connection settings from .env.local (or .env) — see .env.example.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';

if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

const DEFAULT_PASSWORD = 'lssti123';

const seedEmployees = [
  {
    id: 'emp-0142', employeeNumber: '0142', initials: 'JV', fullName: 'Jomar Ferrer Villareal',
    displayName: 'Jomar Villareal', dob: 'March 14, 1989', civilStatus: 'Married', nationality: 'Filipino',
    contact: '0917 234 5678', email: 'jvillareal@lssti.edu.ph', address: 'Purok 3, Poblacion, Balo-i, Lanao del Norte',
    department: 'College of Computer Science', position: 'Faculty Instructor', employmentType: 'Full-time',
    dateHired: 'June 3, 2019', employmentStatus: 'Regular', supervisor: 'Engr. Paulo Diaz, Department Head',
    documents: [
      { id: 'd1', name: 'Government-Issued ID', status: 'uploaded', uploaded: 'June 5, 2019' },
      { id: 'd2', name: 'Diploma / Transcript of Records', status: 'uploaded', uploaded: 'June 5, 2019' },
      { id: 'd3', name: 'NBI Clearance', status: 'missing', uploaded: null },
      { id: 'd4', name: 'Employment Contract', status: 'uploaded', uploaded: 'June 3, 2019' },
    ],
    training: [
      { id: 't1', course: 'Outcomes-Based Teaching Workshop', provider: 'CHED Region X', completed: 'March 2023', certStatus: 'on-file', fromDate: 'March 2023', hours: '16', ldType: 'Technical', conductedBy: 'CHED Region X' },
      { id: 't2', course: 'Occupational Safety Training', provider: 'DOLE', completed: 'August 2024', certStatus: 'expiring', fromDate: 'August 2024', hours: '8', ldType: 'Mandatory', conductedBy: 'DOLE' },
    ],
    education: [
      { id: 'e1', level: 'College', schoolName: 'Mindanao State University - IIT', degree: 'BS Civil Engineering', yearGraduated: '2011', honors: '' },
      { id: 'e2', level: 'Graduate Studies', schoolName: 'MSU - IIT', degree: 'MS Civil Engineering (units earned)', yearGraduated: '', honors: '' },
    ],
    workExperience: [
      { id: 'w1', company: 'Diaz & Partners Engineering Consultancy', position: 'Junior Civil Engineer', fromDate: 'July 2011', toDate: 'May 2019', description: 'Structural design review and site inspection for commercial projects.', statusOfAppointment: 'Permanent', govtService: 'N' },
    ],
    civilServiceEligibility: [
      { id: 'cse1', name: 'Career Service Professional', rating: '84.20', examDate: 'October 2012', examPlace: 'Iligan City', licenseNumber: '', licenseValidUntil: '' },
      { id: 'cse2', name: 'PRC — Civil Engineer', rating: '82.50', examDate: 'May 2011', examPlace: 'Cagayan de Oro City', licenseNumber: 'CE-0098765', licenseValidUntil: 'May 2027' },
    ],
    voluntaryWork: [
      { id: 'vw1', organization: 'Balo-i Disaster Response Volunteers', fromDate: 'January 2020', toDate: '', hours: '40', position: 'Volunteer Engineer, structural damage assessment' },
    ],
    pdsReferences: [
      { id: 'ref1', name: 'Engr. Paulo Diaz', address: 'College of Engineering, LSSTI', contact: '0917 111 2222' },
      { id: 'ref2', name: 'Dr. Ramona Cruz', address: 'MSU - IIT, Iligan City', contact: 'rcruz@msuiit.edu.ph' },
    ],
    pds: {
      nameExtension: null, sexAtBirth: 'Male', placeOfBirth: 'Iligan City, Lanao del Norte',
      heightM: '1.70', weightKg: '68', bloodType: 'O+',
      gsisUmidNo: '0921-0456789-0', pagibigNo: '1211-0034-5678', philhealthNo: '02-123456789-0',
      philsysNumber: '1234-5678-9012', tinNo: '123-456-789-000', agencyEmployeeNo: '0142',
      dualCitizenshipCountry: null, telephoneNo: '', mobileNo: '0917 234 5678',
      residentialAddress: { houseBlockLot: 'Purok 3', street: '', subdivision: '', barangay: 'Poblacion', cityMunicipality: 'Balo-i', province: 'Lanao del Norte', zipCode: '9210' },
      permanentAddress: { houseBlockLot: 'Purok 3', street: '', subdivision: '', barangay: 'Poblacion', cityMunicipality: 'Balo-i', province: 'Lanao del Norte', zipCode: '9210' },
      permanentSameAsResidential: true,
      spouseSurname: 'Villareal', spouseFirstName: 'Anna', spouseMiddleName: 'Reyes', spouseNameExtension: null,
      spouseOccupation: 'Public School Teacher', spouseEmployer: 'DepEd Balo-i District', spouseBusinessAddress: 'Balo-i, Lanao del Norte', spouseTelephone: '0918 222 3344',
      children: [{ id: 'c1', name: 'Miguel Reyes Villareal', dob: '10/02/2015' }, { id: 'c2', name: 'Sofia Reyes Villareal', dob: '22/07/2018' }],
      fatherSurname: 'Villareal', fatherFirstName: 'Ernesto', fatherMiddleName: 'Santos', fatherNameExtension: null,
      motherMaidenSurname: 'Ferrer', motherFirstName: 'Corazon', motherMiddleName: 'Lopez',
      specialSkillsHobbies: 'AutoCAD drafting, basketball coaching, guitar', nonAcademicDistinctions: 'Best Thesis Award, MSU-IIT Civil Engineering 2011', orgMemberships: 'Philippine Institute of Civil Engineers (PICE), Balo-i Chapter',
      q34RelatedThirdDegree: false, q34RelatedFourthDegree: false, q34Details: null,
      q35aAdminOffense: false, q35aDetails: null,
      q35bCriminalCharge: false, q35bDetails: null, q35bDateFiled: null, q35bStatus: null,
      q36Convicted: false, q36Details: null,
      q37Separated: false, q37Details: null,
      q38aCandidate: false, q38aDetails: null,
      q38bResigned: false, q38bDetails: null,
      q39Immigrant: false, q39Country: null,
      q40aIndigenous: false, q40aDetails: null,
      q40bPwd: false, q40bIdNo: null,
      q40cSoloParent: false, q40cIdNo: null,
      govIdType: "Driver's License", govIdNumber: 'N01-23-456789', govIdDateIssued: 'March 2022', govIdPlaceIssued: 'LTO Iligan City',
    },
    performance: [
      { id: 'p1', period: 'SY 2024-2025', rating: 'Very Satisfactory', reviewer: 'Engr. Paulo Diaz, Department Head', remarks: 'Consistently strong student evaluations and active in curriculum committee work.' },
    ],
    attendance: [
      { id: 'a1', period: 'July 2026', daysPresent: 21, daysAbsent: 0, daysLate: 1, remarks: '' },
      { id: 'a2', period: 'August 2026', daysPresent: 8, daysAbsent: 0, daysLate: 0, remarks: '' },
    ],
  },
  {
    id: 'emp-0098', employeeNumber: '0098', initials: 'CB', fullName: 'Consolacion Reyes Bautista',
    displayName: 'Consolacion Bautista', dob: 'November 2, 1985', civilStatus: 'Single', nationality: 'Filipino',
    contact: '0918 555 2231', email: 'cbautista@lssti.edu.ph', address: 'Zone 2, Tubod, Lanao del Norte',
    department: 'College of Midwifery', position: 'Clinical Instructor', employmentType: 'Full-time',
    dateHired: 'January 15, 2016', employmentStatus: 'Regular', supervisor: 'Dr. Fe Aranas, Dean of Nursing',
    documents: [
      { id: 'd1', name: 'Government-Issued ID', status: 'uploaded', uploaded: 'January 18, 2016' },
      { id: 'd2', name: 'Diploma / Transcript of Records', status: 'uploaded', uploaded: 'January 18, 2016' },
      { id: 'd3', name: 'NBI Clearance', status: 'uploaded', uploaded: 'January 18, 2016' },
      { id: 'd4', name: 'Employment Contract', status: 'uploaded', uploaded: 'January 15, 2016' },
    ],
    training: [
      { id: 't1', course: 'Basic Life Support Certification', provider: 'Philippine Red Cross', completed: 'May 2024', certStatus: 'on-file' },
    ],
  },
  {
    id: 'emp-0071', employeeNumber: '0071', initials: 'TM', fullName: 'Teodoro Alcantara Mendez',
    displayName: 'Teodoro Mendez', dob: 'July 22, 1980', civilStatus: 'Married', nationality: 'Filipino',
    contact: '0920 112 4487', email: 'tmendez@lssti.edu.ph', address: 'Purok 7, Baloi, Lanao del Norte',
    department: 'College of Business Administration', position: 'Associate Professor', employmentType: 'Full-time',
    dateHired: 'August 20, 2012', employmentStatus: 'Regular', supervisor: 'Dr. Nimfa Rosales, Dean of Business',
    documents: [
      { id: 'd1', name: 'Government-Issued ID', status: 'uploaded', uploaded: 'August 22, 2012' },
      { id: 'd2', name: 'Diploma / Transcript of Records', status: 'missing', uploaded: null },
      { id: 'd3', name: 'NBI Clearance', status: 'missing', uploaded: null },
      { id: 'd4', name: 'Employment Contract', status: 'uploaded', uploaded: 'August 20, 2012' },
    ],
    training: [
      { id: 't1', course: 'Research Mentorship Program', provider: 'CHED Region X', completed: 'February 2022', certStatus: 'on-file' },
    ],
  },
  {
    id: 'emp-0055', employeeNumber: '0055', initials: 'GL', fullName: 'Grace Uy Lim-Uy',
    displayName: 'Grace Lim-Uy', dob: 'April 9, 1992', civilStatus: 'Single', nationality: 'Filipino',
    contact: '0917 887 1123', email: 'glimuy@lssti.edu.ph', address: 'Poblacion, Baloi, Lanao del Norte',
    department: "Registrar's Office", position: 'Records Officer', employmentType: 'Full-time',
    dateHired: 'October 4, 2020', employmentStatus: 'Regular', supervisor: 'Atty. Ramon Silva, University Registrar',
    documents: [
      { id: 'd1', name: 'Government-Issued ID', status: 'uploaded', uploaded: 'October 6, 2020' },
      { id: 'd2', name: 'Diploma / Transcript of Records', status: 'uploaded', uploaded: 'October 6, 2020' },
      { id: 'd3', name: 'NBI Clearance', status: 'uploaded', uploaded: 'October 6, 2020' },
      { id: 'd4', name: 'Employment Contract', status: 'uploaded', uploaded: 'October 4, 2020' },
    ],
    training: [
      { id: 't1', course: 'Records Management Systems', provider: 'CHED Region X', completed: 'June 2023', certStatus: 'on-file' },
    ],
  },
  {
    id: 'emp-0033', employeeNumber: '0033', initials: 'DC', fullName: 'Danilo Osorio Cruz',
    displayName: 'Danilo Cruz', dob: 'December 30, 1990', civilStatus: 'Married', nationality: 'Filipino',
    contact: '0919 664 2210', email: 'dcruz@lssti.edu.ph', address: 'Purok 1, Matampay, Baloi, Lanao del Norte',
    department: 'College of Computer Science', position: 'Lab Technician', employmentType: 'Full-time',
    dateHired: 'March 11, 2018', employmentStatus: 'Contractual', contractStart: 'March 11, 2025', contractEnd: 'March 11, 2026',
    supervisor: 'Engr. Paulo Diaz, Department Head',
    documents: [
      { id: 'd1', name: 'Government-Issued ID', status: 'uploaded', uploaded: 'March 13, 2018' },
      { id: 'd2', name: 'Diploma / Transcript of Records', status: 'uploaded', uploaded: 'March 13, 2018' },
      { id: 'd3', name: 'NBI Clearance', status: 'uploaded', uploaded: 'March 13, 2018' },
      { id: 'd4', name: 'Employment Contract', status: 'uploaded', uploaded: 'March 11, 2018' },
    ],
    training: [
      { id: 't1', course: 'Laboratory Safety & Hazard Handling', provider: 'DOLE', completed: 'September 2021', certStatus: 'expiring' },
    ],
    education: [
      { id: 'e1', level: 'College', schoolName: 'Mindanao State University - IIT', degree: 'BS Electronics Engineering', yearGraduated: '2014', honors: '' },
    ],
    workExperience: [
      { id: 'w1', company: 'Iligan Steel Fabrication Corp.', position: 'Equipment Technician', fromDate: 'January 2015', toDate: 'February 2018', description: 'Maintained lab and workshop equipment; handled calibration and safety compliance.' },
    ],
    performance: [
      { id: 'p1', period: 'Contract Renewal Review 2025', rating: 'Satisfactory', reviewer: 'Engr. Paulo Diaz, Department Head', remarks: 'Reliable equipment upkeep; recommended for contract renewal.' },
    ],
    attendance: [
      { id: 'a1', period: 'August 2026', daysPresent: 7, daysAbsent: 1, daysLate: 0, remarks: 'Absent Aug 4 — approved leave' },
    ],
  },
  {
    id: 'emp-0019', employeeNumber: '0019', initials: 'MO', fullName: 'Marife Tan Ong',
    displayName: 'Marife Ong', dob: 'February 17, 1978', civilStatus: 'Married', nationality: 'Filipino',
    contact: '0917 320 9981', email: 'mong@lssti.edu.ph', address: 'Zone 5, Tubod, Lanao del Norte',
    department: 'College of Criminology', position: 'Program Head', employmentType: 'Full-time',
    dateHired: 'July 1, 2009', employmentStatus: 'Regular', supervisor: 'Dr. Nimfa Rosales, Dean of Business',
    documents: [
      { id: 'd1', name: 'Government-Issued ID', status: 'uploaded', uploaded: 'July 3, 2009' },
      { id: 'd2', name: 'Diploma / Transcript of Records', status: 'uploaded', uploaded: 'July 3, 2009' },
      { id: 'd3', name: 'NBI Clearance', status: 'uploaded', uploaded: 'July 3, 2009' },
      { id: 'd4', name: 'Employment Contract', status: 'uploaded', uploaded: 'July 1, 2009' },
    ],
    training: [
      { id: 't1', course: 'Strategic Program Leadership', provider: 'CHED Region X', completed: 'January 2024', certStatus: 'on-file' },
    ],
  },
];

const seedUsers = [
  { id: 'user-admin-1', name: 'Ricardo Santos', initials: 'RS', username: 'rsantos', email: 'rsantos@lssti.edu.ph', role: 'admin', status: 'active', employeeId: null },
  { id: 'user-hr-1', name: 'Amelia Reyes', initials: 'AR', username: 'areyes', email: 'areyes@lssti.edu.ph', role: 'hr', status: 'active', employeeId: null },
  { id: 'user-faculty-1', name: 'Jomar Villareal', initials: 'JV', username: 'jvillareal', email: 'jvillareal@lssti.edu.ph', role: 'faculty', status: 'active', employeeId: 'emp-0142' },
  { id: 'user-faculty-2', name: 'Consolacion Bautista', initials: 'CB', username: 'cbautista', email: 'cbautista@lssti.edu.ph', role: 'faculty', status: 'active', employeeId: 'emp-0098' },
  { id: 'user-faculty-3', name: 'Teodoro Mendez', initials: 'TM', username: 'tmendez', email: 'tmendez@lssti.edu.ph', role: 'faculty', status: 'deactivated', employeeId: 'emp-0071' },
];

const seedAuditLog = [
  { id: 'a1', who: 'Amelia Reyes', role: 'HR Personnel', action: 'Uploaded a document for Employee #0142' },
  { id: 'a2', who: 'Ricardo Santos', role: 'System Administrator', action: 'Created account for new Faculty member' },
  { id: 'a3', who: 'Jomar Villareal', role: 'Faculty', action: 'Submitted a Training Certificate' },
  { id: 'a4', who: 'System', role: 'System', action: 'Automatic database backup completed' },
];

const seedMeta = { lastBackup: 'Today, 2:00 AM' };

async function main() {
  const dbName = process.env.DB_NAME || 'e201_fms';
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log(`Creating database "${dbName}" if it doesn't exist...`);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4`);
  await admin.end();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    multipleStatements: true,
  });

  console.log('Applying db/schema.sql (creates tables if they do not already exist)...');
  await conn.query(SCHEMA);

  // Migration: databases created before the photo feature was added won't have this
  // column yet (CREATE TABLE IF NOT EXISTS doesn't retroactively add columns).
  const [photoCol] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'photo_url'",
    [dbName]
  );
  if (photoCol.length === 0) {
    console.log('Migrating: adding photo_url column to employees...');
    await conn.query('ALTER TABLE employees ADD COLUMN photo_url VARCHAR(500) AFTER supervisor');
  }

  // Migration: databases created before the active/inactive status feature
  // won't have these columns yet.
  const [statusCol] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'status'",
    [dbName]
  );
  if (statusCol.length === 0) {
    console.log('Migrating: adding status/deactivation columns to employees...');
    await conn.query("ALTER TABLE employees ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER photo_url");
    await conn.query('ALTER TABLE employees ADD COLUMN deactivation_reason VARCHAR(60) AFTER status');
    await conn.query('ALTER TABLE employees ADD COLUMN deactivated_at VARCHAR(60) AFTER deactivation_reason');
  }

  // Migration: databases created before the training-certificate upload feature
  // won't have these columns yet.
  const [certCol] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'trainings' AND COLUMN_NAME = 'cert_file_url'",
    [dbName]
  );
  if (certCol.length === 0) {
    console.log('Migrating: adding cert_file_url/cert_file_name/cert_file_type columns to trainings...');
    await conn.query('ALTER TABLE trainings ADD COLUMN cert_file_url VARCHAR(500) AFTER cert_status');
    await conn.query('ALTER TABLE trainings ADD COLUMN cert_file_name VARCHAR(255) AFTER cert_file_url');
    await conn.query('ALTER TABLE trainings ADD COLUMN cert_file_type VARCHAR(100) AFTER cert_file_name');
  }

  // Migration: databases created before the CS Form 212 (PDS) feature won't
  // have the pds_details JSON blob column yet.
  const [pdsCol] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'pds_details'",
    [dbName]
  );
  if (pdsCol.length === 0) {
    console.log('Migrating: adding pds_details column to employees...');
    await conn.query('ALTER TABLE employees ADD COLUMN pds_details LONGTEXT AFTER deactivated_at');
  }

  // Migration: databases created before the PDS feature won't have the
  // Learning & Development extra columns on trainings yet.
  const [ldCol] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'trainings' AND COLUMN_NAME = 'from_date'",
    [dbName]
  );
  if (ldCol.length === 0) {
    console.log('Migrating: adding from_date/hours/ld_type/conducted_by columns to trainings...');
    await conn.query('ALTER TABLE trainings ADD COLUMN from_date VARCHAR(60) AFTER cert_file_type');
    await conn.query('ALTER TABLE trainings ADD COLUMN hours VARCHAR(20) AFTER from_date');
    await conn.query('ALTER TABLE trainings ADD COLUMN ld_type VARCHAR(60) AFTER hours');
    await conn.query('ALTER TABLE trainings ADD COLUMN conducted_by VARCHAR(200) AFTER ld_type');
  }

  // Migration: databases created before the PDS feature won't have the
  // Work Experience extra columns yet.
  const [weCol] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'work_experience' AND COLUMN_NAME = 'status_of_appointment'",
    [dbName]
  );
  if (weCol.length === 0) {
    console.log('Migrating: adding status_of_appointment/govt_service columns to work_experience...');
    await conn.query('ALTER TABLE work_experience ADD COLUMN status_of_appointment VARCHAR(100) AFTER description');
    await conn.query("ALTER TABLE work_experience ADD COLUMN govt_service ENUM('Y','N') AFTER status_of_appointment");
  }

  // Migration: databases created before the document review/approval feature
  // won't have the pending_* review columns, or the 'pending'/'rejected'
  // status values, on documents yet.
  const [docReviewCol] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'pending_file_url'",
    [dbName]
  );
  if (docReviewCol.length === 0) {
    console.log('Migrating: adding document review/approval columns to documents...');
    await conn.query("ALTER TABLE documents MODIFY COLUMN status ENUM('uploaded','missing','pending','rejected') NOT NULL DEFAULT 'missing'");
    await conn.query('ALTER TABLE documents ADD COLUMN pending_file_url VARCHAR(500) AFTER file_type');
    await conn.query('ALTER TABLE documents ADD COLUMN pending_file_name VARCHAR(255) AFTER pending_file_url');
    await conn.query('ALTER TABLE documents ADD COLUMN pending_file_type VARCHAR(100) AFTER pending_file_name');
    await conn.query('ALTER TABLE documents ADD COLUMN submitted_at VARCHAR(60) AFTER pending_file_type');
    await conn.query('ALTER TABLE documents ADD COLUMN reviewed_by VARCHAR(150) AFTER submitted_at');
    await conn.query('ALTER TABLE documents ADD COLUMN reviewed_at VARCHAR(60) AFTER reviewed_by');
    await conn.query('ALTER TABLE documents ADD COLUMN review_note VARCHAR(500) AFTER reviewed_at');
    await conn.query("ALTER TABLE notifications MODIFY COLUMN kind ENUM('missing_document','expiring_training','pending_document') NOT NULL");
  }

  console.log('Wiping existing demo data...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['notifications', 'documents', 'trainings', 'education', 'work_experience', 'civil_service_eligibility', 'voluntary_work', 'pds_references', 'performance_reviews', 'attendance_records', 'users', 'employees', 'audit_log', 'app_meta']) {
    await conn.query(`TRUNCATE TABLE ${table}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('Inserting employees, documents, and training records...');
  for (const emp of seedEmployees) {
    await conn.execute(
      `INSERT INTO employees (id, employee_number, initials, full_name, display_name, dob, civil_status, nationality, contact, email, address, department, position, employment_type, date_hired, employment_status, contract_start, contract_end, supervisor, pds_details)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        emp.id, emp.employeeNumber, emp.initials, emp.fullName, emp.displayName, emp.dob, emp.civilStatus,
        emp.nationality, emp.contact, emp.email, emp.address, emp.department, emp.position, emp.employmentType,
        emp.dateHired, emp.employmentStatus, emp.contractStart || null, emp.contractEnd || null, emp.supervisor,
        emp.pds ? JSON.stringify(emp.pds) : null,
      ]
    );
    for (const doc of emp.documents) {
      const docId = `${emp.id}-${doc.id}`;
      await conn.execute(
        'INSERT INTO documents (id, employee_id, name, status, uploaded_at) VALUES (?,?,?,?,?)',
        [docId, emp.id, doc.name, doc.status, doc.uploaded]
      );
      if (doc.status === 'missing') {
        await conn.execute(
          `INSERT INTO notifications (id, employee_id, document_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)`,
          [
            `n-${randomUUID()}`, emp.id, docId, 'missing_document',
            `${doc.name} missing`, `${emp.displayName} (#${emp.employeeNumber}) still needs to submit this document.`, 'unread',
          ]
        );
      }
    }
    for (const t of emp.training) {
      const trainingId = `${emp.id}-${t.id}`;
      await conn.execute(
        'INSERT INTO trainings (id, employee_id, course, provider, completed, cert_status, from_date, hours, ld_type, conducted_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [trainingId, emp.id, t.course, t.provider, t.completed, t.certStatus, t.fromDate || null, t.hours || null, t.ldType || null, t.conductedBy || null]
      );
      if (t.certStatus === 'expiring') {
        await conn.execute(
          `INSERT INTO notifications (id, employee_id, training_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)`,
          [
            `n-${randomUUID()}`, emp.id, trainingId, 'expiring_training',
            `${t.course} certificate expiring soon`, `${emp.displayName} (#${emp.employeeNumber}) — provided by ${t.provider}.`, 'unread',
          ]
        );
      }
    }
    for (const ed of emp.education || []) {
      await conn.execute(
        'INSERT INTO education (id, employee_id, level, school_name, degree, year_graduated, honors) VALUES (?,?,?,?,?,?,?)',
        [`${emp.id}-${ed.id}`, emp.id, ed.level || null, ed.schoolName, ed.degree || null, ed.yearGraduated || null, ed.honors || null]
      );
    }
    for (const w of emp.workExperience || []) {
      await conn.execute(
        'INSERT INTO work_experience (id, employee_id, company, position, from_date, to_date, description, status_of_appointment, govt_service) VALUES (?,?,?,?,?,?,?,?,?)',
        [`${emp.id}-${w.id}`, emp.id, w.company, w.position || null, w.fromDate || null, w.toDate || null, w.description || null, w.statusOfAppointment || null, w.govtService || null]
      );
    }
    for (const cse of emp.civilServiceEligibility || []) {
      await conn.execute(
        'INSERT INTO civil_service_eligibility (id, employee_id, name, rating, exam_date, exam_place, license_number, license_valid_until) VALUES (?,?,?,?,?,?,?,?)',
        [`${emp.id}-${cse.id}`, emp.id, cse.name, cse.rating || null, cse.examDate || null, cse.examPlace || null, cse.licenseNumber || null, cse.licenseValidUntil || null]
      );
    }
    for (const vw of emp.voluntaryWork || []) {
      await conn.execute(
        'INSERT INTO voluntary_work (id, employee_id, organization, from_date, to_date, hours, position) VALUES (?,?,?,?,?,?,?)',
        [`${emp.id}-${vw.id}`, emp.id, vw.organization, vw.fromDate || null, vw.toDate || null, vw.hours || null, vw.position || null]
      );
    }
    for (const ref of emp.pdsReferences || []) {
      await conn.execute(
        'INSERT INTO pds_references (id, employee_id, name, address, contact) VALUES (?,?,?,?,?)',
        [`${emp.id}-${ref.id}`, emp.id, ref.name, ref.address || null, ref.contact || null]
      );
    }
    for (const p of emp.performance || []) {
      await conn.execute(
        'INSERT INTO performance_reviews (id, employee_id, period, rating, reviewer, remarks) VALUES (?,?,?,?,?,?)',
        [`${emp.id}-${p.id}`, emp.id, p.period, p.rating || null, p.reviewer || null, p.remarks || null]
      );
    }
    for (const a of emp.attendance || []) {
      await conn.execute(
        'INSERT INTO attendance_records (id, employee_id, period, days_present, days_absent, days_late, remarks) VALUES (?,?,?,?,?,?,?)',
        [`${emp.id}-${a.id}`, emp.id, a.period, a.daysPresent ?? null, a.daysAbsent ?? null, a.daysLate ?? null, a.remarks || null]
      );
    }
  }

  console.log('Inserting user accounts...');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (const u of seedUsers) {
    await conn.execute(
      `INSERT INTO users (id, name, initials, username, email, password_hash, role, status, employee_id, last_active)
       VALUES (?,?,?,?,?,?,?,?,?, NOW())`,
      [u.id, u.name, u.initials, u.username, u.email, passwordHash, u.role, u.status, u.employeeId]
    );
  }

  console.log('Inserting audit log and meta...');
  for (const a of seedAuditLog) {
    await conn.execute('INSERT INTO audit_log (id, who, role, action) VALUES (?,?,?,?)', [
      `${a.id}-${randomUUID()}`, a.who, a.role, a.action,
    ]);
  }
  await conn.execute('INSERT INTO app_meta (meta_key, meta_value) VALUES (?,?)', ['lastBackup', seedMeta.lastBackup]);

  const [[{ notifCount }]] = await conn.query('SELECT COUNT(*) as notifCount FROM notifications');
  console.log(`Seeded ${seedEmployees.length} employees, ${seedUsers.length} users, ${seedAuditLog.length} audit log entries, ${notifCount} notifications.`);
  console.log(`Every seeded account's password is: ${DEFAULT_PASSWORD}`);
  await conn.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Database seed failed:', err);
  process.exit(1);
});
