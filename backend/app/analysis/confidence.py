"""Confidence badge: do the LLM and our keyword rules agree?

Two independent methods look at the same incident:
  - the rules (incident builder) picked a category from keywords, e.g. "database"
  - the LLM wrote a root cause in its own words
We map the LLM's words to a category with the SAME keyword dictionary.
Same category -> "high" (two methods agree). Different -> "low" (verify manually).
"""
from __future__ import annotations

from app.services.incident_builder import CATEGORY_KEYWORDS, DEFAULT_CATEGORY


def category_of_text(text: str) -> str:
    """The category whose keywords appear most often in the text (same rule as the incident builder)."""
    text = " " + text.lower() + " "
    scores = {category: sum(text.count(word) for word in words) for category, words in CATEGORY_KEYWORDS.items()}
    best = max(scores, key=lambda category: scores[category])
    return best if scores[best] > 0 else DEFAULT_CATEGORY


def decide_confidence(llm_root_cause_text: str, rule_category: str) -> str:
    """Return "high" if the LLM's root cause matches the rule-based category, else "low"."""
    return "high" if category_of_text(llm_root_cause_text) == rule_category else "low"
