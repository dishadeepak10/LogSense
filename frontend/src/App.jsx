import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import HistoryPage from './pages/HistoryPage'
import IncidentDetailPage from './pages/IncidentDetailPage'
import IncidentListPage from './pages/IncidentListPage'
import UploadPage from './pages/UploadPage'

// Which page shows for which address.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<UploadPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/files/:fileId" element={<DashboardPage />} />
          <Route path="/files/:fileId/incidents" element={<IncidentListPage />} />
          <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
          <Route
            path="*"
            element={
              <p className="text-zinc-400">
                Page not found. <Link to="/" className="text-accent-soft underline">Go to upload</Link>
              </p>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
