"use client";

import React from "react";
import { Sliders, Save, Zap, Heart, Shield, Award, Calendar, Cpu, Sparkles, AlertCircle, FileText } from "lucide-react";

interface SettingsTabProps {
  userParams: any;
  setUserParams: (params: any) => void;
  userGoal: any;
  setUserGoal: (goal: any) => void;
  coachingDirectivesMd?: string;
  setCoachingDirectivesMd?: (md: string) => void;
  onSaveSettings: (e: React.FormEvent) => void;
  onEstimateCp: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  userParams,
  setUserParams,
  userGoal,
  setUserGoal,
  coachingDirectivesMd,
  setCoachingDirectivesMd,
  onSaveSettings,
  onEstimateCp
}) => {
  // Safe fallbacks to prevent empty/null rendering
  const params = userParams || {
    ftp: 250,
    cp: 250,
    w_prime: 20000,
    lthr: 165,
    max_hr: 190,
    resting_hr: 50,
    weight_kg: 70,
    bike_weight_kg: 8.5,
    language: "fi",
    llm_provider: "ollama",
    llm_model: "llama3:8b",
    ollama_url: "http://localhost:11434"
  };

  const goal = userGoal || {
    goal_description: "Gravel SM 150km / Tahko MTB 120km",
    target_date: "2026-09-20",
    race_distance_km: 150,
    elevation_gain_m: 1200,
    surface_type: "Gravel",
    weekly_capacity_hours: 10,
    intensity_distribution: "Pyramidal",
    limitations: "Ei erityisiä rajoitteita",
    custom_prompt: ""
  };

  return (
    <form onSubmit={onSaveSettings} className="space-y-8 w-full max-w-7xl mx-auto text-slate-900">
      {/* 1. Physiological & Bike Parameters Card */}
      <div className="p-6 md:p-8 rounded-[32px] bg-white space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-600" />
            <span>Physiological & Bike Parameters</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Define your physiological thresholds for athletic science calculations and W' balance energy modeling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">FTP (Threshold Power W)</label>
            <input 
              type="number" 
              value={params.ftp ?? 250} 
              onChange={(e) => setUserParams({ ...params, ftp: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">CP (Critical Power W)</label>
              <button
                type="button"
                onClick={onEstimateCp}
                className="text-[9px] text-[#0071e3] hover:underline font-bold cursor-pointer"
              >
                Auto-calculate
              </button>
            </div>
            <input 
              type="number" 
              value={params.cp ?? params.ftp ?? 250} 
              onChange={(e) => setUserParams({ ...params, cp: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">W' (Anaerobic Reserve Joules)</label>
            <input 
              type="number" 
              step="500"
              value={params.w_prime ?? 20000} 
              onChange={(e) => setUserParams({ ...params, w_prime: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">LTHR (Threshold HR bpm)</label>
            <input 
              type="number" 
              value={params.lthr ?? 165} 
              onChange={(e) => setUserParams({ ...params, lthr: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Max Heart Rate (Max HR bpm)</label>
            <input 
              type="number" 
              value={params.max_hr ?? 190} 
              onChange={(e) => setUserParams({ ...params, max_hr: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Resting Heart Rate (Resting HR bpm)</label>
            <input 
              type="number" 
              value={params.resting_hr ?? 50} 
              onChange={(e) => setUserParams({ ...params, resting_hr: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Rider Weight (kg)</label>
            <input 
              type="number" 
              step="0.1" 
              value={params.weight_kg ?? 70} 
              onChange={(e) => setUserParams({ ...params, weight_kg: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Bike Weight (kg)</label>
            <input 
              type="number" 
              step="0.1" 
              value={params.bike_weight_kg ?? 8.5} 
              onChange={(e) => setUserParams({ ...params, bike_weight_kg: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Gender / Sukupuoli (TRIMP & Physiology)</label>
            <select 
              value={params.gender || "unspecified"} 
              onChange={(e) => setUserParams({ ...params, gender: e.target.value })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition cursor-pointer"
            >
              <option value="unspecified">Muu / Ei määritelty</option>
              <option value="male">Mies (Male)</option>
              <option value="female">Nainen (Female)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Application Language</label>
            <select 
              value={params.language || "en"} 
              onChange={(e) => setUserParams({ ...params, language: e.target.value })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition cursor-pointer"
            >
              <option value="en">English</option>
              <option value="fi">Suomi</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Detailed Goal & Athlete Questionnaire for AI Coach */}
      <div className="p-6 md:p-8 rounded-[32px] bg-white space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Race Target & AI Coach Questionnaire</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Define your main target event, date, and weekly capacity limits for AI Coach training recommendation algorithms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>🎯 Main Race Target Description</span>
            </label>
            <input 
              type="text" 
              value={goal.goal_description || ""} 
              onChange={(e) => setUserGoal({ ...goal, goal_description: e.target.value })}
              placeholder="e.g. Gravel National Championship 150km, Unbound Gravel, Maratona dles Dolomites"
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>Target Event Date (YYYY-MM-DD)</span>
            </label>
            <input 
              type="text" 
              value={goal.target_date || ""} 
              onChange={(e) => setUserGoal({ ...goal, target_date: e.target.value })}
              placeholder="2026-09-20"
              className="w-full bg-[#f5f5f7] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Race Distance (km)</label>
            <input 
              type="number" 
              value={goal.race_distance_km || ""} 
              onChange={(e) => setUserGoal({ ...goal, race_distance_km: parseFloat(e.target.value) || 0 })}
              placeholder="150"
              className="w-full bg-[#f5f5f7] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Target Elevation Gain (m)</label>
            <input 
              type="number" 
              value={goal.elevation_gain_m || ""} 
              onChange={(e) => setUserGoal({ ...goal, elevation_gain_m: parseFloat(e.target.value) || 0 })}
              placeholder="1200"
              className="w-full bg-[#f5f5f7] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Discipline / Surface</label>
            <select
              value={goal.surface_type || "Gravel"}
              onChange={(e) => setUserGoal({ ...goal, surface_type: e.target.value })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition cursor-pointer"
            >
              <option value="Gravel">Gravel</option>
              <option value="Road">Road</option>
              <option value="MTB">Mountain Bike (MTB)</option>
              <option value="Track">Track / Criterium</option>
              <option value="Indoor">Indoor / Zwift</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Weekly Training Capacity (h/week)</label>
            <input 
              type="number" 
              step="0.5"
              value={goal.weekly_capacity_hours || 10} 
              onChange={(e) => setUserGoal({ ...goal, weekly_capacity_hours: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Training Model</label>
            <select
              value={goal.intensity_distribution || "Pyramidal"}
              onChange={(e) => setUserGoal({ ...goal, intensity_distribution: e.target.value })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition cursor-pointer"
            >
              <option value="Polarized 80/20">Polarized 80/20 (Seiler)</option>
              <option value="Pyramidal">Pyramidal</option>
              <option value="Sweetspot">Sweet Spot Base</option>
              <option value="Threshold">Threshold</option>
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-[#0071e3] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Limitations & Injury Notes for AI Coach</span>
            </label>
            <textarea 
              rows={2}
              value={goal.limitations || ""} 
              onChange={(e) => setUserGoal({ ...goal, limitations: e.target.value })}
              placeholder="e.g. Previous knee strain, bike commute 30min/day, busy Tuesdays, long weekend rides."
              className="w-full bg-[#f5f5f7] rounded-2xl p-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition resize-none"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-[#0071e3] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>LLM Custom Background Prompt & History</span>
            </label>
            <textarea 
              rows={3}
              value={goal.custom_prompt || ""} 
              onChange={(e) => setUserGoal({ ...goal, custom_prompt: e.target.value })}
              placeholder="e.g. 'I previously completed a 12-week Sweet Spot block. Goal is FTP 250W -> 275W...'"
              className="w-full bg-[#f5f5f7] rounded-2xl p-3 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition resize-none"
            />
          </div>
        </div>
      </div>

      {/* 2.5. AI Coach Directives & Athlete Context Card (coaching_directives.md) */}
      <div className="p-6 md:p-8 rounded-[32px] bg-white space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <span>AI Coach Directives & Athlete Context</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Tämä Markdown-ohjeistus syötetään automaattisesti tekoälyvalmentajan taustatiedoksi kaikkien harjoitusohjelmien ja -analyysien pohjalle. Voit muokata urheilijaprofiiliasi, arjen reunaehtoja ja syketavoitteitasi vapaasti!
            </p>
          </div>
          <span className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-full text-xs border border-indigo-100 flex items-center gap-1.5 shrink-0">
            <FileText className="w-3.5 h-3.5" />
            coaching_directives.md
          </span>
        </div>

        <div className="space-y-2">
          <textarea
            rows={12}
            value={coachingDirectivesMd || ""}
            onChange={(e) => setCoachingDirectivesMd && setCoachingDirectivesMd(e.target.value)}
            placeholder="Kirjoita tähän urheilijaprofiilisi, taustasi, arjen reunaehdot ja fysiologiset tavoitteesi Markdown-muodossa..."
            className="w-full bg-[#f5f5f7] border border-slate-200/80 rounded-2xl p-4 text-xs font-mono text-slate-900 leading-relaxed focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition resize-y min-h-[240px]"
          />
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span className="font-bold text-indigo-600">💡 Vinkki:</span>
            <span>Muotoilut kuten <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">### Otsikot</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">* Listat</code> ja <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">**Lihavoinnit**</code> ovat tuettuja.</span>
          </div>
        </div>
      </div>

      {/* 3. LLM AI Provider Configuration */}
      <div className="p-6 md:p-8 rounded-[32px] bg-white space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-600" />
            <span>AI Model (LLM) Settings</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Choose between local computer Ollama models or cloud AI provider endpoints.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">LLM Provider</label>
            <select
              value={params.llm_provider || "ollama"}
              onChange={(e) => {
                const prov = e.target.value;
                let defaultModel = params.llm_model;
                if (prov === "gemini") defaultModel = "gemini-2.0-flash";
                else if (prov === "openai") defaultModel = "gpt-4o-mini";
                else if (prov === "anthropic") defaultModel = "claude-3-5-sonnet-20241022";
                else if (prov === "deepseek") defaultModel = "deepseek-chat";
                else if (prov === "openrouter") defaultModel = "deepseek/deepseek-r1";
                else if (prov === "ollama") defaultModel = "llama3.1";

                setUserParams({
                  ...params,
                  llm_provider: prov,
                  llm_model: defaultModel
                });
              }}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition cursor-pointer"
            >
              <option value="gemini">✨ Google Gemini (Gemini 2.0 / 1.5 Flash & Pro)</option>
              <option value="openai">⚡ OpenAI (ChatGPT GPT-4o / GPT-4o-mini)</option>
              <option value="anthropic">🧠 Anthropic (Claude 3.5 Sonnet / Haiku)</option>
              <option value="deepseek">🚀 DeepSeek AI (DeepSeek-V3 / R1)</option>
              <option value="openrouter">🌐 OpenRouter (Cloud Models)</option>
              <option value="ollama">💻 Ollama (Local Computer)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Model Identifier</label>
            <input 
              type="text" 
              value={params.llm_model || "gemini-2.0-flash"} 
              onChange={(e) => setUserParams({ ...params, llm_model: e.target.value })}
              placeholder="gemini-2.0-flash, gpt-4o, claude-3-5-sonnet-20241022, llama3.1"
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
            />
          </div>

          {params.llm_provider === "ollama" ? (
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-600">Ollama Server Endpoint</label>
              <input 
                type="text" 
                value={params.ollama_url || "http://localhost:11434"} 
                onChange={(e) => setUserParams({ ...params, ollama_url: e.target.value })}
                className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
              />
            </div>
          ) : (
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-600">API Key / Token</label>
                <span className="text-[10px] font-bold text-slate-400">
                  {params.llm_provider === "gemini" && "Syötä Google AI Studio API-avain (AIzaSy...)"}
                  {params.llm_provider === "openai" && "Syötä OpenAI API-avain (sk-...)"}
                  {params.llm_provider === "anthropic" && "Syötä Anthropic API-avain (sk-ant-...)"}
                  {params.llm_provider === "deepseek" && "Syötä DeepSeek API-avain (sk-...)"}
                  {params.llm_provider === "openrouter" && "Syötä OpenRouter API-avain (sk-or-...)"}
                </span>
              </div>
              <input 
                type="password" 
                value={params.llm_api_key || ""} 
                onChange={(e) => setUserParams({ ...params, llm_api_key: e.target.value })}
                placeholder={
                  params.llm_provider === "gemini" ? "AIzaSy..." :
                  params.llm_provider === "openai" ? "sk-..." :
                  params.llm_provider === "anthropic" ? "sk-ant-..." :
                  params.llm_provider === "openrouter" ? "sk-or-v1-..." : "API Key / Token..."
                }
                className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Data Sync Mode & Remote Server Endpoint Configuration */}
      <div className="p-6 md:p-8 rounded-[32px] bg-white space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0071e3]" />
            <span>Data Sync & Server Endpoint Architecture</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Configure how your workouts and training data are synced: local SQLite, custom remote server, or Strava Cloud API.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-600">Active Sync Engine Mode</label>
            <select
              value={params.sync_mode || "local"}
              onChange={(e) => setUserParams({ ...params, sync_mode: e.target.value })}
              className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition cursor-pointer"
            >
              <option value="local">💻 Local Only (Standalone SQLite - 100% Private & Free)</option>
              <option value="remote_endpoint">🌐 Custom Remote Server (e.g. cycling-sync.oivauix.org / Self-Hosted SaaS)</option>
              <option value="strava">🧡 Strava Cloud API (Pro Auto-Sync)</option>
            </select>
          </div>

          {params.sync_mode === "remote_endpoint" && (
            <>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-600">Remote Sync Server Endpoint URL</label>
                <input 
                  type="text" 
                  value={params.remote_server_url || "https://cycling-sync.oivauix.org"} 
                  onChange={(e) => setUserParams({ ...params, remote_server_url: e.target.value })}
                  placeholder="https://cycling-sync.oivauix.org"
                  className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-600">Server Authentication X-API-Key</label>
                <input 
                  type="password" 
                  value={params.remote_api_key || "my_very_secure_secret_token_12345"} 
                  onChange={(e) => setUserParams({ ...params, remote_api_key: e.target.value })}
                  placeholder="my_very_secure_secret_token_12345"
                  className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
                />
              </div>
            </>
          )}

          {params.sync_mode === "strava" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Strava API Client ID</label>
                <input 
                  type="text" 
                  value={params.strava_client_id || ""} 
                  onChange={(e) => setUserParams({ ...params, strava_client_id: e.target.value })}
                  placeholder="e.g. 123456"
                  className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Strava Client Secret</label>
                <input 
                  type="password" 
                  value={params.strava_client_secret || ""} 
                  onChange={(e) => setUserParams({ ...params, strava_client_secret: e.target.value })}
                  placeholder="Strava App Client Secret..."
                  className="w-full bg-[#f5f5f7] rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="px-8 py-3.5 bg-[#0071e3] hover:bg-blue-600 text-white font-extrabold rounded-full text-xs transition flex items-center gap-2 cursor-pointer shadow-md"
        >
          <Save className="w-4 h-4" />
          <span>Save Settings & Thresholds</span>
        </button>
      </div>
    </form>
  );
};
