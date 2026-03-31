'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
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

    const initialResults: UploadResult[] = files.map(f => ({
      fileName: f.name,
      status: 'pending',
    }))
    setResults(initialResults)

    for (let i = 0; i < files.length; i++) {
      // Update status to uploading
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'uploading' } : r))

      try {
        const formData = new FormData()
        formData.append('file', files[i])

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          setResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', message: err.error || 'Upload failed' } : r
          ))
        } else {
          const result = await res.json()
          setResults(prev => prev.map((r, idx) =>
            idx === i ? {
              ...r,
              status: 'success',
              employeeCount: result.employeeCount,
              discrepancyCount: result.discrepancyCount,
              message: `${result.employeeCount} employees, ${result.discrepancyCount} discrepancies`,
            } : r
          ))
        }
      } catch {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', message: 'Upload failed' } : r
        ))
      }
    }

    setUploading(false)
    setAllDone(true)
  }

  const successCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container px-4 sm:px-6 flex items-center justify-between py-3 sm:py-4">
          <Link href="/dashboard" className="text-lg sm:text-2xl font-bold">Payroll Dashboard</Link>
          <Link href="/dashboard" className="text-sm sm:text-base text-blue-500 hover:underline">Back to Dashboard</Link>
        </div>
      </nav>

      <div className="container px-4 sm:px-6 py-6 sm:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="card">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Upload Paychex PDFs</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input"
                  disabled={uploading}
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <div className="text-5xl mb-3">📄</div>
                  <p className="text-xl font-semibold mb-2">
                    {files.length === 0
                      ? 'Drop PDFs here or click to select'
                      : `${files.length} file${files.length > 1 ? 's' : ''} selected`}
                  </p>
                  <p className="text-gray-600">Select multiple Paychex payroll journal PDFs at once</p>
                </label>
              </div>

              {/* File list */}
              {files.length > 0 && !uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-gray-700">Files to upload:</h3>
                    <button type="button" onClick={clearAll} className="text-sm text-red-500 hover:underline">
                      Clear all
                    </button>
                  </div>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                      <span className="truncate flex-1 mr-2">{f.name}</span>
                      <span className="text-gray-400 mr-3 whitespace-nowrap">{(f.size / 1024).toFixed(0)} KB</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 font-bold">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload progress / results */}
              {results.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-gray-700">Progress:</h3>
                  {results.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                      r.status === 'success' ? 'bg-green-50 border border-green-200' :
                      r.status === 'error' ? 'bg-red-50 border border-red-200' :
                      r.status === 'uploading' ? 'bg-blue-50 border border-blue-200' :
                      'bg-gray-50 border border-gray-200'
                    }`}>
                      <span className="truncate flex-1 mr-2">
                        {r.status === 'uploading' && '⏳ '}
                        {r.status === 'success' && '✅ '}
                        {r.status === 'error' && '❌ '}
                        {r.status === 'pending' && '⏸ '}
                        {r.fileName}
                      </span>
                      <span className={`text-xs whitespace-nowrap ${
                        r.status === 'success' ? 'text-green-700' :
                        r.status === 'error' ? 'text-red-700' :
                        r.status === 'uploading' ? 'text-blue-700' :
                        'text-gray-500'
                      }`}>
                        {r.status === 'uploading' ? 'Processing...' :
                         r.status === 'pending' ? 'Waiting...' :
                         r.message || ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary after all done */}
              {allDone && (
                <div className={`rounded px-4 py-3 text-sm font-medium ${
                  errorCount === 0 ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                }`}>
                  {errorCount === 0
                    ? `All ${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully!`
                    : `${successCount} succeeded, ${errorCount} failed`}
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="ml-4 underline hover:no-underline"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || files.length === 0}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {uploading
                  ? `Uploading ${results.filter(r => r.status === 'uploading').length > 0 ? `(${results.filter(r => r.status !== 'pending').length}/${files.length})` : '...'}`
                  : `Upload & Process ${files.length > 0 ? `(${files.length} file${files.length > 1 ? 's' : ''})` : ''}`}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t">
              <h3 className="font-bold mb-3">Expected Format</h3>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Paychex Payroll Journal PDF</li>
                <li>Select multiple files at once or add them one by one</li>
                <li>Files are processed sequentially in order</li>
                <li>Upload oldest payroll first for accurate discrepancy detection</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
