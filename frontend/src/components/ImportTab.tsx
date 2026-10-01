"use client";

import React, { useState } from "react";
import { formatErrorMessage } from "../lib/utils";
import { 
  Upload, 
  GitMerge, 
  Trash2, 
  FileCheck, 
  Zap, 
  Heart, 
  Clock, 
  Layers, 
  Sparkles, 
  Check, 
  AlertTriangle,
  FileText,
  Sliders,
  RefreshCw,
  ShieldAlert,
  Plus,
  X
} from "lucide-react";

interface RawFile {
  id: string;
  filename: string;
  file_type: string;
  upload_time: string;
  start_time?: string;
  end_time?: string;
  sensors_present: string[];
  status: string;
}

interface ImportTabProps {
  unmergedFiles: RawFile[];
  workouts?: any[];
  onUploadSuccess: () => void;
  onRefreshData: (shouldSync?: boolean) => void;
  apiUrl: string;
}

export const ImportTab: React.FC<ImportTabProps> = ({
  unmergedFiles,
  workouts = [],
  onUploadSuccess,
  onRefreshData,
  apiUrl
}) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [attachTargetWorkout, setAttachTargetWorkout] = useState<any | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [manageTargetWorkout, setManageTargetWorkout] = useState<any | null>(null);
  const [sourceFiles, setSourceFiles] = useState<RawFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Sort unmerged files strictly newest to oldest
  const sortedUnmergedFiles = React.useMemo(() => {
    return [...unmergedFiles].sort((a, b) => {
      const tA = new Date(a.start_time || a.upload_time).getTime();
      const tB = new Date(b.start_time || b.upload_time).getTime();
      return tB - tA;
    });
  }, [unmergedFiles]);

  // Sort all workouts strictly newest to oldest
  const sortedWorkouts = React.useMemo(() => {
    return [...workouts].sort((a, b) => {
      const tA = new Date(a.timestamp || a.started_at || 0).getTime();
      const tB = new Date(b.timestamp || b.started_at || 0).getTime();
      return tB - tA;
    });
  }, [workouts]);

  const [manualFormData, setManualFormData] = useState({
    title: "",
    timestamp: new Date().toISOString().slice(0, 16),
    duration_minutes: "60",
    distance_km: "30",
    tss: "50",
    np: "200",
    avg_hr: "140"
  });

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch(`${apiUrl}/api/files/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setMessage({ type: "success", text: `${files.length} workout file(s) uploaded successfully!` });
        onUploadSuccess();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: formatErrorMessage(err, "File upload failed.") });
      }
    } catch (err) {
      setMessage({ type: "error", text: formatErrorMessage(err, "Error uploading files.") });
    } finally {
      setUploading(false);
    }
  };

  // Toggle selection
  const toggleSelectFile = (id: string) => {
    setSelectedFileIds(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  // Select all
  const selectAllFiles = () => {
    if (selectedFileIds.length === unmergedFiles.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(unmergedFiles.map(f => f.id));
    }
  };

  // Delete Individual Raw File
  const handleDeleteFile = async (id: string, filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete file "${filename}" from the server?`)) return;

    try {
      const res = await fetch(`${apiUrl}/api/files/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: `File "${filename}" deleted from server.` });
        setSelectedFileIds(prev => prev.filter(fId => fId !== id));
        onRefreshData();
      } else {
        setMessage({ type: "error", text: "Failed to delete file." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error deleting file." });
    }
  };

  // Cleanup Duplicates from Server
  const handleCleanupDuplicates = async () => {
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/api/workouts/cleanup-duplicates`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: data.message || "Server duplicate cleanup completed!" });
        onRefreshData();
      } else {
        setMessage({ type: "error", text: "Duplicate cleanup failed." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error cleaning up duplicates." });
    }
  };

  // Manual Selection Merge
  const handleManualMerge = async () => {
    if (selectedFileIds.length < 2) {
      alert("Please select at least two files to merge.");
      return;
    }

    setMerging(true);
    setMessage(null);

    try {
      const res = await fetch(`${apiUrl}/api/workouts/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_file_ids: selectedFileIds }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Selected workout files merged successfully!" });
        setSelectedFileIds([]);
        onRefreshData();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: formatErrorMessage(err, "Merge failed.") });
      }
    } catch (err) {
      setMessage({ type: "error", text: formatErrorMessage(err, "Error in merge request.") });
    } finally {
      setMerging(false);
    }
  };

  // Auto-Merge (Overlapping Time Windows)
  const handleAutoMerge = async () => {
    setMerging(true);
    setMessage(null);

    try {
      const res = await fetch(`${apiUrl}/api/workouts/auto-merge`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: data.message || "Auto-merge completed!" });
        onRefreshData();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: formatErrorMessage(err, "Auto-merge failed.") });
      }
    } catch (err) {
      setMessage({ type: "error", text: formatErrorMessage(err, "Error performing auto-merge.") });
    } finally {
      setMerging(false);
    }
  };

  // Save Manual Workout Entry
  const handleSaveManualWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: manualFormData.title || "Manual Workout",
        timestamp: manualFormData.timestamp ? new Date(manualFormData.timestamp).toISOString() : new Date().toISOString(),
        duration_seconds: Number(manualFormData.duration_minutes) * 60,
        distance_meters: Number(manualFormData.distance_km) * 1000,
        tss: Number(manualFormData.tss) || 0,
        np: Number(manualFormData.np) || 0,
        average_hr: Number(manualFormData.avg_hr) || 0
      };

      const res = await fetch(`${apiUrl}/api/workouts/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Manual workout added successfully!" });
        setShowManualModal(false);
        onRefreshData();
      } else {
        setMessage({ type: "success", text: "Workout created." });
        setShowManualModal(false);
        onRefreshData();
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error creating workout." });
    }
  };

  // Database Wipe / Reset
  const handleWipeDatabase = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/settings/reset`, { method: "POST" });
      if (res.ok) {
        setMessage({ type: "success", text: "All workout data and files cleared from database." });
        setShowWipeModal(false);
        onRefreshData();
      } else {
        setMessage({ type: "error", text: "Failed to reset database." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Connection error resetting database." });
    }
  };

  // Attach FIT File to existing Workout with date check confirmation
  const handleAttachFileToWorkout = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !attachTargetWorkout) return;

    const file = files[0];
    const attachConfirm = confirm(
      `Attach file "${file.name}" to workout "${attachTargetWorkout.title}"?\n\nData will be aligned and recalculated on the server.`
    );
    if (!attachConfirm) return;

    setAttaching(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl}/api/workouts/${attachTargetWorkout.id}/attach-file`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: data.message || "File attached to workout and data updated on server!" });
        setAttachTargetWorkout(null);
        onRefreshData(true);
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: formatErrorMessage(err, "Failed to attach file.") });
      }
    } catch (err) {
      setMessage({ type: "error", text: formatErrorMessage(err, "Error attaching file.") });
    } finally {
      setAttaching(false);
    }
  };

  // Fetch source files for target workout
  const handleOpenManageModal = async (w: any) => {
    setManageTargetWorkout(w);
    setLoadingFiles(true);
    try {
      const res = await fetch(`${apiUrl}/api/workouts/${w.id}/source-files`);
      if (res.ok) {
        const files = await res.json();
        setSourceFiles(files);
      } else {
        setSourceFiles([]);
      }
    } catch (err) {
      setSourceFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Detach a single raw file from a workout
  const handleDetachFile = async (fileId: string, filename: string) => {
    if (!manageTargetWorkout) return;
    if (!confirm(`Are you sure you want to detach "${filename}" from this workout?\n\nThe file will be returned to the unprocessed files list.`)) return;

    try {
      const res = await fetch(`${apiUrl}/api/workouts/${manageTargetWorkout.id}/detach-file/${fileId}`, {
        method: "POST"
      });

      if (res.ok) {
        setMessage({ type: "success", text: `File "${filename}" detached from workout and returned to raw files!` });
        setManageTargetWorkout(null);
        onRefreshData();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: formatErrorMessage(err, "Failed to detach file.") });
      }
    } catch (err) {
      setMessage({ type: "error", text: formatErrorMessage(err, "Error detaching file from workout.") });
    }
  };

  // Unmerge entire workout back into separate files
  const handleUnmergeEntireWorkout = async () => {
    if (!manageTargetWorkout) return;
    if (!confirm(`Are you sure you want to completely unmerge workout "${manageTargetWorkout.title}"?\n\nFiles will be restored as separate workouts.`)) return;

    try {
      const res = await fetch(`${apiUrl}/api/workouts/${manageTargetWorkout.id}/unmerge`, {
        method: "POST"
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Workout unmerged! Files restored as separate workouts." });
        setManageTargetWorkout(null);
        onRefreshData();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: formatErrorMessage(err, "Unmerge failed.") });
      }
    } catch (err) {
      setMessage({ type: "error", text: formatErrorMessage(err, "Error unmerging workout.") });
    }
  };

  // Push all local workouts & merged data up to central remote server
  const [pushing, setPushing] = useState(false);

  const handlePushToServer = async () => {
    setPushing(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/api/workouts/push-to-server`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: data.message || "All merged data pushed to main server!" });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: formatErrorMessage(err, "Pushing to server failed.") });
      }
    } catch (err) {
      setMessage({ type: "error", text: formatErrorMessage(err, "Error pushing data to server.") });
    } finally {
      setPushing(false);
    }
  };

  const handlePullFromServer = async () => {
    setMessage(null);
    try {
      const res = await fetch(`${apiUrl}/api/workouts/sync-from-server`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: data.message || "Workouts synced from server successfully!" });
        onRefreshData(false);
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: formatErrorMessage(err, "Syncing from server failed.") });
      }
    } catch (err) {
      setMessage({ type: "error", text: formatErrorMessage(err, "Error connecting to remote sync server.") });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-slate-900">
      
      {/* Title Header with Server Controls */}
      <div className="bg-white rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Upload className="w-7 h-7 text-[#0071e3]" />
            <span>Files & Workout Data</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium max-w-2xl">
            Upload new `.fit`, `.gpx` or `.zip` workout files, sync with remote server, or merge data from multiple devices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onRefreshData(true)}
            className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#eaeaea] text-slate-900 text-xs font-bold rounded-full transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>Päivitä</span>
          </button>
          
          <button
            onClick={handlePullFromServer}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            <span>Synkronoi palvelimelta (Pull)</span>
          </button>

          <button
            onClick={handlePushToServer}
            disabled={pushing}
            className="px-4 py-2 bg-[#0071e3] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-full transition flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Upload className="w-3.5 h-3.5 text-white" />
            <span>{pushing ? "Lähetetään..." : "Lähetä palvelimelle (Push)"}</span>
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="px-4 py-2 bg-[#0071e3] hover:bg-blue-600 text-white text-xs font-bold rounded-full transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add manual workout</span>
          </button>
        </div>
      </div>

      {/* Message Notifications */}
      {message && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex justify-between items-center ${
          message.type === "success" 
            ? "bg-black text-white" 
            : "bg-[#1c1c1e] text-white"
        }`}>
          <span>{typeof message.text === "string" ? message.text : formatErrorMessage(message.text, "Notice")}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* 1. FILE UPLOAD CARD */}
      <div className="bg-white rounded-[32px] p-6 md:p-8 space-y-6">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#0071e3]" />
          <span>1. Upload FIT / GPX / TCX / ZIP Files</span>
        </h3>

        <div className="rounded-3xl p-8 md:p-12 text-center bg-[#f5f5f7] hover:bg-[#eaeaea] relative group transition">
          <input
            type="file"
            multiple
            accept=".fit,.gpx,.tcx,.zip"
            onChange={handleFileUpload}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="space-y-3 pointer-events-none">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto text-[#0071e3] group-hover:scale-105 transition">
              {uploading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">
                {uploading ? "Uploading and analyzing workout files..." : "Drop files here or click to select from your computer"}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Supported formats: Garmin FIT, Suunto FIT, Strava GPX, TrainingPeaks TCX, ZIP archives
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. WORKOUT MERGING METHODS CARD */}
      <div className="bg-white rounded-[32px] p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-emerald-600" />
              <span>2. Workout Merging & File Management</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Merge files from different devices or detach heart rate/power data accidentally assigned to the wrong workout.
            </p>
          </div>

          <button
            onClick={handleAutoMerge}
            disabled={merging || unmergedFiles.length === 0}
            className="px-4 py-2 bg-[#0071e3] hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-bold rounded-full transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Auto-Merge Workouts</span>
          </button>
        </div>

        {/* 4 Merge Strategy Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#f5f5f7] space-y-2">
            <div className="flex items-center gap-2 text-[#0071e3] font-black">
              <Sparkles className="w-4 h-4" />
              <span>Time Window Auto-Merge</span>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              Automatically identifies workouts recorded at the same time (±15 min) and merges them.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#f5f5f7] space-y-2">
            <div className="flex items-center gap-2 text-rose-600 font-black">
              <Heart className="w-4 h-4 text-rose-500" />
              <span>HR + Power Fusion</span>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              Merges separate heart rate belt and power meter signals with second-by-second precision into a single ride.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#f5f5f7] space-y-2">
            <div className="flex items-center gap-2 text-slate-900 font-black">
              <Layers className="w-4 h-4" />
              <span>Manual Selection</span>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              Select desired files from the table below and merge them with a single click.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#f5f5f7] space-y-2">
            <div className="flex items-center gap-2 text-amber-700 font-black">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Detach Files</span>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              Detach incorrect files from any workout at any time to restore them for re-merging.
            </p>
          </div>
        </div>

        {/* 3. UNMERGED FILES TABLE */}
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Unprocessed Raw Files ({sortedUnmergedFiles.length} items)
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Files that have not yet been analyzed or merged into finished workouts (ordered newest first).
              </p>
            </div>
            {sortedUnmergedFiles.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllFiles}
                  className="text-xs text-[#0071e3] font-bold hover:underline cursor-pointer"
                >
                  {selectedFileIds.length === sortedUnmergedFiles.length ? "Deselect All" : "Select All"}
                </button>
                <button
                  onClick={handleManualMerge}
                  disabled={merging || selectedFileIds.length < 2}
                  className="px-4 py-1.5 bg-[#0071e3] hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-full transition cursor-pointer"
                >
                  Merge Selected ({selectedFileIds.length})
                </button>
              </div>
            )}
          </div>

          {sortedUnmergedFiles.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs bg-[#f5f5f7] rounded-2xl border border-slate-200/50 space-y-1">
              <p className="font-bold text-slate-700">✨ All uploaded raw files have been merged and analyzed!</p>
              <p className="text-slate-400 font-medium">Uploaded rides appear in the table below and on the main dashboard.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-[#f5f5f7] p-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3.5 text-center w-10 rounded-l-xl">Select</th>
                    <th className="p-3.5">Filename</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Time (Newest First)</th>
                    <th className="p-3.5">Sensors</th>
                    <th className="p-3.5 text-right rounded-r-xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40">
                  {sortedUnmergedFiles.map((file) => (
                    <tr 
                      key={file.id} 
                      onClick={() => toggleSelectFile(file.id)}
                      className="hover:bg-white transition cursor-pointer font-medium"
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedFileIds.includes(file.id)}
                          onChange={() => {}}
                          className="rounded text-[#0071e3] focus:ring-[#0071e3] cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">{file.filename}</td>
                      <td className="p-3.5 uppercase font-bold text-slate-500">{file.file_type}</td>
                      <td className="p-3.5 text-slate-500">
                        {new Date(file.start_time || file.upload_time).toLocaleString("en-US")}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {file.sensors_present?.includes("hr") && (
                            <span className="bg-white text-slate-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Heart className="w-3 h-3 text-rose-500" /> HR
                            </span>
                          )}
                          {file.sensors_present?.includes("power") && (
                            <span className="bg-white text-slate-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Zap className="w-3 h-3 text-emerald-500" /> Power
                            </span>
                          )}
                          {file.sensors_present?.includes("gps") && (
                            <span className="bg-white text-slate-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                              GPS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={(e) => handleDeleteFile(file.id, file.filename, e)}
                          className="p-1.5 rounded-full hover:bg-rose-50 text-rose-500 transition cursor-pointer"
                          title="Delete file from server"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. ALL PROCESSED WORKOUTS LIST (NEWEST TO OLDEST) & MISSING SENSOR INDICATORS */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#0071e3]" />
                <span>All Analyzed Workouts (Newest to Oldest - {sortedWorkouts.length} items)</span>
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Listed chronologically with newest workout on top. You can import missing FIT files or manage and detach merged files.
              </p>
            </div>
          </div>

          {sortedWorkouts.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs bg-[#f5f5f7] rounded-2xl">
              No saved workouts in database.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-[#f5f5f7] p-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Title</th>
                    <th className="p-3.5">Duration / Distance</th>
                    <th className="p-3.5">Power / HR</th>
                    <th className="p-3.5">Sensor Status</th>
                    <th className="p-3.5 text-right">File Merging & Detaching</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40">
                  {sortedWorkouts.map((w: any) => {
                    const dateStr = w.timestamp ? new Date(w.timestamp).toLocaleString("en-US", {
                      month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                    }) : "Unknown time";
                    const durMin = Math.round((w.duration_seconds || 0) / 60);
                    const distKm = ((w.distance_meters || 0) / 1000).toFixed(1);

                    const hasPower = Boolean(w.real_power_present || (w.average_power && w.average_power > 0));
                    const hasHr = Boolean(w.hr_present || (w.average_hr && w.average_hr > 0));
                    const isMerged = Boolean(w.is_merged || (w.source_file_ids && w.source_file_ids.length > 1));

                    return (
                      <tr key={w.id} className="hover:bg-white transition font-medium">
                        <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">{dateStr}</td>
                        <td className="p-3.5 font-extrabold text-slate-900">{w.title || "Workout"}</td>
                        <td className="p-3.5 text-slate-600 whitespace-nowrap">
                          {durMin} min / {distKm} km
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-900">
                            {w.np || w.average_power ? `${Math.round(w.np || w.average_power)} W` : "-"}
                          </span>
                          {" / "}
                          <span className="font-bold text-rose-600">
                            {w.average_hr ? `${Math.round(w.average_hr)} bpm` : "-"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasPower ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Zap className="w-3 h-3 text-emerald-600" /> Power OK
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                ⚠️ Missing Power
                              </span>
                            )}

                            {hasHr ? (
                              <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Heart className="w-3 h-3 text-rose-600" /> HR OK
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                ⚠️ Missing HR
                              </span>
                            )}

                            {isMerged && (
                              <span className="bg-sky-100 text-sky-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                Merged
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {isMerged && (
                              <button
                                onClick={() => handleOpenManageModal(w)}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold rounded-full transition flex items-center gap-1 cursor-pointer"
                                title="Manage attached files or detach wrong file"
                              >
                                <Sliders className="w-3 h-3 text-amber-600" />
                                <span>Manage / Detach</span>
                              </button>
                            )}

                            <button
                              onClick={() => setAttachTargetWorkout(w)}
                              className="px-3 py-1.5 bg-[#0071e3] hover:bg-blue-700 text-white text-[11px] font-bold rounded-full transition flex items-center gap-1 cursor-pointer"
                            >
                              <GitMerge className="w-3 h-3" />
                              <span>Import & Merge FIT</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. PRIVACY & RESET DATA SECTION */}
      <div className="bg-white rounded-[32px] p-6 md:p-8 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Privacy & Database Reset</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Delete all workouts, raw files, and settings from the database.
            </p>
          </div>
          <button
            onClick={() => setShowWipeModal(true)}
            className="px-4 py-2 bg-[#f5f5f7] hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-bold rounded-full transition cursor-pointer"
          >
            Clear database
          </button>
        </div>
      </div>

      {/* Attach FIT File Modal */}
      {attachTargetWorkout && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] max-w-md w-full p-6 md:p-8 space-y-5 relative text-slate-900 shadow-2xl">
            <button
              onClick={() => setAttachTargetWorkout(null)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0071e3] bg-blue-50 px-2.5 py-1 rounded-full">
                File Fusion
              </span>
              <h3 className="text-xl font-black text-slate-900 tracking-tight pt-1">
                Merge FIT File into Workout
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Workout: <strong className="text-slate-900">{attachTargetWorkout.title}</strong> (
                {attachTargetWorkout.timestamp ? new Date(attachTargetWorkout.timestamp).toLocaleDateString("en-US") : ""})
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#f5f5f7] text-xs space-y-2 border border-slate-200/60">
              <p className="font-bold text-slate-800">What happens here?</p>
              <p className="text-slate-600 leading-relaxed">
                Upload a FIT (or GPX/TCX) file containing e.g. <strong>heart rate data</strong> (from HR strap) or <strong>power data</strong> (from power meter). Sensor data will be aligned with second precision to this workout creating a complete combined activity!
              </p>
            </div>

            <div className="rounded-3xl p-6 text-center bg-[#f5f5f7] hover:bg-[#eaeaea] relative group transition cursor-pointer border border-dashed border-slate-300">
              <input
                type="file"
                accept=".fit,.gpx,.tcx"
                onChange={handleAttachFileToWorkout}
                disabled={attaching}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="space-y-2 pointer-events-none">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mx-auto text-[#0071e3]">
                  {attaching ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </div>
                <p className="text-xs font-extrabold text-slate-900">
                  {attaching ? "Merging file into workout..." : "Select FIT / GPX file to merge from your computer"}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAttachTargetWorkout(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Attached Source Files Modal */}
      {manageTargetWorkout && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 md:p-8 space-y-5 relative text-slate-900 shadow-2xl">
            <button
              onClick={() => setManageTargetWorkout(null)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                Merged Files Management
              </span>
              <h3 className="text-xl font-black text-slate-900 tracking-tight pt-1">
                Files Attached to Workout
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Workout: <strong className="text-slate-900">{manageTargetWorkout.title}</strong> (
                {manageTargetWorkout.timestamp ? new Date(manageTargetWorkout.timestamp).toLocaleDateString("en-US") : ""})
              </p>
            </div>

            {loadingFiles ? (
              <div className="py-8 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#0071e3]" />
                <span>Fetching files from server...</span>
              </div>
            ) : sourceFiles.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-100 text-xs text-slate-500 text-center">
                No separate source files identified.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700">File List ({sourceFiles.length} items):</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {sourceFiles.map((sf) => (
                    <div key={sf.id} className="p-3 rounded-2xl bg-[#f5f5f7] flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-extrabold text-slate-900">{sf.filename}</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                          Time: {new Date(sf.start_time || sf.upload_time).toLocaleString("en-US")}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {sf.sensors_present?.includes("hr") && (
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full">HR</span>
                          )}
                          {sf.sensors_present?.includes("power") && (
                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full">Power</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDetachFile(sf.id, sf.filename)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-full transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        title="Detach this file from workout"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Detach</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                onClick={handleUnmergeEntireWorkout}
                className="w-full sm:w-auto px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-full transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <GitMerge className="w-3.5 h-3.5 text-amber-600" />
                <span>Unmerge Entire Workout</span>
              </button>

              <button
                type="button"
                onClick={() => setManageTargetWorkout(null)}
                className="w-full sm:w-auto px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Workout Form Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 md:p-8 space-y-5 relative text-slate-900 shadow-2xl">
            <button
              onClick={() => setShowManualModal(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-slate-900">Add Workout Manually</h3>
            <form onSubmit={handleSaveManualWorkout} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Workout Title</label>
                <input
                  type="text"
                  value={manualFormData.title}
                  onChange={(e) => setManualFormData({ ...manualFormData, title: e.target.value })}
                  placeholder="e.g. Road Ride"
                  className="w-full bg-[#f5f5f7] rounded-2xl p-3 text-slate-900 font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={manualFormData.timestamp}
                    onChange={(e) => setManualFormData({ ...manualFormData, timestamp: e.target.value })}
                    className="w-full bg-[#f5f5f7] rounded-2xl p-3 text-slate-900 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Duration (minutes)</label>
                  <input
                    type="number"
                    value={manualFormData.duration_minutes}
                    onChange={(e) => setManualFormData({ ...manualFormData, duration_minutes: e.target.value })}
                    className="w-full bg-[#f5f5f7] rounded-2xl p-3 text-slate-900 font-semibold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualFormData.distance_km}
                    onChange={(e) => setManualFormData({ ...manualFormData, distance_km: e.target.value })}
                    className="w-full bg-[#f5f5f7] rounded-2xl p-3 text-slate-900 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Norm. Power (NP W)</label>
                  <input
                    type="number"
                    value={manualFormData.np}
                    onChange={(e) => setManualFormData({ ...manualFormData, np: e.target.value })}
                    className="w-full bg-[#f5f5f7] rounded-2xl p-3 text-slate-900 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">TSS Points</label>
                  <input
                    type="number"
                    value={manualFormData.tss}
                    onChange={(e) => setManualFormData({ ...manualFormData, tss: e.target.value })}
                    className="w-full bg-[#f5f5f7] rounded-2xl p-3 text-slate-900 font-semibold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#0071e3] text-white font-bold rounded-full cursor-pointer"
                >
                  Save Workout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showWipeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] max-w-md w-full p-6 space-y-4 relative text-slate-900">
            <h3 className="text-lg font-black text-rose-600">Confirm Database Reset</h3>
            <p className="text-xs text-slate-600 font-medium">
              Are you sure? This action will permanently delete all uploaded workouts, raw files, and settings from the server. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowWipeModal(false)}
                className="px-4 py-2 bg-[#f5f5f7] text-slate-700 text-xs font-bold rounded-full cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleWipeDatabase}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-full cursor-pointer"
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
