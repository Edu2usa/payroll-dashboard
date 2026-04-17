'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Clock, X } from 'lucide-react'

interface UploadResult {
  fileName: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  message?: string
  employeeCount?: number
  discrepancyCount?: number
}

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<UploadResult[]>([])
  const [uploading, setUploading] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (dropped.length > 0) {
      setFiles(prev => [...prev, ...dropped])
      setAllDone(false)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length > 0) {
      setFiles(prev => [...prev, ...selected])
      setAllDone(false)
    }
    e.target.value = ''
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearAll = useCallback(() => {
    setFiles([])
    setResults([])
    setAllDone(false)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return

    setUploading(true)
    setAllDone(false)

    const initialResults: UploadResult[] = files.map(f => ({ fileName: f.name, status: 'pending' }))
    setResults(initialResults)

    for (let i = 0; i < files.length; i++) {
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'uploading' } : r))

      try {
        const formData = new FormData()
        formData.append('file', files[i])

        const res = await fetch('/api/upload', { method: 'POST', body: formData })

        if (!res.ok) {
          const err = await res.json()
          setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', message: err.error || 'Upload failed' } : r))
        } else {
          const result = await res.json()
          setResults(prev => prev.map((r, idx) => idx === i ? {
            ...r, status: 'success',
            employeeCount: result.employeeCount,
            discrepancyCount: result.discrepancyCount,
            message: `${result.employeeCount} employees, ${result.discrepancyCount} discrepancies`,
          } : r))
        }
      } catch {
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', message: 'Upload failed' } : r))
      }
    }

    setUploading(false)
    setAllDone(true)
  }

  const successCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status === 'error').length

  const statusIcon = (status: UploadResult['status']) => {
    if (status === 'uploading') return <Loader2 size={15} className="animate-spin text-blue-600" />
    if (status === 'success') return <CheckCircle2 size={15} className="text-emerald-600" />
    if (status === 'error') return <XCircle size={15} className="text-red-500" />
    return <Clock size={15} className="text-gray-400" />
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-8 pt-16 lg:pt-8">

          <div className="page-header">
            <h1>Upload Payroll PDFs</h1>
            <p>Import Paychex payroll journal PDFs to populate the dashboard</p>
          </div>

          <div className="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-150 ${
                  dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/40'
                }`}
              >
                <input type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" id="file-input" disabled={uploading} />
                <label htmlFor="file-input" className="cursor-pointer block">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-blue-100 rounded-2xl">
                      <Upload size={28} className="text-blue-600" />
                    </div>
                  </div>
                  <p className="text-base font-semibold text-gray-800 mb-1">
                    {files.length === 0 ? 'Drop PDFs here or click to select' : `${files.length} file${files.length > 1 ? 's' : ''} selected`}
                  </p>
                  <p className="text-sm text-gray-500">Select multiple Paychex payroll journal PDFs</p>
                </label>
              </div>

              {/* File list */}
              {files.length > 0 && !uploading && (
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Files to upload</p>
                    <button type="button" onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                        <FileText size={15} className="text-blue-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate flex-1">{f.name}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{(f.size / 1024).toFixed(0)} KB</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              {results.length > 0 && (
                <div className="card p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Progress</p>
                  <div className="space-y-2">
                    {results.map((r, i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border text-sm ${
                        r.status === 'success' ? 'bg-emerald-50 border-emerald-200' :
                        r.status === 'error' ? 'bg-red-50 border-red-200' :
                        r.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex-shrink-0">{statusIcon(r.status)}</div>
                        <span className="truncate flex-1 font-medium text-gray-800">{r.fileName}</span>
                        <span className={`text-xs whitespace-nowrap ${
                          r.status === 'success' ? 'text-emerald-700' :
                          r.status === 'error' ? 'text-red-700' :
                          r.status === 'uploading' ? 'text-blue-700' : 'text-gray-500'
                        }`}>
                          {r.status === 'uploading' ? 'Processing...' : r.status === 'pending' ? 'Waiting...' : r.message || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done summary */}
              {allDone && (
                <div className={`rounded-xl px-4 py-3.5 text-sm font-medium flex items-center justify-between ${
                  errorCount === 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}>
                  <span>
                    {errorCount === 0
                      ? `${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`
                      : `${successCount} succeeded, ${errorCount} failed`}
                  </span>
                  <button type="button" onClick={() => router.push('/dashboard')} className="underline hover:no-underline text-sm ml-4">
                    Go to Dashboard
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || files.length === 0}
                className="btn btn-primary w-full py-2.5"
              >
                {uploading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Uploading ({results.filter(r => r.status !== 'pending').length}/{files.length})...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Upload & Process{files.length > 0 ? ` (${files.length} file${files.length > 1 ? 's' : ''})` : ''}
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm font-semibold text-blue-800 mb-2">Expected Format</p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Paychex Payroll Journal PDF</li>
                <li>• Select multiple files at once or add one by one</li>
                <li>• Files are processed sequentially in order</li>
                <li>• Upload oldest payroll first for accurate discrepancy detection</li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
