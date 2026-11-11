import { Link } from 'react-router-dom'

import { listLogFiles } from '../api/client'
import { EmptyState, ErrorState, Loading } from '../components/States'
import { useApi } from '../hooks/useApi'
import { formatBytes, formatUtc } from '../utils/format'

// Every file analyzed so far, newest first, so earlier results can be reopened.
export default function HistoryPage() {
  const { data, loading, error, reload } = useApi(listLogFiles, [])

  if (loading) return <Loading text="Loading history..." />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold tracking-tight">History</h1>
      {data.length === 0 ? (
        <EmptyState title="No files analyzed yet">
          <Link to="/" className="text-accent-soft underline">Upload a log</Link> or load a sample to get started.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/60 text-zinc-400">
              <tr>
                <th className="px-4 py-2">File</th>
                <th className="px-4">Analyzed</th>
                <th className="px-4">Size</th>
                <th className="px-4">Incidents</th>
              </tr>
            </thead>
            <tbody>
              {data.map((file) => (
                <tr key={file.id} className="border-t border-zinc-800">
                  <td className="px-4 py-2">
                    <Link to={`/files/${file.id}`} className="break-all font-medium text-accent-soft hover:underline">
                      {file.file_name}
                    </Link>
                    {file.source === 'sample' && <span className="ml-2 text-xs text-zinc-400">sample</span>}
                  </td>
                  <td className="whitespace-nowrap px-4">{formatUtc(file.uploaded_at)}</td>
                  <td className="whitespace-nowrap px-4">{formatBytes(file.size_bytes)}</td>
                  <td className="px-4 tabular-nums">{file.incident_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
