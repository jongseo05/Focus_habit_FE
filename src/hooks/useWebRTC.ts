import { useState, useEffect, useRef, useCallback } from 'react'

interface WebRTCConfig {
  iceServers: RTCIceServer[]
}

interface SignalingCallbacks {
  onOffer?: (to: string, offer: RTCSessionDescriptionInit) => void
  onAnswer?: (to: string, answer: RTCSessionDescriptionInit) => void
  onIceCandidate?: (to: string, candidate: RTCIceCandidateInit) => void
}

interface UseWebRTCReturn {
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  isConnecting: boolean
  error: string | null
  startLocalStream: () => Promise<void>
  stopLocalStream: () => void
  connectToPeer: (peerId: string) => Promise<void>
  disconnectFromPeer: (peerId: string) => void
  sendMessage: (peerId: string, message: any) => void
  handleOffer: (peerId: string, offer: RTCSessionDescriptionInit) => Promise<void>
  handleAnswer: (peerId: string, answer: RTCSessionDescriptionInit) => Promise<void>
  handleIceCandidate: (peerId: string, candidate: RTCIceCandidateInit) => Promise<void>
  setSignalingCallbacks: (callbacks: SignalingCallbacks) => void
}

const defaultConfig: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}

export function useWebRTC(config: WebRTCConfig = defaultConfig): UseWebRTCReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const signalingCallbacks = useRef<SignalingCallbacks>({})

  // 시그널링 콜백 설정
  const setSignalingCallbacks = useCallback((callbacks: SignalingCallbacks) => {
    signalingCallbacks.current = callbacks
  }, [])

  // 로컬 스트림 시작
  const startLocalStream = useCallback(async () => {
    try {
      setError(null)
      setIsConnecting(true)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      
      localStreamRef.current = stream
      setLocalStream(stream)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '카메라/마이크 접근 권한을 얻을 수 없습니다.'
      setError(errorMessage)
      console.error('로컬 스트림 시작 실패:', err)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  // 로컬 스트림 중지
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
      setLocalStream(null)
    }
  }, [])

  // 피어 연결 생성
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(config)
    
    // 로컬 스트림 추가
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }
    
    // 원격 스트림 처리
    pc.ontrack = (event) => {
      const stream = event.streams[0]
      if (stream) {
        setRemoteStreams(prev => new Map(prev.set(peerId, stream)))
      }
    }
    
    // ICE 후보 처리
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // ICE 후보를 시그널링 서버로 전송
        if (signalingCallbacks.current.onIceCandidate) {
          signalingCallbacks.current.onIceCandidate(peerId, event.candidate)
        }
        console.log('ICE 후보 생성:', event.candidate)
      }
    }
    
    // 연결 상태 변경
    pc.onconnectionstatechange = () => {
      console.log(`피어 ${peerId} 연결 상태:`, pc.connectionState)
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        disconnectFromPeer(peerId)
      }
    }
    
    return pc
  }, [config])

  // 피어와 연결
  const connectToPeer = useCallback(async (peerId: string) => {
    try {
      if (peerConnections.current.has(peerId)) {
        console.log(`이미 ${peerId}와 연결되어 있습니다.`)
        return
      }
      
      const pc = createPeerConnection(peerId)
      peerConnections.current.set(peerId, pc)
      
      // Offer 생성 및 전송
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      // Offer를 시그널링 서버로 전송
      if (signalingCallbacks.current.onOffer) {
        signalingCallbacks.current.onOffer(peerId, offer)
      }
      
      console.log(`${peerId}와의 연결 시작`)
    } catch (err) {
      console.error(`${peerId}와의 연결 실패:`, err)
      setError(`피어 연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    }
  }, [createPeerConnection])

  // 피어 연결 해제
  const disconnectFromPeer = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId)
    if (pc) {
      pc.close()
      peerConnections.current.delete(peerId)
      
      // 원격 스트림 제거
      setRemoteStreams(prev => {
        const newMap = new Map(prev)
        newMap.delete(peerId)
        return newMap
      })
      
      console.log(`${peerId}와의 연결 해제`)
    }
  }, [])

  // 메시지 전송 (데이터 채널을 통한 텍스트 메시지)
  const sendMessage = useCallback((peerId: string, message: any) => {
    const pc = peerConnections.current.get(peerId)
    if (pc && pc.connectionState === 'connected') {
      // 데이터 채널을 통한 메시지 전송 구현
      console.log(`${peerId}에게 메시지 전송:`, message)
    }
  }, [])

  // Offer 처리 (다른 피어로부터 받은 Offer에 대한 응답)
  const handleOffer = useCallback(async (peerId: string, offer: RTCSessionDescriptionInit) => {
    try {
      let pc = peerConnections.current.get(peerId)
      
      if (!pc) {
        pc = createPeerConnection(peerId)
        peerConnections.current.set(peerId, pc)
      }
      
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      // Answer를 시그널링 서버로 전송
      if (signalingCallbacks.current.onAnswer) {
        signalingCallbacks.current.onAnswer(peerId, answer)
      }
      
      console.log(`${peerId}의 Offer 처리 완료`)
    } catch (err) {
      console.error(`${peerId}의 Offer 처리 실패:`, err)
    }
  }, [createPeerConnection])

  // Answer 처리 (다른 피어로부터 받은 Answer에 대한 응답)
  const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnections.current.get(peerId)
      if (pc) {
        await pc.setRemoteDescription(answer)
        console.log(`${peerId}의 Answer 처리 완료`)
      }
    } catch (err) {
      console.error(`${peerId}의 Answer 처리 실패:`, err)
    }
  }, [])

  // ICE 후보 처리
  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnections.current.get(peerId)
      if (pc) {
        await pc.addIceCandidate(candidate)
        console.log(`${peerId}의 ICE 후보 처리 완료`)
      }
    } catch (err) {
      console.error(`${peerId}의 ICE 후보 처리 실패:`, err)
    }
  }, [])

  // 정리
  useEffect(() => {
    return () => {
      // 모든 피어 연결 해제
      peerConnections.current.forEach((pc, peerId) => {
        pc.close()
      })
      peerConnections.current.clear()
      
      // 로컬 스트림 정리
      stopLocalStream()
    }
  }, [stopLocalStream])

  return {
    localStream,
    remoteStreams,
    isConnecting,
    error,
    startLocalStream,
    stopLocalStream,
    connectToPeer,
    disconnectFromPeer,
    sendMessage,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    setSignalingCallbacks
  }
}
