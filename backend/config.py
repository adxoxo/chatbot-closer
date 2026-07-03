"""Central environment configuration for the TQ Chatbot backend.

All external services are optional. When a key is missing the corresponding
subsystem falls back to a local/no-op implementation so the system is always
runnable for a demo.
"""
import os

from dotenv import load_dotenv

load_dotenv()


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


# Supabase
SUPABASE_URL = _get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = _get("SUPABASE_SERVICE_KEY")
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Groq (OpenAI-compatible) — primary LLM when set
GROQ_API_KEY = _get("GROQ_API_KEY")
GROQ_MODEL = _get("GROQ_MODEL", "llama-3.3-70b-versatile")
# Mechanical scoring extraction runs on a cheaper/faster model with its own quota.
GROQ_SCORING_MODEL = _get("GROQ_SCORING_MODEL", "llama-3.1-8b-instant")
GROQ_BASE_URL = _get("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
USE_GROQ = bool(GROQ_API_KEY)

# Gemini (fallback LLM)
GEMINI_API_KEY = _get("GEMINI_API_KEY")
GEMINI_MODEL = _get("GEMINI_MODEL", "gemini-2.5-flash")
USE_GEMINI = bool(GEMINI_API_KEY)

# Admin auth
ADMIN_API_KEY = _get("ADMIN_API_KEY", "tq-admin-dev-key")

# Misc
DASHBOARD_URL = _get("DASHBOARD_URL", "https://tq-demo.aquryu.space")

_cors = _get("CORS_ORIGINS", "*")
CORS_ORIGINS = ["*"] if _cors in ("", "*") else [o.strip() for o in _cors.split(",")]

# Local SQLite path (used when Supabase is not configured)
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "tq.db")


def summary() -> dict:
    llm = "groq" if USE_GROQ else ("gemini" if USE_GEMINI else "mock")
    return {
        "storage": "supabase" if USE_SUPABASE else "sqlite",
        "llm": llm,
        "llm_model": GROQ_MODEL if USE_GROQ else (GEMINI_MODEL if USE_GEMINI else "mock"),
        "notify": "n8n (per-tenant webhook)",
    }
