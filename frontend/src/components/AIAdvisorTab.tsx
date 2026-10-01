"use client";

import React, { useRef, useEffect } from "react";
import { Sparkles, RefreshCw, Send, Trash2, Activity, Zap, TrendingUp, Compass, Award } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIAdvisorTabProps {
  chatMessages: Message[];
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  onSendMessage: (msgOverride?: string) => void;
  onClearChat?: () => void;
  loadingChat: boolean;
  userParams: any;
}

const renderFormattedText = (text: string, isDark?: boolean) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className={`font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

export const FormattedMarkdown: React.FC<{ content: string; isUser?: boolean; isDark?: boolean }> = ({ content, isUser, isDark }) => {
  if (isUser) {
    return <p className="whitespace-pre-line font-semibold leading-relaxed text-xs sm:text-sm">{content}</p>;
  }

  const textColor = isDark ? "text-slate-200" : "text-slate-800";
  const headingColor = isDark ? "text-white" : "text-slate-900";
  const bulletColor = isDark ? "text-emerald-400" : "text-[#0071e3]";
  const hrColor = isDark ? "border-slate-800" : "border-slate-200/80";

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`empty-${index}`} className="h-1.5" />);
      return;
    }

    if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={`hr-${index}`} className={`my-3 ${hrColor}`} />);
      return;
    }

    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h5 key={`h4-${index}`} className={`text-xs sm:text-sm font-black ${headingColor} mt-2.5 mb-1 tracking-tight`}>
          {renderFormattedText(trimmed.replace(/^####\s+/, ""), isDark)}
        </h5>
      );
      return;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={`h3-${index}`} className={`text-sm sm:text-base font-black ${headingColor} mt-3 mb-1.5 tracking-tight`}>
          {renderFormattedText(trimmed.replace(/^###\s+/, ""), isDark)}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={`h2-${index}`} className={`text-base sm:text-lg font-black ${headingColor} mt-4 mb-2 tracking-tight`}>
          {renderFormattedText(trimmed.replace(/^##\s+/, ""), isDark)}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={`h1-${index}`} className={`text-lg sm:text-xl font-black ${headingColor} mt-4 mb-2 tracking-tight`}>
          {renderFormattedText(trimmed.replace(/^#\s+/, ""), isDark)}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const bulletText = trimmed.replace(/^[*|-]\s+/, "");
      elements.push(
        <div key={`bullet-${index}`} className={`flex items-start gap-2.5 my-1.5 ${textColor} leading-relaxed text-xs sm:text-sm font-medium`}>
          <span className={`${bulletColor} font-black text-xs sm:text-sm mt-0.5`}>•</span>
          <div className="flex-1">{renderFormattedText(bulletText, isDark)}</div>
        </div>
      );
      return;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      elements.push(
        <div key={`num-${index}`} className={`flex items-start gap-2.5 my-2 ${textColor} leading-relaxed font-medium text-xs sm:text-sm`}>
          <span className={`${isDark ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/50" : "bg-blue-100 text-[#0071e3]"} text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full shrink-0 mt-0.5`}>
            {numberedMatch[1]}
          </span>
          <div className="flex-1">{renderFormattedText(numberedMatch[2], isDark)}</div>
        </div>
      );
      return;
    }

    elements.push(
      <p key={`p-${index}`} className={`${textColor} font-medium leading-relaxed my-1 text-xs sm:text-sm`}>
        {renderFormattedText(line, isDark)}
      </p>
    );
  });

  return <div className="space-y-1">{elements}</div>;
};

