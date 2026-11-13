// All calls to the backend live in this one file.
// Pages never use axios directly, so switching between mock data and the
// real API (VITE_USE_MOCK in .env.local) only changes this file's behaviour.
import axios from 'axios'

import analysisResult from '../mock/analysisResult.json'
import incidentDetail from '../mock/incidentDetail.json'
import logFiles from '../mock/logFiles.json'
import samples from '../mock/samples.json'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) || 100
export const ALLOWED_EXTENSIONS = ['.log', '.txt']

const api = axios.create({ baseURL: API_URL, timeout: 300000 })

// Pretend the network takes a moment, so loading states are visible in mock mode.
function mock(data, ms = 400) {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), ms))
}

// ---------- Endpoints (see docs/API_CONTRACT.md) ----------

export async function uploadLog(file, onProgress) {
  if (USE_MOCK) return mock({ ...analysisResult, file: { ...analysisResult.file, file_name: file.name } }, 1200)
  const form = new FormData()
  form.append('file', file)
  const response = await api.post('/api/logs/upload', form, {
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  return response.data
}

export async function listSamples() {
  if (USE_MOCK) return mock(samples)
  return (await api.get('/api/samples')).data
}

export async function loadSample(name) {
  if (USE_MOCK) return mock(analysisResult, 1200)
  return (await api.post(`/api/samples/${encodeURIComponent(name)}/load`)).data
}

export async function listLogFiles() {
  if (USE_MOCK) return mock(logFiles)
  return (await api.get('/api/logs')).data
}

export async function getLogFile(fileId) {
  if (USE_MOCK) return mock(analysisResult)
  return (await api.get(`/api/logs/${fileId}`)).data
}

export async function getIncident(incidentId) {
  if (USE_MOCK) {
    // The mock has full details for one incident; others reuse their list entry.
    const fromList = analysisResult.incidents.find((i) => String(i.id) === String(incidentId))
    if (String(incidentId) === String(incidentDetail.id) || !fromList) return mock(incidentDetail)
    return mock({ ...fromList, total_entries: 0, entries: [] })
  }
  return (await api.get(`/api/incidents/${incidentId}`)).data
}

// Downloads the Markdown report as a file in the browser.
export async function downloadReport(fileId) {
  let blob
  let fileName = `logsense-report-${fileId}.md`
  if (USE_MOCK) {
    blob = new Blob(['# LogSense report (mock)\n\nThis is mock data.\n'], { type: 'text/markdown' })
  } else {
    const response = await api.get(`/api/logs/${fileId}/report`, { responseType: 'blob' })
    blob = response.data
    const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] || '')
    if (match) fileName = match[1]
  }
  // Make a temporary link to the file and click it.
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Downloads a PDF report generated in the browser from the markdown content.
export async function downloadPdf(fileId) {
  // Fetch the markdown blob from the backend
  let mdText
  let fileName = `logsense-report-${fileId}.pdf`
  if (USE_MOCK) {
    mdText = '# LogSense report (mock)\n\nThis is mock data.\n'
  } else {
    const response = await api.get(`/api/logs/${fileId}/report`, { responseType: 'text' })
    mdText = response.data
    const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] || '')
    if (match) fileName = match[1].replace(/\.md$/, '.pdf')
  }
  // Build an HTML page from the markdown and open a print dialog
  const html = buildPrintHtml(mdText, fileName)
  const win = window.open('', '_blank')
  if (!win) return // blocked by popup blocker
  win.document.write(html)
  win.document.close()
  win.addEventListener('load', () => {
    win.focus()
    win.print()
  })
}

function buildPrintHtml(mdText, title) {
  // Convert markdown headings, bold, bullets, code blocks, and tables to HTML
  function mdToHtml(md) {
    return md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/^(?!<[a-z])/gm, '')
      // Simple table: | col | col | -> <table>
      .replace(/^\|(.+)\|$/gm, (line) => {
        const cells = line.split('|').slice(1, -1)
        const isHeader = cells.some(c => /^\s*[-:]+\s*$/.test(c))
        if (isHeader) return ''
        const tag = 'td'
        return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>'
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>')
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; color: #111; font-size: 14px; line-height: 1.6; }
  h1 { font-size: 1.8em; border-bottom: 2px solid #10b981; padding-bottom: 0.3em; color: #064e3b; }
  h2 { font-size: 1.3em; margin-top: 1.5em; color: #065f46; border-bottom: 1px solid #d1fae5; padding-bottom: 0.2em; }
  h3 { font-size: 1.1em; color: #047857; }
  code { background: #f3f4f6; padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.88em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d1d5db; padding: 0.4em 0.75em; text-align: left; }
  tr:nth-child(even) { background: #f9fafb; }
  ul { padding-left: 1.5em; }
  li { margin: 0.2em 0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body><p>${mdToHtml(mdText)}</p></body>
</html>`
}

// ---------- Errors ----------

// Turns any axios error into one sentence we can show to the user.
export function errorMessage(error) {
  if (error?.response) {
    const detail = error.response.data?.detail
    if (typeof detail === 'string') return detail
    if (error.response.status === 404) return 'Not found.'
    if (error.response.status === 422) return 'The request was not valid. Please check the file and try again.'
    return `The server returned an error (${error.response.status}).`
  }
  if (error?.code === 'ECONNABORTED') return 'The request took too long. Please try again.'
  if (error?.request) return `Cannot reach the backend at ${API_URL}. Is it running?`
  return error?.message || 'Something went wrong.'
}
