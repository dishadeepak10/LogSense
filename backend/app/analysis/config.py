"""All thresholds and settings for the analysis module, in one place.

Change a number here, not inside the detector code, so it is easy to tune
and easy to explain in the viva ("the spike threshold is K = 3.5").
"""
import os

from dotenv import load_dotenv

load_dotenv()  # reads the .env file at the repo root (never commit it)

# ---------- Detector 1: error spike (median + MAD) ----------
SPIKE_BUCKET_SECONDS = 60      # count errors per 1-minute bucket
SPIKE_MAX_BUCKETS = 5000       # very long logs get wider buckets so we never make millions
SPIKE_LINES_PER_BUCKET = 100   # used instead of time when the log has no timestamps
SPIKE_K = 3.5                  # how many "robust standard deviations" above normal is a spike
MAD_SCALE = 1.4826             # turns MAD into the same scale as a standard deviation
MIN_MAD = 1.0                  # floor, so a perfectly quiet log (MAD = 0) does not flag every single error
SPIKE_MIN_ERRORS = 3           # a bucket needs at least this many errors to count as a spike

# ---------- Detector 2: burst ----------
BURST_GAP_SECONDS = 60         # errors less than 60 s apart belong to the same burst
BURST_GAP_LINES = 20           # same idea for logs without timestamps
BURST_MIN_ERRORS = 3           # a burst needs at least this many errors (a single FATAL also counts)

# ---------- Detector 3: first-time error ----------
FIRST_TIME_BASELINE_FRACTION = 0.2  # the first 20% of the log is "normal operation"
FIRST_TIME_MIN_COUNT = 2            # a new error must happen at least twice (one-offs are noise)
FIRST_TIME_MAX_LINES = 20           # at most this many lines of one new error go into the incident

# ---------- Lead-up warnings ----------
# Warnings from the same service just before the errors are often the real trigger
# ("pool 95% used" before "pool exhausted"), so we add them to the anomaly.
LEADUP_WARN_SECONDS = 120
LEADUP_LOOKBACK_LINES = 50

# ---------- Evidence bundle ----------
EVIDENCE_MAX_LINES = 40        # the guide asks for 20-40 representative lines
EVIDENCE_MAX_LINE_CHARS = 300  # long lines (huge stack traces) are cut
EVIDENCE_MAX_CHARS = 8000      # hard size cap for the whole bundle
EVIDENCE_START = "<<<LOG_EVIDENCE_START>>>"
EVIDENCE_END = "<<<LOG_EVIDENCE_END>>>"

# ---------- LLM ----------
# LLM_PROVIDER: "anthropic" (Claude, default) or "openai_compatible"
# (any API with the OpenAI chat format, e.g. Groq or Gemini's OpenAI endpoint).
LLM_PROVIDER = (os.getenv("LLM_PROVIDER") or "anthropic").strip().lower()
LLM_API_KEY = (os.getenv("LLM_API_KEY") or "").strip()
LLM_MODEL = (os.getenv("LLM_MODEL") or "").strip() or (
    "claude-opus-5-5" if LLM_PROVIDER == "anthropic" else "llama-3.3-70b-versatile"
)
LLM_BASE_URL = (os.getenv("LLM_BASE_URL") or "https://api.groq.com/openai/v1").strip().rstrip("/")
LLM_TIMEOUT_SECONDS = 30
LLM_RETRIES = 1                # one retry after the first failed attempt
LLM_TEMPERATURE = 0.2          # low = more repeatable answers (used where the API supports it)
LLM_MAX_TOKENS = 4000
LLM_CACHE_SIZE = 200           # remember this many answers (same evidence -> same answer, no API call)
LLM_FIELD_MAX_CHARS = 1200     # each of the three answer fields is cut to this length

# ---------- Similar incidents ("seen before") ----------
SIMILARITY_THRESHOLD = 0.3     # Jaccard score needed to call two incidents similar
SIMILARITY_MAX_RESULTS = 5