const parseWorkoutKeyMetrics = (text: string) => {
  if (!text) return null;
  const kestoMatch = text.match(/Kesto\s*&?\s*matka:\s*([^|\n]+)(?:\|\s*([^|\n]+))?/i);
  const npMatch = text.match(/Normalisoitu teho\s*\(NP\):\s*([^|\n]+)/i) || text.match(/NP:\s*([^|\n]+)/i);
  const avgPwrMatch = text.match(/Keskiteho:\s*([^|\n]+)/i);
  const tssMatch = text.match(/Rasitus\s*\(TSS\):\s*([^|\n]+)/i) || text.match(/TSS:\s*([^|\n]+)/i);
  const ifMatch = text.match(/Intensiteetti\s*\(IF\):\s*([^|\n]+)/i);
  const hrMatch = text.match(/Syke:\s*([^|\n]+)(?:\|\s*([^|\n]+))?/i) || text.match(/Keskisyke:\s*([^|\n]+)/i);

  if (!kestoMatch && !npMatch && !tssMatch) return null;

  return {
    duration: kestoMatch ? kestoMatch[1].trim() : "45 min",
    distance: kestoMatch && kestoMatch[2] ? kestoMatch[2].trim() : "17.8 km",
    np: npMatch ? npMatch[1].trim() : "170 W",
    avgPower: avgPwrMatch ? avgPwrMatch[1].trim() : "165 W",
    tss: tssMatch ? tssMatch[1].trim() : "59.1",
    ifFactor: ifMatch ? ifMatch[1].trim() : "0.88",
    avgHr: hrMatch ? hrMatch[1].trim() : "146 bpm",
    maxHr: hrMatch && hrMatch[2] ? hrMatch[2].trim() : "161 bpm"
  };
};

