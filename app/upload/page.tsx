'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      setFile(files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Upload failed')
        return
      }

      const result = await res.json()
      setSuccess(`Successfully uploaded ${result.employeeCount} employees (${result.discrepancyCount} discrepancies detected)`)
      setFile(null)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container flex items-center justify-between py-4">
          <Link href="/dashboard" className="text-2xl font-bold">Payroll Dashboard</Link>
        </div>
      </nav>

      <div className="container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="card">
            <h1 className="text-3xl font-bold mb-6">Upload Paychex PDF</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-input"
                  disabled={uploading}
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <div className="text-5xl mb-3">📄</div>
                  <p className="text-xl font-semibold mb-2">
                    {file ? file.name : 'Drop PDF here or click to select'}
                  </p>
                  <p className="text-gray-600">Paychex payroll journal PDF</p>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !file}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload & Process'}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t">
              <h3 className="font-bold mb-3">Expected Format</h3>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Paychex Payroll Journal PDF</li>
                <li>Employee names and IDs</li>
                <li>Hours, earnings, withholdings, and deductions</li>
                <li>Department and net pay information</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
