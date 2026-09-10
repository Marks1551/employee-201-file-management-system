"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { roleLabel, roleHome, nowStamp } from "@/shared/lib/roles";
import type {
  Employee,
  User,
  AuditLogEntry,
  Notification,
  AppMeta,
  Role,
  EmployeeStatus,
  EmployeeInput,
} from "@/shared/types";

export { roleLabel, roleHome };

/** Result shape returned by most mutating actions below. */
export type ActionResult = { ok: true; error?: undefined } | { ok: false; error: string };

interface ApiOptions {
  method?: string;
  body?: unknown;
}

async function api<T = any>(url: string, { method = "GET", body }: ApiOptions = {}): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong. Please try again.");
  return data as T;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

/** Generic add/update/delete actions for a per-employee record sub-resource
 *  (education, work experience, performance, attendance) — all share the same
 *  { employee } response shape. */
interface RecordActions<TInput> {
  add: (employeeId: string, data: TInput) => Promise<ActionResult>;
  update: (employeeId: string, recordId: string, patch: Partial<TInput>) => Promise<ActionResult>;
  remove: (employeeId: string, recordId: string) => Promise<ActionResult>;
}

export interface AppContextValue {
  employees: Employee[];
  users: User[];
  auditLog: AuditLogEntry[];
  notifications: Notification[];
  meta: AppMeta;
  ready: boolean;
  currentUser: User | null;
  currentEmployee: Employee | null;

  login: (identifier: string, password: string) => Promise<{ ok: true; user: User } | { ok: false; error: string }>;
  loginAsDemo: (role: Role) => Promise<User | null>;
  logout: () => Promise<void>;

  /** Completes account setup (new account) or a password reset (existing
   *  account) using the token from an emailed link, and signs the user in. */
  completeAccountSetup: (
    token: string,
    password: string,
  ) => Promise<{ ok: true; user: User } | { ok: false; error: string }>;
  /** Requests a password-reset email for a username/email. Always resolves
   *  { ok: true } — the server never reveals whether the identifier matched
   *  an account. */
  requestPasswordReset: (identifier: string) => Promise<ActionResult>;
  /** Re-sends the setup email for an account still pending password setup. */
  resendInvite: (userId: string) => Promise<ActionResult>;

  addUser: (data: Record<string, unknown>) => Promise<string | null>;
  /** Creates an account either from an employee number (pulls name/email from
   *  their 201 file) or, when omitted, from a name + email typed directly —
   *  used for HR/Admin staff who don't have a 201 file on record. Either
   *  `employeeNumber` or both `name` and `email` must be provided. */
  addUserInvite: (data: {
    employeeNumber?: string;
    name?: string;
    email?: string;
    role: Role;
  }) => Promise<ActionResult>;
  updateUser: (id: string, patch: Record<string, unknown>) => Promise<void>;
  setUserStatus: (id: string, status: string) => Promise<void>;
  setUserRole: (id: string, role: Role) => Promise<void>;
  changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<ActionResult>;

  addEmployee: (data: EmployeeInput) => Promise<string | null>;
  updateEmployee: (id: string, patch: Partial<EmployeeInput>) => Promise<void>;
  setEmployeeStatus: (id: string, status: EmployeeStatus, reason?: string | null) => Promise<ActionResult>;
  deleteEmployee: (id: string) => Promise<ActionResult>;

  uploadDocument: (employeeId: string, docId: string, docFile?: File | null) => Promise<ActionResult>;
  removeDocument: (employeeId: string, docId: string) => Promise<ActionResult>;
  approveDocument: (employeeId: string, docId: string) => Promise<ActionResult>;
  rejectDocument: (employeeId: string, docId: string, note?: string) => Promise<ActionResult>;
  uploadEmployeePhoto: (employeeId: string, photoFile: File) => Promise<ActionResult>;
  removeEmployeePhoto: (employeeId: string) => Promise<ActionResult>;
  submitDocument: (
    employeeId: string | null | undefined,
    docTypeName: string,
    docFile?: File | null,
  ) => Promise<ActionResult>;

