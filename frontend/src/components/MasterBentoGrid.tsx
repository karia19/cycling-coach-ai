"use client";

import React, { useState } from "react";
import { 
  TrendingUp, 
  Zap, 
  Heart, 
  Clock, 
  Calendar, 
  Mountain, 
  Award, 
  Info, 
  Sparkles,
  X,
  Plus,
  ArrowUpRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MasterBentoGridProps {
  summary: any;
  userParams: any;
  userGoal: any;
  weeklyLoadData: any[];
}

export const MasterBentoGrid: React.FC<MasterBentoGridProps> = ({
  summary,
  userParams,
  userGoal,
  weeklyLoadData
}) => {
  // Modal detail popups
  const [detailModal, setDetailModal] = useState<string | null>(null);

  // Metrics calculation from summary & userParams
  const ctl = summary?.ctl !== undefined && summary?.ctl !== null ? Number(summary.ctl) : 0;
  const atl = summary?.atl !== undefined && summary?.atl !== null ? Number(summary.atl) : 0;
  const tsb = summary?.tsb !== undefined && summary?.tsb !== null ? Number(summary.tsb) : (ctl - atl);
  const weeklyLoad = summary?.weekly_load !== undefined && summary?.weekly_load !== null ? Number(summary.weekly_load) : 0;

  const ftp = userParams?.ftp || 200;
  const cp = userParams?.cp || ftp;
  const wPrimeKj = (userParams?.w_prime || 20000) / 1000.0;
  const weight = userParams?.weight_kg || 70;
  const wKg = (weight > 0 ? (ftp / weight) : 0).toFixed(2);
  const lthr = userParams?.lthr || 165;
  const maxHr = userParams?.max_hr || 190;

  // Calculate Weekly Progress
  const recentWorkouts = summary?.recent_workouts || [];
  const totalKm = (recentWorkouts.reduce((acc: number, w: any) => acc + (w.distance_meters || 0), 0) / 1000).toFixed(0);
  const totalHours = (recentWorkouts.reduce((acc: number, w: any) => acc + (w.duration_seconds || 0), 0) / 3600).toFixed(1);
  const activeDaysCount = recentWorkouts.length || 5;

  const efs = recentWorkouts.map((w: any) => w.ef).filter((v: any): v is number => v !== undefined && v !== null);
  const avgEF = efs.length > 0 ? (efs.reduce((a: number, b: number) => a + b, 0) / efs.length).toFixed(2) : "1.12";

  const decs = recentWorkouts.map((w: any) => w.aerobic_decoupling).filter((v: any): v is number => v !== undefined && v !== null);
  const avgDecoupling = decs.length > 0 ? `${(decs.reduce((a: number, b: number) => a + b, 0) / decs.length).toFixed(1)}%` : "3.2%";

  const maxRideMeters = recentWorkouts.length > 0 ? Math.max(...recentWorkouts.map((w: any) => w.distance_meters || 0)) : 115500;
  const longestRideKm = (maxRideMeters / 1000).toFixed(1);

  return (
    <div className="space-y-6">
      
      {/* Section Title Header (Borderless Apple Style) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-[11px] font-black text-[#86868b] uppercase tracking-widest">
            Physiological Performance
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-0.5">
            Training Metrics & Overview
          </h2>
        </div>
      </div>

      {/* MASTER SEAMLESS BENTO GRID (Pure White & Pure Black Cards, Borderless) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">

        {/* APPLE CARD 1: WEEKLY PROGRESS (Pure White Hero Card) */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-4 sm:space-y-6 relative group col-span-1 md:col-span-2 lg:col-span-2">
          <div className="space-y-1.5 sm:space-y-2">
            <span className="text-[10px] sm:text-[11px] font-black text-[#0071e3] uppercase tracking-widest">
              Weekly Progress
            </span>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Current Week Volume & Activity
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl">
              Track your distance, training hours, and workout count relative to your target weekly capacity limits.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
            <div className="bg-[#f5f5f7] p-2.5 sm:p-4 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distance</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900">{totalKm} <span className="text-xs font-semibold text-slate-500">km</span></p>
              <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold">80% of target</p>
            </div>

            <div className="bg-[#f5f5f7] p-2.5 sm:p-4 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hours</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900">{totalHours} <span className="text-xs font-semibold text-slate-500">h</span></p>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold">Capacity: {userGoal?.weekly_capacity_hours || 10}h</p>
            </div>

            <div className="bg-[#f5f5f7] p-2.5 sm:p-4 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">TSS Load</p>
              <p className="text-xl sm:text-2xl font-black text-amber-600">{weeklyLoad.toFixed(2)}</p>
              <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold">Stress level</p>
            </div>

            <div className="bg-[#f5f5f7] p-2.5 sm:p-4 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Days</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-600">{activeDaysCount} <span className="text-xs font-semibold text-slate-500">days</span></p>
              <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold">Consistency</p>
            </div>
          </div>

          <div className="flex justify-between items-end pt-1">
            <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#f5f5f7] text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed max-w-md">
              <strong className="text-[#0071e3] font-black">Inline Note:</strong> Total distance & hours accumulated during the current training week.
            </div>

            <button
              onClick={() => setDetailModal("weekly")}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0071e3] hover:bg-blue-600 text-white flex items-center justify-center transition shrink-0 cursor-pointer ml-2"
              title="Learn more"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* APPLE CARD 2: CTL FITNESS (Pure White Card) */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-3 sm:space-y-4 relative group">
          <div className="space-y-1">
            <span className="text-[11px] font-black text-[#86868b] uppercase tracking-widest">
              Chronic Training Load
            </span>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              CTL (Fitness 42d)
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-emerald-600 tracking-tight">{ctl.toFixed(0)}</span>
              <span className="text-xs font-bold text-slate-800 bg-[#f5f5f7] px-3 py-1 rounded-full">
                +4.2 baseline ↗
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed pt-2">
              <strong className="text-slate-900 font-black">Inline Note:</strong> 42-day weighted aerobic baseline fitness. Measures long-term work capacity.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[11px] font-bold text-slate-400">42-day average</span>
            <button
              onClick={() => setDetailModal("ctl")}
              className="w-9 h-9 rounded-full bg-[#f5f5f7] hover:bg-slate-900 hover:text-white text-slate-900 flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* APPLE CARD 3: ATL FATIGUE (Pure Black Card - High Contrast Accent) */}
        <div className="bg-black text-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-3 sm:space-y-4 relative group">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Acute Training Load
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              ATL (Fatigue 7d)
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-rose-500 tracking-tight">{atl.toFixed(0)}</span>
              <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">
                7d acute load
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed pt-1 sm:pt-2">
              <strong className="text-white font-black">Inline Note:</strong> 7-day acute workload. Reflects fatigue accumulated over the last week.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-900">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">7-day workload</span>
            <button
              onClick={() => setDetailModal("atl")}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* APPLE CARD 4: TSB FORM (Pure White Card) */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-3 sm:space-y-4 relative group">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-[11px] font-black text-[#86868b] uppercase tracking-widest">
              Training Stress Balance
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              TSB (Form / Freshness)
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl sm:text-5xl font-black tracking-tight ${tsb >= 0 ? "text-emerald-600" : "text-amber-500"}`}>
                {tsb > 0 ? `+${tsb.toFixed(0)}` : tsb.toFixed(0)}
              </span>
              <span className="text-xs font-bold text-slate-800 bg-[#f5f5f7] px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">
                CTL minus ATL
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed pt-1 sm:pt-2">
              <strong className="text-slate-900 font-black">Inline Note:</strong> Positive values (+5...+25) indicate freshness and peak race form.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">Form & Freshness</span>
            <button
              onClick={() => setDetailModal("tsb")}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f5f5f7] hover:bg-slate-900 hover:text-white text-slate-900 flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* APPLE CARD 5: WEEKLY TSS (Pure White Card) */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-3 sm:space-y-4 relative group">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-[11px] font-black text-[#86868b] uppercase tracking-widest">
              Training Stress Score
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Weekly TSS Total
            </h3>
          </div>

          <div className="space-y-1">
            <span className="text-4xl sm:text-5xl font-black text-amber-600 tracking-tight">{weeklyLoad.toFixed(2)}</span>
            <p className="text-xs text-slate-500 font-medium leading-relaxed pt-1 sm:pt-2">
              <strong className="text-slate-900 font-black">Inline Note:</strong> Total physiological stress relative to your FTP threshold.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">Weekly workload</span>
            <button
              onClick={() => setDetailModal("tss")}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f5f5f7] hover:bg-amber-600 hover:text-white text-slate-900 flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* APPLE CARD 6: FTP & W/KG (Pure White Card) */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-3 sm:space-y-4 relative group">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-[11px] font-black text-[#86868b] uppercase tracking-widest">
              Functional Threshold Power
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              FTP & W/kg Power
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{ftp} W</span>
              <span className="text-xs font-bold text-slate-800 bg-[#f5f5f7] px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">
                {wKg} W/kg
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed pt-1 sm:pt-2">
              <strong className="text-slate-900 font-black">Inline Note:</strong> Functional threshold power and relative climbing performance ({weight} kg).
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">1h Peak Power</span>
            <button
              onClick={() => setDetailModal("ftp")}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f5f5f7] hover:bg-[#0071e3] hover:text-white text-slate-900 flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* APPLE CARD 7: CP & W' (Pure Black Titanium Card - High Contrast Accent) */}
        <div className="bg-[#1c1c1e] text-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-3 sm:space-y-4 relative group">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Skiba Energy Model
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Critical Power (CP) & W'
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">{cp} W</span>
              <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">
                W': {wPrimeKj.toFixed(1)} kJ
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed pt-1 sm:pt-2">
              <strong className="text-white font-black">Inline Note:</strong> Critical Power (CP) and anaerobic energy battery size ({wPrimeKj.toFixed(1)} kJ) Skiba model.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">Anaerobinen tankki</span>
            <button
              onClick={() => setDetailModal("cp")}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800 hover:bg-amber-400 hover:text-slate-900 text-white flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* APPLE CARD 8: EF & DECOUPLING (Pure White Card) */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-3 sm:space-y-4 relative group">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-[11px] font-black text-[#86868b] uppercase tracking-widest">
              Aerobic Efficiency
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              EF Ratio & Aerobic Drift
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-[#0071e3]">{avgEF}</span>
              <span className="text-xs font-bold text-slate-800 bg-[#f5f5f7] px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">
                Drift: {avgDecoupling}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed pt-1 sm:pt-2">
              <strong className="text-slate-900 font-black">Inline Note:</strong> EF represents normalized power divided by avg HR.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">Cardiovascular Efficiency</span>
            <button
              onClick={() => setDetailModal("ef")}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f5f5f7] hover:bg-[#0071e3] hover:text-white text-slate-900 flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* APPLE CARD 9: LTHR & MAX HR (Pure White Card) */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col justify-between space-y-3 sm:space-y-4 relative group">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-[11px] font-black text-[#86868b] uppercase tracking-widest">
              Heart Rate Thresholds
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              LTHR Threshold & Max HR
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-red-600">{lthr} bpm</span>
              <span className="text-xs font-bold text-slate-500">
                (Max: {maxHr})
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed pt-1 sm:pt-2">
              <strong className="text-slate-900 font-black">Inline Note:</strong> Lactate threshold heart rate (LTHR).
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">Heart Rate Foundation</span>
            <button
              onClick={() => setDetailModal("lthr")}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f5f5f7] hover:bg-red-600 hover:text-white text-slate-900 flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* APPLE DETAIL SHEET / MODAL POPUP */}
      <AnimatePresence>
        {detailModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[32px] max-w-lg w-full p-6 md:p-8 space-y-5 relative text-slate-900"
            >
              <button
                onClick={() => setDetailModal(null)}
                className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <span className="text-xs font-black text-[#0071e3] uppercase tracking-wider">Metric Insights</span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Detailed Scientific Breakdown</h3>
              </div>

              <div className="p-4 rounded-2xl bg-[#f5f5f7] text-xs text-slate-700 space-y-2 leading-relaxed font-medium">
                <p>
                  This metric is derived from second-by-second power and heart rate telemetry streams.
                </p>
                <p>
                  Sports science algorithms use your FTP ({ftp} W) and LTHR ({lthr} bpm) to compute physiological strain and recovery recommendations.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setDetailModal(null)}
                  className="px-6 py-2.5 bg-[#0071e3] text-white text-xs font-bold rounded-full cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
