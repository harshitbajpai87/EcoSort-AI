// src/pages/Scanner.tsx
import { useRef, useState } from 'react'
import { predictWaste, ClassificationResult } from '../api/client'
import { Upload, AlertTriangle, CheckCircle, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { submitFeedback } from '../api/feedback'
import { useAuth } from '../contexts/AuthContext'

// ── Bin colour → Tailwind classes ────────────────────────────────────────────
function binStyle(bin: string): string {
  if (bin.toLowerCase().includes('blue'))   return 'bg-blue-50 border-blue-400 text-blue-800'
  if (bin.toLowerCase().includes('green'))  return 'bg-green-50 border-green-500 text-green-800'
  if (bin.toLowerCase().includes('teal'))   return 'bg-teal-50 border-teal-500 text-teal-800'
  if (bin.toLowerCase().includes('red'))    return 'bg-rose-50 border-rose-500 text-rose-800'
  if (bin.toLowerCase().includes('yellow')) return 'bg-yellow-50 border-yellow-500 text-yellow-800'
  if (bin.toLowerCase().includes('black'))  return 'bg-gray-100 border-gray-500 text-gray-800'
  return 'bg-gray-50 border-gray-300 text-gray-800'
}

function binEmoji(bin: string): string {
  if (bin.toLowerCase().includes('blue'))   return '🔵'
  if (bin.toLowerCase().includes('green'))  return '🟢'
  if (bin.toLowerCase().includes('teal'))   return '🩵'
  if (bin.toLowerCase().includes('red'))    return '🔴'
  if (bin.toLowerCase().includes('yellow')) return '🟡'
  return '🗑️'
}

function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 0.85 ? 'bg-emerald-500' : pct >= 0.65 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
      <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${pct * 100}%` }} />
    </div>
  )
}

const WASTE_CATEGORIES = [
  'plastic','paper','cardboard','glass','metal',
  'organic','textile','e-waste','battery','hazardous',
]

export default function Scanner() {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile]       = useState<File | null>(null)
  const [result, setResult]   = useState<ClassificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  // Feedback state
  const [feedbackGiven, setFeedbackGiven]   = useState(false)
  const [feedbackMsg, setFeedbackMsg]       = useState<string | null>(null)
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctedCat, setCorrectedCat]     = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    setPreview(URL.createObjectURL(f))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    setPreview(URL.createObjectURL(f))
  }

  async function handleClassify() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await predictWaste(file)
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleFeedback(isCorrect: boolean) {
    if (!result || feedbackGiven) return
    const payload = {
      scan_id: result.scan_id,
      predicted_category: result.predicted_category,
      is_correct: isCorrect,
      corrected_category: isCorrect ? undefined : (correctedCat || undefined),
    }
    try {
      await submitFeedback(payload)
      setFeedbackGiven(true)
      setFeedbackMsg(isCorrect ? '✅ Thanks! +10 EcoPoints for your feedback.' : '🔄 Thanks for the correction! +15 EcoPoints.')
      setShowCorrection(false)
    } catch {
      setFeedbackMsg('Could not save feedback right now.')
    }
  }

  function handleReset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    setFeedbackGiven(false)
    setFeedbackMsg(null)
    setShowCorrection(false)
    setCorrectedCat('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Scanner</h1>
        <p className="text-gray-500 mt-1">Upload a photo of any waste item to get instant AI classification.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-emerald-300 rounded-2xl p-8 flex flex-col items-center
                   gap-3 cursor-pointer hover:bg-emerald-50 transition-colors"
      >
        {preview ? (
          <img src={preview} alt="preview" className="max-h-56 rounded-xl object-contain shadow" />
        ) : (
          <>
            <Upload size={36} className="text-emerald-400" />
            <p className="text-sm text-gray-500">Drag & drop an image here, or <span className="text-emerald-600 font-medium">click to browse</span></p>
            <p className="text-xs text-gray-400">Supported: PNG, JPG, JPEG, WebP — max 10 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {file && (
          <button
            onClick={handleClassify}
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300
                       text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw size={18} className="animate-spin" /> : null}
            {loading ? 'Classifying…' : 'Classify Waste'}
          </button>
        )}
        {(file || result) && (
          <button
            onClick={handleReset}
            className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-600
                       hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            Reset
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="rounded-2xl border border-gray-200 shadow overflow-hidden">
          {/* Category header */}
          <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">Predicted Category</p>
              <p className="text-xl font-bold capitalize">{result.predicted_category}</p>
            </div>
            {result.is_hazardous
              ? <AlertTriangle size={28} className="text-yellow-300" />
              : <CheckCircle   size={28} className="text-emerald-300" />}
          </div>

          {/* Confidence */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Confidence</span>
              <span className="font-semibold text-gray-700">{result.confidence_pct}</span>
            </div>
            <ConfidenceBar pct={result.confidence} />
            <p className="text-xs text-gray-400 mt-1">Source: {result.source}</p>
          </div>

          {/* Bin card */}
          <div className={`mx-5 my-4 border-2 rounded-xl px-4 py-3 ${binStyle(result.recommended_bin)}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-0.5">Recommended Bin</p>
            <p className="text-lg font-bold">{binEmoji(result.recommended_bin)} {result.recommended_bin}</p>
          </div>

          {/* Instructions */}
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Preparation Steps</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{result.instructions}</p>
          </div>

          {/* Feedback widget */}
          {user && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Was this correct?</p>
              {!feedbackGiven && !showCorrection && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleFeedback(true)}
                    className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg px-3 py-1.5 text-sm transition-colors"
                  >
                    <ThumbsUp size={14} /> Yes, correct
                  </button>
                  <button
                    onClick={() => setShowCorrection(true)}
                    className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg px-3 py-1.5 text-sm transition-colors"
                  >
                    <ThumbsDown size={14} /> No, it's wrong
                  </button>
                </div>
              )}
              {showCorrection && !feedbackGiven && (
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={correctedCat}
                    onChange={e => setCorrectedCat(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select correct category…</option>
                    {WASTE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={() => handleFeedback(false)}
                    disabled={!correctedCat}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg px-3 py-1.5 text-sm transition-colors"
                  >
                    Submit Correction
                  </button>
                  <button onClick={() => setShowCorrection(false)} className="text-gray-500 hover:text-gray-700 text-sm px-2">Cancel</button>
                </div>
              )}
              {feedbackMsg && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-2">
                  {feedbackMsg}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