  addTraining: (employeeId: string, data: Record<string, unknown>) => Promise<ActionResult>;
  updateTraining: (employeeId: string, trainingId: string, patch: Record<string, unknown>) => Promise<ActionResult>;
  deleteTraining: (employeeId: string, trainingId: string) => Promise<ActionResult>;
  uploadTrainingCertificate: (employeeId: string, trainingId: string, certFile: File) => Promise<ActionResult>;
  removeTrainingCertificate: (employeeId: string, trainingId: string) => Promise<ActionResult>;

  addEducation: RecordActions<Record<string, unknown>>["add"];
  updateEducation: RecordActions<Record<string, unknown>>["update"];
  deleteEducation: RecordActions<Record<string, unknown>>["remove"];

  addWorkExperience: RecordActions<Record<string, unknown>>["add"];
  updateWorkExperience: RecordActions<Record<string, unknown>>["update"];
  deleteWorkExperience: RecordActions<Record<string, unknown>>["remove"];

  addPerformanceReview: RecordActions<Record<string, unknown>>["add"];
  updatePerformanceReview: RecordActions<Record<string, unknown>>["update"];
  deletePerformanceReview: RecordActions<Record<string, unknown>>["remove"];

  addAttendanceRecord: RecordActions<Record<string, unknown>>["add"];
  updateAttendanceRecord: RecordActions<Record<string, unknown>>["update"];
  deleteAttendanceRecord: RecordActions<Record<string, unknown>>["remove"];

  addCivilServiceEligibility: RecordActions<Record<string, unknown>>["add"];
  updateCivilServiceEligibility: RecordActions<Record<string, unknown>>["update"];
  deleteCivilServiceEligibility: RecordActions<Record<string, unknown>>["remove"];

  addVoluntaryWork: RecordActions<Record<string, unknown>>["add"];
  updateVoluntaryWork: RecordActions<Record<string, unknown>>["update"];
  deleteVoluntaryWork: RecordActions<Record<string, unknown>>["remove"];

  addPdsReference: RecordActions<Record<string, unknown>>["add"];
  updatePdsReference: RecordActions<Record<string, unknown>>["update"];
  deletePdsReference: RecordActions<Record<string, unknown>>["remove"];

  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  backupNow: () => Promise<string>;

