# 🚲 cycling-coach-ai

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Python](https://img.shields.io/badge/Python-3.12-emerald.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg)](https://nextjs.org/)
[![Privacy-First](https://img.shields.io/badge/Privacy--First-Local--First-purple.svg)](#-privacy--local-first)

An open-source, local-first, privacy-focused cycling performance analytics and AI coaching application tailored for gravel and road racing. 

Upload your **FIT**, **TCX**, or **GPX** files directly. All workout data is processed and stored locally on your machine in SQLite.

---

## ✨ Features

- **📊 Continuous 1-Second Sports Science Engine:**
  - **Normalized Power (NP):** Calculated using 30-second rolling continuous averages raised to the 4th power.
  - **TSS & hrTSS:** Power-based Training Stress Score with heart-rate (hrTSS) and Banister TRIMP fallbacks.
  - **CTL, ATL & TSB (Form):** Exponentially weighted moving average (EWMA 42/7 days) for fitness, fatigue, and race readiness.
- **🤖 Local-First AI Coach (Ollama / OpenAI / Anthropic):**
  - Connect a free local LLM (e.g. `llama3` via Ollama) or bring your own API key.
  - Context-aware coaching advice reading your exact CTL, ATL, TSB, and aerobic decoupling.
- **⚡ Structured Workout Export (.ZWO & .ERG):**
  - Generate interval sessions and export directly to Zwift or Garmin head units.
- **🔒 100% Privacy & Data Ownership:**
  - No mandatory cloud subscriptions. Your data remains strictly on your device.

---

## 🚀 Quickstart (Docker Compose)

The easiest way to spin up the complete application (FastAPI backend + Next.js frontend):

```bash
git clone https://github.com/karia19/cycling-coach-ai.git
cd cycling-coach-ai
docker compose up -d
```

Open [http://localhost:3456](http://localhost:3456) in your browser.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- **Conda** (Miniconda / Anaconda) with Python 3.12
- **Node.js** 22+ (via `nvm`)

### 2. Backend Setup (FastAPI Python)
```bash
conda create -n conda_trainer python=3.12 -y
conda run -n conda_trainer pip install -r backend/requirements.txt
conda run -n conda_trainer python backend/main.py
```
*The backend server runs on `http://localhost:8765`.*

### 3. Frontend Setup (Next.js Node 22)
```bash
cd frontend
nvm use 22
npm install --legacy-peer-deps
npm run dev
```
*The frontend dashboard runs on `http://localhost:3456`.*

---

## 🤖 Configuring Local AI (Ollama)

1. Install and run Ollama: [ollama.com](https://ollama.com)
2. Pull your preferred model:
   ```bash
   ollama pull llama3
   ```
3. In the UI under **Settings (Asetukset)**, set:
   - **Provider:** `ollama`
   - **URL:** `http://localhost:11434`
   - **Model:** `llama3`

---

## 📜 License

Licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
