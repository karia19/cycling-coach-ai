"use client";

import React, { useState } from "react";
import { 
  X, 
  Trash2, 
  Sliders, 
  Zap, 
  Heart, 
  Calendar, 
  Clock, 
  Flame, 
  Activity, 
  Info,
  Shield,
  GitMerge
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine,
  ScatterChart,
  Scatter
} from "recharts";
import { WorkoutSummary } from "./WorkoutList";

interface WorkoutModalProps {
  workout: WorkoutSummary;
  workoutStream: any[];
  workoutAnalytics: any;
  userParams: any;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onUnmerge?: (id: string) => void;
  language?: string;
}

export const WorkoutModal: React.FC<WorkoutModalProps> = ({
  workout,
  workoutStream,
  workoutAnalytics,
  userParams,
  onClose,
  onDelete,
  onEdit,
  onUnmerge,
  language = "fi"
}) => {
  const [modalTab, setModalTab] = useState<"stream" | "wprime" | "decoupling" | "zones" | "scatter">("stream");
  const [scatterMode, setScatterMode] = useState<"powerHR" | "cadencePower">("powerHR");

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const safeStream = Array.isArray(workoutStream) ? workoutStream : [];
  const hasPower = workout.real_power_present || workout.estimated_power_present || safeStream.some((r: any) => r && r.power !== null && r.power !== undefined);
  const hasCadence = safeStream.some((r: any) => r && r.cadence !== null && r.cadence !== undefined && r.cadence > 0);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 md:p-6 z-50 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-gray-200 rounded-[32px] max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative text-slate-900">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-[#f5f5f7] hover:bg-gray-200 text-gray-500 hover:text-slate-900 rounded-full transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-2 border-b border-gray-100 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            {workout.source === "strava" || workout.strava_id ? (
              <span className="text-xs bg-orange-50 border border-orange-200 text-orange-700 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                🧡 Strava Synkronoitu {workout.strava_id && `(#${workout.strava_id})`}
              </span>
            ) : workout.source === "hybrid" ? (
              <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                ⚡ Yhdistetty FIT + Strava
              </span>
            ) : (
              <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                💻 Omat Tiedostot (Local FIT/GPX)
              </span>
            )}

            {workout.estimated_power_present ? (
              <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Sykkeestä arvioitu tehosignaali
              </span>
            ) : workout.real_power_present ? (
              <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600" /> Suora Tehomittari
              </span>
            ) : null}

            {(workout.source_file_ids?.length ?? 0) > 1 && (
              <span className="text-xs bg-sky-50 border border-sky-200 text-sky-700 px-3 py-1 rounded-full font-bold">
                Yhdistetty ajo ({workout.source_file_ids?.length} tiedostoa)
              </span>
            )}
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {workout.title || (language === "fi" ? "Nimetön harjoitus" : "Unnamed Workout")}
          </h2>

          <p className="text-xs text-gray-500 font-medium flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {new Date(workout.timestamp).toLocaleString("fi-FI", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Key Metrics Grid (Apple White Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          <div className="bg-[#f5f5f7] p-3.5 rounded-2xl border border-gray-200/70 text-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Kesto</p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">{formatDuration(workout.duration_seconds)}</p>
          </div>
          <div className="bg-[#f5f5f7] p-3.5 rounded-2xl border border-gray-200/70 text-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Matka</p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">{(workout.distance_meters / 1000.0).toFixed(1)} km</p>
          </div>
          <div className="bg-[#f5f5f7] p-3.5 rounded-2xl border border-gray-200/70 text-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Teho NP</p>
            <p className="text-sm font-extrabold text-emerald-600 mt-0.5">{workout.np ? `${workout.np.toFixed(0)} W` : "-"}</p>
          </div>
          <div className="bg-[#f5f5f7] p-3.5 rounded-2xl border border-gray-200/70 text-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Keskisyke</p>
            <p className="text-sm font-extrabold text-rose-600 mt-0.5">{workout.average_hr ? `${workout.average_hr.toFixed(0)} bpm` : "-"}</p>
          </div>
          <div className="bg-[#f5f5f7] p-3.5 rounded-2xl border border-gray-200/70 text-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">TSS Kuormitus</p>
            <p className="text-sm font-extrabold text-amber-600 mt-0.5">{workout.tss ? workout.tss.toFixed(0) : "0"}</p>
          </div>
          <div className="bg-[#f5f5f7] p-3.5 rounded-2xl border border-gray-200/70 text-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Hyötysuhde (EF)</p>
            <p className="text-sm font-extrabold text-sky-600 mt-0.5">{workout.ef ? workout.ef.toFixed(2) : "-"}</p>
          </div>
        </div>

        {/* Tab Buttons (Apple Segmented Control) */}
        <div className="flex bg-[#f5f5f7] p-1.5 rounded-full border border-gray-200 text-xs overflow-x-auto">
          <button
            onClick={() => setModalTab("stream")}
            className={`flex-1 py-2 px-3 rounded-full font-semibold transition whitespace-nowrap cursor-pointer ${
              modalTab === "stream" ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:text-slate-900"
            }`}
          >
            Treenikäyrä
          </button>
          <button
            onClick={() => setModalTab("wprime")}
            disabled={!workoutAnalytics || !hasPower}
            className={`flex-1 py-2 px-3 rounded-full font-semibold transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer ${
              modalTab === "wprime" ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:text-slate-900"
            }`}
          >
            W' Akku (Anaerobinen)
          </button>
          <button
            onClick={() => setModalTab("decoupling")}
            disabled={!workoutAnalytics || !hasPower || !workout.hr_present}
            className={`flex-1 py-2 px-3 rounded-full font-semibold transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer ${
              modalTab === "decoupling" ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:text-slate-900"
            }`}
          >
            Pw:HR Aerobinen
          </button>
          <button
            onClick={() => setModalTab("zones")}
            disabled={!workoutAnalytics}
            className={`flex-1 py-2 px-3 rounded-full font-semibold transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer ${
              modalTab === "zones" ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:text-slate-900"
            }`}
          >
            Tehoalueet
          </button>
          <button
            onClick={() => setModalTab("scatter")}
            disabled={!workoutAnalytics}
            className={`flex-1 py-2 px-3 rounded-full font-semibold transition disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer ${
              modalTab === "scatter" ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:text-slate-900"
            }`}
          >
            Hajonta (Scatter)
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="w-full bg-[#f9f9fb] p-5 md:p-6 rounded-[24px] border border-gray-200/80 space-y-4">
          {modalTab === "stream" && safeStream.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Treenikuvaaja</span>
                  <span className="text-xs font-normal text-gray-500">(Teho & Syke sekuntikohtaisesti)</span>
                </h4>
              </div>
              <div className="h-[480px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={safeStream} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="modalPowerGradLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="modalHrGradLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time_offset" 
                      stroke="#6b7280" 
                      fontSize={11} 
                      tickFormatter={(val) => {
                        const m = Math.floor(val / 60);
                        const s = Math.floor(val % 60);
                        return `${m}:${s < 10 ? '0' : ''}${s}`;
                      }} 
                    />
                    <YAxis yAxisId="left" stroke="#059669" fontSize={11} label={{ value: 'Teho (W)', angle: -90, position: 'insideLeft', fill: '#059669', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#e11d48" fontSize={11} label={{ value: 'Syke (BPM)', angle: 90, position: 'insideRight', fill: '#e11d48', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "1rem", fontSize: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}
                      labelFormatter={(val: any) => {
                        const num = Number(val) || 0;
                        return `Aika: ${Math.floor(num / 60)}m ${Math.floor(num % 60)}s`;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="power" stroke="#059669" fill="url(#modalPowerGradLight)" strokeWidth={2} dot={false} name={workout.estimated_power_present ? "Arvioitu Teho (W)" : "Teho (W)"} />
                    <Area yAxisId="right" type="monotone" dataKey="heart_rate" stroke="#e11d48" fill="url(#modalHrGradLight)" strokeWidth={2} dot={false} name="Syke (BPM)" />
                    {hasCadence && (
                      <Line yAxisId="right" type="monotone" dataKey="cadence" stroke="#0284c7" dot={false} strokeWidth={1.5} opacity={0.6} name="Kadenssi (RPM)" />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {modalTab === "wprime" && safeStream.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h4 className="text-sm font-bold text-purple-700">W' Balance (Anaerobinen akkukapasiteetti - Skiba-malli)</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Seuraa anaerobisen energiatankin kulumista ja palautumista sekunti sekunnilta suorituksen aikana.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1 rounded-full font-bold">
                    Kapasiteetti ($W'$): {(((userParams?.w_prime || 20000)) / 1000.0).toFixed(1)} kJ
                  </span>
                </div>
              </div>

              <div className="h-[480px] w-full pt-2">
                {(() => {
                  const userW = userParams?.w_prime || 20000.0;
                  const wPrimeData = safeStream.map((r: any) => ({
                    time_offset: r.time_offset,
                    w_bal: (r.w_prime_bal !== undefined ? r.w_prime_bal : userW) / 1000.0
                  }));
                  const maxWkJ = userW / 1000.0;
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={wPrimeData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="modalWPrimeGradLight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35}/>
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="time_offset" 
                          stroke="#6b7280" 
                          fontSize={11} 
                          tickFormatter={(val) => {
                            const m = Math.floor(val / 60);
                            const s = Math.floor(val % 60);
                            return `${m}:${s < 10 ? '0' : ''}${s}`;
                          }} 
                        />
                        <YAxis stroke="#7c3aed" fontSize={11} label={{ value: "W' Akku (kJ)", angle: -90, position: "insideLeft", fill: "#7c3aed", fontSize: 11 }} domain={[0, maxWkJ * 1.05]} />
                        <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "1rem", fontSize: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                        <Area type="monotone" dataKey="w_bal" stroke="#7c3aed" fill="url(#modalWPrimeGradLight)" strokeWidth={2} dot={false} name="W' Akku" />
                        <ReferenceLine y={maxWkJ * 0.50} stroke="#d97706" strokeDasharray="3 3" label={{ value: '50% Akku', fill: '#d97706', fontSize: 10 }} />
                        <ReferenceLine y={maxWkJ * 0.25} stroke="#dc2626" strokeDasharray="3 3" label={{ value: '25% Akku (Vaara!)', fill: '#dc2626', fontSize: 10 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>
          )}

          {modalTab === "decoupling" && workoutAnalytics && workoutAnalytics.decoupling && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Aerobinen Decoupling (Pw:HR aerobinen siirtymä)</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Vertaa ensimmäisen ja toisen puoliskon teho/syke-suhdetta. Yli 5% decoupling viittaa aerobisen kestävyyden hyytymiseen.
                  </p>
                </div>
                <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                  workoutAnalytics.decoupling.decoupling_percent > 5 
                    ? "bg-rose-50 border-rose-200 text-rose-700" 
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}>
                  Pw:HR Drift: {workoutAnalytics.decoupling.decoupling_percent.toFixed(2)}%
                </span>
              </div>
              <div className="h-[480px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={safeStream} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="decPowerGradModalLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="decHrGradModalLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time_offset" 
                      stroke="#6b7280" 
                      fontSize={11} 
                      tickFormatter={(val) => {
                        const m = Math.floor(val / 60);
                        const s = Math.floor(val % 60);
                        return `${m}:${s < 10 ? '0' : ''}${s}`;
                      }} 
                    />
                    <YAxis yAxisId="left" stroke="#059669" fontSize={11} label={{ value: 'Teho (W)', angle: -90, position: 'insideLeft', fill: '#059669', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#e11d48" fontSize={11} label={{ value: 'Syke (BPM)', angle: 90, position: 'insideRight', fill: '#e11d48', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "1rem", fontSize: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="power" stroke="#059669" fill="url(#decPowerGradModalLight)" strokeWidth={2} dot={false} name="Teho (W)" />
                    <Area yAxisId="right" type="monotone" dataKey="heart_rate" stroke="#e11d48" fill="url(#decHrGradModalLight)" strokeWidth={2} dot={false} name="Syke (BPM)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {modalTab === "zones" && workoutAnalytics && workoutAnalytics.zones && (
            <div className="space-y-5">
              <h4 className="text-sm font-bold text-slate-900">Harjoituskuormitus teho- ja sykealueittain</h4>
              
              {hasPower && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Aika tehoalueilla (Power Zones Z1-Z6)</h5>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {Object.entries(workoutAnalytics.zones.power_zones).map(([zone, val]: any) => {
                      const colors: any = {
                        Z1: "bg-blue-50 border-blue-200 text-blue-700",
                        Z2: "bg-emerald-50 border-emerald-200 text-emerald-700",
                        Z3: "bg-yellow-50 border-yellow-200 text-yellow-700",
                        Z4: "bg-orange-50 border-orange-200 text-orange-700",
                        Z5: "bg-rose-50 border-rose-200 text-rose-700",
                        Z6: "bg-purple-50 border-purple-200 text-purple-700",
                      };
                      return (
                        <div key={zone} className={`p-3.5 rounded-2xl border text-center ${colors[zone] || ""}`}>
                          <p className="text-xs font-bold">{zone}</p>
                          <p className="text-sm font-extrabold mt-1">{val.toFixed(1)}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {workout.hr_present && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-rose-700 uppercase tracking-wider">Aika sykealueilla (HR Zones Z1-Z5)</h5>
                  <div className="grid grid-cols-5 gap-3">
                    {Object.entries(workoutAnalytics.zones.hr_zones).map(([zone, val]: any) => {
                      const colors: any = {
                        Z1: "bg-blue-50 border-blue-200 text-blue-700",
                        Z2: "bg-emerald-50 border-emerald-200 text-emerald-700",
                        Z3: "bg-yellow-50 border-yellow-200 text-yellow-700",
                        Z4: "bg-orange-50 border-orange-200 text-orange-700",
                        Z5: "bg-rose-50 border-rose-200 text-rose-700",
                      };
                      return (
                        <div key={zone} className={`p-3.5 rounded-2xl border text-center ${colors[zone] || ""}`}>
                          <p className="text-xs font-bold">{zone}</p>
                          <p className="text-sm font-extrabold mt-1">{val.toFixed(1)}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {modalTab === "scatter" && safeStream.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Hajontakuvaaja (Scatter Plot)</h4>
                  <p className="text-xs text-gray-500">Määritä korrelaatio ja hermolihasjakauma treenin aikana.</p>
                </div>
                <div className="flex bg-[#f5f5f7] p-1 rounded-full border border-gray-200 text-xs self-end">
                  <button
                    type="button"
                    onClick={() => setScatterMode("powerHR")}
                    className={`px-3 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                      scatterMode === "powerHR" ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:text-slate-900"
                    }`}
                  >
                    Teho vs. Syke
                  </button>
                  <button
                    type="button"
                    onClick={() => setScatterMode("cadencePower")}
                    className={`px-3 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                      scatterMode === "cadencePower" ? "bg-white text-slate-900 shadow-sm" : "text-gray-500 hover:text-slate-900"
                    }`}
                  >
                    Kadenssi vs. Teho {!hasCadence && "(Ei kadenssia)"}
                  </button>
                </div>
              </div>

              <div className="h-[480px] w-full pt-2">
                {scatterMode === "powerHR" ? (
                  hasPower && (workout.hr_present || safeStream.some(r => r && r.heart_rate !== null && r.heart_rate > 0)) ? (
                    (() => {
                      const scatterData = safeStream
                        .filter(r => r && r.power !== null && r.power !== undefined && r.heart_rate !== null && r.heart_rate !== undefined)
                        .map(r => ({ x: r.power, y: r.heart_rate }));
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="x" name="Teho" unit=" W" stroke="#6b7280" fontSize={11} label={{ value: 'Teho (W)', position: 'insideBottom', offset: -5, fill: '#4b5563', fontSize: 11 }} />
                            <YAxis type="number" dataKey="y" name="Syke" unit=" BPM" domain={['dataMin - 5', 'dataMax + 5']} stroke="#6b7280" fontSize={11} label={{ value: 'Syke (BPM)', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 11 }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "1rem", fontSize: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                            <Scatter name="Pisteet" data={scatterData} fill="#059669" opacity={0.4} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      );
                    })()
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 p-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Activity className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Molemmat teho- ja syketiedot vaaditaan</p>
                        <p className="text-slate-500 max-w-sm mt-1">
                          Tämän harjoituksen tiedostosta puuttuu syke- tai tehosignaali.
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  hasPower && hasCadence ? (
                    (() => {
                      const scatterData = safeStream
                        .filter(r => r && r.cadence !== null && r.cadence !== undefined && r.power !== null && r.power !== undefined)
                        .map(r => ({ x: r.cadence, y: r.power }));
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="x" name="Kadenssi" unit=" RPM" stroke="#6b7280" fontSize={11} label={{ value: 'Kadenssi (RPM)', position: 'insideBottom', offset: -5, fill: '#4b5563', fontSize: 11 }} />
                            <YAxis type="number" dataKey="y" name="Teho" unit=" W" stroke="#6b7280" fontSize={11} label={{ value: 'Teho (W)', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 11 }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "1rem", fontSize: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                            <Scatter name="Pisteet" data={scatterData} fill="#0284c7" opacity={0.4} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      );
                    })()
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 p-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Activity className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Ei kadenssitietoja (RPM) tässä harjoituksessa</p>
                        <p className="text-slate-500 max-w-sm mt-1">
                          Tämän harjoituksen raakatiedostossa (FIT) ei ole kadenssianturin dataa. Klikkaa ylhäältä <strong>Teho vs. Syke</strong> nähdäksesi sykekorrelaatiokuvaajan!
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex justify-between items-center border-t border-gray-100 pt-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onDelete(workout.id)}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-full border border-rose-200 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Poista harjoitus</span>
            </button>

            <button
              onClick={onEdit}
              className="px-4 py-2 bg-[#f5f5f7] hover:bg-gray-200 text-slate-900 text-xs font-bold rounded-full border border-gray-200 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5 text-emerald-600" />
              <span>Muokkaa tietoja</span>
            </button>

            {onUnmerge && (workout.is_merged || (workout.source_file_ids?.length ?? 0) > 1) && (
              <button
                onClick={() => onUnmerge(workout.id)}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200 transition flex items-center space-x-1.5 cursor-pointer"
                title="Pura yhdistäminen ja palauta tiedostot omiksi erillisiksi harjoituksikseen"
              >
                <GitMerge className="h-3.5 w-3.5 text-amber-600" />
                <span>Pura yhdistäminen</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full text-xs transition cursor-pointer shadow-md"
          >
            Sulje
          </button>
        </div>
      </div>
    </div>
  );
};
