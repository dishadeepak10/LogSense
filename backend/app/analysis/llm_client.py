"""LLM client: turns one incident into "Probable Root Cause / Why / Suggested Action".

analyze_incident() is the function the backend calls. Steps:
  1. No LLM wanted (use_llm False) or no API key  -> rule-based fallback
  2. Build the masked evidence bundle and the prompt
  3. Same prompt seen before?                      -> answer from the cache (no API call)
  4. Call the LLM with a timeout; on failure retry once
  5. Check the answer is JSON with the three fields -> otherwise fallback
Whatever happens, the backend always gets the same three fields back.
"""
from __future__ import annotations

import hashlib
import json
import logging
import urllib.request

from app.analysis import config
from app.analysis.evidence import build_evidence
from app.analysis.fallback import build_fallback
from app.analysis.prompt import ANSWER_SCHEMA, SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)

FIELDS = ("root_cause", "why", "suggested_action")

# prompt hash -> answer. Uploading the same log twice costs only one LLM call.
_cache: dict[str, dict] = {}


def _cache_key(user_prompt: str) -> str:
    text = "|".join([config.LLM_PROVIDER, config.LLM_MODEL, SYSTEM_PROMPT, user_prompt])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _remember(key: str, answer: dict) -> None:
    if len(_cache) >= config.LLM_CACHE_SIZE:
        _cache.pop(next(iter(_cache)))  # forget the oldest answer
    _cache[key] = answer


# ---------- Providers ----------

def _call_anthropic(user_prompt: str) -> str:
    """Claude, through the official anthropic SDK (pip install anthropic).
    Current Claude models do not accept a temperature setting; instead we ask for a
    fixed JSON format (structured output) and low effort, and we cache answers."""
    import anthropic  # imported here so the app still runs if the package is missing

    client = anthropic.Anthropic(api_key=config.LLM_API_KEY, timeout=config.LLM_TIMEOUT_SECONDS, max_retries=0)
    response = client.messages.create(
        model=config.LLM_MODEL,
        max_tokens=config.LLM_MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": ANSWER_SCHEMA}},
    )
    if response.stop_reason == "refusal":
        raise ValueError("the model declined to answer")
    return next(block.text for block in response.content if block.type == "text")


def _call_openai_compatible(user_prompt: str) -> str:
    """Any API that uses the OpenAI chat format (Groq, OpenAI, Gemini's OpenAI endpoint...).
    Plain HTTP with Python's built-in urllib, so no extra package is needed."""
    body = {
        "model": config.LLM_MODEL,
        "temperature": config.LLM_TEMPERATURE,
        "max_tokens": config.LLM_MAX_TOKENS,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    }
    request = urllib.request.Request(
        f"{config.LLM_BASE_URL}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {config.LLM_API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=config.LLM_TIMEOUT_SECONDS) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def call_llm(user_prompt: str) -> str:
    if config.LLM_PROVIDER == "anthropic":
        return _call_anthropic(user_prompt)
    if config.LLM_PROVIDER == "openai_compatible":
        return _call_openai_compatible(user_prompt)
    raise ValueError(f"Unknown LLM_PROVIDER {config.LLM_PROVIDER!r}")


# ---------- Checking the answer ----------

def parse_answer(text: str) -> dict:
    """Turn the LLM's text into {"root_cause", "why", "suggested_action"} or raise ValueError.
    Some models wrap JSON in ```json fences or add a sentence around it, so we take
    the part from the first "{" to the last "}"."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in the answer")
    data = json.loads(text[start:end + 1])
    if not isinstance(data, dict):
        raise ValueError("answer is not a JSON object")
    answer = {}
    for field in FIELDS:
        value = data.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"answer is missing the field {field!r}")
        answer[field] = value.strip()[:config.LLM_FIELD_MAX_CHARS]
    return answer


# ---------- Main entry point ----------

def analyze_incident(incident: dict, use_llm: bool) -> dict:
    """Called by the backend for every incident. Always returns the three fields plus
    "source": "llm" or "fallback"."""
    if not use_llm or not config.LLM_API_KEY:
        return build_fallback(incident)

    user_prompt = build_user_prompt(build_evidence(incident))
    key = _cache_key(user_prompt)
    if key in _cache:
        return dict(_cache[key])

    for attempt in range(1 + config.LLM_RETRIES):
        try:
            answer = {**parse_answer(call_llm(user_prompt)), "source": "llm"}
        except Exception as error:  # timeout, network, bad key, bad JSON...
            logger.warning("LLM attempt %d failed: %s", attempt + 1, error)
            continue
        _remember(key, answer)
        return dict(answer)

    logger.warning("LLM failed twice; using the rule-based fallback")
    return build_fallback(incident)
