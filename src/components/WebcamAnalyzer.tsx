import React, { useEffect, useRef, useState } from 'react'

type AnalysisResult = {
  weapon_detected: boolean
  gun_detected: boolean
  knife_detected: boolean
  extracted_text: string
}

export default function WebcamAnalyzer() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [streamActive, setStreamActive] = useState(false)
  
  // Make sure VITE_API_BASE_URL is set in your Render frontend environment variables!
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

  useEffect(() => {
    let isMounted = true

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStreamActive(true)
        }
        // Start the capture loop
        loopCapture()
      } catch (e) {
        setError('Unable to access webcam')
      }
    }

    const loopCapture = async () => {
      if (!isMounted) return
      await captureAndSend()
      // Wait 2 seconds AFTER the previous request finishes before capturing again
      setTimeout(loopCapture, 2000)
    }

    const captureAndSend = async () => {
      if (!videoRef.current || !canvasRef.current) return
      
      const video = videoRef.current
      const canvas = canvasRef.current
      const width = video.videoWidth || 640
      const height = video.videoHeight || 480
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)

      try {
        const res = await fetch(`${API_BASE_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: dataUrl })
        })

        if (!res.ok) {
          // Attempt to extract the detailed error from the FastAPI backend
          const errData = await res.json().catch(() => null)
          const errMsg = errData?.detail || `Server error: ${res.status}`
          throw new Error(errMsg)
        }

        const json = await res.json()
        setResult(json as AnalysisResult)
        setError(null) // Clear any previous errors on success
      } catch (e: any) {
        console.error("Fetch error:", e)
        setError(e.message || 'Analysis request failed')
      }
    }

    start()

    return () => {
      isMounted = false
      const tracks = (videoRef.current?.srcObject as MediaStream | null)?.getTracks() || []
      tracks.forEach(t => t.stop())
      setStreamActive(false)
    }
  }, [])

  return (
    <div className="analyzer-container">
      {result?.weapon_detected && (
        <div className="warning-banner">Weapon detected</div>
      )}
      {error && <div className="error-banner">{error}</div>}
      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline muted className="video" />
        <canvas ref={canvasRef} className="hidden-canvas" />
      </div>
      <div className="ocr-output">
        <h2>Extracted Text</h2>
        <div className="text-box">{result?.extracted_text || ''}</div>
      </div>
      <div className="status-row">
        <span>Stream: {streamActive ? 'Active' : 'Inactive'}</span>
        <span>Gun: {result?.gun_detected ? 'True' : 'False'}</span>
        <span>Knife: {result?.knife_detected ? 'True' : 'False'}</span>
      </div>
    </div>
  )
}
