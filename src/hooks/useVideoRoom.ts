import { useState, useEffect, useCallback } from 'react'
import { useWebRTC } from './useWebRTC'
import { useSignaling } from './useSignaling'
import { useCameraStateSync } from './useCameraStateSync'
import type { RoomParticipant } from '@/types/social'

interface UseVideoRoomProps {
  roomId: string
  userId: string
  participants: RoomParticipant[]
}

interface UseVideoRoomReturn {
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  isConnecting: boolean
  error: string | null
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  startVideo: () => Promise<void>
  stopVideo: () => void
  toggleVideo: () => Promise<void>
  toggleAudio: () => Promise<void>
  connectedPeers: string[]
  // 카메라 상태 동기화 관련 추가
  participantsCameraState: { [userId: string]: { is_video_enabled: boolean; is_audio_enabled: boolean; updated_at: string } }
  syncCameraStates: () => Promise<void>
  isCameraStateLoading: boolean
  cameraStateError: string | null
}

export function useVideoRoom({
  roomId,
  userId,
  participants
}: UseVideoRoomProps): UseVideoRoomReturn {
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])

  // WebRTC 훅
  const {
    localStream,
    remoteStreams,
    isConnecting,
    error,
    startLocalStream,
    stopLocalStream,
    connectToPeer,
    disconnectFromPeer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    setSignalingCallbacks
  } = useWebRTC()

  // 카메라 상태 동기화 훅
  const {
    participantsCameraState,
    updateCameraState,
    syncCameraStates,
    isLoading: isCameraStateLoading,
    error: cameraStateError,
    handleCameraStateUpdate
  } = useCameraStateSync({
    roomId,
    userId
  })

  // 시그널링 훅 (카메라 상태 콜백 포함)
  const {
    isConnected: isSignalingConnected,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendCameraStateUpdate
  } = useSignaling({
    roomId,
    userId,
    onOffer: handleOffer,
    onAnswer: handleAnswer,
    onIceCandidate: handleIceCandidate,
    onUserJoined: (newUserId) => {
      if (newUserId !== userId && isVideoEnabled) {
        connectToPeer(newUserId)
      }
    },
    onUserLeft: (leftUserId) => {
      disconnectFromPeer(leftUserId)
      setConnectedPeers(prev => prev.filter(id => id !== leftUserId))
    },
    onCameraStateUpdate: handleCameraStateUpdate
  })

  // 시그널링 콜백 설정
  useEffect(() => {
    setSignalingCallbacks({
      onOffer: sendOffer,
      onAnswer: sendAnswer,
      onIceCandidate: sendIceCandidate
    })
  }, [setSignalingCallbacks, sendOffer, sendAnswer, sendIceCandidate])

  // 비디오 시작
  const startVideo = useCallback(async () => {
    try {
      await startLocalStream()
      setIsVideoEnabled(true)
      
      // 기존 참가자들과 연결
      participants.forEach(participant => {
        if (participant.user_id !== userId) {
          connectToPeer(participant.user_id)
        }
      })
    } catch (error) {
      console.error('비디오 시작 실패:', error)
    }
  }, [startLocalStream, participants, userId, connectToPeer])

  // 비디오 중지
  const stopVideo = useCallback(() => {
    stopLocalStream()
    setIsVideoEnabled(false)
    
    // 모든 피어 연결 해제
    participants.forEach(participant => {
      if (participant.user_id !== userId) {
        disconnectFromPeer(participant.user_id)
      }
    })
    setConnectedPeers([])
  }, [stopLocalStream, participants, userId, disconnectFromPeer])

  // 비디오 토글 (카메라 상태 동기화 포함)
  const toggleVideo = useCallback(async () => {
    try {
      if (isVideoEnabled) {
        stopVideo()
        await updateCameraState(false, isAudioEnabled)
        if (sendCameraStateUpdate) {
          sendCameraStateUpdate(false, isAudioEnabled)
        }
      } else {
        await startVideo()
        await updateCameraState(true, isAudioEnabled)
        if (sendCameraStateUpdate) {
          sendCameraStateUpdate(true, isAudioEnabled)
        }
      }
    } catch (error) {
      console.error('비디오 토글 중 오류:', error)
    }
  }, [isVideoEnabled, startVideo, stopVideo, updateCameraState, isAudioEnabled, sendCameraStateUpdate])

  // 오디오 토글 (카메라 상태 동기화 포함)
  const toggleAudio = useCallback(async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        const newAudioState = !audioTrack.enabled
        audioTrack.enabled = newAudioState
        setIsAudioEnabled(newAudioState)
        
        // 카메라 상태 동기화
        try {
          await updateCameraState(isVideoEnabled, newAudioState)
          if (sendCameraStateUpdate) {
            sendCameraStateUpdate(isVideoEnabled, newAudioState)
          }
        } catch (error) {
          console.error('오디오 상태 동기화 중 오류:', error)
        }
      }
    }
  }, [localStream, updateCameraState, isVideoEnabled, sendCameraStateUpdate])

  // 연결된 피어 목록 업데이트
  useEffect(() => {
    const peerIds = Array.from(remoteStreams.keys())
    setConnectedPeers(peerIds)
  }, [remoteStreams])

  // 참가자 변경 시 자동 연결/해제
  useEffect(() => {
    if (isVideoEnabled && isSignalingConnected) {
      const currentParticipantIds = participants.map(p => p.user_id).filter(id => id !== userId)
      const connectedParticipantIds = Array.from(remoteStreams.keys())
      
      // 새로 참가한 사용자와 연결
      currentParticipantIds.forEach(participantId => {
        if (!connectedParticipantIds.includes(participantId)) {
          connectToPeer(participantId)
        }
      })
      
      // 퇴장한 사용자와 연결 해제
      connectedParticipantIds.forEach(peerId => {
        if (!currentParticipantIds.includes(peerId)) {
          disconnectFromPeer(peerId)
        }
      })
    }
  }, [participants, isVideoEnabled, isSignalingConnected, userId, remoteStreams, connectToPeer, disconnectFromPeer])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopVideo()
    }
  }, [stopVideo])

  return {
    localStream,
    remoteStreams,
    isConnecting,
    error,
    isVideoEnabled,
    isAudioEnabled,
    startVideo,
    stopVideo,
    toggleVideo,
    toggleAudio,
    connectedPeers,
    // 카메라 상태 동기화 관련
    participantsCameraState,
    syncCameraStates,
    isCameraStateLoading,
    cameraStateError
  }
}
