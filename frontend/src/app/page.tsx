"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatErrorMessage } from "@/lib/utils";
import { 
  Activity, 
  Upload, 
  Settings as SettingsIcon, 
  Zap, 
  X, 
  Info,
  Sparkles,
  Award,
  BookOpen,
  Calendar,
  Clock,
  Heart,
  TrendingUp,
  Flame,
  Mountain,
  User,
  SlidersHorizontal,
  Compass,
  FileCheck,
  RefreshCw
} from "lucide-react";

import { DashboardCharts } from "@/components/DashboardCharts";
import { WorkoutFilters, FilterState } from "@/components/WorkoutFilters";
import { WorkoutList, WorkoutSummary } from "@/components/WorkoutList";
import { WorkoutModal } from "@/components/WorkoutModal";
import { AIAdvisorTab, FormattedMarkdown, AICoachBentoGrid } from "@/components/AIAdvisorTab";
import { SettingsTab } from "@/components/SettingsTab";
import { ImportTab } from "@/components/ImportTab";
import { MasterBentoGrid } from "@/components/MasterBentoGrid";
import { LandingPage } from "@/components/LandingPage";

interface UserParameters {
  ftp: number;
  cp?: number;
  w_prime?: number;
  max_hr: number;
  lthr: number;
  resting_hr: number;
  weight_kg: number;
  bike_weight_kg: number;
  wheel_size_mm: number;
  gender: string;
  age: number;
  language: string;
  llm_provider?: string;
  llm_api_key?: string;
  llm_model?: string;
  ollama_url?: string;
  sync_mode?: string;
  remote_server_url?: string;
  remote_api_key?: string;
  strava_client_id?: string;
  strava_client_secret?: string;
}

interface UserGoal {
  goal_description: string;
  target_date: string;
  race_distance_km: number;
  elevation_gain_m: number;
  surface_type: string;
  weekly_capacity_hours: number;
  intensity_distribution: string;
  limitations: string;
  custom_prompt?: string;
}

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

