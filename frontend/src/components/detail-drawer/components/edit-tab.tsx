"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface EditTabProps {
  selectedPerson: any;
  setSelectedPerson: (person: any | null) => void;
  token: string;
  loadTreeContext: () => Promise<void>;
  setToast: (toast: { message: string; type: "success" | "error" } | null) => void;
  setDrawerTab: (tab: "profile" | "edit" | "relations") => void;
}

export function EditTab({
  selectedPerson,
  setSelectedPerson,
  token,
  loadTreeContext,
  setToast,
  setDrawerTab,
}: EditTabProps) {
  // Editing forms state
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [editDeath, setEditDeath] = useState("");
  const [editAlive, setEditAlive] = useState(true);
  const [editNative, setEditNative] = useState("");
  const [editCurrent, setEditCurrent] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Sync state with selectedPerson
  useEffect(() => {
    if (selectedPerson) {
      setEditName(selectedPerson.name || "");
      setEditGender(selectedPerson.gender || "Male");
      setEditBirth(selectedPerson.birth_date || "");
      setEditDeath(selectedPerson.death_date || "");
      setEditAlive(selectedPerson.is_alive !== false); // default to true if undefined
      setEditNative(selectedPerson.native_place || "");
      setEditCurrent(selectedPerson.current_place || "");
      setEditJob(selectedPerson.occupation || "");
      setEditPhotoUrl(selectedPerson.photo_url || "");
    }
  }, [selectedPerson]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const formData = new FormData();
    formData.append("file", file);

    setPhotoUploading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/media/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setEditPhotoUrl(data.url);
        setToast({ message: "Avatar uploaded successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Image upload failed.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Image upload failed.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson || !token) return;

    setEditSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/people/${selectedPerson.person_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          gender: editGender,
          birth_date: editBirth || null,
          death_date: editAlive ? null : (editDeath || null),
          is_alive: editAlive,
          native_place: editNative || null,
          current_place: editCurrent || null,
          occupation: editJob || null,
          photo_url: editPhotoUrl || null
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedPerson(updated);
        await loadTreeContext();
        setDrawerTab("profile");
        setToast({ message: "Profile updated successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to update profile.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to update profile.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleEditProfile} className="space-y-4">
      {/* Photo Uploader */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
          Avatar Image
        </label>
        <div className="flex gap-4 items-center">
          <div className="h-14 w-14 rounded-lg bg-muted border flex items-center justify-center font-bold overflow-hidden shrink-0">
            {editPhotoUrl ? (
              <img src={editPhotoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              "?"
            )}
          </div>
          
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="avatar-photo-file"
            />
            <label
              htmlFor="avatar-photo-file"
              className="inline-flex cursor-pointer items-center justify-center px-4 py-2 border rounded-lg hover:bg-muted text-xs font-semibold transition"
            >
              {photoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-primary" /> : null}
              Change Photo
            </label>
            <p className="text-[10px] text-muted-foreground mt-1">Direct upload to Cloudinary CDN</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          Full Name
        </label>
        <input
          type="text"
          required
          placeholder="Input Member Name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Gender
          </label>
          <select
            value={editGender}
            onChange={(e) => setEditGender(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium text-foreground bg-popover"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="flex items-center pt-5 gap-2">
          <input
            type="checkbox"
            id="alive-swapper"
            checked={editAlive}
            onChange={(e) => setEditAlive(e.target.checked)}
            className="h-4 w-4 text-primary focus:ring-0 rounded"
          />
          <label htmlFor="alive-swapper" className="text-xs font-semibold select-none cursor-pointer">
            Is Alive?
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Birth Date
          </label>
          <input
            type="date"
            value={editBirth}
            onChange={(e) => setEditBirth(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground bg-popover"
          />
        </div>

        {!editAlive && (
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              Death Date
            </label>
            <input
              type="date"
              value={editDeath}
              onChange={(e) => setEditDeath(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground bg-popover"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          Birthplace (Native Origin)
        </label>
        <input
          type="text"
          placeholder="e.g. Berlin, Germany"
          value={editNative}
          onChange={(e) => setEditNative(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          Current Residence
        </label>
        <input
          type="text"
          placeholder="e.g. New York, USA"
          value={editCurrent}
          onChange={(e) => setEditCurrent(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          Occupation
        </label>
        <input
          type="text"
          placeholder="e.g. Software Architect"
          value={editJob}
          onChange={(e) => setEditJob(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-border">
        <button
          type="button"
          onClick={() => setDrawerTab("profile")}
          className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={editSubmitting}
          className="flex items-center gap-1 py-2 px-4 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground text-sm font-semibold transition"
        >
          {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Updates
        </button>
      </div>
    </form>
  );
}
