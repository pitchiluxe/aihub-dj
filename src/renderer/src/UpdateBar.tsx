import React, { useEffect, useState } from 'react'
import { ArrowUpCircle, Download, Loader2, RefreshCw, X } from 'lucide-react'
import './update-bar.css'

type Phase = 'available' | 'downloading' | 'downloaded' | 'error'
interface State { phase: Phase; version?: string; percent?: number; message?: string }

/**
 * "A new version of AIHub DJ is available" — driven by the main process's
 * electron-updater events. Download → progress → Restart to update; nothing
 * installs without a click, and it stays silent when there is no update.
 * Bottom-left, over the library: away from the mixer's video monitor, whose
 * native player view would paint over anything placed on top of it.
 */
export default function UpdateBar() {
  const [state, setState] = useState<State | null>(null)
  const [hidden, setHidden] = useState(false)
  const api = (window as any).electronAPI?.updater

  useEffect(() => {
    let received = false
    let active = true
    const apply = (e: any) => {
      if (!active || !e) return
      switch (e.type) {
        case 'available': setHidden(false); setState({ phase: 'available', version: e.version }); break
        case 'progress': setState(s => ({ ...(s || { phase: 'downloading', version: e.version }), phase: 'downloading', percent: e.percent })); break
        case 'downloaded': setHidden(false); setState({ phase: 'downloaded', version: e.version }); break
        // A failed background check stays silent; a failure mid-download is shown.
        case 'error': setState(s => (s ? { phase: 'error', message: e.message, version: s.version } : s)); break
        case 'not-available': setState(null); break
      }
    }
    const off = api?.onEvent?.((e: any) => { received = true; apply(e) })
    void api?.getState?.().then((e: any) => { if (!received) apply(e) }).catch(() => {})
    return () => { active = false; try { off?.() } catch { /* noop */ } }
  }, [api])

  const download = async () => {
    setState(s => s ? { ...s, phase: 'downloading', percent: 0 } : s)
    try {
      const result = await api?.download()
      if (!result?.ok) throw new Error(result?.error || 'The update could not be downloaded. Please try again.')
    } catch (error) {
      setState(s => ({ phase: 'error', version: s?.version, message: (error as Error).message }))
    }
  }
  const install = async () => {
    try {
      const result = await api?.install()
      if (!result?.ok) throw new Error(result?.error || 'The update could not be installed. Please try again.')
    } catch (error) { setState(s => ({ phase: 'error', version: s?.version, message: (error as Error).message })) }
  }

  if (!state || hidden) return null

  const title = state.phase === 'available' ? 'Update available'
    : state.phase === 'downloading' ? 'Downloading update…'
    : state.phase === 'downloaded' ? 'Update ready'
    : 'Update failed'
  const detail = state.phase === 'available' ? `AIHub DJ ${state.version} is out.`
    : state.phase === 'downloading' ? `${state.percent ?? 0}% — keep mixing, it downloads in the background.`
    : state.phase === 'downloaded' ? `Version ${state.version} installs when you restart.`
    : state.message || 'Please try again later.'

  return (
    <div className="aihub-update" role="status" aria-live="polite">
      <div className="aihub-update-ic">
        {state.phase === 'downloading' ? <Loader2 size={18} className="spin" /> : <ArrowUpCircle size={18} />}
      </div>
      <div className="aihub-update-text">
        <b>{title}</b>
        <span>{detail}</span>
        {state.phase === 'downloading' && <div className="aihub-update-bar"><i style={{ width: `${state.percent ?? 0}%` }} /></div>}
      </div>
      {(state.phase === 'available' || (state.phase === 'error' && state.version)) && (
        <button type="button" className="aihub-update-btn" onClick={() => void download()}>
          <Download size={14} /> {state.phase === 'error' ? 'Retry download' : 'Download'}
        </button>
      )}
      {state.phase === 'downloaded' && (
        <button type="button" className="aihub-update-btn" onClick={() => void install()}>
          <RefreshCw size={14} /> Restart to update
        </button>
      )}
      <button type="button" className="aihub-update-x" onClick={() => setHidden(true)} title="Later" aria-label="Dismiss"><X size={14} /></button>
    </div>
  )
}