interface DashboardSummary {
  ctl: number;
  atl: number;
  tsb: number;
  weekly_load: number;
  weekly_hours: number;
  weekly_capacity: number;
  goal_progress_percent: number;
  recent_workouts: WorkoutSummary[];
  cp?: number;
  w_prime?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8765";

const normalizeWorkout = (w: any): WorkoutSummary => {
  if (!w) return w;
  const startedAt = w.timestamp || w.started_at || w.start_time || w.date;
  
  let durationSec = w.duration_seconds || w.duration || w.total_time_seconds;
  if (!durationSec && (w.started_at || w.start_time) && (w.ended_at || w.end_time)) {
    try {
      const s = new Date(w.started_at || w.start_time).getTime();
      const e = new Date(w.ended_at || w.end_time).getTime();
      if (!isNaN(s) && !isNaN(e) && e > s) {
        durationSec = (e - s) / 1000;
      }
    } catch (_) {}
  }

  let distMeters = w.distance_meters;
  if (distMeters === undefined || distMeters === null) {
    if (w.total_distance_km !== undefined && w.total_distance_km !== null) {
      distMeters = Number(w.total_distance_km) * 1000;
    } else if (w.distance_km !== undefined && w.distance_km !== null) {
      distMeters = Number(w.distance_km) * 1000;
    } else if (w.distance !== undefined && w.distance !== null) {
      distMeters = Number(w.distance);
    } else {
      distMeters = 0;
    }
  }

  return {
    ...w,
    id: String(w.id || w.external_id || Math.random()),
    title: w.title || w.plan_name || w.name || "Harjoitus",
    timestamp: startedAt,
    duration_seconds: Number(durationSec || 0),
    distance_meters: Number(distMeters || 0),
    average_power: w.average_power !== undefined && w.average_power !== null ? Number(w.average_power) : (w.avg_power_watts !== undefined ? Number(w.avg_power_watts) : (w.avg_power !== undefined ? Number(w.avg_power) : undefined)),
    max_power: w.max_power !== undefined && w.max_power !== null ? Number(w.max_power) : undefined,
    average_hr: w.average_hr !== undefined && w.average_hr !== null ? Number(w.average_hr) : undefined,
    max_hr: w.max_hr !== undefined && w.max_hr !== null ? Number(w.max_hr) : undefined,
    tss: w.tss !== undefined && w.tss !== null ? Number(w.tss) : undefined,
    np: w.np !== undefined && w.np !== null ? Number(w.np) : (w.normalized_power !== undefined ? Number(w.normalized_power) : undefined),
    if_factor: w.if_factor !== undefined && w.if_factor !== null ? Number(w.if_factor) : undefined,
    ef: w.ef !== undefined && w.ef !== null ? Number(w.ef) : undefined,
    vi: w.vi !== undefined && w.vi !== null ? Number(w.vi) : undefined,
    aerobic_decoupling: w.aerobic_decoupling !== undefined && w.aerobic_decoupling !== null ? Number(w.aerobic_decoupling) : undefined,
    real_power_present: Boolean(w.real_power_present),
    estimated_power_present: Boolean(w.estimated_power_present),
    hr_present: Boolean(w.hr_present || w.average_hr),
    source_file_ids: Array.isArray(w.source_file_ids) ? w.source_file_ids : [],
    source: w.source || (w.strava_id ? "strava" : "local"),
    strava_id: w.strava_id ? String(w.strava_id) : undefined
  };
};

export default function Home() {
  // View Mode & Navigation State
  const [viewMode, setViewMode] = useState<"landing" | "app">("landing");
  const [activeTab, setActiveTab] = useState<"dashboard" | "import" | "coach" | "settings">("dashboard");
  
  // Data State
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [powerCurveData, setPowerCurveData] = useState<any[]>([]);
  const [weeklyLoadData, setWeeklyLoadData] = useState<any[]>([]);
  const [ftpHistoryData, setFtpHistoryData] = useState<any[]>([]);
  const [scatterData, setScatterData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<{ monthly: any[]; daily: any[] } | null>(null);
  const [unmergedFiles, setUnmergedFiles] = useState<RawFile[]>([]);

  const [userParams, setUserParams] = useState<UserParameters>({
    ftp: 250,
    cp: 250,
    w_prime: 20000,
    max_hr: 190,
    lthr: 165,
    resting_hr: 50,
    weight_kg: 70,
    bike_weight_kg: 8.5,
    wheel_size_mm: 2096,
    gender: "male",
    age: 30,
    language: "fi",
    llm_provider: "ollama",
    llm_model: "llama3:8b",
    ollama_url: "http://localhost:11434"
  });

  const [userGoal, setUserGoal] = useState<UserGoal>({
    goal_description: "Gravel SM 150km / Tahko MTB 120km",
    target_date: "2026-09-20",
    race_distance_km: 150,
    elevation_gain_m: 1200,
    surface_type: "Gravel",
    weekly_capacity_hours: 10,
    intensity_distribution: "Pyramidal",
    limitations: "Ei erityisiä rajoitteita",
    custom_prompt: ""
  });
  
  const [coachingDirectivesMd, setCoachingDirectivesMd] = useState<string>("");
  
  // Modal & Detail States
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSummary | null>(null);
  const [selectedWorkoutStream, setSelectedWorkoutStream] = useState<any[]>([]);
  const [workoutAnalytics, setWorkoutAnalytics] = useState<any | null>(null);
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    title: "",
    timestamp: "",
    duration_minutes: "",
    distance_km: "",
    tss: "",
    np: "",
    notes: ""
  });

