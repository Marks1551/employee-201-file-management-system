"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Loader2, Camera, Trash2 } from "lucide-react";
import Layout from "./Layout";
import { Card, Button, Field, inputCls } from "./ui";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";
import type { Role } from "@/shared/types";

const eyebrows: Record<Role, string> = {
  admin: "Admin › Account",
  hr: "HR › Account",
  faculty: "Faculty › Account",
};

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** Admin and HR edit their own display name and profile picture here.
 *  (Faculty don't get this page — HR edits faculty on the employee record.) */
export default function ProfilePage({ role }: { role: Role }) {
  const { currentUser, updateProfileName, uploadProfilePhoto, removeProfilePhoto } = useApp();
  const showToast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(currentUser?.name ?? "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<"upload" | "remove" | null>(null);

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError("");
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2 || trimmed.length > 100) {
      setNameError("Name must be 2 to 100 characters.");
      return;
    }
    if (trimmed === currentUser?.name) {
      setNameError("That's already your name.");
      return;
    }
    setSavingName(true);
    const result = await updateProfileName(trimmed).finally(() => setSavingName(false));
    if (!result.ok) {
      setNameError(result.error);
      showToast("Could not update your name.", "error");
      return;
    }
    setName(trimmed);
    showToast("Your name has been updated.");
  }

  async function handlePhotoChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again later
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      showToast("Please choose a JPG, PNG, or WEBP image.", "error");
      return;
    }
    if (file.size > MAX_SIZE) {
      showToast("Photo must be smaller than 5MB.", "error");
      return;
    }
    setPhotoBusy("upload");
    const result = await uploadProfilePhoto(file).finally(() => setPhotoBusy(null));
    if (result.ok) showToast("Profile picture updated.");
    else showToast(result.error, "error");
  }

  async function handleRemovePhoto() {
    if (!window.confirm("Remove your profile picture?")) return;
    setPhotoBusy("remove");
    const result = await removeProfilePhoto().finally(() => setPhotoBusy(null));
    if (result.ok) showToast("Profile picture removed.");
    else showToast(result.error, "error");
  }

  const photoUrl = currentUser?.photoUrl;

  return (
    <Layout role={role} eyebrow={eyebrows[role]} title="My Profile">
      <h2 className="mb-2">Profile picture</h2>
      <p className="text-ink-muted mb-5">Shown next to your name at the top of every page.</p>
      <Card className="max-w-md">
        <div className="flex items-center gap-5 flex-wrap">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Your profile"
              className="w-24 h-24 rounded-full object-cover border border-border flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-navy-100 text-navy flex items-center justify-center font-bold font-display text-3xl flex-shrink-0">
              {currentUser?.initials}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChosen}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy !== null}
            >
              {photoBusy === "upload" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Camera size={16} />
                  {photoUrl ? "Change photo" : "Upload photo"}
                </>
              )}
            </Button>
            {photoUrl && (
              <Button type="button" variant="ghost" onClick={handleRemovePhoto} disabled={photoBusy !== null}>
                {photoBusy === "remove" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Removing…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Remove photo
                  </>
                )}
              </Button>
            )}
            <span className="text-[0.78rem] text-ink-faint">JPG, PNG or WEBP, up to 5MB.</span>
          </div>
        </div>
      </Card>

      <h2 className="mt-8 mb-2">Name</h2>
      <p className="text-ink-muted mb-5">This is the name shown in the header and recorded in the audit log.</p>
      <Card className="max-w-md">
        <form onSubmit={handleNameSubmit}>
          <Field label="Full name">
            <input type="text" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          {nameError && (
            <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">
              {nameError}
            </p>
          )}
          <Button type="submit" disabled={savingName} className="disabled:opacity-70 disabled:cursor-not-allowed">
            {savingName ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save name"
            )}
          </Button>
        </form>
      </Card>
    </Layout>
  );
}
