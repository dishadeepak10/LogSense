# LogSense frontend (Anusha)

React (Vite) + Tailwind CSS + Recharts + Axios + React Router.

## Run

```
cd frontend
npm install
npm run dev            # http://localhost:5173 (backend must run on http://localhost:8000)
```

No backend at hand? Create `frontend/.env.local` with `VITE_USE_MOCK=true`. The app then reads
`src/mock/*.json` (copied from real API responses, see `docs/API_CONTRACT.md`) and shows a yellow
"Mock mode" bar. `.env.local` is ignored by git.

`npm run build` makes a production build, `npm run lint` checks the code.

## Pages

| Address | Page | What it shows |
|---|---|---|
| `/` | Upload | drag-and-drop or choose a file, progress, "Load sample log" |
| `/files/:id` | Dashboard | summary tiles, errors/warnings chart (with table view), top 3 incidents, most frequent errors, report download |
| `/files/:id/incidents` | Incident list | every incident with severity and category filters |
| `/incidents/:id` | Incident details | AI analysis + confidence badge, failure timeline, similar earlier incidents, candidate trigger, log lines |
| `/history` | History | every analyzed file, to reopen it |

Every page has a loading state, an error state with "Try again", and an empty state.

## How the code is organized

```
src/
  api/client.js        every backend call (and the mock switch) in one place
  hooks/useApi.js      loads data for a page: { data, loading, error, reload }
  pages/               one file per page (above)
  components/          pieces used by the pages (badges, chart, timeline, ...)
  utils/format.js      time/size formatting, severity colors
  mock/                JSON copied from the real API, for building without a backend
```

Time rule (from the contract): times read from the log have no timezone and are shown exactly as
written (`formatLogTime`); times the server created end with `Z` and are shown in local time (`formatUtc`).
