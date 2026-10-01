"use client";

import React, { useState } from "react";
import { 
  Zap, 
  Heart, 
  Calendar, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  GitMerge,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  TrendingUp,
  Mountain
} from "lucide-react";

export interface WorkoutSummary {
  id: string;
  title: string;
  timestamp: string;
  duration_seconds: number;
  distance_meters: number;
  average_power?: number;
  max_power?: number;
  np?: number;
  tss?: number;
  tss_type?: string;
  if_factor?: number;
  average_hr?: number;
  max_hr?: number;
  ef?: number;
  vi?: number;
  aerobic_decoupling?: number;
  real_power_present: boolean;
  estimated_power_present: boolean;
  hr_present: boolean;
  source_file_ids?: string[];
  is_merged?: boolean;
  sport_type?: string;
  source?: string;
  strava_id?: string;
}

interface WorkoutListProps {
  workouts: WorkoutSummary[];
  onSelectWorkout: (workout: WorkoutSummary) => void;
  onEditWorkout: (workout: WorkoutSummary) => void;
  onDeleteWorkout: (id: string) => void;
  onOpenMergeModal: () => void;
  language?: string;
}

export const WorkoutList: React.FC<WorkoutListProps> = ({
  workouts,
  onSelectWorkout,
  onEditWorkout,
  onDeleteWorkout,
  onOpenMergeModal,
  language = "fi"
}) => {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [displayLimit, setDisplayLimit] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const filteredWorkouts = workouts.filter((w) => {
    if (sourceFilter === "strava") return w.source === "strava" || !!w.strava_id;
    if (sourceFilter === "local") return w.source === "local" || w.source === "local_fit" || !w.source;
    return true;
  });

  const totalPages = displayLimit === 99999 ? 1 : Math.ceil(filteredWorkouts.length / displayLimit) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * displayLimit;
  const paginatedWorkouts = displayLimit === 99999 ? filteredWorkouts : filteredWorkouts.slice(startIndex, startIndex + displayLimit);

  return (
    <div className="bg-white rounded-[32px] p-6 md:p-8 space-y-5">
      {/* Header Controls & View Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0071e3]" />
            <span>Harjoitushistoria ({filteredWorkouts.length} / {workouts.length})</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Tarkastele harjoitushistoriaa taulukossa tai korteissa. Klikkaa riviä avataksesi suorituksen yksityiskohdat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          {/* Source Filter Switcher */}
          <div className="flex bg-[#e8e8ed] p-1 rounded-full text-[11px] font-bold">
            <button
              onClick={() => { setSourceFilter("all"); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-full transition cursor-pointer ${
                sourceFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kaikki
            </button>
            <button
              onClick={() => { setSourceFilter("strava"); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1 ${
                sourceFilter === "strava" ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🧡 Strava</span>
            </button>
            <button
              onClick={() => { setSourceFilter("local"); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1 ${
                sourceFilter === "local" ? "bg-[#0071e3] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>💻 Omat / FIT</span>
            </button>
          </div>

          {/* Table / Cards Toggle */}
          <div className="flex bg-[#e8e8ed] p-1 rounded-full text-xs font-bold">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3.5 py-1.5 rounded-full transition flex items-center gap-1 cursor-pointer ${
                viewMode === "table" ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Taulukko</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3.5 py-1.5 rounded-full transition flex items-center gap-1 cursor-pointer ${
                viewMode === "cards" ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kortit</span>
            </button>
          </div>

          {/* Merge button */}
          <button
            onClick={onOpenMergeModal}
            className="px-4 py-1.5 bg-[#f5f5f7] hover:bg-[#eaeaec] text-slate-900 text-xs font-bold rounded-full transition flex items-center gap-1.5 cursor-pointer"
          >
            <GitMerge className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>Yhdistä</span>
          </button>

          {/* Limit selector */}
          <div className="flex items-center gap-1.5 text-xs bg-[#f5f5f7] px-3.5 py-1.5 rounded-full">
            <span className="text-slate-500 font-medium">Näytä:</span>
            <select
              value={displayLimit}
              onChange={(e) => {
                setDisplayLimit(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-900 font-extrabold focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={99999}>Kaikki</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Rendering */}
      {paginatedWorkouts.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-[#f5f5f7] rounded-2xl">
          Ei harjoituksia valitulla suodattimella.
        </div>
      ) : viewMode === "table" ? (
        /* ELEGANT APPLE TABLE VIEW */
        <div className="overflow-x-auto rounded-2xl bg-[#f5f5f7] p-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4 rounded-l-xl">Pvm</th>
                <th className="py-3 px-4">Harjoituksen nimi</th>
                <th className="py-3 px-4 text-right">Matka</th>
                <th className="py-3 px-4 text-right">Kesto</th>
                <th className="py-3 px-4 text-right">NP Teho</th>
                <th className="py-3 px-4 text-right">Syke</th>
                <th className="py-3 px-4 text-right">TSS</th>
                <th className="py-3 px-4 text-right">IF</th>
                <th className="py-3 px-4 text-right">EF</th>
                <th className="py-3 px-4 text-center">Lähde</th>
                <th className="py-3 px-4 text-right rounded-r-xl"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/40">
              {paginatedWorkouts.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => onSelectWorkout(w)}
                  className="hover:bg-white transition cursor-pointer group font-medium text-slate-800"
                >
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-medium">
                    {new Date(w.timestamp).toLocaleDateString("fi-FI", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-[#0071e3] transition max-w-[200px] truncate">
                    {w.title || "Nimetön harjoitus"}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-slate-900">
                    {w.distance_meters > 0 ? `${(w.distance_meters / 1000.0).toFixed(1)} km` : "-"}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap text-slate-600">
                    {formatDuration(w.duration_seconds)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-emerald-600">
                    {w.np ? `${w.np.toFixed(0)} W` : (w.average_power ? `${w.average_power.toFixed(0)} W` : "-")}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-rose-500">
                    {w.average_hr ? `${w.average_hr.toFixed(0)} bpm` : "-"}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-black text-amber-600">
                    {w.tss ? w.tss.toFixed(0) : "0"}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap text-slate-600 font-semibold">
                    {w.if_factor ? w.if_factor.toFixed(2) : "-"}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-[#0071e3]">
                    {w.ef !== undefined && w.ef !== null ? w.ef.toFixed(2) : "-"}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {w.source === "strava" || w.strava_id ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-800 border border-orange-300 px-2.5 py-0.5 rounded-full font-bold">
                        🧡 Strava
                      </span>
                    ) : w.source === "hybrid" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-300 px-2.5 py-0.5 rounded-full font-bold">
                        ⚡ FIT + Strava
                      </span>
                    ) : w.source === "suunto" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-800 border border-red-300 px-2.5 py-0.5 rounded-full font-bold">
                        🔴 Suunto
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                        💻 Omat Tiedostot
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0071e3] group-hover:translate-x-0.5 transition inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedWorkouts.map((w) => (
            <div
              key={w.id}
              onClick={() => onSelectWorkout(w)}
              className="bg-[#f5f5f7] hover:bg-[#eaeaec] p-5 rounded-[24px] transition cursor-pointer flex flex-col justify-between gap-3 group"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-[#0071e3] transition">
                    {w.title || "Nimetön harjoitus"}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                    <span>📅 {new Date(w.timestamp).toLocaleDateString("fi-FI", { day: "numeric", month: "numeric", year: "numeric" })}</span>
                    <span>⏱️ {formatDuration(w.duration_seconds)}</span>
                  </p>
                </div>
                {w.estimated_power_present ? (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">Syke-arvio</span>
                ) : w.real_power_present ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">Tehomittari</span>
                ) : null}
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Matka</p>
                  <p className="text-xs font-black text-slate-900">{w.distance_meters > 0 ? `${(w.distance_meters / 1000.0).toFixed(1)} km` : "-"}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">NP Teho</p>
                  <p className="text-xs font-black text-emerald-600">{w.np ? `${w.np.toFixed(0)} W` : "-"}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Syke</p>
                  <p className="text-xs font-black text-rose-500">{w.average_hr ? `${w.average_hr.toFixed(0)}` : "-"}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">TSS</p>
                  <p className="text-xs font-black text-amber-600">{w.tss ? w.tss.toFixed(0) : "0"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {displayLimit !== 99999 && totalPages > 1 && (
        <div className="flex justify-between items-center border-t border-slate-100 pt-4 text-xs">
          <span className="text-slate-500 font-medium">
            Sivu <strong className="text-slate-900">{activePage}</strong> / {totalPages} (Yhteensä {workouts.length} harjoitusta)
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={activePage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none text-slate-900 font-bold rounded-full transition flex items-center gap-1 border border-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Edellinen</span>
            </button>

            <button
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none text-slate-900 font-bold rounded-full transition flex items-center gap-1 border border-slate-200 cursor-pointer"
            >
              <span>Seuraava</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