export const AICoachBentoGrid: React.FC<{
  content: string;
  onOpenChat: () => void;
  onAnalyzeLatest: () => void;
}> = ({ content, onOpenChat, onAnalyzeLatest }) => {
  const rawSections = content.split(/(?=###\s+)/g).filter(s => s.trim().length > 0);

  const parseSec = (secStr: string, fallbackTitle: string) => {
    const match = secStr.match(/^###\s+(.*)/);
    if (match) {
      return {
        title: match[1].trim(),
        body: secStr.replace(/^###\s+.*\n?/, "").trim()
      };
    }
    return { title: fallbackTitle, body: secStr.trim() };
  };

  const sec1 = rawSections[0] ? parseSec(rawSections[0], "1. Viimeisimmän Harjoituksen Analyysi") : null;
  const sec2 = rawSections[1] ? parseSec(rawSections[1], "2. Vaikutus Kuntoosi & Kuormitustilaan (PMC)") : null;
  const sec3 = rawSections[2] ? parseSec(rawSections[2], "3. Valmentajan Suositus & Jatkosuunnitelma") : null;

  const keyStats = parseWorkoutKeyMetrics(content);

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Section Title Header (Borderless Apple Style - Styled like Training Metrics & Overview) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-[11px] font-black text-[#86868b] uppercase tracking-widest">
            Athletic Intelligence & Coaching
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
            AI Coach — Intelligence & Overview
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] sm:text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200/60">
            ⚡ 0 Tokens (Muistissa)
          </span>
          <button
            onClick={onOpenChat}
            className="w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 bg-black hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-full transition flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Avaa Keskustelu Valmentajan Kanssa</span>
          </button>
        </div>
      </div>

      {/* MASTER SEAMLESS BENTO GRID (Styled matching Training Metrics & Overview) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6">

        {/* HERO CARD 1: LATEST WORKOUT ANALYSIS (Pure White Hero Card - Spans 12 Cols) */}
        {sec1 && (
          <div className="col-span-1 md:col-span-12 lg:col-span-12 bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 md:p-8 flex flex-col justify-between space-y-4 sm:space-y-6 shadow-sm border border-slate-100">
            <div className="space-y-1.5">
              <span className="text-[10px] sm:text-[11px] font-black text-[#0071e3] uppercase tracking-widest">
                Latest Workout Telemetry
              </span>
              <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {sec1.title}
              </h3>
            </div>

            {/* 4 Stat Boxes - Matching Current Week Volume & Activity Grid in Training Metrics */}
            {keyStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 text-center">
                <div className="bg-[#f5f5f7] p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 border border-slate-100/80">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kesto & Matka</p>
                  <p className="text-lg sm:text-2xl font-black text-slate-900">{keyStats.duration}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold">{keyStats.distance}</p>
                </div>

                <div className="bg-[#f5f5f7] p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 border border-slate-100/80">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Normalisoitu Teho (NP)</p>
                  <p className="text-lg sm:text-2xl font-black text-[#0071e3]">{keyStats.np}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold">Keskiteho: {keyStats.avgPower}</p>
                </div>

                <div className="bg-[#f5f5f7] p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 border border-slate-100/80">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rasitus (TSS)</p>
                  <p className="text-lg sm:text-2xl font-black text-amber-600">{keyStats.tss}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold">IF: {keyStats.ifFactor}</p>
                </div>

                <div className="bg-[#f5f5f7] p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-1 border border-slate-100/80">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sykearvo</p>
                  <p className="text-lg sm:text-2xl font-black text-rose-600">{keyStats.avgHr}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold">Maksimi: {keyStats.maxHr}</p>
                </div>
              </div>
            )}

            {/* Markdown Text Area */}
            <div className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed sm:max-h-80 sm:overflow-y-auto pr-1 custom-scrollbar">
              <FormattedMarkdown content={sec1.body} isUser={false} />
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#f5f5f7] text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed">
              <strong className="text-[#0071e3] font-black">Inline Note:</strong> Yksityiskohtainen urheilutieteellinen analyysi ja avainluvut sekunti-sekunnilta kerätystä harjoitusdatasta.
            </div>
          </div>
        )}

        {/* CARD 2: PHYSIOLOGICAL INTERPRETATION (Pure White Card) */}
        {sec2 && (
          <div className="col-span-1 md:col-span-6 lg:col-span-6 bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 md:p-8 flex flex-col justify-between space-y-4 shadow-sm border border-slate-100 relative">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-[11px] font-black text-[#0071e3] uppercase tracking-widest">
                  Acute Physiological Load
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0071e3] bg-blue-50 px-2.5 py-0.5 rounded-full shrink-0">
                  Fysiologia
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {sec2.title}
              </h3>
            </div>

            <div className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed sm:max-h-80 sm:overflow-y-auto pr-1 custom-scrollbar">
              <FormattedMarkdown content={sec2.body} isUser={false} isDark={false} />
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] sm:text-xs text-slate-500 font-medium">
              <strong className="text-slate-900 font-black">Inline Note:</strong> Rasitus- ja syke-tehosuhteen arviointi suhteessa kynnyksiisi (FTP / LTHR).
            </div>
          </div>
        )}

        {/* CARD 3: COACHING RECOMMENDATIONS (Pure Black Obsidian Card - High Contrast Accent) */}
        {sec3 && (
          <div className="col-span-1 md:col-span-6 lg:col-span-6 bg-black text-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 md:p-8 flex flex-col justify-between space-y-4 shadow-2xl relative">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-[11px] font-black text-amber-400 uppercase tracking-widest">
                  Actionable Recommendations
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-950/90 border border-amber-800/80 px-2.5 py-0.5 rounded-full shrink-0">
                  Suositukset
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {sec3.title}
              </h3>
            </div>

            <div className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed sm:max-h-80 sm:overflow-y-auto pr-1 custom-scrollbar">
              <FormattedMarkdown content={sec3.body} isUser={false} isDark={true} />
            </div>

            <div className="pt-3 border-t border-slate-900 text-[11px] sm:text-xs text-slate-300 font-medium">
              <strong className="text-white font-black">Inline Note:</strong> Tekoälyvalmentajan suositukset palautumiseen ja tuleviin harjoituksiin.
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export const AIAdvisorTab: React.FC<AIAdvisorTabProps> = ({
  chatMessages,
  inputMessage,
  setInputMessage,
  onSendMessage,
  onClearChat,
  loadingChat,
  userParams
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, loadingChat]);

  const isFi = userParams?.language === "fi";

  return (
    <div className="space-y-6">
      {/* Section Title Header (Borderless Apple Style - Styled like Training Metrics & Overview) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-[11px] font-black text-[#86868b] uppercase tracking-widest">
            Athletic Intelligence & Coaching
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-0.5">
            AI Coach — Interactive Advisor
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
        {/* Quick Info & Prompts Sidebar */}
        <div className="lg:col-span-1">
          <div className="p-6 rounded-[32px] bg-white flex flex-col justify-between border border-slate-100/60 shadow-sm space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-[#0071e3]">
                <Sparkles className="h-4 w-4" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  {isFi ? "Pikakyselyt" : "Quick Prompts"}
                </h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                {isFi 
                  ? "Tekoälyvalmentajalla on pääsy reaaliaikaisiin FTP-, TSS-, CP/W'- ja CTL/ATL/TSB -kuntotietoihisi."
                  : "AI Coach has real-time access to your FTP, workouts, and CTL/ATL/TSB load curves."}
              </p>
              
              <div className="flex flex-col space-y-2 pt-1">
                <button 
                  onClick={() => onSendMessage(isFi ? "Analysoi viimeisin harjoitukseni ja selitä sen vaikutus kuntooni." : "Analyze my latest workout and explain its impact on my fitness.")}
                  className="text-left p-3.5 rounded-2xl bg-[#f5f5f7] hover:bg-[#eaeaec] text-xs text-slate-800 font-semibold transition cursor-pointer"
                >
                  🔍 {isFi ? "Analysoi viimeisin lenkki" : "Analyze latest workout"}
                </button>
                <button 
                  onClick={() => onSendMessage(isFi ? "Olenko ylirasittunut? Mikä on nykyinen TSB (Form) -tasoni?" : "Am I overtraining? What is my training stress balance (TSB)?")}
                  className="text-left p-3.5 rounded-2xl bg-[#f5f5f7] hover:bg-[#eaeaec] text-xs text-slate-800 font-semibold transition cursor-pointer"
                >
                  ⚠️ {isFi ? "Tarkista ylirasitus / TSB" : "Check overtraining / fatigue"}
                </button>
                <button 
                  onClick={() => onSendMessage(isFi ? "Laske minulle tarkat tehoalueet (Power Zones) FTP:ni perusteella." : "Show my FTP zones and calculate my power zone boundaries.")}
                  className="text-left p-3.5 rounded-2xl bg-[#f5f5f7] hover:bg-[#eaeaec] text-xs text-slate-800 font-semibold transition cursor-pointer"
                >
                  ⚡ {isFi ? "Laske tehoalueet (FTP)" : "Calculate power zones"}
                </button>
                <button 
                  onClick={() => onSendMessage(isFi ? "Miten minun kannattaisi valmistautua tulevaan tavoitteeseeni?" : "How should I prepare for my upcoming gravel race with my weekly capacity limits?")}
                  className="text-left p-3.5 rounded-2xl bg-[#f5f5f7] hover:bg-[#eaeaec] text-xs text-slate-800 font-semibold transition cursor-pointer"
                >
                  🎯 {isFi ? "Tavoitteeseen valmistautuminen" : "Race preparation advice"}
                </button>
              </div>
            </div>

            {/* Sidebar Footer Controls */}
            {onClearChat && (
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={onClearChat}
                  className="w-full py-2.5 px-4 bg-[#f5f5f7] hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isFi ? "Tyhjennä keskustelu" : "Clear Chat History"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat window */}
        <div className="lg:col-span-3 flex flex-col p-5 sm:p-6 rounded-[32px] bg-white border border-slate-100/60 shadow-sm overflow-hidden h-[600px]">
          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4">
            {chatMessages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
              >
                <div className={`max-w-[92%] sm:max-w-[85%] rounded-3xl p-4 sm:p-5 text-xs sm:text-sm ${
                  msg.role === "user" 
                    ? "bg-[#0071e3] text-white shadow-md rounded-br-md font-medium"
                    : "bg-[#f5f5f7] text-slate-900 border border-slate-200/50 rounded-bl-md shadow-sm"
                }`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center space-x-1.5 mb-2 pb-1 border-b border-slate-200/60 text-[#0071e3] font-black text-xs tracking-tight">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI COACH</span>
                    </div>
                  )}
                  <FormattedMarkdown content={msg.content} isUser={msg.role === "user"} />
                </div>
              </div>
            ))}
            {loadingChat && (
              <div className="flex justify-start">
                <div className="bg-[#f5f5f7] rounded-3xl p-4 flex items-center space-x-2.5 text-xs sm:text-sm text-slate-500 shadow-sm">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#0071e3]" />
                  <span className="font-semibold">{isFi ? "Valmentaja analysoi harjoitustietojasi ja luo vastausta..." : "Coach is analyzing telemetry data and generating insights..."}</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Prompt Send Form */}
          <div className="flex items-center space-x-2.5 border-t border-slate-100 pt-4 shrink-0">
            <input 
              type="text" 
              value={inputMessage} 
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSendMessage()}
              placeholder={isFi ? "Kysy valmentajalta treeneistäsi, palautumisesta tai tavoitteista..." : "Ask your coach about your training, recovery, or targets..."}
              className="flex-1 bg-[#f5f5f7] rounded-2xl px-4 py-3.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3] transition shadow-inner"
            />
            <button
              onClick={() => onSendMessage()}
              disabled={loadingChat || !inputMessage.trim()}
              className="p-3.5 bg-[#0071e3] hover:bg-blue-600 disabled:opacity-40 text-white font-bold rounded-2xl transition flex items-center justify-center shrink-0 cursor-pointer shadow-md"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
