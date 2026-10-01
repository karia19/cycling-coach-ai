"use client";

import React, { useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Zap,
  Activity,
  Sparkles,
  Upload,
  ShieldCheck,
  Cpu,
  TrendingUp,
  Award,
  ChevronRight,
  CheckCircle2,
  Lock,
  Globe,
  Terminal,
  ArrowRight,
  Sliders,
  Check,
  Play,
  BarChart3,
  Flame,
  Download,
  HelpCircle,
  MessageSquare,
  BookOpen,
  Code2,
  Layers,
  Server
} from "lucide-react";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

interface LandingPageProps {
  onOpenApp: () => void;
}

export function LandingPage({ onOpenApp }: LandingPageProps) {
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [copiedManual, setCopiedManual] = useState(false);
  const [activeTab, setActiveTab] = useState<"docker" | "manual">("docker");
  const [activeDemoTab, setActiveDemoTab] = useState<"analytics" | "chat" | "science" | "export">("analytics");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Scroll animations
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.97]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  const handleCopyDocker = () => {
    navigator.clipboard.writeText("git clone https://github.com/your-repo/cycling-coach-ai.git\ncd cycling-coach-ai\ndocker compose up -d");
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 2500);
  };

  const handleCopyManual = () => {
    navigator.clipboard.writeText("# Backend setup\nconda create -n conda_trainer python=3.12 -y\nconda run -n conda_trainer pip install -r backend/requirements.txt\npython backend/main.py\n\n# Frontend setup\ncd frontend\nnpm install\nnpm run dev");
    setCopiedManual(true);
    setTimeout(() => setCopiedManual(false), 2500);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-slate-900 selection:text-white overflow-x-hidden">
      
      {/* Subtle Monochrome Top Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-slate-200/50 via-slate-100/30 to-transparent blur-[120px] pointer-events-none z-0" />

      {/* Floating Header */}
      <header className="fixed top-3 sm:top-4 left-0 right-0 z-50 px-3 sm:px-4 max-w-5xl mx-auto">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-full px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between transition-all">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 flex items-center justify-center shadow-sm">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-black text-xs sm:text-sm text-slate-900 tracking-tight leading-none block">Cycling Coach AI</span>
              <span className="text-[8px] text-slate-500 font-bold tracking-wider uppercase mt-0.5 block">100% Open Source</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-6 text-xs font-bold text-slate-600">
            <button onClick={() => scrollToSection("how-it-works")} className="hover:text-slate-900 transition cursor-pointer">How It Works</button>
            <button onClick={() => scrollToSection("installation")} className="hover:text-slate-900 transition cursor-pointer">Installation</button>
            <button onClick={() => scrollToSection("sports-science")} className="hover:text-slate-900 transition cursor-pointer">Sports Science</button>
            <button onClick={() => scrollToSection("features")} className="hover:text-slate-900 transition cursor-pointer">Features</button>
            <button onClick={() => scrollToSection("faq")} className="hover:text-slate-900 transition cursor-pointer">FAQ</button>
          </nav>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => window.open("https://github.com", "_blank")}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 transition cursor-pointer border border-slate-200"
            >
              <GithubIcon className="w-3.5 h-3.5 text-slate-900" />
              <span>GitHub</span>
            </button>
            
            <button
              onClick={onOpenApp}
              className="px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
            >
              <span>Launch App</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-44 md:pb-24 px-4 max-w-5xl mx-auto text-center z-10">
        <motion.div style={{ scale: heroScale, opacity: heroOpacity }} className="space-y-6">
          
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Open Source • Privacy-First • Local AI</span>
          </motion.div>

          {/* Main Title - Single Solid Color */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-slate-900 leading-[1.08] max-w-4xl mx-auto"
          >
            Cycling Coach AI — Data-Driven Coaching on Your Own Machine
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed"
          >
            100% free and open-source performance analytics tailored for gravel and road racing. Combines 1-second power stream analysis with sports science CTL/ATL/TSB modeling and local Ollama LLMs.
          </motion.p>

          {/* Call to Actions */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
          >
            <button
              onClick={() => scrollToSection("installation")}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-md transition cursor-pointer flex items-center justify-center space-x-2 group scale-100 hover:scale-[1.02]"
            >
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Run with Docker (Quickstart)</span>
            </button>

            <button
              onClick={onOpenApp}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm border border-slate-300/80 shadow-sm transition cursor-pointer flex items-center justify-center space-x-2"
            >
              <Play className="w-4 h-4 text-slate-700 fill-slate-700" />
              <span>Try Web Demo</span>
            </button>
          </motion.div>

          {/* Key Metric Highlights */}
          <div className="relative mt-12 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            
            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-2 text-emerald-600 text-xs font-bold mb-1">
                <Activity className="w-4 h-4" />
                <span>TSB Form Model</span>
              </div>
              <p className="text-xl font-black text-slate-900">+8.4 <span className="text-xs text-emerald-600 font-bold">Optimal</span></p>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">42/7-day EWMA load</p>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-2 text-slate-800 text-xs font-bold mb-1">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Ollama Local LLM</span>
              </div>
              <p className="text-xs font-bold text-slate-900 truncate">100% Private</p>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">Runs locally, zero cloud costs</p>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-2 text-slate-800 text-xs font-bold mb-1">
                <Flame className="w-4 h-4 text-emerald-600" />
                <span>NP & TSS Engine</span>
              </div>
              <p className="text-xl font-black text-slate-900">284 W <span className="text-xs text-slate-500 font-normal">IF 0.88</span></p>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">4th-power continuous rolling avg</p>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-2 text-slate-800 text-xs font-bold mb-1">
                <Upload className="w-4 h-4 text-slate-700" />
                <span>FIT / TCX / GPX</span>
              </div>
              <p className="text-xs font-bold text-slate-900">Native Files</p>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">Automatic stream parsing</p>
            </div>

          </div>

        </motion.div>
      </section>

      {/* How It Works & Architecture Section */}
      <section id="how-it-works" className="py-16 px-4 max-w-5xl mx-auto z-10 relative">
        <div className="text-center space-y-2 mb-12">
          <span className="text-xs font-bold text-slate-700 tracking-wider uppercase bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            System Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            How Does the System Work?
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto text-xs sm:text-sm font-medium">
            The pipeline processes raw sensor streams through four precise stages from file ingestion to AI recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm space-y-3 relative">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">
              1
            </div>
            <h3 className="text-sm font-bold text-slate-900">1. Data Ingestion</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Upload FIT, TCX, or GPX files. The backend parses 1-second streams for power, heart rate, cadence, and elevation.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm space-y-3 relative">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">
              2
            </div>
            <h3 className="text-sm font-bold text-slate-900">2. Sports Science</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Calculates Normalized Power (NP) via a 30s rolling 4th power algorithm alongside daily CTL (42d), ATL (7d), and TSB.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm space-y-3 relative">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">
              3
            </div>
            <h3 className="text-sm font-bold text-slate-900">3. Local AI Advisor</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              FastAPI feeds training load context and workout summaries into Ollama (e.g. `llama3`) or your preferred LLM.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm space-y-3 relative">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">
              4
            </div>
            <h3 className="text-sm font-bold text-slate-900">4. Analytics & Export</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Inspect charts on the Next.js dashboard and export structured workouts (.ZWO / .ERG) directly to Zwift or head units.
            </p>
          </div>

        </div>
      </section>

      {/* Detailed Installation Guide Section */}
      <section id="installation" className="py-16 px-4 max-w-5xl mx-auto z-10 relative">
        <div className="bg-white border border-slate-200/90 p-6 sm:p-10 rounded-[32px] shadow-sm relative overflow-hidden space-y-8">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
            <div>
              <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Run Locally
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                Setup & Installation Guide
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                The complete platform is 100% free to clone, build, and run on your own hardware without subscriptions.
              </p>
            </div>

            {/* Selector */}
            <div className="bg-slate-100 p-1 rounded-full flex space-x-1 text-xs font-bold border border-slate-200">
              <button
                onClick={() => setActiveTab("docker")}
                className={`px-3.5 py-1.5 rounded-full transition cursor-pointer ${
                  activeTab === "docker" ? "bg-slate-900 text-white" : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Docker Compose (Recommended)
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`px-3.5 py-1.5 rounded-full transition cursor-pointer ${
                  activeTab === "manual" ? "bg-slate-900 text-white" : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Manual (Conda + Node)
              </button>
            </div>
          </div>

          {activeTab === "docker" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 font-medium">
                The easiest way to launch the application. Docker automatically orchestrates the FastAPI backend and Next.js frontend:
              </p>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 font-mono text-xs text-slate-200 relative shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 text-[11px] text-slate-400 font-sans">
                  <span className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-200">Docker Quickstart Command</span>
                  </span>
                  <button
                    onClick={handleCopyDocker}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] transition cursor-pointer flex items-center space-x-1 border border-slate-700"
                  >
                    {copiedDocker ? <Check className="w-3 h-3 text-emerald-400" /> : <Upload className="w-3 h-3" />}
                    <span>{copiedDocker ? "Copied!" : "Copy"}</span>
                  </button>
                </div>

                <pre className="text-emerald-400 leading-relaxed overflow-x-auto text-[11px]">
                  <code>{`git clone https://github.com/your-repo/cycling-coach-ai.git
cd cycling-coach-ai
docker compose up -d`}</code>
                </pre>
              </div>

              <div className="text-xs text-slate-600 font-medium bg-slate-50 p-4 rounded-xl border border-slate-200">
                💡 <strong>Connecting Ollama:</strong> Ensure Ollama is running locally (<code>ollama serve</code>) and pull your model via <code>ollama run llama3</code>. Configure your Ollama URL in the app Settings panel.
              </div>
            </div>
          )}

          {activeTab === "manual" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 font-medium">
                If you want to modify code or run components directly in a local development environment:
              </p>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 font-mono text-xs text-slate-200 relative shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 text-[11px] text-slate-400 font-sans">
                  <span className="flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-200">Local Conda & Node Setup</span>
                  </span>
                  <button
                    onClick={handleCopyManual}
                    className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] transition cursor-pointer flex items-center space-x-1 border border-slate-700"
                  >
                    {copiedManual ? <Check className="w-3 h-3 text-emerald-400" /> : <Upload className="w-3 h-3" />}
                    <span>{copiedManual ? "Copied!" : "Copy"}</span>
                  </button>
                </div>

                <pre className="text-emerald-400 leading-relaxed overflow-x-auto text-[11px]">
                  <code>{`# 1. Backend Setup (Python 3.12 FastAPI)
conda create -n conda_trainer python=3.12 -y
conda run -n conda_trainer pip install -r backend/requirements.txt
python backend/main.py   # Runs on port 8765

# 2. Frontend Setup (Next.js Node 22)
cd frontend
npm install
npm run dev              # Runs on port 3456`}</code>
                </pre>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Sports Science Section */}
      <section id="sports-science" className="py-16 px-4 max-w-5xl mx-auto z-10 relative">
        <div className="text-center space-y-2 mb-12">
          <span className="text-xs font-bold text-slate-700 tracking-wider uppercase bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            Scientific Foundation
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Rigorous Sports Science Calculations
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto text-xs sm:text-sm font-medium">
            The AI advisor relies on mathematically verified training load models rather than arbitrary prompts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 font-black text-xs">
              NP
            </div>
            <h3 className="text-base font-bold text-slate-900">Normalized Power (NP)</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Calculated over a continuous 1-second timeline using a 30-second rolling average raised to the 4th power. Ensures accurate physiological cost.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 font-black text-xs">
              TSS
            </div>
            <h3 className="text-base font-bold text-slate-900">Training Stress Score (TSS)</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Power-based TSS (duration × NP × IF / FTP × 100) or heart-rate based hrTSS & Banister TRIMP if power sensors are absent.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 font-black text-xs">
              TSB
            </div>
            <h3 className="text-base font-bold text-slate-900">CTL, ATL & TSB (Form)</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              CTL (Fitness 42d EWMA) minus ATL (Fatigue 7d EWMA). TSB precisely indicates when you are fresh for race day vs at risk of overtraining.
            </p>
          </div>

        </div>
      </section>

      {/* Interactive Live Demo Section */}
      <section id="demo" className="py-16 px-4 max-w-5xl mx-auto z-10 relative">
        <div className="text-center space-y-2 mb-10">
          <span className="text-xs font-bold text-slate-700 tracking-wider uppercase bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            Interactive Live Demo
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Experience the Platform Live
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto text-xs sm:text-sm font-medium">
            Explore performance charts, AI coach advisor chat, and workout export functionality in the live preview below.
          </p>
        </div>

        {/* Segmented Light Tab Selectors */}
        <div className="flex justify-center mb-6">
          <div className="bg-slate-200/80 border border-slate-300/60 p-1 rounded-full flex space-x-1 text-xs font-bold backdrop-blur-md">
            <button
              onClick={() => setActiveDemoTab("analytics")}
              className={`px-4 py-2 rounded-full transition cursor-pointer ${
                activeDemoTab === "analytics" ? "bg-slate-900 text-white shadow-md" : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveDemoTab("chat")}
              className={`px-4 py-2 rounded-full transition cursor-pointer ${
                activeDemoTab === "chat" ? "bg-slate-900 text-white shadow-md" : "text-slate-700 hover:text-slate-900"
              }`}
            >
              AI Coach
            </button>
            <button
              onClick={() => setActiveDemoTab("export")}
              className={`px-4 py-2 rounded-full transition cursor-pointer ${
                activeDemoTab === "export" ? "bg-slate-900 text-white shadow-md" : "text-slate-700 hover:text-slate-900"
              }`}
            >
              ERG Export
            </button>
          </div>
        </div>

        {/* Light Demo Window Container */}
        <div className="bg-white border border-slate-200/90 rounded-[28px] shadow-sm p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            {activeDemoTab === "analytics" && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <span>CTL / ATL / TSB Fitness & Fatigue Model</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">EWMA 42/7 days</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">Scientific training load calculated from 1-second power and heart rate streams</p>
                  </div>
                  <div className="flex space-x-3 text-xs font-bold">
                    <span className="text-slate-900 flex items-center space-x-1">● CTL (Fitness): 78</span>
                    <span className="text-amber-600 flex items-center space-x-1">● ATL (Fatigue): 62</span>
                    <span className="text-emerald-600 flex items-center space-x-1">● TSB (Form): +16</span>
                  </div>
                </div>

                <div className="h-56 bg-slate-50 rounded-2xl border border-slate-200/80 p-4 flex flex-col justify-between relative overflow-hidden">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 150">
                    <path d="M0,120 Q100,90 200,60 T400,40 T500,20" fill="none" stroke="#0f172a" strokeWidth="3.5" />
                    <path d="M0,130 Q100,110 200,80 T400,95 T500,50" fill="none" stroke="#d97706" strokeWidth="2.5" strokeDasharray="4 4" />
                    <path d="M0,70 Q100,40 200,90 T400,30 T500,10" fill="none" stroke="#059669" strokeWidth="3" />
                  </svg>

                  <div className="flex justify-between text-[10px] text-slate-500 font-bold border-t border-slate-200/80 pt-2 z-10">
                    <span>Wk 32</span>
                    <span>Wk 34</span>
                    <span>Wk 36</span>
                    <span>Wk 38 (Today)</span>
                    <span className="text-emerald-600">Form: Ready to Race</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeDemoTab === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">AI Coach Interactive Chat</h3>
                  </div>
                  <span className="text-[10px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-bold">Model: Local Ollama llama3</span>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="bg-slate-100 border border-slate-200/60 p-3.5 rounded-2xl max-w-xl">
                    <p className="text-slate-800 font-semibold">👤 "What do you recommend for tomorrow's long gravel ride 3 weeks out from race day?"</p>
                  </div>
                  <div className="bg-emerald-50/80 border border-emerald-200/70 p-4 rounded-2xl max-w-2xl text-slate-800 space-y-1.5">
                    <p className="font-bold text-emerald-800 flex items-center space-x-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Coach Analysis (TSB +16, CTL 78):</span>
                    </p>
                    <p className="leading-relaxed text-slate-700 text-xs sm:text-sm">
                      "Your form is optimal for a high-quality session. I recommend a <strong>3.5h gravel ride</strong> with 3x20min at race effort (SweetSpot 88-92% FTP). Keep HR under 162 bpm to maintain aerobic decoupling below 4%."
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeDemoTab === "export" && (
              <motion.div
                key="export"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Download className="w-4 h-4 text-slate-800" />
                    <span>Workout File Export (.ZWO / .ERG Zwift & Garmin)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Transfer AI-generated structured workouts straight to your head unit or indoor trainer</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="space-y-1 text-left">
                    <p className="text-xs font-bold text-slate-900">4x8min VO2max Interval Session</p>
                    <p className="text-[11px] text-slate-600">Warmup 15m @ 55% -&gt; 4x (8m @ 108% FTP, 4m Rest @ 50%) -&gt; Cooldown 15m</p>
                  </div>
                  <div className="flex space-x-2 shrink-0">
                    <button className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer">
                      Download .ZWO (Zwift)
                    </button>
                    <button className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer">
                      Download .FIT
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 px-4 max-w-3xl mx-auto z-10 relative">
        <div className="text-center space-y-2 mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Frequently Asked Questions</h2>
          <p className="text-slate-600 text-xs sm:text-sm font-medium">Learn more about app operations, open-source licensing, and privacy.</p>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "Is this application completely free?",
              a: "Yes! The entire application is open source (AGPL-3.0). You can download the code from GitHub, run it on your machine with Docker, and connect a free local Ollama LLM model with zero subscription costs."
            },
            {
              q: "How does the AI process your workouts?",
              a: "The FastAPI backend parses your FIT, TCX, or GPX files to compute sports science metrics (NP, TSS, IF, CTL, ATL, TSB, HR decoupling). The AI reads this structured summary to deliver precise recommendations."
            },
            {
              q: "How is my training data stored and secured?",
              a: "100% of your data remains on your local machine inside an SQLite database. No workout files or personal metrics are transmitted to third-party cloud servers without your explicit permission."
            },
            {
              q: "How can I contribute to development?",
              a: "The project is open to everyone! Feel free to submit Pull Requests or Issues on GitHub, build new analytics modules, or enhance the frontend UI."
            }
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left text-xs sm:text-sm font-bold text-slate-900 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition"
              >
                <span>{item.q}</span>
                <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${openFaq === idx ? "rotate-90 text-slate-900" : ""}`} />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed font-medium border-t border-slate-100 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-10 px-4 z-10 relative bg-white">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-white">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="font-black text-sm text-slate-900">Cycling Coach AI</span>
          </div>

          <div className="flex space-x-6 text-xs text-slate-600 font-bold">
            <button onClick={() => scrollToSection("how-it-works")} className="hover:text-slate-900 transition cursor-pointer">Architecture</button>
            <button onClick={() => scrollToSection("installation")} className="hover:text-slate-900 transition cursor-pointer">Installation</button>
            <button onClick={() => scrollToSection("sports-science")} className="hover:text-slate-900 transition cursor-pointer">Sports Science</button>
            <button onClick={onOpenApp} className="hover:text-slate-900 transition cursor-pointer">Launch App</button>
          </div>

          <div className="text-[11px] text-slate-500 font-semibold">
            © 2026 Cycling Coach AI. AGPL-3.0 Open Source License.
          </div>
        </div>
      </footer>

    </div>
  );
}
