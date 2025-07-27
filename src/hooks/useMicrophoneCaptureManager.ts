
import { useState, useEffect, useCallback } from "react"
export type MicrophoneCaptureState =
  | "idle"
  | "capturing"
  | "muted"
  | "error"
  | "permission-request"
  | "permission-denied"

export interface MicrophoneCaptureStatus {
  state: MicrophoneCaptureState
  stream: MediaStream | null
  error: string | null
  permission: "granted" | "denied" | "prompt"
}

export function useMicrophoneCaptureManager() {
  const [status, setStatus] = useState<MicrophoneCaptureStatus>({
    state: "idle",
    stream: null,
    error: null,
    permission: "prompt",
  })

  // 스트림 재요청 (핫스왑)
  const hotSwapStream = useCallback(async () => {
    if (status.state === "capturing") {
      // 기존 스트림 해제
      if (status.stream) {
        status.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      }
      // 새 스트림 요청
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1 },
        })
        setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, stream, state: "capturing", permission: "granted", error: null }))
      } catch (err: any) {
        setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, stream: null, state: "error", error: err?.message || "장치 변경 후 스트림 획득 실패", permission: "denied" }))
      }
    }
  }, [status.state, status.stream])

  // devicechange 이벤트 등록
  useEffect(() => {
    const handleDeviceChange = () => {
      hotSwapStream()
    }
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange)
    }
    return () => {
      if (navigator?.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange)
      }
    }
  }, [hotSwapStream])

  // 권한 요청 (권한 상태만 미리 확인)
  const requestPermission = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, state: "error", error: "getUserMedia를 지원하지 않는 브라우저입니다.", permission: "denied" }))
      return false
    }
    try {
      setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, state: "permission-request", error: null }))
      // 권한만 요청 (실제 스트림 사용 X)
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, permission: "granted", state: "idle", error: null }))
      return true
    } catch (err: any) {
      setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, permission: "denied", state: "permission-denied", error: err?.message || "권한 요청 실패" }))
      return false
    }
  }

  // 스트림 열기 (16kHz mono)
  const openStream = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, state: "error", error: "getUserMedia를 지원하지 않는 브라우저입니다.", permission: "denied" }))
      return null
    }
    try {
      setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, state: "capturing", error: null }))
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      })
      setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, stream, state: "capturing", permission: "granted", error: null }))
      return stream
    } catch (err: any) {
      setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, stream: null, state: "error", error: err?.message || "마이크 스트림 획득 실패", permission: "denied" }))
      return null
    }
  }

  // 스트림 해제
  const stopStream = () => {
    if (status.stream) {
      status.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
    }
    setStatus((prev: MicrophoneCaptureStatus) => ({ ...prev, stream: null, state: "idle" }))
  }

  return {
    status,
    setStatus, // 내부에서만 사용 권장
    requestPermission,
    openStream,
    stopStream,
    hotSwapStream,
  }
}
