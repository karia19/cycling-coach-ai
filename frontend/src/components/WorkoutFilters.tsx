"use client";

import React from "react";
import { Search, Filter, Calendar, Zap, Activity, RotateCcw, Sliders } from "lucide-react";

export interface FilterState {
  searchQuery: string;
  selectedMonth: string;
  minNp: string;
  maxNp: string;
  minTss: string;
  maxTss: string;
  powerSource: "all" | "real" | "estimated";
}

interface WorkoutFiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  availableMonths: { value: string; label: string }[];
  totalWorkoutsCount: number;
  filteredWorkoutsCount: number;
}

export const WorkoutFilters: React.FC<WorkoutFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableMonths,
  totalWorkoutsCount,
  filteredWorkoutsCount
}) => {
  return (
    <div className="bg-white rounded-[32px] p-6 space-y-5 border border-slate-100/80 shadow-sm">
      {/* Filter Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3]">
            <Filter className="w-4 h-4" />
          </div>
          <h3 className="text-base font-black text-slate-900 tracking-tight">Workout Search & Filters</h3>
          <span className="text-xs bg-[#f5f5f7] text-slate-700 font-bold px-3 py-1 rounded-full border border-slate-200/60">
            {filteredWorkoutsCount} / {totalWorkoutsCount} workouts
          </span>
        </div>

        <button
          onClick={onResetFilters}
          className="text-xs text-slate-500 hover:text-[#0071e3] flex items-center gap-1.5 transition font-bold cursor-pointer bg-[#f5f5f7] hover:bg-blue-50 px-3 py-1.5 rounded-full"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>

      {/* Grid Controls with Equal Row Heights & Aligned Labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        
        {/* 1. Text Search */}
        <div className="space-y-1.5">
          <label className="h-5 flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">
            <Search className="w-3.5 h-3.5 text-[#0071e3]" /> Search
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Title or notes..."
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
              className="w-full h-10 bg-[#f5f5f7] rounded-xl pl-3 pr-3 text-xs font-semibold text-slate-900 placeholder-slate-400 border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition shadow-none"
            />
          </div>
        </div>

        {/* 2. Month Dropdown */}
        <div className="space-y-1.5">
          <label className="h-5 flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-[#0071e3]" /> Month
          </label>
          <select
            value={filters.selectedMonth}
            onChange={(e) => onFilterChange({ selectedMonth: e.target.value })}
            className="w-full h-10 bg-[#f5f5f7] rounded-xl px-3 text-xs font-bold text-slate-900 border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition cursor-pointer"
          >
            <option value="all">All Months</option>
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* 3. Power Range Filter */}
        <div className="space-y-1.5">
          <label className="h-5 flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-[#0071e3]" /> Power NP (W)
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min W"
              value={filters.minNp}
              onChange={(e) => onFilterChange({ minNp: e.target.value })}
              className="w-1/2 h-10 bg-[#f5f5f7] rounded-xl px-3 text-xs font-semibold text-slate-900 placeholder-slate-400 border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-slate-400 text-xs font-bold shrink-0">-</span>
            <input
              type="number"
              placeholder="Max W"
              value={filters.maxNp}
              onChange={(e) => onFilterChange({ maxNp: e.target.value })}
              className="w-1/2 h-10 bg-[#f5f5f7] rounded-xl px-3 text-xs font-semibold text-slate-900 placeholder-slate-400 border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* 4. TSS Range Filter */}
        <div className="space-y-1.5">
          <label className="h-5 flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-[#0071e3]" /> TSS Load
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min TSS"
              value={filters.minTss}
              onChange={(e) => onFilterChange({ minTss: e.target.value })}
              className="w-1/2 h-10 bg-[#f5f5f7] rounded-xl px-3 text-xs font-semibold text-slate-900 placeholder-slate-400 border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-slate-400 text-xs font-bold shrink-0">-</span>
            <input
              type="number"
              placeholder="Max TSS"
              value={filters.maxTss}
              onChange={(e) => onFilterChange({ maxTss: e.target.value })}
              className="w-1/2 h-10 bg-[#f5f5f7] rounded-xl px-3 text-xs font-semibold text-slate-900 placeholder-slate-400 border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* 5. Power Source Filter */}
        <div className="space-y-1.5">
          <label className="h-5 flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">
            <Sliders className="w-3.5 h-3.5 text-[#0071e3]" /> Power Source
          </label>
          <select
            value={filters.powerSource}
            onChange={(e) => onFilterChange({ powerSource: e.target.value as any })}
            className="w-full h-10 bg-[#f5f5f7] rounded-xl px-3 text-xs font-bold text-slate-900 border border-transparent focus:border-[#0071e3] focus:bg-white focus:outline-none transition cursor-pointer"
          >
            <option value="all">All Workouts</option>
            <option value="real">⚡ Real Power Meter</option>
            <option value="estimated">❤️ HR Power Estimate</option>
          </select>
        </div>

      </div>
    </div>
  );
};
