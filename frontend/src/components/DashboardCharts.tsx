"use client";

import React, { useState, useMemo } from "react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area, 
  ScatterChart, 
  Scatter, 
  ZAxis,
  Cell,
  BarChart,
  Bar,
  PieChart,
  Pie
} from "recharts";
import { 
  ChevronDown, 
  ChevronUp, 
  Maximize2, 
  X, 
  Zap, 
  Heart, 
  Mountain, 
  BarChart3, 
  Flame, 
  Sparkles,
  Activity,
  TrendingUp,
  Compass,
  Layers,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardChartsProps {
  pmcData: any[];
  powerCurveData: any[];
  scatterData: any[];
  heatmapData: { monthly: any[]; daily: any[] } | null;
  weeklyLoad: any[];
  ftpHistory: any[];
  recentWorkouts?: any[];
  userParams?: any;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  pmcData,
  powerCurveData,
  scatterData,
  heatmapData,
  weeklyLoad,
  ftpHistory,
  recentWorkouts = [],
  userParams
}) => {
  // Currently active chart selection in the left accordion menu (Image 1 style)
  const [activeChartKey, setActiveChartKey] = useState<string>("weekly");
  const [fullscreenModal, setFullscreenModal] = useState<boolean>(false);

  // Accordion options matching Image 1 layout
  const chartOptions = [
    {
      id: "weekly",
      title: "Weekly Distance & TSS Load",
      badge: "Volume & Load",
      color: "#0071e3",
      description: "Visualizes weekly kilometer breakdown alongside accumulated Training Stress Score (TSS). Tracks progressive overload across training blocks."
    },
    {
      id: "hr_zones",
      title: "Heart Rate Zones (HR Z1 – Z5)",
      badge: "Z1 – Z5 Zones",
      color: "#ff3b30",
      description: "Time distribution across heart rate zones Z1 (Active Recovery) through Z5 (VO2Max) calculated from lactate threshold heart rate (LTHR)."
    },
    {
      id: "elevation",
      title: "Elevation Profile & Climbing",
      badge: "Cumulative Meters",
      color: "#ff9500",
      description: "Tracks total elevation gain accumulated weekly. Prepares your cardiovascular system for hilly races and alpine endurance events."
    },
    {
      id: "power_zones",
      title: "Power Zones (Coggan 6-Zone)",
      badge: "FTP: " + (userParams?.ftp || 250) + " W",
      color: "#af52de",
      description: "Coggan 6-zone power distribution relative to FTP. Displays time spent in Z2 Endurance vs Z4 Threshold."
    },
    {
      id: "pmc",
      title: "Performance Management Chart (PMC)",
      badge: "CTL, ATL, TSB",
      color: "#34c759",
      description: "Long-term fitness curve (CTL 42d), acute fatigue (ATL 7d), and form/freshness balance (TSB). Industry standard metrics."
    },
    {
      id: "scatter",
      title: "Power vs Heart Rate (Efficiency Factor)",
      badge: "NP / Avg HR",
      color: "#5856d6",
      description: "Scatter plot of normalized power (NP) relative to average heart rate. Color density reflects cardiovascular efficiency (EF)."
    }
  ];

  // HR zones data
  const hrZonesData = useMemo(() => [
    { name: "Z1 Recovery (<120)", value: 22, color: "#34c759", text: "Active Recovery" },
    { name: "Z2 Endurance (120-145)", value: 48, color: "#0071e3", text: "Aerobic Base & Fat Oxidation" },
    { name: "Z3 Tempo (146-160)", value: 18, color: "#ff9500", text: "Aerobic Threshold" },
    { name: "Z4 Threshold (161-172)", value: 8, color: "#ff3b30", text: "Lactate Threshold" },
    { name: "Z5 VO2Max (>173)", value: 4, color: "#af52de", text: "Anaerobic Capacity" }
  ], []);

  // Power zones data
  const powerZonesData = useMemo(() => {
    const ftp = userParams?.ftp || 250;
    return [
      { zone: "Z1 Active Recovery", label: `<${Math.round(ftp * 0.55)}W`, percent: 18, color: "#5ea6ff" },
      { zone: "Z2 Endurance", label: `${Math.round(ftp * 0.56)}-${Math.round(ftp * 0.75)}W`, percent: 45, color: "#34c759" },
      { zone: "Z3 Tempo", label: `${Math.round(ftp * 0.76)}-${Math.round(ftp * 0.90)}W`, percent: 20, color: "#ff9500" },
      { zone: "Z4 Threshold", label: `${Math.round(ftp * 0.91)}-${Math.round(ftp * 1.05)}W`, percent: 10, color: "#ff3b30" },
      { zone: "Z5 VO2Max", label: `${Math.round(ftp * 1.06)}-${Math.round(ftp * 1.20)}W`, percent: 5, color: "#af52de" },
      { zone: "Z6 Anaerobic Capacity", label: `>${Math.round(ftp * 1.20)}W`, percent: 2, color: "#ff2d55" },
    ];
  }, [userParams?.ftp]);

  // Elevation data
  const elevationData = useMemo(() => {
    if (weeklyLoad && weeklyLoad.length > 0) {
      let cumulative = 0;
      return weeklyLoad.map((w, idx) => {
        const gain = Math.round((w.distance || 40) * (12 + (idx % 5) * 4));
        cumulative += gain;
        return { week: w.week_label || `Wk ${idx + 1}`, elevation: gain, cumulative, distance: w.distance || 0 };
      });
    }
    return [
      { week: "Wk 1", elevation: 420, cumulative: 420, distance: 85 },
      { week: "Wk 2", elevation: 680, cumulative: 1100, distance: 120 },
      { week: "Wk 3", elevation: 850, cumulative: 1950, distance: 145 },
      { week: "Wk 4", elevation: 510, cumulative: 2460, distance: 95 },
      { week: "Wk 5", elevation: 920, cumulative: 3380, distance: 160 },
      { week: "Wk 6", elevation: 1150, cumulative: 4530, distance: 190 }
    ];
  }, [weeklyLoad]);

  const activeOption = chartOptions.find(o => o.id === activeChartKey) || chartOptions[0];

  return (
    <div className="bg-[#f5f5f7] rounded-[24px] sm:rounded-[36px] p-2.5 sm:p-6 md:p-10 space-y-4 sm:space-y-8 text-slate-900">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 sm:gap-4 border-b border-slate-200/60 pb-3 sm:pb-6">
        <div>
          <span className="text-[10px] sm:text-[11px] font-black text-[#86868b] uppercase tracking-widest flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0071e3]" /> Interactive Analytics Engine
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-0.5">
            Performance Charts Explorer
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] sm:text-xs bg-white text-slate-900 font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" /> Interactive Switcher
          </span>
        </div>
      </div>

      {/* APPLE ACCORDION + DEVICE SHOWCASE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
        
        {/* LEFT COLUMN: Accordion Selector Menu (5 / 12 cols on desktop) */}
        <div className="lg:col-span-5 space-y-2 sm:space-y-3">
          {chartOptions.map((opt) => {
            const isSelected = opt.id === activeChartKey;
            return (
              <div 
                key={opt.id}
                onClick={() => setActiveChartKey(opt.id)}
                className={`rounded-[18px] sm:rounded-[24px] transition-all duration-300 cursor-pointer overflow-hidden ${
                  isSelected 
                    ? "bg-black text-white p-3.5 sm:p-5" 
                    : "bg-white hover:bg-[#ececec] text-slate-900 p-3 sm:p-4"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 transition-transform duration-300"
                      style={{ backgroundColor: opt.color, transform: isSelected ? "scale(1.2)" : "scale(1)" }} 
                    />
                    <h3 className={`text-sm sm:text-base tracking-tight font-black ${isSelected ? "text-white" : "text-slate-900"}`}>
                      {opt.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? "bg-slate-800 text-slate-200" : "bg-[#f5f5f7] text-slate-600"}`}>
                      {opt.badge}
                    </span>
                    {isSelected ? (
                      <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Expanded text inside accordion item */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="pt-2.5 border-t border-slate-800 mt-2.5 space-y-2.5"
                    >
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">
                        {opt.description}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-blue-400 hover:underline"
                      >
                        <span>Open Fullscreen View</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: Device Showcase Panel (7 / 12 cols on desktop) */}
        <div className="lg:col-span-7 bg-white rounded-[24px] sm:rounded-[32px] p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 relative overflow-hidden flex flex-col justify-between min-h-[380px] sm:min-h-[520px]">
          
          {/* Showcase Top Bar */}
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeOption.color }} />
              <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                {activeOption.title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullscreenModal(true)}
                className="p-1.5 sm:p-2 rounded-full bg-[#f5f5f7] hover:bg-[#0071e3] text-slate-600 hover:text-white transition cursor-pointer"
                title="Maximize"
              >
                <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Floating Apple Pill Badges */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-extrabold">
            <span className="bg-[#f5f5f7] px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-slate-800 flex items-center gap-1">
              <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" /> HR: {userParams?.lthr || 165} bpm
            </span>
            <span className="bg-[#f5f5f7] px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-slate-800 flex items-center gap-1">
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" /> FTP: {userParams?.ftp || 250} W
            </span>
            <span className="bg-[#f5f5f7] px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-slate-800 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" /> CTL: {userParams?.ctl || 48}
            </span>
          </div>

          {/* Dynamic Interactive Diagram Renderer */}
          <div className="h-[280px] sm:h-[340px] w-full pt-1">
            
            {/* CHART TYPE 1: WEEKLY */}
            {activeChartKey === "weekly" && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyLoad} margin={{ top: 10, right: 0, left: -32, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis dataKey="week_label" stroke="#86868b" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#0071e3" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="#34c759" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "1rem", borderColor: "#cbd5e1", fontSize: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar yAxisId="left" dataKey="distance" name="Matka (km)" fill="#0071e3" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="tss" name="TSS Kuorma" stroke="#34c759" strokeWidth={3} dot={{ r: 4 }} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* CHART TYPE 2: HR ZONES */}
            {activeChartKey === "hr_zones" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center h-full">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={hrZonesData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                        {hrZonesData.map((entry, idx) => (
                          <Cell key={`hr-pie-${idx}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "1rem", borderColor: "#cbd5e1", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {hrZonesData.map(z => (
                    <div key={z.name} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color }} />
                        <span>{z.name}</span>
                      </div>
                      <span className="font-black text-slate-900">{z.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CHART TYPE 3: ELEVATION */}
            {activeChartKey === "elevation" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={elevationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="elevGradDev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff9500" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ff9500" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis dataKey="week" stroke="#86868b" fontSize={11} />
                  <YAxis stroke="#ff9500" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "1rem", borderColor: "#cbd5e1", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="elevation" name="Viikon nousu (m)" stroke="#ff9500" fill="url(#elevGradDev)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* CHART TYPE 4: POWER ZONES */}
            {activeChartKey === "power_zones" && (
              <div className="space-y-3 justify-center flex flex-col h-full">
                {powerZonesData.map(z => (
                  <div key={z.zone} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-800">{z.zone} <span className="text-slate-400 font-normal">({z.label})</span></span>
                      <span className="text-slate-900 font-black">{z.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${z.percent * 2.2}%`, backgroundColor: z.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CHART TYPE 5: PMC */}
            {activeChartKey === "pmc" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pmcData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ctlGradDev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34c759" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#34c759" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#86868b" fontSize={11} />
                  <YAxis stroke="#86868b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "1rem", borderColor: "#cbd5e1", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area type="monotone" dataKey="ctl" stroke="#34c759" fill="url(#ctlGradDev)" strokeWidth={3} name="CTL (Kunto)" />
                  <Line type="monotone" dataKey="atl" stroke="#ff3b30" strokeWidth={2} dot={false} name="ATL (Väsymys)" />
                  <Line type="monotone" dataKey="tsb" stroke="#0071e3" strokeWidth={2.5} dot={false} name="TSB (Muoto)" />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* CHART TYPE 6: SCATTER */}
            {activeChartKey === "scatter" && (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="np" name="Normitettu Teho (NP)" unit="W" stroke="#86868b" fontSize={11} />
                  <YAxis type="number" dataKey="avg_hr" name="Keskisyke" unit="bpm" stroke="#86868b" fontSize={11} domain={["dataMin-5", "dataMax+5"]} />
                  <ZAxis type="number" dataKey="tss" range={[30, 200]} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "1rem", borderColor: "#cbd5e1", fontSize: "12px" }} />
                  <Scatter name="Harjoitukset" data={scatterData}>
                    {scatterData.map((entry, idx) => (
                      <Cell key={`sc-dev-${idx}`} fill={entry.ef >= 1.15 ? "#34c759" : entry.ef >= 1.05 ? "#0071e3" : "#ff9500"} opacity={0.85} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}

          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 font-bold border-t border-slate-100 pt-3">
            <span>Valittu kaavio: {activeOption.title}</span>
            <span className="text-[#0071e3] cursor-pointer hover:underline" onClick={() => setFullscreenModal(true)}>Avaa koko näytölle →</span>
          </div>
        </div>

      </div>

      {/* FULLSCREEN EXPANDED MODAL */}
      <AnimatePresence>
        {fullscreenModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 md:p-8 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-[32px] max-w-5xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative text-slate-900"
            >
              <button
                onClick={() => setFullscreenModal(false)}
                className="absolute top-6 right-6 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2">
                <span className="text-xs font-black text-[#0071e3] uppercase tracking-wider">Koko Näytön Kaavio</span>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{activeOption.title}</h3>
                <p className="text-xs text-slate-500 font-medium">{activeOption.description}</p>
              </div>

              <div className="h-[450px] w-full pt-4">
                {activeChartKey === "weekly" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyLoad} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="week_label" stroke="#64748b" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#0071e3" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="#34c759" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "1rem", borderColor: "#cbd5e1", fontSize: "12px" }} />
                      <Bar yAxisId="left" dataKey="distance" name="Matka (km)" fill="#0071e3" radius={[6, 6, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="tss" name="TSS Kuorma" stroke="#34c759" strokeWidth={3} dot={{ r: 4 }} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {activeChartKey === "pmc" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pmcData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "1rem", borderColor: "#cbd5e1", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="ctl" stroke="#34c759" fill="#34c759" fillOpacity={0.2} strokeWidth={3} name="CTL (Kunto)" />
                      <Line type="monotone" dataKey="atl" stroke="#ff3b30" strokeWidth={2} name="ATL (Väsymys)" />
                      <Line type="monotone" dataKey="tsb" stroke="#0071e3" strokeWidth={2.5} name="TSB (Muoto)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
