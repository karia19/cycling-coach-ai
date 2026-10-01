import json
import os
import time
import requests
from sqlalchemy.orm import Session
from backend.config import settings
from backend.models import UserParameters, UserGoal, Workout
from backend.summarizer import update_all_summaries, SUMMARIES_DIR
from backend.agent_tools import AGENT_TOOLS_SCHEMA, execute_agent_tool

def load_md_summaries(db: Session) -> dict:
    """Ensures MD summaries exist and reads their content."""
    ensure_files = ["coaching_directives.md", "athlete_profile.md", "weekly_history.md", "latest_workout.md"]
    all_exist = all(os.path.exists(os.path.join(SUMMARIES_DIR, f)) for f in ensure_files)
    
    if not all_exist:
        update_all_summaries(db)
        
    summaries = {}
    for filename in ensure_files:
        filepath = os.path.join(SUMMARIES_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                summaries[filename] = f.read()
        else:
            summaries[filename] = "No data available."
            
    return summaries

def query_gemini_with_fallbacks(api_key: str, requested_model: str, api_messages: list, db: Session) -> str:
    """
    Robustly queries Google Gemini API using native and OpenAI format endpoints,
    ensuring proper system_instruction separation and strictly alternating user/model roles.
    Automatically falls back across active candidate models (gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro, gemini-flash-latest).
    Extracts detailed Google error JSON (code, status, message) on failures.
    """
    candidate_models = []
    standard_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-flash-latest"]

    if requested_model and "gemini-pro" not in requested_model.lower():
        req_clean = requested_model.strip()
        candidate_models.append(req_clean)
        for m in standard_models:
            if m != req_clean:
                candidate_models.append(m)
    else:
        candidate_models = standard_models

    # Separate system instruction from conversation contents for Native Gemini API
    system_text = ""
    chat_turns = []
    for m in api_messages:
        role = m.get("role")
        content = m.get("content") or ""
        if role == "system":
            system_text += content + "\n\n"
        else:
            chat_turns.append((role, content))

    native_contents = []
    for role, content in chat_turns:
        gemini_role = "user" if role == "user" else "model"
        if native_contents and native_contents[-1]["role"] == gemini_role:
            native_contents[-1]["parts"][0]["text"] += "\n\n" + content
        else:
            native_contents.append({
                "role": gemini_role,
                "parts": [{"text": content}]
            })

    if not native_contents:
        native_contents = [{"role": "user", "parts": [{"text": "Hei, anna yhteenveto harjoituskuormastani."}]}]

    last_error = ""

    for target_model in candidate_models:
        # 1. Native generateContent Endpoint (Using system_instruction parameter)
        native_url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
        native_body = {
            "contents": native_contents
        }
        if system_text.strip():
            native_body["system_instruction"] = {
                "parts": [{"text": system_text.strip()}]
            }

        for attempt in range(2):
            try:
                res = requests.post(native_url, json=native_body, timeout=30)
                if res.status_code == 200:
                    n_data = res.json()
                    candidates = n_data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"]

                # Extract detailed error details from response JSON
                err_detail = ""
                try:
                    err_json = res.json()
                    if "error" in err_json:
                        err_obj = err_json["error"]
                        code = err_obj.get("code", res.status_code)
                        msg = err_obj.get("message", res.text[:200])
                        status = err_obj.get("status", "")
                        err_detail = f"[{code} {status}] {msg}".strip()
                except Exception:
                    err_detail = res.text[:200]

                last_error = f"Model '{target_model}' HTTP {res.status_code}: {err_detail}"

                if res.status_code in (503, 500, 502, 429) and attempt == 0:
                    time.sleep(1.5)
                    continue
                else:
                    break
            except Exception as e:
                last_error = f"Model '{target_model}': {str(e)}"
                break

        # 2. OpenAI-compatible Endpoint Fallback
        openai_url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        payload = {
            "model": target_model,
            "messages": api_messages,
            "tools": AGENT_TOOLS_SCHEMA,
            "temperature": 0.7
        }

        try:
            res = requests.post(openai_url, headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                data = res.json()
                choice = data["choices"][0]
                message_res = choice["message"]
                tool_calls = message_res.get("tool_calls")
                if tool_calls:
                    api_messages.append(message_res)
                    for tool_call in tool_calls:
                        func = tool_call.get("function", {})
                        tool_name = func.get("name")
                        raw_args = func.get("arguments", "{}")
                        try:
                            args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                        except Exception:
                            args = {}
                        tool_result = execute_agent_tool(tool_name, args, db)
                        api_messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.get("id", "call_1"),
                            "content": tool_result
                        })
                    payload["messages"] = api_messages
                    payload.pop("tools", None)
                    followup_res = requests.post(openai_url, headers=headers, json=payload, timeout=30)
                    if followup_res.status_code == 200:
                        followup_data = followup_res.json()
                        return followup_data["choices"][0]["message"]["content"]
                return message_res.get("content", "Virhe: Gemini ei palauttanut tekstiä.")
            else:
                err_detail = ""
                try:
                    err_json = res.json()
                    if "error" in err_json:
                        err_obj = err_json["error"]
                        code = err_obj.get("code", res.status_code)
                        msg = err_obj.get("message", res.text[:200])
                        status = err_obj.get("status", "")
                        err_detail = f"[{code} {status}] {msg}".strip()
                except Exception:
                    err_detail = res.text[:200]
                last_error = f"OpenAI format '{target_model}' HTTP {res.status_code}: {err_detail}"
        except Exception as e:
            last_error = f"OpenAI format '{target_model}': {str(e)}"

    raise Exception(last_error or "Gemini API unavailable")

