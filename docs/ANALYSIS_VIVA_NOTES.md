# Analysis module: viva notes (Disha)

Everything lives in `backend/app/analysis/`. All thresholds are in `config.py`.
Backend calls four functions through `backend/app/services/analysis_adapter.py`:

| Function | File | Input | Output |
|---|---|---|---|
| `detect_anomalies(entries, groups)` | anomaly.py | parsed lines | `[{entry_indices, reason}]` |
| `analyze_incident(incident, use_llm)` | llm_client.py | incident context | `{root_cause, why, suggested_action, source}` |
| `find_similar_incidents(new_templates, past_incidents)` | similarity.py | template sets | `[{incident_id, file_name, similarity}]` |
| `decide_confidence(llm_root_cause_text, rule_category)` | confidence.py | LLM text + rule category | `"high"` or `"low"` |

## 1. Error spike detector: why median + MAD

We count errors per minute, giving a list like `[0, 1, 0, 2, 1, ..., 40, 1]`.

**Old way: mean + 3 × standard deviation.** The single 40 pulls the mean up and inflates the
standard deviation a lot (deviations are squared). The threshold climbs toward the spike and
can end up above it. The spike hides itself.

**Our way: median + K × MAD.**
- median = the middle value after sorting. One huge value does not move it.
- MAD (median absolute deviation) = median of `|count - median|`. Also ignores a few extreme values.
- threshold = `median + 3.5 × (1.4826 × MAD)`.
  - 1.4826 scales MAD to the size of a standard deviation for normal data, so "3.5" means the same kind of thing as "3 sigma".
  - 3.5 is the usual cut-off for the "modified z-score" (Iglewicz and Hoaglin).
- In a quiet log most minutes have 0 errors, so MAD = 0. Then every single error would count as a spike, so we use
  a floor (`MIN_MAD = 1`) and also require at least 3 errors in the minute.

Worked example (from `tests/test_analysis.py`): 57 minutes cycling 0,1,2 errors, then 1, 1, 40.
median = 1, MAD = 1, threshold = 1 + 3.5 × 1.48 ≈ 6.2 → the 40 is flagged.
Mean + 3σ ≈ 16 here, more than twice as high, and it rises further with bigger spikes.

## 2. Burst detector
Walk through errors in order. If an error is within 60 s of the previous one it joins the same burst.
A burst with 3+ errors (or any FATAL) is an anomaly. This rule is absolute, not statistical, so it also works on short logs where there are too few minutes to compute a median.

## 3. First-time error detector
The first 20% of the log counts as normal operation (the baseline). An error template that first
appears after the baseline and happens at least twice is a new problem. This catches slow, steady new
errors (e.g. after a bad deploy, one failure every 2-3 minutes) that are neither a burst nor a spike.
See `notification_bad_config.log`: only this detector catches it.

All three add **lead-up warnings**: WARN lines from the same service up to 2 minutes earlier
("pool 94% used"), because the warning is often the real trigger.

## 4. Evidence bundle and prompt-injection protection
- We never send the whole log: only facts, the top 10 templates with counts, the trigger line, and up to 40
  representative lines (lines that only differ in numbers are kept once), capped at 8000 characters.
- Masked before sending: emails, IPs, JWTs, bearer tokens, `password=`/`token=`/`api_key=` values.
- The evidence is wrapped in `<<<LOG_EVIDENCE_START>>>` / `<<<LOG_EVIDENCE_END>>>`. The system prompt says
  everything inside is raw data, never instructions.
- If a log line contains our marker text, we remove it, so the log cannot close the block early.
  `order_prompt_injection.log` tests this ("IGNORE ALL PREVIOUS INSTRUCTIONS... solar flare").

## 5. LLM client
Timeout 30 s, one retry, answer must be a JSON object with three non-empty strings (otherwise retry, then fallback),
answers cached by a hash of the prompt (same evidence → no second API call). Low temperature (0.2) is used for
OpenAI-style APIs; current Claude models don't accept a temperature setting, so we use structured JSON output plus the cache to keep answers stable.
Only the 5 most severe incidents per file use the LLM (`MAX_LLM_INCIDENTS`); the rest use the fallback.

## 6. Fallback
`fallback.py` has one row per category (database, memory, disk, network, auth, config, hardware, application)
with a root cause and suggested action; "why" is filled from the incident's own numbers. With no API key the
whole app still works.

## 7. Confidence badge
The rules picked a category from keywords. We map the LLM's root-cause text to a category with the **same keyword
dictionary**. Same → "high" (two independent methods agree). Different → "low, verify manually".
Fallback answers are always "low" because they come from the rules themselves, so there is no second opinion.

## 8. Similar incidents (Jaccard)
Each incident = set of its error templates (numbers/IPs/IDs masked, so the same error looks identical across files).
`similarity = |A ∩ B| / |A ∪ B|`. Example: {A,B,C} vs {B,C,D} → 2/4 = 0.5. Threshold 0.3, top 5, best first.
Identical re-uploads are skipped by the backend (same content hash).

## 9. Evaluation
`backend/scripts/evaluate.py` → `docs/EVALUATION.md`. Currently 9/10: the real Hadoop slice is detected but labelled
`application` instead of `network` by the keyword rules (Hadoop's wording is not in the keyword list). See the Findings section there.