  // Filter State for Workouts Tab
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    selectedMonth: "all",
    minNp: "",
    maxNp: "",
    minTss: "",
    maxTss: "",
    powerSource: "all"
  });

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("trainer_ai_chat_messages");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
    }
    return [];
  });
  const [inputMessage, setInputMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && chatMessages.length > 0) {
      try {
        localStorage.setItem("trainer_ai_chat_messages", JSON.stringify(chatMessages));
      } catch (_) {}
    }
  }, [chatMessages]);

  const handleClearChat = () => {
    setChatMessages([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("trainer_ai_chat_messages");
    }
  };

  // Cached AI Coach insight from localStorage (zero API tokens consumed on load)
  const latestCoachInsight = useMemo(() => {
    if (!chatMessages || chatMessages.length === 0) return null;
    const assistantMsgs = chatMessages.filter(m => m.role === "assistant");
    if (assistantMsgs.length === 0) return null;
    return assistantMsgs[assistantMsgs.length - 1];
  }, [chatMessages]);
  
  // App Status
  const [backendAlive, setBackendAlive] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Initial & Refresh Data
  const fetchData = async (shouldSync = false) => {
    setLoadingData(true);
    try {
      const baseUrl = API_URL;

      if (shouldSync) {
        try {
          const syncRes = await fetch(`${baseUrl}/api/workouts/sync-from-server`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              server_url: userParams.remote_server_url || "https://cycling-sync.oivauix.org",
              api_key: userParams.remote_api_key || "my_very_secure_secret_token_12345"
            })
          }).then(r => r.json());
          if (syncRes && syncRes.imported_count !== undefined) {
            if (syncRes.imported_count > 0) {
              setSuccessMsg(`Server synced (${userParams.remote_server_url || "cycling-sync.oivauix.org"}): ${syncRes.imported_count} new workout(s) imported!`);
            }
          }
        } catch (_) {}
      }

      const [sumRes, chartRes, powerRes, weeklyRes, ftpRes, scatterRes, heatmapRes, unmergedRes, paramsRes, goalsRes, directivesRes] = await Promise.all([
        fetch(`${baseUrl}/api/dashboard/summary`).then(r => r.json()).catch(() => null),
        fetch(`${baseUrl}/api/dashboard/charts`).then(r => r.json()).catch(() => []),
        fetch(`${baseUrl}/api/dashboard/power-curve`).then(r => r.json()).catch(() => []),
        fetch(`${baseUrl}/api/dashboard/weekly-load`).then(r => r.json()).catch(() => []),
        fetch(`${baseUrl}/api/dashboard/ftp-history`).then(r => r.json()).catch(() => []),
        fetch(`${baseUrl}/api/dashboard/scatter`).then(r => r.json()).catch(() => []),
        fetch(`${baseUrl}/api/dashboard/heatmap`).then(r => r.json()).catch(() => null),
        fetch(`${baseUrl}/api/workouts/unmerged`).then(r => r.json()).catch(() => []),
        fetch(`${baseUrl}/api/settings/parameters`).then(r => r.json()).catch(() => null),
        fetch(`${baseUrl}/api/settings/goals`).then(r => r.json()).catch(() => null),
        fetch(`${baseUrl}/api/settings/directives`).then(r => r.json()).catch(() => null)
      ]);

      if (sumRes) {
        setSummary({
          ...sumRes,
          recent_workouts: (sumRes.recent_workouts || []).map(normalizeWorkout)
        });
      }
      if (chartRes) setChartData(chartRes);
      if (powerRes) setPowerCurveData(powerRes);
      if (weeklyRes) setWeeklyLoadData(weeklyRes);
      if (ftpRes) setFtpHistoryData(ftpRes);
      if (scatterRes) setScatterData(scatterRes);
      if (heatmapRes) setHeatmapData(heatmapRes);
      if (unmergedRes) setUnmergedFiles(unmergedRes);
      if (paramsRes && paramsRes.ftp) setUserParams(paramsRes);
      if (goalsRes && goalsRes.goal_description) setUserGoal(goalsRes);
      if (directivesRes && directivesRes.directives_md !== undefined) setCoachingDirectivesMd(directivesRes.directives_md);
      setBackendAlive(true);
    } catch (err: any) {
      setBackendAlive(false);
      setErrorMsg("Connection to backend server failed.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  // Compute dynamic months list for filters
  const availableMonths = useMemo(() => {
    if (!summary?.recent_workouts) return [];
    const set = new Set<string>();
    summary.recent_workouts.forEach(w => {
      if (w.timestamp) {
        const d = new Date(w.timestamp);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          set.add(key);
        }
      }
    });
    return Array.from(set).sort().reverse().map(m => {
      const [yr, mo] = m.split("-");
      const date = new Date(Number(yr), Number(mo) - 1, 1);
      const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      return { value: m, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, [summary?.recent_workouts]);

  // Compute filtered workouts
  const filteredWorkouts = useMemo(() => {
    if (!summary?.recent_workouts) return [];
    return summary.recent_workouts.filter(w => {
      // Text Search
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        if (!w.title?.toLowerCase().includes(q)) return false;
      }
      // Month Filter
      if (filters.selectedMonth !== "all") {
        const d = new Date(w.timestamp);
        if (!isNaN(d.getTime())) {
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (mKey !== filters.selectedMonth) return false;
        }
      }
      // Power NP Filter
      const npVal = w.np || w.average_power || 0;
      if (filters.minNp && npVal < Number(filters.minNp)) return false;
      if (filters.maxNp && npVal > Number(filters.maxNp)) return false;
      // TSS Filter
      const tssVal = w.tss || 0;
      if (filters.minTss && tssVal < Number(filters.minTss)) return false;
      if (filters.maxTss && tssVal > Number(filters.maxTss)) return false;
      // Power Source Filter
      if (filters.powerSource === "real" && !w.real_power_present) return false;
      if (filters.powerSource === "estimated" && !w.estimated_power_present) return false;

      return true;
    });
  }, [summary?.recent_workouts, filters]);

  // Handle select workout modal
  const handleSelectWorkout = async (workout: WorkoutSummary) => {
    setSelectedWorkout(workout);
    setWorkoutModalOpen(true);
    try {
      const [stream, analytics] = await Promise.all([
        fetch(`${API_URL}/api/workouts/${workout.id}/stream`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/api/workouts/${workout.id}/analytics`).then(r => r.json()).catch(() => null)
      ]);
      setSelectedWorkoutStream(stream || []);
      setWorkoutAnalytics(analytics);
    } catch (_) {}
  };

  // Handle Delete Workout
  const handleDeleteWorkout = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workout?")) return;
    try {
      const res = await fetch(`${API_URL}/api/workouts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWorkoutModalOpen(false);
        setSelectedWorkout(null);
        setSuccessMsg("Workout deleted successfully.");
        fetchData();
      } else {
        const err = await res.json();
        setErrorMsg(formatErrorMessage(err, "Failed to delete workout."));
      }
    } catch (err) {
      setErrorMsg(formatErrorMessage(err, "Failed to delete workout."));
    }
  };

  // Handle Unmerge Workout
  const handleUnmergeWorkout = async (id: string) => {
    if (!confirm("Are you sure you want to unmerge this workout?\n\nRaw files will be restored as standalone workouts.")) return;
    try {
      const res = await fetch(`${API_URL}/api/workouts/${id}/unmerge`, { method: "POST" });
      if (res.ok) {
        setWorkoutModalOpen(false);
        setSelectedWorkout(null);
        setSuccessMsg("Unmerged successfully! Raw files restored as standalone workouts.");
        fetchData();
      } else {
        const err = await res.json();
        setErrorMsg(formatErrorMessage(err, "Failed to unmerge workout."));
      }
    } catch (err) {
      setErrorMsg(formatErrorMessage(err, "Error unmerging workout."));
    }
  };

  // Handle Open Edit Modal
  const handleOpenEditModal = () => {
    if (!selectedWorkout) return;
    setEditFormData({
      title: selectedWorkout.title || "",
      timestamp: selectedWorkout.timestamp ? new Date(selectedWorkout.timestamp).toISOString().slice(0, 16) : "",
      duration_minutes: String(Math.round(selectedWorkout.duration_seconds / 60)),
      distance_km: (selectedWorkout.distance_meters / 1000.0).toFixed(1),
      tss: selectedWorkout.tss ? String(selectedWorkout.tss) : "",
      np: selectedWorkout.np ? String(selectedWorkout.np) : "",
      notes: ""
    });
    setEditModalOpen(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkout) return;
    try {
      const payload = {
        title: editFormData.title,
        timestamp: editFormData.timestamp ? new Date(editFormData.timestamp).toISOString() : selectedWorkout.timestamp,
        duration_seconds: editFormData.duration_minutes ? Number(editFormData.duration_minutes) * 60 : selectedWorkout.duration_seconds,
        distance_meters: editFormData.distance_km ? Number(editFormData.distance_km) * 1000 : selectedWorkout.distance_meters,
        tss: editFormData.tss ? Number(editFormData.tss) : selectedWorkout.tss,
        np: editFormData.np ? Number(editFormData.np) : selectedWorkout.np
      };
      const res = await fetch(`${API_URL}/api/workouts/${selectedWorkout.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditModalOpen(false);
        setSuccessMsg("Workout updated successfully.");
        fetchData();
      } else {
        const err = await res.json();
        setErrorMsg(formatErrorMessage(err, "Failed to update workout."));
      }
    } catch (err) {
      setErrorMsg(formatErrorMessage(err, "Failed to update workout."));
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        fetch(`${API_URL}/api/settings/parameters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userParams)
        }),
        fetch(`${API_URL}/api/settings/goals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userGoal)
        }),
        fetch(`${API_URL}/api/settings/directives`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directives_md: coachingDirectivesMd })
        })
      ]);

      if (userParams.sync_mode === "remote_endpoint" || userParams.remote_server_url) {
        try {
          const syncRes = await fetch(`${API_URL}/api/workouts/sync-from-server`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              server_url: userParams.remote_server_url || "https://cycling-sync.oivauix.org",
              api_key: userParams.remote_api_key || "my_very_secure_secret_token_12345"
            })
          }).then(r => r.json());

          if (syncRes && syncRes.total_fetched !== undefined) {
            setSuccessMsg(`Settings saved & fetched ${syncRes.total_fetched} workout(s) from server (${userParams.remote_server_url || "cycling-sync.oivauix.org"})!`);
          } else {
            setSuccessMsg("Settings saved successfully.");
          }
        } catch (_) {
          setSuccessMsg("Settings saved successfully.");
        }
      } else {
        setSuccessMsg("Settings saved successfully.");
      }
      fetchData(false);
    } catch (err) {
      setErrorMsg("Failed to save settings.");
    }
  };

  // Estimate CP
  const handleEstimateCp = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/parameters/estimate-cp`, { method: "POST" }).then(r => r.json());
      if (res && res.cp && userParams) {
        setUserParams({ ...userParams, cp: res.cp, w_prime: res.w_prime });
        setSuccessMsg(`Estimated Critical Power: ${res.cp} W, W': ${(res.w_prime/1000).toFixed(1)} kJ`);
      }
    } catch (err) {
      setErrorMsg("CP estimation failed.");
    }
  };

  // Handle Chat Message
  const handleSendMessage = async (msgOverride?: string) => {
    const textToSend = msgOverride || inputMessage;
    if (!textToSend.trim()) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: textToSend }];
    setChatMessages(newMessages);
    if (!msgOverride) setInputMessage("");
    setLoadingChat(true);

    try {
      const res = await fetch(`${API_URL}/api/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages })
      }).then(r => r.json());

      if (res && res.response) {
        setChatMessages([...newMessages, { role: "assistant", content: res.response }]);
      }
    } catch (err) {
      setChatMessages([...newMessages, { role: "assistant", content: "Virhe valmentaja-rajapinnassa." }]);
    } finally {
      setLoadingChat(false);
    }
  };

  if (viewMode === "landing") {
    return <LandingPage onOpenApp={() => setViewMode("app")} />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#0071e3] selection:text-white">
      {/* Apple Floating Translucent Liquid Glass Navbar (Desktop/Tablet & Mobile Header) */}
      <header className="sticky top-2 sm:top-4 z-50 px-2 sm:px-6 max-w-5xl mx-auto pointer-events-auto">
        <div className="bg-white/80 backdrop-blur-2xl border border-white/80 shadow-[0_10px_35px_rgba(0,0,0,0.06)] rounded-full px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between transition-all">
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0 cursor-pointer" onClick={() => setViewMode("landing")}>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 flex items-center justify-center shadow-sm">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-black text-xs sm:text-sm text-slate-900 tracking-tight leading-none">Trainer AI</h1>
              <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold tracking-wide uppercase mt-0.5">Cycling Analytics</p>
            </div>
          </div>

          {/* Liquid Segmented Nav Pills (Desktop / Tablet View) */}
          <nav className="hidden sm:flex space-x-1 bg-slate-300/80 p-1 rounded-full text-xs font-bold backdrop-blur-md">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3.5 py-1.5 rounded-full transition-all duration-300 flex items-center space-x-1 cursor-pointer whitespace-nowrap ${
                activeTab === "dashboard" ? "bg-slate-900 text-white shadow-md scale-[1.02]" : "text-slate-700 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`px-3.5 py-1.5 rounded-full transition-all duration-300 flex items-center space-x-1 cursor-pointer whitespace-nowrap ${
                activeTab === "import" ? "bg-slate-900 text-white shadow-md scale-[1.02]" : "text-slate-700 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>
            <button
              onClick={() => setActiveTab("coach")}
              className={`px-3.5 py-1.5 rounded-full transition-all duration-300 flex items-center space-x-1 cursor-pointer whitespace-nowrap ${
                activeTab === "coach" ? "bg-slate-900 text-white shadow-md scale-[1.02]" : "text-slate-700 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Coach</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3.5 py-1.5 rounded-full transition-all duration-300 flex items-center space-x-1 cursor-pointer whitespace-nowrap ${
                activeTab === "settings" ? "bg-slate-900 text-white shadow-md scale-[1.02]" : "text-slate-700 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Modern Compact Mobile Floating Bottom Navigation Bar */}
      <div className="fixed bottom-3 left-4 right-4 z-50 sm:hidden max-w-xs mx-auto">
        <div className="bg-slate-900/90 text-white backdrop-blur-xl border border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.3)] rounded-full px-2 py-1 flex items-center justify-around">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 flex flex-col items-center justify-center py-0.5 px-1 rounded-full transition-all cursor-pointer ${
              activeTab === "dashboard" ? "text-emerald-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span className="text-[9px] tracking-tight font-bold mt-0.5">Dash</span>
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 flex flex-col items-center justify-center py-0.5 px-1 rounded-full transition-all cursor-pointer ${
              activeTab === "import" ? "text-emerald-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span className="text-[9px] tracking-tight font-bold mt-0.5">Files</span>
          </button>
          <button
            onClick={() => setActiveTab("coach")}
            className={`flex-1 flex flex-col items-center justify-center py-0.5 px-1 rounded-full transition-all cursor-pointer ${
              activeTab === "coach" ? "text-amber-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-[9px] tracking-tight font-bold mt-0.5">AI Coach</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex flex-col items-center justify-center py-0.5 px-1 rounded-full transition-all cursor-pointer ${
              activeTab === "settings" ? "text-emerald-400 font-extrabold" : "text-slate-400 hover:text-white"
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="text-[9px] tracking-tight font-bold mt-0.5">Settings</span>
          </button>
        </div>
      </div>

      {/* Floating Data Loading Indicator */}
      {loadingData && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white backdrop-blur-xl px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-slate-700/50">
          <RefreshCw className="w-4 h-4 text-[#0071e3] animate-spin" />
          <span>Loading data...</span>
        </div>
      )}

      {/* Alert Notifications with generous navbar spacing */}
      {errorMsg && (
        <div className="max-w-5xl mx-auto px-4 mt-6 sm:mt-8">
          <div className="bg-[#1c1c1e] text-white text-xs px-5 py-3 flex justify-between items-center rounded-2xl shadow-xl border border-slate-800/80 animate-in fade-in duration-200">
            <span className="font-medium">⚠️ {typeof errorMsg === "string" ? errorMsg : formatErrorMessage(errorMsg, "Error")}</span>
            <button onClick={() => setErrorMsg("")} className="p-1 hover:bg-slate-800 rounded-lg transition cursor-pointer">
              <X className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="max-w-5xl mx-auto px-4 mt-6 sm:mt-8">
          <div className="bg-black text-white text-xs px-5 py-3 flex justify-between items-center rounded-2xl shadow-xl border border-slate-800/80 animate-in fade-in duration-200">
            <span className="font-medium">✨ {typeof successMsg === "string" ? successMsg : formatErrorMessage(successMsg, "Notice")}</span>
            <button onClick={() => setSuccessMsg("")} className="p-1 hover:bg-slate-800 rounded-lg transition cursor-pointer">
              <X className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="py-4 sm:py-8 pb-24 sm:pb-8 space-y-6 sm:space-y-12">
        {activeTab === "dashboard" && (
          <div className="space-y-6 sm:space-y-12 animate-in fade-in duration-200">
            
            {/* RACE GOALS BANNER */}
            {userGoal && userGoal.goal_description && (
              <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8">
                <div className="bg-[#f5f5f7] border border-slate-200/50 p-4 sm:p-6 md:p-8 rounded-[24px] sm:rounded-[32px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <Award className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500" />
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {userGoal.goal_description}
                      </h2>
                      {userGoal.surface_type && (
                        <span className="text-[10px] sm:text-xs bg-white text-slate-800 px-2.5 py-0.5 sm:px-3.5 sm:py-1 rounded-full font-bold shadow-sm">
                          {userGoal.surface_type}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 flex flex-wrap items-center gap-2 sm:gap-4 font-semibold">
                      {userGoal.race_distance_km > 0 && <span>📏 Distance: {userGoal.race_distance_km} km</span>}
                      {userGoal.elevation_gain_m > 0 && <span>🏔️ Elevation: {userGoal.elevation_gain_m} m</span>}
                      {userGoal.weekly_capacity_hours > 0 && <span>⏱️ Capacity: {userGoal.weekly_capacity_hours} h/wk</span>}
                      {userGoal.intensity_distribution && <span>📊 Model: {userGoal.intensity_distribution}</span>}
                    </p>
                    {userGoal.limitations && (
                      <p className="text-[11px] sm:text-xs text-amber-800 pt-1 font-medium">
                        ⚠️ <strong>Limitations & Notes:</strong> {userGoal.limitations}
                      </p>
                    )}
                  </div>

                  {userGoal.target_date && (
                    <div className="bg-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl text-center shrink-0 shadow-sm border border-slate-200/50 w-full sm:w-auto">
                      <p className="text-[9px] sm:text-[10px] font-bold text-amber-600 uppercase tracking-widest">Days to Race</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                        {(() => {
                          const target = new Date(userGoal.target_date).getTime();
                          const now = new Date().getTime();
                          const diffDays = Math.ceil((target - now) / (1000 * 3600 * 24));
                          return diffDays > 0 ? `${diffDays} days` : (diffDays === 0 ? "RACE DAY!" : "Past event");
                        })()}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold mt-0.5">{userGoal.target_date}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI COACH LATEST BENTO GRID (LOCATED AT VERY TOP - ZERO TOKENS USED) */}
            <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8">
              {latestCoachInsight ? (
                <AICoachBentoGrid
                  content={latestCoachInsight.content}
                  onOpenChat={() => setActiveTab("coach")}
                  onAnalyzeLatest={() => {
                    setActiveTab("coach");
                    handleSendMessage("Analysoi viimeisin harjoitukseni ja selitä sen vaikutus kuntooni.");
                  }}
                />
              ) : (
                <div className="bg-white border border-slate-200/60 p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#0071e3]" />
                      <span>AI Coach — Viimeisin Analyysi</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">
                      Haluatko henkilökohtaisen yhteenvedon ja analyysin viimeisimmästä harjoituksestasi?
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("coach");
                      handleSendMessage("Analysoi viimeisin harjoitukseni ja selitä sen vaikutus kuntooni.");
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#0071e3] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-full transition cursor-pointer shadow-md shrink-0"
                  >
                    🔍 Analysoi viimeisin lenkki
                  </button>
                </div>
              )}
            </div>

            {/* MASTER BENTO GRID (Full Width Container on Mobile) */}
            <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8">
              <MasterBentoGrid
                summary={summary}
                userParams={userParams}
                userGoal={userGoal}
                weeklyLoadData={weeklyLoadData}
              />
            </div>

            {/* FULL-WIDTH GREY SECTION STRIP FOR PERFORMANCE CHARTS EXPLORER */}
            <div className="w-full bg-[#f5f5f7] py-6 sm:py-12 md:py-16 border-y border-slate-200/60">
              <div className="max-w-7xl mx-auto px-1 sm:px-6 lg:px-8">
                <DashboardCharts
                  pmcData={chartData}
                  powerCurveData={powerCurveData}
                  scatterData={scatterData}
                  heatmapData={heatmapData}
                  weeklyLoad={weeklyLoadData}
                  ftpHistory={ftpHistoryData}
                  recentWorkouts={summary?.recent_workouts}
                  userParams={userParams}
                />
              </div>
            </div>

            {/* VIIMEISET HARJOITUKSET – INTERAKTIIVINEN TAULUKKO JA HAKU */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <WorkoutFilters
                filters={filters}
                onFilterChange={(newF) => setFilters(prev => ({ ...prev, ...newF }))}
                onResetFilters={() => setFilters({
                  searchQuery: "",
                  selectedMonth: "all",
                  minNp: "",
                  maxNp: "",
                  minTss: "",
                  maxTss: "",
                  powerSource: "all"
                })}
                availableMonths={availableMonths}
                totalWorkoutsCount={summary?.recent_workouts?.length || 0}
                filteredWorkoutsCount={filteredWorkouts.length}
              />

              <WorkoutList
                workouts={filteredWorkouts}
                onSelectWorkout={handleSelectWorkout}
                onEditWorkout={(w) => {
                  setSelectedWorkout(w);
                  handleOpenEditModal();
                }}
                onDeleteWorkout={handleDeleteWorkout}
                onOpenMergeModal={() => setMergeModalOpen(true)}
                language={userParams?.language}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Upload Files & Workout Merging */}
        {activeTab === "import" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ImportTab
              unmergedFiles={unmergedFiles}
              workouts={summary?.recent_workouts || []}
              onUploadSuccess={() => fetchData(true)}
              onRefreshData={(sync) => fetchData(sync !== undefined ? sync : true)}
              apiUrl={API_URL}
            />
          </div>
        )}

        {/* Tab 3: AI Advisor */}
        {activeTab === "coach" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AIAdvisorTab
              chatMessages={chatMessages}
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              loadingChat={loadingChat}
              userParams={userParams}
            />
          </div>
        )}

        {/* Tab 4: Settings */}
        {activeTab === "settings" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SettingsTab
              userParams={userParams}
              setUserParams={setUserParams}
              userGoal={userGoal}
              setUserGoal={setUserGoal}
              coachingDirectivesMd={coachingDirectivesMd}
              setCoachingDirectivesMd={setCoachingDirectivesMd}
              onSaveSettings={handleSaveSettings}
              onEstimateCp={handleEstimateCp}
            />
          </div>
        )}
      </main>

      {/* Enlarged Workout Detail Modal */}
      {workoutModalOpen && selectedWorkout && (
        <WorkoutModal
          workout={selectedWorkout}
          workoutStream={selectedWorkoutStream}
          workoutAnalytics={workoutAnalytics}
          userParams={userParams}
          onClose={() => setWorkoutModalOpen(false)}
          onDelete={handleDeleteWorkout}
          onEdit={handleOpenEditModal}
          onUnmerge={handleUnmergeWorkout}
          language={userParams?.language}
        />
      )}

      {/* Edit Workout Metadata Modal */}
      {editModalOpen && selectedWorkout && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-[32px] max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-slate-900">
            <button onClick={() => setEditModalOpen(false)} className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-900"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-extrabold text-slate-900">Muokkaa harjoituksen tietoja</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600">Harjoituksen Otsikko</label>
                <input type="text" value={editFormData.title} onChange={e => setEditFormData({ ...editFormData, title: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-slate-900 font-semibold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Kesto (minuutit)</label>
                  <input type="number" value={editFormData.duration_minutes} onChange={e => setEditFormData({ ...editFormData, duration_minutes: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-slate-900 font-semibold" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Matka (km)</label>
                  <input type="number" step="0.1" value={editFormData.distance_km} onChange={e => setEditFormData({ ...editFormData, distance_km: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-slate-900 font-semibold" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-900 font-bold rounded-full border border-slate-200">Peruuta</button>
                <button type="submit" className="px-6 py-2 bg-slate-900 text-white font-bold rounded-full">Tallenna</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