def generate_coaching_response(messages: list[dict], db: Session) -> str:
    """
    Builds the sports-science system prompt using Markdown summaries
    and queries the LLM with tool-calling capabilities and Gemini fallbacks.
    """
    params = db.query(UserParameters).first() or UserParameters()
    summaries = load_md_summaries(db)
    
    lang_name = "Finnish" if params.language == "fi" else "English"
    
    system_prompt = f"""You are LocalCyclingCoach, an elite cycling coach and sports scientist using Golden Cheetah metrics.
All workout data is private and stored locally. You have access to pre-compiled athlete context below.

---
{summaries.get('coaching_directives.md', '')}
---
{summaries.get('athlete_profile.md', '')}
---
{summaries.get('weekly_history.md', '')}
---
{summaries.get('latest_workout.md', '')}
---

TSB Guidance (Sports Science Standard):
- TSB > 5: Fresh/Tapered (Good for racing or recovery week)
- TSB between -10 and 5: Optimal Training Load (Progressive overload)
- TSB between -20 and -10: High Training Load (Watch fatigue)
- TSB < -20: Overtraining Risk! Schedule recovery or light rides immediately.

INSTRUCTIONS FOR YOUR RESPONSE:
1. Be highly supportive, analytical, and actionable. Base recommendations on bioenergetics, CP/W'bal, Aerobic Decoupling, and TSB form.
2. Respect the athlete's life context, background, and specific targets defined in the Coaching Directives (e.g., target heart rates, family balance, sports history).
3. If the user asks about older workouts or peak power bests outside the last 6 weeks summary, use your available tools (`search_workout_history`, `get_power_curve_bests`, `get_specific_workout_details`).
4. You MUST respond in {lang_name}. If Finnish, use natural sports coaching terminology (e.g. 'PK-lenkki', 'FTP', 'CP', 'W'bal', 'tulitikut', 'tehoalueet', 'palautuminen').
5. Do not mention system details (like databases, APIs, code) to the athlete.
"""

    cleaned_messages = [msg for msg in messages if msg.get("role") != "system"]
    api_messages = [{"role": "system", "content": system_prompt}] + cleaned_messages

    provider = params.llm_provider.lower() if params.llm_provider else "gemini"
    api_key = params.llm_api_key or ""
    model = params.llm_model or "gemini-2.0-flash"
    
    headers = {"Content-Type": "application/json"}
    
    if provider == "gemini":
        try:
            return query_gemini_with_fallbacks(api_key, model, api_messages, db)
        except Exception as e:
            err_msg = str(e)
            if params.language == "fi":
                return (
                    f"### 1. Viimeisimmän Harjoituksen Analyysi\n\n"
                    f"⚠️ **Google Gemini API virhe / Palvelin ruuhkautunut**\n\n"
                    f"Googlen rajapinta palautti virheen:\n"
                    f"```\n{err_msg}\n```\n\n"
                    f"**Mistä tämä johtuu ja miten korjata:**\n"
                    f"1. **Malli ruuhkautunut (HTTP 503 UNAVAILABLE)**: Google Gemini `gemini-flash-latest` kokee tilapäisiä kuormituspiikkejä ilmaisilla rajapinnoilla.\n"
                    f"2. **Suositus**: Mene **Settings (Asetukset)** -välilehdelle ja vaihda LLM Model -kentän arvoksi `gemini-2.0-flash` tai `gemini-1.5-flash`."
                )
            else:
                return (
                    f"### 1. Latest Workout Analysis\n\n"
                    f"⚠️ **Google Gemini API Error / Service Overloaded**\n\n"
                    f"Google API returned error:\n"
                    f"```\n{err_msg}\n```\n\n"
                    f"**Suggested fix:**\n"
                    f"1. **High demand (HTTP 503 UNAVAILABLE)**: `gemini-flash-latest` is experiencing temporary load spikes.\n"
                    f"2. **Action**: Go to **Settings** and update LLM Model to `gemini-2.0-flash` or `gemini-1.5-flash`."
                )

    if provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        headers["Authorization"] = f"Bearer {api_key}"
        payload = {
            "model": model or "gpt-4o",
            "messages": api_messages,
            "tools": AGENT_TOOLS_SCHEMA,
            "temperature": 0.7
        }
    elif provider == "deepseek":
        url = "https://api.deepseek.com/chat/completions"
        headers["Authorization"] = f"Bearer {api_key}"
        payload = {
            "model": model or "deepseek-chat",
            "messages": api_messages,
            "temperature": 0.7
        }
    elif provider == "openrouter":
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers["Authorization"] = f"Bearer {api_key}"
        headers["HTTP-Referer"] = "http://localhost:3000"
        headers["X-Title"] = "Trainer AI"
        payload = {
            "model": model or "deepseek/deepseek-r1",
            "messages": api_messages,
            "temperature": 0.7
        }
    else:  # Default to Ollama
        base_url = params.ollama_url or "http://localhost:11434"
        url = f"{base_url.rstrip('/')}/v1/chat/completions"
        payload = {
            "model": model or "llama3.1",
            "messages": api_messages,
            "tools": AGENT_TOOLS_SCHEMA,
            "temperature": 0.7
        }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=45)
        response.raise_for_status()
        data = response.json()
        
        choice = data["choices"][0]
        message_res = choice["message"]

        tool_calls = message_res.get("tool_calls")
        if tool_calls:
            api_messages.append(message_res)
            for tool_call in tool_calls:
                func = tool_call.get("function", {})
                tool_name = func.get("name")
                raw_args = func.get("arguments", "{}")
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except Exception:
                    args = {}
                    
                tool_result = execute_agent_tool(tool_name, args, db)
                api_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.get("id", "call_1"),
                    "content": tool_result
                })
                
            payload["messages"] = api_messages
            payload.pop("tools", None)
            followup_res = requests.post(url, headers=headers, json=payload, timeout=45)
            followup_res.raise_for_status()
            followup_data = followup_res.json()
            return followup_data["choices"][0]["message"]["content"]

        return message_res.get("content", "Virhe: LLM ei palauttanut tekstiä.")

    except Exception as e:
        err_msg = str(e)
        provider_name = provider.upper()
        if params.language == "fi":
            return (
                f"Hei! En saanud yhteyttä AI-palvelimeen ({provider_name}). "
                f"Tarkista API-avain ja malli asetuksista.\n\n"
                f"Tiedot luettu MD-yhteenvedoista onnistuneesti. Virheilmoitus: `{err_msg}`"
            )
        else:
            return (
                f"Hi! Could not connect to the AI model endpoint ({provider_name}). "
                f"Please check your API key/model settings.\n\n"
                f"MD summary files loaded successfully. Error: `{err_msg}`"
            )