  logAction: (who: string, role: string, action: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<AppMeta>({ lastBackup: "" });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refreshAll = useCallback(async () => {
    const [empRes, usersRes, auditRes, metaRes, notifRes] = await Promise.all([
      api<{ employees: Employee[] }>("/api/employees"),
      api<{ users: User[] }>("/api/users"),
      api<{ auditLog: AuditLogEntry[] }>("/api/audit-log"),
      api<{ meta: AppMeta }>("/api/meta"),
      api<{ notifications: Notification[] }>("/api/notifications"),
    ]);
    setEmployees(empRes.employees);
    setUsers(usersRes.users);
    setAuditLog(auditRes.auditLog);
    setMeta({ lastBackup: metaRes.meta.lastBackup || "" });
    setNotifications(notifRes.notifications);
  }, []);

  // On first load, check for an existing session (httpOnly cookie) and hydrate data.
  useEffect(() => {
    (async () => {
      try {
        const { user } = await api<{ user: User | null }>("/api/auth/me");
        setCurrentUser(user);
        if (user) await refreshAll();
      } catch {
        // not signed in / server unreachable — leave defaults
      } finally {
        setReady(true);
      }
    })();
  }, [refreshAll]);

  const currentEmployee = useMemo(
    () => (currentUser?.employeeId ? employees.find((e) => e.id === currentUser.employeeId) || null : null),
    [employees, currentUser],
  );

  // ---------- auth ----------
  const login = useCallback(
    async (identifier: string, password: string) => {
      try {
        const { user } = await api<{ user: User }>("/api/auth/login", {
          method: "POST",
          body: { identifier, password },
        });
        setCurrentUser(user);
        await refreshAll();
        return { ok: true as const, user };
      } catch (err) {
        return { ok: false as const, error: errorMessage(err) };
      }
    },
    [refreshAll],
  );

  const loginAsDemo = useCallback(
    async (role: Role) => {
      try {
        const { user } = await api<{ user: User }>("/api/auth/demo", { method: "POST", body: { role } });
        setCurrentUser(user);
        await refreshAll();
        return user;
      } catch {
        return null;
      }
    },
    [refreshAll],
  );

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — clear local state regardless
    }
    setCurrentUser(null);
    setEmployees([]);
    setUsers([]);
    setAuditLog([]);
    setNotifications([]);
    setMeta({ lastBackup: "" });
  }, []);

  const completeAccountSetup = useCallback(
    async (token: string, password: string) => {
      try {
        const { user } = await api<{ user: User }>("/api/auth/account-setup", {
          method: "POST",
          body: { token, password },
        });
        setCurrentUser(user);
        await refreshAll();
        return { ok: true as const, user };
      } catch (err) {
        return { ok: false as const, error: errorMessage(err) };
      }
    },
    [refreshAll],
  );

  const requestPasswordReset = useCallback(async (identifier: string): Promise<ActionResult> => {
    try {
      await api("/api/auth/request-reset", { method: "POST", body: { identifier } });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  const resendInvite = useCallback(
    async (userId: string): Promise<ActionResult> => {
      try {
        await api(`/api/users/${userId}/resend-invite`, { method: "POST" });
        await refreshAll();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [refreshAll],
  );

  // ---------- users / accounts ----------
  const addUser = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        const { id } = await api<{ id: string }>("/api/users", { method: "POST", body: data });
        await refreshAll();
        return id;
      } catch (err) {
        console.error("addUser failed:", errorMessage(err));
        return null;
      }
    },
    [refreshAll],
  );

  /** Creates an account from an employee number, or from a name + email when
   *  no employee number is given (HR/Admin staff without a 201 file). */
  const addUserInvite = useCallback(
    async (data: { employeeNumber?: string; name?: string; email?: string; role: Role }): Promise<ActionResult> => {
      try {
        await api("/api/users/invite", { method: "POST", body: data });
        await refreshAll();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [refreshAll],
  );

  const updateUser = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      try {
        await api(`/api/users/${id}`, { method: "PATCH", body: patch });
        await refreshAll();
      } catch (err) {
        console.error("updateUser failed:", errorMessage(err));
      }
    },
    [refreshAll],
  );

  const setUserStatus = useCallback(
    async (id: string, status: string) => {
      try {
        await api(`/api/users/${id}`, { method: "PATCH", body: { status } });
        await refreshAll();
      } catch (err) {
        console.error("setUserStatus failed:", errorMessage(err));
      }
    },
    [refreshAll],
  );

  const setUserRole = useCallback(
    async (id: string, role: Role) => {
      try {
        await api(`/api/users/${id}`, { method: "PATCH", body: { role } });
        await refreshAll();
      } catch (err) {
        console.error("setUserRole failed:", errorMessage(err));
      }
    },
    [refreshAll],
  );

  /** Returns { ok, error? } — the current password is verified server-side. */
  const changePassword = useCallback(
    async (userId: string, currentPassword: string, newPassword: string): Promise<ActionResult> => {
      try {
        await api("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  // ---------- employees ----------
  const addEmployee = useCallback(
    async (data: EmployeeInput) => {
      try {
        const { id } = await api<{ id: string }>("/api/employees", { method: "POST", body: data });
        await refreshAll();
        return id;
      } catch (err) {
        console.error("addEmployee failed:", errorMessage(err));
        return null;
      }
    },
    [refreshAll],
  );

  const updateEmployee = useCallback(async (id: string, patch: Partial<EmployeeInput>) => {
    try {
      const { employee } = await api<{ employee: Employee }>(`/api/employees/${id}`, { method: "PATCH", body: patch });
      setEmployees((list) => list.map((e) => (e.id === id ? employee : e)));
    } catch (err) {
      console.error("updateEmployee failed:", errorMessage(err));
    }
  }, []);

  /** Activates or deactivates an employee's 201 file. `reason` is required when
   *  status is 'inactive' (one of the DEACTIVATION_REASONS). Returns { ok, error? }. */
  const setEmployeeStatus = useCallback(
    async (id: string, status: EmployeeStatus, reason?: string | null): Promise<ActionResult> => {
      try {
        const { employee } = await api<{ employee: Employee }>(`/api/employees/${id}`, {
          method: "PATCH",
          body: { status, deactivationReason: reason ?? null },
        });
        setEmployees((list) => list.map((e) => (e.id === id ? employee : e)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  /** Permanently deletes an employee record. Returns { ok, error? }. */
  const deleteEmployee = useCallback(async (id: string): Promise<ActionResult> => {
    try {
      await api(`/api/employees/${id}`, { method: "DELETE" });
      setEmployees((list) => list.filter((e) => e.id !== id));
      setNotifications((list) => list.filter((n) => n.employeeId !== id));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  /** docFile is optional — a File from an <input type="file">. When
   *  omitted, the document is simply flagged as uploaded with no file stored.
   *  Returns { ok, error? }. */
  const uploadDocument = useCallback(
    async (employeeId: string, docId: string, docFile?: File | null): Promise<ActionResult> => {
      try {
        const body = new FormData();
        if (docFile) body.append("file", docFile);
        const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Document upload failed.");
        setEmployees((list) => list.map((e) => (e.id === employeeId ? data.employee : e)));
        const { notifications: fresh } = await api<{ notifications: Notification[] }>("/api/notifications");
        setNotifications(fresh);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  /** Reverts a document back to "missing" and deletes its stored file, if any.
   *  Returns { ok, error? }. */
  const removeDocument = useCallback(async (employeeId: string, docId: string): Promise<ActionResult> => {
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove document.");
      setEmployees((list) => list.map((e) => (e.id === employeeId ? data.employee : e)));
      const { notifications: fresh } = await api<{ notifications: Notification[] }>("/api/notifications");
      setNotifications(fresh);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  /** Approves a faculty-submitted document: the submitted file becomes the
   *  file of record and the document flips to "uploaded". Returns { ok, error? }. */
  const approveDocument = useCallback(async (employeeId: string, docId: string): Promise<ActionResult> => {
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents/${docId}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not approve document.");
      setEmployees((list) => list.map((e) => (e.id === employeeId ? data.employee : e)));
      const { notifications: fresh } = await api<{ notifications: Notification[] }>("/api/notifications");
      setNotifications(fresh);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  /** Rejects a faculty-submitted document: the submitted file is discarded
   *  and never applied to the record; an optional note explains why.
   *  Returns { ok, error? }. */
  const rejectDocument = useCallback(
    async (employeeId: string, docId: string, note?: string): Promise<ActionResult> => {
      try {
        const res = await fetch(`/api/employees/${employeeId}/documents/${docId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note || "" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not reject document.");
        setEmployees((list) => list.map((e) => (e.id === employeeId ? data.employee : e)));
        const { notifications: fresh } = await api<{ notifications: Notification[] }>("/api/notifications");
        setNotifications(fresh);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  /** photoFile is a File from an <input type="file">. Returns { ok, error? }. */
  const uploadEmployeePhoto = useCallback(async (employeeId: string, photoFile: File): Promise<ActionResult> => {
    try {
      const body = new FormData();
      body.append("photo", photoFile);
      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Photo upload failed.");
      setEmployees((list) => list.map((e) => (e.id === employeeId ? data.employee : e)));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  const removeEmployeePhoto = useCallback(async (employeeId: string): Promise<ActionResult> => {
    try {
      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove photo.");
      setEmployees((list) => list.map((e) => (e.id === employeeId ? data.employee : e)));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  /** docFile is optional — a File from an <input type="file">. Returns { ok, error? }. */
  const submitDocument = useCallback(
    async (
      employeeId: string | null | undefined,
      docTypeName: string,
      docFile?: File | null,
    ): Promise<ActionResult> => {
      try {
        const body = new FormData();
        body.append("docTypeName", docTypeName);
        if (employeeId) body.append("employeeId", employeeId);
        if (docFile) body.append("file", docFile);
        const res = await fetch("/api/documents/submit", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Document submission failed.");
        await refreshAll();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [refreshAll],
  );

  // ---------- training ----------
  const addTraining = useCallback(async (employeeId: string, data: Record<string, unknown>): Promise<ActionResult> => {
    try {
      const { employee } = await api<{ employee: Employee }>(`/api/employees/${employeeId}/trainings`, {
        method: "POST",
        body: data,
      });
      setEmployees((list) => list.map((e) => (e.id === employeeId ? employee : e)));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  const updateTraining = useCallback(
    async (employeeId: string, trainingId: string, patch: Record<string, unknown>): Promise<ActionResult> => {
      try {
        const { employee } = await api<{ employee: Employee }>(`/api/employees/${employeeId}/trainings/${trainingId}`, {
          method: "PATCH",
          body: patch,
        });
        setEmployees((list) => list.map((e) => (e.id === employeeId ? employee : e)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  const deleteTraining = useCallback(async (employeeId: string, trainingId: string): Promise<ActionResult> => {
    try {
      const { employee } = await api<{ employee: Employee }>(`/api/employees/${employeeId}/trainings/${trainingId}`, {
        method: "DELETE",
      });
      setEmployees((list) => list.map((e) => (e.id === employeeId ? employee : e)));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }, []);

  /** certFile is a File from an <input type="file">. Returns { ok, error? }. */
  const uploadTrainingCertificate = useCallback(
    async (employeeId: string, trainingId: string, certFile: File): Promise<ActionResult> => {
      try {
        const body = new FormData();
        body.append("file", certFile);
        const res = await fetch(`/api/employees/${employeeId}/trainings/${trainingId}/certificate`, {
          method: "POST",
          body,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Certificate upload failed.");
        setEmployees((list) => list.map((e) => (e.id === employeeId ? data.employee : e)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  const removeTrainingCertificate = useCallback(
    async (employeeId: string, trainingId: string): Promise<ActionResult> => {
      try {
        const res = await fetch(`/api/employees/${employeeId}/trainings/${trainingId}/certificate`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not remove certificate.");
        setEmployees((list) => list.map((e) => (e.id === employeeId ? data.employee : e)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  // ---------- generic record CRUD (education, work experience, performance, attendance) ----------
  function makeRecordActions(basePath: string): RecordActions<Record<string, unknown>> {
    const add = async (employeeId: string, data: Record<string, unknown>): Promise<ActionResult> => {
      try {
        const { employee } = await api<{ employee: Employee }>(`/api/employees/${employeeId}/${basePath}`, {
          method: "POST",
          body: data,
        });
        setEmployees((list) => list.map((e) => (e.id === employeeId ? employee : e)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    };
    const update = async (
      employeeId: string,
      recordId: string,
      patch: Record<string, unknown>,
    ): Promise<ActionResult> => {
      try {
        const { employee } = await api<{ employee: Employee }>(`/api/employees/${employeeId}/${basePath}/${recordId}`, {
          method: "PATCH",
          body: patch,
        });
        setEmployees((list) => list.map((e) => (e.id === employeeId ? employee : e)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    };
    const remove = async (employeeId: string, recordId: string): Promise<ActionResult> => {
      try {
        const { employee } = await api<{ employee: Employee }>(`/api/employees/${employeeId}/${basePath}/${recordId}`, {
          method: "DELETE",
        });
        setEmployees((list) => list.map((e) => (e.id === employeeId ? employee : e)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    };
    return { add, update, remove };
  }

  const educationActions = useMemo(() => makeRecordActions("education"), []);
  const addEducation = educationActions.add;
  const updateEducation = educationActions.update;
  const deleteEducation = educationActions.remove;

  const workExperienceActions = useMemo(() => makeRecordActions("work-experience"), []);
  const addWorkExperience = workExperienceActions.add;
  const updateWorkExperience = workExperienceActions.update;
  const deleteWorkExperience = workExperienceActions.remove;

  const performanceActions = useMemo(() => makeRecordActions("performance"), []);
  const addPerformanceReview = performanceActions.add;
  const updatePerformanceReview = performanceActions.update;
  const deletePerformanceReview = performanceActions.remove;

  const attendanceActions = useMemo(() => makeRecordActions("attendance"), []);
  const addAttendanceRecord = attendanceActions.add;
  const updateAttendanceRecord = attendanceActions.update;
  const deleteAttendanceRecord = attendanceActions.remove;

  const eligibilityActions = useMemo(() => makeRecordActions("civil-service-eligibility"), []);
  const addCivilServiceEligibility = eligibilityActions.add;
  const updateCivilServiceEligibility = eligibilityActions.update;
  const deleteCivilServiceEligibility = eligibilityActions.remove;

  const voluntaryWorkActions = useMemo(() => makeRecordActions("voluntary-work"), []);
  const addVoluntaryWork = voluntaryWorkActions.add;
  const updateVoluntaryWork = voluntaryWorkActions.update;
  const deleteVoluntaryWork = voluntaryWorkActions.remove;

  const pdsReferenceActions = useMemo(() => makeRecordActions("pds-references"), []);
  const addPdsReference = pdsReferenceActions.add;
  const updatePdsReference = pdsReferenceActions.update;
  const deletePdsReference = pdsReferenceActions.remove;

  // ---------- backup ----------
  const backupNow = useCallback(async () => {
    const res = await fetch("/api/backup", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || "Backup failed. Please try again.");
    }
    const stamp = res.headers.get("X-Backup-Stamp") || nowStamp();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch?.[1] || "backup.sql";

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setMeta((m) => ({ ...m, lastBackup: stamp }));
    return stamp;
  }, []);

  // ---------- notifications ----------
  const markNotificationRead = useCallback(async (id: string) => {
    try {
      const { notifications: fresh } = await api<{ notifications: Notification[] }>(`/api/notifications/${id}`, {
        method: "PATCH",
      });
      setNotifications(fresh);
    } catch (err) {
      console.error("markNotificationRead failed:", errorMessage(err));
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      const { notifications: fresh } = await api<{ notifications: Notification[] }>("/api/notifications/read-all", {
        method: "POST",
      });
      setNotifications(fresh);
    } catch (err) {
      console.error("markAllNotificationsRead failed:", errorMessage(err));
    }
  }, []);

  // ---------- audit log ----------
  const logAction = useCallback(async (who: string, role: string, action: string) => {
    try {
      await api("/api/audit-log", { method: "POST", body: { who, role, action } });
      const { auditLog: fresh } = await api<{ auditLog: AuditLogEntry[] }>("/api/audit-log");
      setAuditLog(fresh);
    } catch (err) {
      console.error("logAction failed:", errorMessage(err));
    }
  }, []);

  const value: AppContextValue = {
    employees,
    users,
    auditLog,
    notifications,
    meta,
    ready,
    currentUser,
    currentEmployee,
    login,
    loginAsDemo,
    logout,
    completeAccountSetup,
    requestPasswordReset,
    resendInvite,
    addUser,
    addUserInvite,
    updateUser,
    setUserStatus,
    setUserRole,
    changePassword,
    addEmployee,
    updateEmployee,
    setEmployeeStatus,
    deleteEmployee,
    uploadDocument,
    removeDocument,
    approveDocument,
    rejectDocument,
    uploadEmployeePhoto,
    removeEmployeePhoto,
    submitDocument,
    addTraining,
    updateTraining,
    deleteTraining,
    uploadTrainingCertificate,
    removeTrainingCertificate,
    addEducation,
    updateEducation,
    deleteEducation,
    addWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,
    addPerformanceReview,
    updatePerformanceReview,
    deletePerformanceReview,
    addAttendanceRecord,
    updateAttendanceRecord,
    deleteAttendanceRecord,
    addCivilServiceEligibility,
    updateCivilServiceEligibility,
    deleteCivilServiceEligibility,
    addVoluntaryWork,
    updateVoluntaryWork,
    deleteVoluntaryWork,
    addPdsReference,
    updatePdsReference,
    deletePdsReference,
    markNotificationRead,
    markAllNotificationsRead,
    backupNow,
    logAction,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
