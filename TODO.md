# LogSense: to-do list

Status on 2026-10-15: every feature from the team plan is built and works without an AI key.
All 69 backend tests pass and the frontend builds with no lint errors.
The items below are what is still open. Owner in brackets.

## Before the demo / submission (most important first)

- [ ] **Test with a real LLM API key** [Disha]
  Nothing has called a real LLM yet; every explanation so far came from the rule-based fallback.
  The client was only tested against a fake local server (request and answer format are correct for both providers).
  1. Copy `.env.example` to `.env` (repo root, never commit it) and set `LLM_PROVIDER`, `LLM_API_KEY`
     (plus `LLM_MODEL` and `LLM_BASE_URL` for `openai_compatible`, e.g. Groq). See README.
  2. Restart the backend (settings are read only at startup).
  3. Analyze a sample: the analysis should say "Explained by the AI model".
     If it still says "Rule-based", the backend log shows why (`LLM attempt 1 failed: ...`).
  4. Run `backend/venv/Scripts/python scripts/evaluate.py` (from `backend/`) to fill the LLM column of `docs/EVALUATION.md`.
- [ ] **Check the app against the project guide** [everyone]
  The guide was never available while this was built, so its 6-week plan, report format and
  viva expectations have not been checked.
- [ ] **Test on PostgreSQL** [Gourav]
  Everything ran on SQLite (the default). Set `DATABASE_URL=postgresql+psycopg://user:pass@host/db`,
  start the backend, upload a sample, open the dashboard and an incident.
- [ ] **Push and open pull requests** [Anusha]
  All work is local. Branches are stacked: `Gourav_BackEnd` → `feature/analysis-module` →
  `feature/api-contract` → `feature/frontend`. Pushing was disabled on purpose; re-enable with
  `git remote set-url --push origin https://github.com/dishadeepak10/LogSense.git`.
  Open one PR per branch, in that order, and get a teammate to review each.

## Known bugs / limitations

- [ ] **Parser drops some traceback lines** [Gourav]
  `backend/app/services/parser.py` line 49 only folds an exception line into its error when the
  name ends in `Error` or `Exception`. `UpstreamTimeout: ...`, `ReadTimeout: ...` and `KeyboardInterrupt`
  are counted as unrecognized lines instead. Fix the regex and add a test with a Python traceback.
- [ ] **Hadoop log labelled "application" instead of "network"** [Gourav]
  Add `no route to host` / `noroute` (and maybe `contacting rm`) to the network keywords in
  `services/incident_builder.py`. Evaluation is 9/10 because of this (`docs/EVALUATION.md`).
- [ ] **Evidence often has fewer than 20 lines** [Gourav + Disha]
  The guide asks for 20-40 representative lines. The pipeline passes only the first 30 lines of an
  incident (`SAMPLE_LINES` in `services/pipeline.py`), and the evidence builder removes near-duplicates,
  so big incidents can end up with only a handful. Pass more lines (e.g. 200), or lines from across the incident.

## Not verified yet

- [ ] Click "Download report (.md)" in the browser (the endpoint itself is tested).
- [ ] Phone-size layout (could not resize the test browser). Check at ~390 px wide.
- [ ] Mock mode after the dashboard/hero redesign: set `VITE_USE_MOCK=true` in `frontend/.env.local` and click through every page.
- [ ] Run the app on a second laptop from this zip, following README (Anusha's weekly end-to-end check).

## Decisions the team should confirm

- [ ] **Animations ignore the OS "reduce motion" setting** (asked for on purpose). People who turn it on
  usually find motion uncomfortable; consider putting the check back before the public demo
  (`src/index.css` and `src/hooks/useCountUp.js`, see git history).
- [ ] **Fallback answers always show "Low confidence"** (they come from the rules, so there is no second opinion).
  Documented in `docs/API_CONTRACT.md`.
- [ ] **Default Claude model is `claude-opus-5-5`**; change `LLM_MODEL` if the team wants a cheaper one.

## Housekeeping

- [ ] `test_logs/checkout_redis_outage.log` is a hand-made test log (one Redis outage). Keep it as a
  sample in `sample_logs/` (add it to `expected_results.json`) or delete it.
- [ ] Frontend has no automated tests (not required by the plan). A few component tests would help.
- [ ] Update `docs/API_CONTRACT.md` change log once PRs are merged.

## Only if the core is finished (team must agree first)

Compare two files · follow-up question box · thumbs up/down feedback · JSON logs · Slack alert.
