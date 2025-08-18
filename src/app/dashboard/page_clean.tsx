"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  Play,
  Pause,
  Square,
  Bell,
  Settings,
  Menu,
  Trophy,
  TrendingUp,
  Zap,
  Users,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Video,
  VideoOff,
  Activity,
  Target,
  AlertCircle,
  BarChart3,
  Database,
  LogOut,
  Watch,
  User,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useFocusSessionWithGesture } from "@/hooks/useFocusSessionWithGesture"
import { useActiveFocusSession } from "@/hooks/useFocusSession"
import CameraPermissionLayer from "@/components/CameraPermissionLayer"
import WebcamPreview from "@/components/WebcamPreview"
import FocusSessionErrorDisplay from "@/components/FocusSessionErrorDisplay"
import { FocusSessionStatus } from "@/types/focusSession"
import ProtectedRoute from "@/components/ProtectedRoute"
import MicrophonePermissionLayer from "@/components/MicrophonePermissionLayer"
import { useMicrophoneStream, useMediaStream } from "@/hooks/useMediaStream"
import HybridAudioPipeline from "@/components/HybridAudioPipeline"
import WebcamAnalysisDisplay from "@/components/WebcamAnalysisDisplay"

import { supabaseBrowser } from "@/lib/supabase/client"
import { ReportService } from "@/lib/database/reportService"
import { useSignOut, useAuth } from "@/hooks/useAuth"
import { useQuery } from "@tanstack/react-query"
import { SessionEndNotification } from "@/components/SessionEndNotification"
import ChallengeProgressCard from "@/components/social/ChallengeProgressCard"

import { useFriendRanking, useStudyRoomChallenges } from "@/hooks/useSocial"

// 실제 Zustand 스토어 사용
import { useDashboardStore } from "@/stores/dashboardStore"
import { 
  useFocusSessionState, 
  useFocusSessionActions, 
  useFocusSessionSync 
} from "@/stores/focusSessionStore"

// Import separated chart components
import {
  CircularGauge,
  MiniBarChart,
  CircularProgress,
  PulseIndicator,
  AnimatedLineChart,
  EnhancedFocusTrendChart
} from "@/components/dashboard/charts"

// Import separated social components
import {
  DashboardFriendRanking,
  DashboardTeamGoals
} from "@/components/dashboard/social"

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}

function DashboardContent() {
  // 집중세션 상태와 액션 분리
  const sessionStateState = useFocusSessionState()
  const sessionActions = useFocusSessionActions()
  const sessionSync = useFocusSessionSync()
  const signOut = useSignOut()
  const router = useRouter()
  

  
  // 현재 사용자 정보 가져오기
  const { user } = useAuth()
  

  // 로그아웃 성공 시 홈페이지로 리다이렉트
  useEffect(() => {
    if (signOut.isSuccess) {
      router.push('/')
    }
  }, [signOut.isSuccess, router])

  // 로그아웃 에러 처리
  useEffect(() => {
    if (signOut.error) {
      alert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }, [signOut.error])
  
  // 실시간 집중 상태 분석 상태
  const [currentFocusStatus, setCurrentFocusStatus] = useState<'focused' | 'distracted' | 'unknown'>('unknown')
  const [focusConfidence, setFocusConfidence] = useState(0)
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null)
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    timestamp: Date
    status: 'focused' | 'distracted'
    confidence: number
    text: string
  }>>([])
  
  // 현재 활성 세션 조회
  const { data: activeSession } = useActiveFocusSession(user?.id)
  
  // 최근 완료된 세션들 조회 (데이터 로그용)
  const { data: recentSessions } = useQuery({
    queryKey: ['recent-sessionStates', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('focus_sessionState')
        .select('*')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null) // 완료된 세션만
        .order('ended_at', { ascending: false })
        .limit(5) // 최근 5개
      
      if (error) {
        return []
      }
      
      return data || []
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false, // 윈도우 포커스 시 새로고침 비활성화
    refetchOnMount: false, // 컴포넌트 마운트 시 새로고침 비활성화
  })
  
  // elapsed 시간 업데이트
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (sessionStateState.isRunning && !sessionStateState.isPaused) {
      interval = setInterval(() => {
        sessionActions.updateElapsed()
      }, 1000)
    }
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [sessionStateState.isRunning, sessionStateState.isPaused, sessionActions])
  

  
  // 미디어 스트림과 제스처 인식을 통합 관리
  // currentSessionId는 이제 sessionSync.currentSessionId로 대체됨
  
  const mediaStream = useFocusSessionWithGesture(
    sessionStateState.isRunning, 
    sessionSync.currentSessionId || activeSession?.session_id, // 현재 세션 ID 우선 사용
    {
      frameRate: 10, // 1초에 10번 (10fps)
      enableGestureRecognition: true, // 제스처 인식 활성화
      gestureJpegQuality: 0.95
    }
  )
  const microphoneStream = useMicrophoneStream()
  const [showWebcam, setShowWebcam] = useState(false)
  const [snapshotCollapsed, setSnapshotCollapsed] = useState(false)
  const [showCameraPermissionLayer, setShowCameraPermissionLayer] = useState(false)
  
  // 세션 종료 알림 상태
  const [showSessionEndNotification, setShowSessionEndNotification] = useState(false)
  const [sessionStateEndData, setSessionEndData] = useState<{
    duration: number
    averageFocusScore: number
    sampleCount: number
    eventCount: number
    mlFeatureCount: number
    sessionId: string
  } | null>(null)
  const [showMicrophonePermissionLayer, setShowMicrophonePermissionLayer] = useState(false)
  const [showErrorDisplay, setShowErrorDisplay] = useState(false)
  const [showAudioPipeline, setShowAudioPipeline] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 1, message: "웹캠 연결이 성공적으로 완료되었습니다", type: "success" },
    { id: 2, message: "새로운 업데이트가 있습니다", type: "info" },
  ])
  


  // 에러 상태 모니터링
  useEffect(() => {
    if (mediaStream.lastSessionError && mediaStream.sessionStatus === FocusSessionStatus.ERROR) {
      setShowErrorDisplay(true)
    } else if (mediaStream.sessionStatus === FocusSessionStatus.ACTIVE) {
      // 성공적으로 복구된 경우 3초 후 에러 표시 해제
      const timer = setTimeout(() => {
        setShowErrorDisplay(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [mediaStream.lastSessionError, mediaStream.sessionStatus])

  // 집중 시작 버튼 클릭 시 권한 순차 요청
  const handleStartSession = () => {
    if (!mediaStream.isPermissionGranted) {
      setShowCameraPermissionLayer(true)
      return
    }
    if (!microphoneStream.isPermissionGranted) {
      setShowMicrophonePermissionLayer(true)
      return
    }
    // 둘 다 있으면 바로 시작
    startFocusSession()
  }

  // 집중모드 시작 함수
  const startFocusSession = async () => {
    if (!sessionStateState.isRunning) {
      try {
        
        // 1. 로컬 세션 시작
        sessionActions.startSession()
        
        // 🚀 최적화: API 라우트를 통해 세션 생성 (인증과 검증 포함)
        const response = await fetch('/api/focus-sessionState', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            goal_min: 30,
            context_tag: '집중 세션',
            sessionState_type: 'study'
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Session creation failed:', errorData)
          alert(`세션 생성에 실패했습니다: ${errorData.error}`)
          sessionActions.stopSession() // 로컬 세션도 중단
          return
        }

        const result = await response.json()
        
        // 🚀 최적화: 새로운 스토어에 세션 정보 저장
        sessionSync.setCurrentSession(result.data.session_id, result.data)
        
        // 3. 미디어 스트림 시작
        await mediaStream.startStream()
        await microphoneStream.startStream()
        setShowWebcam(true)
        setShowAudioPipeline(true)
        
      } catch (error) {
        console.error('❌ 세션 시작 중 오류:', error)
        alert('세션 시작 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    }
  }

  // DB 상태 확인 기능 제거됨

  const handleStopSession = async () => {
    try {
      const supabase = supabaseBrowser()
      
      // 1. 현재 사용자 인증 상태 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        alert('사용자 인증에 실패했습니다. 다시 로그인해주세요.')
        return
      }
      
      if (!user) {
        alert('사용자 인증 정보가 없습니다. 다시 로그인해주세요.')
        return
      }

      // 2. 활성 세션 조회 (API 사용)
      // 🚀 최적화: 활성 세션 조회 - API 우선, 빠른 실패 처리
      let activeSession = null
      try {
        const sessionStateResponse = await fetch('/api/focus-sessionState?active=true', {
          signal: AbortSignal.timeout(3000) // 3초 타임아웃
        })
        
        if (sessionStateResponse.ok) {
          const sessionData = await sessionStateResponse.json()
          activeSession = sessionData.data
        } else {
          throw new Error(`API failed: ${sessionStateResponse.status}`)
        }
              } catch (fetchError) {
        
        // API 실패 시 직접 DB 조회 (필요한 필드만)
        try {
          const { data: directSession, error: directError } = await supabase
            .from('focus_sessionState')
            .select('session_id, started_at, goal_min, context_tag, sessionState_type, notes, focus_score')
            .eq('user_id', user.id)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (!directError) {
            activeSession = directSession
          }
        } catch (dbError) {
          console.error('❌ DB 조회 중 예외 발생:', dbError)
        }
      }
      
      if (!activeSession) {
        // 활성 세션이 없어도 로컬 상태는 초기화
      } else {
        // 🚀 최적화: 세션 종료 및 리포트 생성
        try {
  
          
          const response = await fetch('/api/focus-sessionState/end', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: activeSession.session_id,
              finalFocusScore: sessionStateState.focusScore
            })
          })

          if (response.ok) {
            const result = await response.json()
            
            if (result.success) {
              const sessionDuration = Math.floor(sessionStateState.elapsed / 60) // 분 단위
              
              // 세션 종료 데이터 설정
              setSessionEndData({
                duration: sessionDuration,
                averageFocusScore: result.data.summary.averageFocusScore || sessionStateState.focusScore,
                sampleCount: result.data.summary.sampleCount,
                eventCount: result.data.summary.eventCount,
                mlFeatureCount: 0, // ML 피쳐는 더 이상 사용하지 않음
                sessionId: activeSession.session_id
              })
              
              // 알림 표시
              setShowSessionEndNotification(true)
            } else {
              console.error('세션 종료 실패:', result.error)
              alert(`세션 종료 중 오류가 발생했습니다: ${result.error}`)
            }
          } else {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
          }
        } catch (error) {
          console.error('세션 종료 처리 중 예외 발생:', error)
          alert('세션 종료 중 예상치 못한 오류가 발생했습니다. 관리자에게 문의해주세요.')
        }
      }
    } catch (error) {
      alert('세션 종료 중 오류가 발생했습니다.')
      // 오류가 발생해도 로컬 상태는 초기화
    }

    // 6. 로컬 상태 초기화 (항상 실행)
    sessionActions.stopSession()
    sessionSync.clearCurrentSession()
    mediaStream.stopStream()
    microphoneStream.stopStream()
    setShowWebcam(false)
    setShowAudioPipeline(false)
  }

  const handlePauseSession = () => {
    sessionActions.pauseSession()
    // 일시정지 시에는 스트림은 유지하되, 오디오 파이프라인과 제스처 인식만 일시정지
    // (HybridAudioPipeline과 useFocusSessionWithGesture에서 자동으로 처리됨)
  }

  const handleWebcamToggle = async () => {
    if (showWebcam) {
      setShowWebcam(false)
    } else {
      try {
        if (mediaStream.stream) {
          setShowWebcam(true)
        } else {
          // 스트림이 없으면 다시 시작
          const success = await mediaStream.startStream()
          if (success) {
            setShowWebcam(true)
          } else {
            // 실패 시 권한 레이어 표시
            setShowMicrophonePermissionLayer(true)
          }
        }
      } catch (error) {
        setShowMicrophonePermissionLayer(true)
      }
    }
  }

  const handlePermissionGranted = async () => {
    // 권한이 부여되면 카메라 스트림 시작 시도
    const success = await mediaStream.startStream()
    
    if (success) {
      setShowWebcam(true)
      setShowMicrophonePermissionLayer(false)
      
      // 세션이 아직 시작되지 않았다면 시작
      if (!sessionStateState.isRunning) {
        sessionActions.startSession()
      }
    } else {
      // 스트림 시작 실패해도 권한 레이어는 닫고 세션은 유지
      setShowMicrophonePermissionLayer(false)
    }
  }

  const handleCameraPermissionLayerClose = () => {
    setShowMicrophonePermissionLayer(false)
    
    // 권한이 확실히 부여되지 않았고, 스트림도 없는 경우에만 웹캠을 끔
    // 스트림이 있으면 권한이 부여된 것으로 간주
    if (!mediaStream.isPermissionGranted && !mediaStream.stream && !showWebcam) {
      mediaStream.stopStream()
      setShowWebcam(false)
      // 세션은 계속 유지 - 카메라 없이도 집중 세션은 가능
    }
  }

  const handleMicrophonePermissionLayerClose = () => {
    setShowMicrophonePermissionLayer(false)
    
    // 권한이 확실히 부여되지 않았고, 스트림도 없는 경우에만 마이크를 끔
    // 스트림이 있으면 권한이 부여된 것으로 간주
    if (!microphoneStream.isPermissionGranted && !microphoneStream.stream) {
      microphoneStream.stopStream()
    }
  }

  // ML 피쳐값 CSV 내보내기
  const handleMLFeaturesExport = async () => {
    if (!sessionStateState.isRunning || !activeSession?.session_id) {
      alert('활성 집중 세션이 없습니다.');
      return;
    }

    try {
      const response = await fetch(`/api/ml-features?sessionId=${activeSession.session_id}&format=csv`);
      if (!response.ok) throw new Error('ML 피쳐값 조회 실패');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ml-features-${activeSession.session_id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('ML 피쳐값 내보내기 실패');
    }
  }

  // 세션 전체 데이터 다운로드
  const handleSessionDownload = async (format: 'json' | 'csv' = 'json', sessionId?: string, includeAllUsers: boolean = false) => {
    const targetSessionId = sessionId || activeSession?.session_id;
    
    if (!targetSessionId) {
      alert('세션 ID가 없습니다.');
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        format: format,
        uid: user?.id || '',
        includeAllUsers: includeAllUsers.toString()
      });
      
      const response = await fetch(`/api/focus-sessionState/${targetSessionId}/download?${queryParams}`);
      if (!response.ok) throw new Error('세션 데이터 조회 실패');
      
      if (format === 'csv') {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = includeAllUsers 
          ? `focus-sessionState-all-users-${targetSessionId}-${new Date().toISOString().split('T')[0]}.csv`
          : `focus-sessionState-${targetSessionId}-${new Date().toISOString().split('T')[0]}.csv`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = includeAllUsers 
          ? `focus-sessionState-all-users-${targetSessionId}-${new Date().toISOString().split('T')[0]}.json`
          : `focus-sessionState-${targetSessionId}-${new Date().toISOString().split('T')[0]}.json`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      alert('세션 다운로드 실패');
    }
  }

  // 카메라 권한 승인 감지 → 마이크 권한 없으면 마이크 Layer, 있으면 바로 집중모드
  useEffect(() => {
    // ...existing code...
    if (
      showCameraPermissionLayer &&
      mediaStream.isPermissionGranted
    ) {
      setShowCameraPermissionLayer(false)
      if (!microphoneStream.isPermissionGranted) {
        setShowMicrophonePermissionLayer(true)
      } else {
        startFocusSession()
      }
    }
  }, [mediaStream.isPermissionGranted, showCameraPermissionLayer])

  // 마이크 권한 승인 감지 → 자동으로 오디오 파이프라인 시작
  useEffect(() => {
    if (
      showMicrophonePermissionLayer &&
      microphoneStream.isPermissionGranted
    ) {
      setShowMicrophonePermissionLayer(false)
      
      // 오디오 파이프라인 자동 시작
      setShowAudioPipeline(true)
      
      // 두 권한 모두 있으면 집중 세션도 시작
      if (mediaStream.isPermissionGranted && microphoneStream.isPermissionGranted) {
        startFocusSession()
      }
    }
  }, [microphoneStream.isPermissionGranted, showMicrophonePermissionLayer])

  // Mock data
  const todayStats = {
    totalTime: "2:34",
    avgScore: 87,
    distractions: 3,
    lastUpdate: "2분 전",
  }

  const weeklyData = [75, 82, 78, 85, 90, 87, 92]
  const challenges = [
    { name: "저녁 2시간 무휴대폰", progress: 72 },
    { name: "주간 20시간 집중", progress: 85 },
    { name: "연속 7일 목표달성", progress: 43 },
  ]

  const insights = [
    "18-20시 휴대폰 사용이 집중을 23% 감소시켰어요. 30분 휴식 알림 설정을 시도해보세요.",
    "오후 3시경 집중도가 가장 높습니다. 중요한 학습을 이 시간에 배치해보세요.",
    "주말 학습 시간이 평일보다 40% 적습니다. 일정한 루틴 유지를 권장합니다.",
  ]

  const friends = [
    { name: "김민수", 시간: "24:30", avatar: "KM" },
    { name: "이지은", 시간: "22:15", avatar: "PJ" },
    { name: "박준호", 시간: "20:45", avatar: "PJ" },
  ]

  // ML 피쳐값 및 집중도 점수 데이터 상태
  const [mlFeatures, setMlFeatures] = useState<any[]>([])
  const [focusScores, setFocusScores] = useState<Array<{
    ts: string
    score: number
    confidence: number
    analysis: string
  }>>([])
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false)

  // ML 피쳐값 로드 함수
  const loadMLFeatures = useCallback(async () => {
    // ML Features API 호출 비활성화 (서버 오류로 인해)
    console.log('ML Features API 호출 비활성화됨')
    setIsLoadingFeatures(false)
  }, [])

  // 활성 세션이 변경될 때마다 ML 피쳐값 로드
  useEffect(() => {
    if (activeSession?.session_id) {
      loadMLFeatures()
    }
  }, [activeSession?.session_id, loadMLFeatures])

  // 세션 시작 시 ML 피쳐값 초기화하지 않음 (데이터 유지)
  // useEffect(() => {
  //   if (sessionStateState.isRunning) {
  //     setMlFeatures([])
  //   }
  // }, [sessionStateState.isRunning])

  // AI 집중도 점수 계산 및 저장 함수 (useCallback으로 최적화)
  const calculateAndSaveFocusScore = useCallback(async () => {
  try {
    // AI 집중도 엔진 import
    const { FocusScoreEngine } = await import('@/lib/focusScoreEngine')
    
          // 현재 시간 기반 지표 계산 (elapsed 시간 사용)
      const currentTime = Date.now()
      const sessionDuration = Math.floor(sessionStateState.elapsed / 60) // 분 단위
      
      // 1초마다 실행되므로 너무 자주 로그 출력하지 않도록 제한
      if (Math.floor(sessionStateState.elapsed) % 10 === 0) { // 10초마다만 로그 출력
        console.log('📊 실시간 집중도 수집 중:', { 
          elapsed: sessionStateState.elapsed, 
        sessionDuration, 
        timestamp: new Date().toISOString() 
      })
    }
      
      // AI 집중도 계산을 위한 피쳐 데이터 구성
      const focusFeatures = {
        // 시각적 지표 (ML 피쳐값에서 가져오거나 기본값 사용)
        visual: {
          eyeStatus: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.eye_status 
            ? mlFeatures[mlFeatures.length - 1].eye_status 
            : 'OPEN',
          earValue: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.ear_value 
            ? mlFeatures[mlFeatures.length - 1].ear_value 
            : 0.3,
          headPose: {
            pitch: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.head_pose_pitch 
              ? mlFeatures[mlFeatures.length - 1].head_pose_pitch 
              : 0,
            yaw: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.head_pose_yaw 
              ? mlFeatures[mlFeatures.length - 1].head_pose_yaw 
              : 0,
            roll: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.head_pose_roll 
              ? mlFeatures[mlFeatures.length - 1].head_pose_roll 
              : 0
          },
          gazeDirection: 'FORWARD' as const
        },
        
        // 청각적 지표 (음성 분석 결과에서 가져오거나 기본값 사용)
        audio: {
          isSpeaking: false, // 실제로는 음성 분석 결과 사용
          speechContent: '',
          isStudyRelated: true,
          confidence: 0.8,
          audioLevel: 20 // 기본 조용함
        },
        
        // 행동 지표 (실제로는 사용자 활동 모니터링에서 가져와야 함)
        behavior: {
          mouseActivity: true, // 기본값
          keyboardActivity: true, // 기본값
          tabSwitches: 0, // 실제로는 탭 전환 감지 필요
          idleTime: 0 // 실제로는 유휴 시간 감지 필요
        },
        
        // 시간 지표
        time: {
          sessionDuration,
          lastBreakTime: Math.floor(sessionDuration * 0.8), // 예시값
          consecutiveFocusTime: Math.floor(sessionDuration * 0.9) // 예시값
        }
      }

      // AI 집중도 점수 계산 및 저장
      if (!activeSession?.session_id) {
        console.error('❌ 활성 세션 ID가 없습니다')
        return
      }
      
      const focusScoreResult = await FocusScoreEngine.trackFocusScore(
        activeSession.session_id,
        focusFeatures
      )

      // 로컬 상태 업데이트
      setMlFeatures(prev => [...prev, {
        ts: new Date().toISOString(),
        score: focusScoreResult.score,
        confidence: focusScoreResult.confidence,
        topic_tag: 'ai_focus_analysis',
        created_at: new Date().toISOString()
      }])

      // 집중도 점수 히스토리 업데이트
      setFocusScores(prev => [...prev, {
        ts: new Date().toISOString(),
        score: focusScoreResult.score,
        confidence: focusScoreResult.confidence,
        analysis: focusScoreResult.analysis.primaryFactor
      }])

      // 집중도 점수 업데이트
      sessionActions.updateFocusScore(focusScoreResult.score)

      console.log('🤖 AI 집중도 분석 완료:', {
        score: focusScoreResult.score,
        confidence: focusScoreResult.confidence,
        breakdown: focusScoreResult.breakdown,
        analysis: focusScoreResult.analysis
      })

    } catch (error) {
      console.error('❌ AI 집중도 점수 계산 실패:', error)
    }
  }, [activeSession?.session_id, mlFeatures, sessionActions])

  // AI 집중도 점수 계산 및 저장 (세션 중일 때)
  useEffect(() => {
    if (!sessionStateState.isRunning || !activeSession?.session_id) return
    
    // 5초마다 AI 집중도 점수 계산 및 저장 (UI 업데이트용)
    const interval = setInterval(calculateAndSaveFocusScore, 5000)
    
    return () => clearInterval(interval)
  }, [sessionStateState.isRunning, activeSession?.session_id, calculateAndSaveFocusScore])

  // 페이지 언마운트 시 정리 작업
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 정리 작업
      console.log('Dashboard 컴포넌트 정리 중...')
      
      // 소셜 관련 쿼리 캐시 정리
      if (typeof window !== 'undefined' && window.location.pathname !== '/social') {
        console.log('소셜 관련 쿼리 캐시 정리 중...')
      }
    }
  }, [])

  // 페이지 가시성 변경 시 쿼리 관리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('페이지가 숨겨짐 - 쿼리 비활성화')
      } else {
        console.log('페이지가 다시 보임 - 쿼리 활성화')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">FocusAI</span>
            </Link>

            <div className="flex items-center gap-4">
              {/* 웹캠 상태 표시 (세션 중일 때만) */}
              {sessionStateState.isRunning && mediaStream.isPermissionGranted && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${showWebcam ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-slate-600 hidden sm:inline">
                    {showWebcam ? '카메라 활성' : '카메라 비활성'}
                  </span>
                </div>
              )}

              {/* 제스처 인식 상태 표시 (세션 중일 때만) */}
              {sessionStateState.isRunning && mediaStream.isPermissionGranted && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    mediaStream.isGestureRecognitionActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-slate-600 hidden sm:inline">
                    {mediaStream.isGestureRecognitionActive ? '제스처 분석' : '제스처 대기'}
                  </span>
                  {mediaStream.gestureFramesSent > 0 && (
                    <span className="text-xs text-slate-400">
                      ({mediaStream.gestureFramesSent}프레임)
                    </span>
                  )}
                </div>
              )}

              {/* AI 집중도 점수 표시 (세션 중일 때만) */}
              {sessionStateState.isRunning && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    sessionStateState.focusScore >= 80 ? 'bg-green-500' :
                    sessionStateState.focusScore >= 60 ? 'bg-yellow-500' :
                    'bg-red-500'
                  } animate-pulse`}></div>
                  <span className="text-slate-600 hidden sm:inline">
                    AI 집중도: {sessionStateState.focusScore}점
                  </span>
                  <span className="text-xs text-slate-400">
                    (실시간)
                  </span>
                  {/* 웹캠 분석 상태 표시 */}
                  {mediaStream.webcamAnalysisResult && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>🎥 분석 중</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="w-5 h-5" />
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs"></span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  {notifications.map((notif) => (
                    <DropdownMenuItem key={notif.id} className="p-3">
                      <div className={`text-sm ${
                        notif.type === 'error' ? 'text-red-600' : 
                        notif.type === 'success' ? 'text-green-600' : 
                        'text-slate-700'
                      }`}>
                        {notif.message}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => signOut.mutate()}
                    disabled={signOut.isPending}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {signOut.isPending ? '로그아웃 중...' : '로그아웃'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Weekly Report */}
              <Link href="/report/weekly">
                <Button variant="ghost" size="sm" title="주간 리포트 보기">
                  <BarChart3 className="w-5 h-5" />
                </Button>
              </Link>

              {/* Social Features */}
              <Link href="/social">
                <Button variant="ghost" size="sm" title="소셜 스터디">
                  <Users className="w-5 h-5" />
                </Button>
              </Link>

              {/* Personal Challenges */}
              <Link href="/social/challenge">
                <Button variant="ghost" size="sm" title="개인 챌린지로 이동">
                  <Trophy className="w-5 h-5" />
                </Button>
              </Link>

              {/* Profile */}
              <Link href="/profile">
                <Button variant="ghost" size="sm" title="프로필 보기">
                  <User className="w-5 h-5" />
                </Button>
              </Link>

              {/* Watch Connection */}
              <Link href="/connect">
                <Button variant="ghost" size="sm" title="스마트워치 연동">
                  <Watch className="w-5 h-5" />
                </Button>
              </Link>

              {/* Data Log Drawer */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Open data log">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>데이터 로그</SheetTitle>
                    <SheetDescription>ML 분석 결과 및 집중도 데이터</SheetDescription>

                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {activeSession?.session_id ? (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                          <Database className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="text-lg font-semibold text-slate-800 mb-2">세션 데이터 다운로드</div>
                        <div className="text-sm text-slate-600 mb-6">
                          현재 활성 세션의 모든 데이터를 다운로드할 수 있습니다
                        </div>
                        
                        <div className="space-y-3">
                          <Button 
                            variant="default" 
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleSessionDownload('json')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            JSON 형식으로 다운로드
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => handleSessionDownload('csv')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            CSV 형식으로 다운로드
                          </Button>
                        </div>
                        
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-sm font-medium text-blue-800 mb-2">💡 전체 세션 데이터 다운로드</div>
                          <div className="text-xs text-blue-600 mb-3">
                            세션에 참여한 모든 사용자의 데이터를 다운로드하려면 아래 버튼을 사용하세요
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                              onClick={() => handleSessionDownload('json', undefined, true)}
                            >
                              전체 JSON
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                              onClick={() => handleSessionDownload('csv', undefined, true)}
                            >
                              전체 CSV
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded">
                          <div className="font-medium mb-1">📊 포함되는 데이터:</div>
                          <ul className="text-left space-y-1">
                            <li>• 세션 기본 정보 (시작/종료 시간, 집중도 등)</li>
                            <li>• ML 분석 결과 (눈 상태, 머리 방향 등)</li>
                            <li>• 제스처 인식 데이터</li>
                            <li>• 세션 상세 기록</li>
                          </ul>
                        </div>
                      </div>
                    ) : recentSessions && recentSessions.length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-center py-4">
                          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                            <Database className="w-6 h-6 text-green-600" />
                          </div>
                          <div className="text-md font-semibold text-slate-800 mb-2">최근 완료된 세션</div>
                          <div className="text-sm text-slate-600 mb-4">
                            완료된 세션의 데이터를 다운로드할 수 있습니다
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {recentSessions.map((session) => (
                            <div key={session.session_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900">
                                  {session.context_tag || `세션 ${new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {new Date(session.started_at).toLocaleDateString('ko-KR')} {new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - {new Date(session.ended_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleSessionDownload('json', session.session_id)}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                >
                                  JSON
                                </Button>
                                <Button
                                  onClick={() => handleSessionDownload('csv', session.session_id)}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                >
                                  CSV
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500">
                        <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                          <Database className="w-8 h-8 text-slate-400" />
                        </div>
                        <div className="text-sm font-medium mb-1">활성 세션이 없습니다</div>
                        <div className="text-xs mb-3">집중 세션을 시작하면 데이터 다운로드가 가능합니다</div>
                        {!sessionStateState.isRunning && (
                          <div className="text-xs text-slate-400 bg-slate-50 p-2 rounded">
                            💡 집중 세션을 시작해보세요
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Webcam Preview */}
      <AnimatePresence>
        {showWebcam && mediaStream.stream && (
          <WebcamPreview
            stream={mediaStream.stream}
            onClose={handleWebcamToggle}
          />
        )}
      </AnimatePresence>

      {/* Audio Pipeline - 세션 중일 때만 표시 */}
      <AnimatePresence>
        {showAudioPipeline && sessionStateState.isRunning && (
          <div className="fixed bottom-4 right-4 z-50">
            <HybridAudioPipeline />
          </div>
        )}
      </AnimatePresence>

      {/* Camera Permission Layer */}
      <CameraPermissionLayer
        isVisible={showCameraPermissionLayer && !mediaStream.isPermissionGranted}
        isLoading={mediaStream.isLoading}
        error={mediaStream.error}
        isPermissionDenied={mediaStream.isPermissionDenied}
        isPermissionGranted={mediaStream.isPermissionGranted}
        onRequestPermission={mediaStream.requestPermission}
        onRetry={mediaStream.retryPermission}
        onClose={handleCameraPermissionLayerClose}
        onDismissError={() => {
          mediaStream.resetError()
          setShowCameraPermissionLayer(false)
        }}
      />
      <MicrophonePermissionLayer
        isVisible={showMicrophonePermissionLayer && !microphoneStream.isPermissionGranted}
        isLoading={microphoneStream.isLoading}
        error={microphoneStream.error}
        isPermissionDenied={microphoneStream.isPermissionDenied}
        isPermissionGranted={microphoneStream.isPermissionGranted}
        onRequestPermission={microphoneStream.requestPermission}
        onRetry={microphoneStream.retryPermission}
        onClose={handleMicrophonePermissionLayerClose}
        onDismissError={() => {
          microphoneStream.resetError()
          setShowMicrophonePermissionLayer(false)
        }}
      />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Session Control Bar */}
          <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  {!sessionStateState.isRunning ? (
                    <div className="flex items-center gap-3">
                      <Button
                        size="lg"
                        onClick={handleStartSession}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        집중 시작!
                      </Button>
                      
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handlePauseSession}
                        className="px-6 py-3 rounded-xl bg-transparent"
                      >
                        {sessionStateState.isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
                        {sessionStateState.isPaused ? "재개" : "일시정지"}
                      </Button>
                      
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleStopSession}
                        className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        세션 종료
                      </Button>
                      
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <CircularGauge value={sessionStateState.focusScore} />
                    <div className="text-sm text-slate-600 mt-1">집중도</div>
                  </div>
                  <div className="text-center">
                                         <div className="text-2xl font-bold text-slate-900">{sessionStateState.formatTime(sessionStateState.elapsed)}</div>
                    <div className="text-sm text-slate-600">세션 시간</div>
                  </div>
                  
                  {/* 웹캠 토글 버튼 (세션 중일 때만 표시) */}
                  {sessionStateState.isRunning && mediaStream.isPermissionGranted && (
                    <div className="text-center">
                      <Button
                        variant={showWebcam ? "default" : "outline"}
                        size="lg"
                        onClick={handleWebcamToggle}
                        className={`px-4 py-3 rounded-xl transition-all duration-200 ${
                          showWebcam 
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg" 
                            : "bg-transparent border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50"
                        }`}
                        title={showWebcam ? "웹캠 미리보기 끄기" : "웹캠 미리보기 켜기"}
                      >
                        {showWebcam ? (
                          <Video className="w-5 h-5" />
                        ) : (
                          <VideoOff className="w-5 h-5" />
                        )}
                      </Button>
                      <div className="text-sm text-slate-600 mt-1">
                        {showWebcam ? "카메라 켜짐" : "카메라 꺼짐"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Grid */}
          <div className="grid xl:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Today's Snapshot */}
              <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900">오늘의 현황</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSnapshotCollapsed(!snapshotCollapsed)}>
                      {snapshotCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <AnimatePresence>
                  {!snapshotCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Total Focus Time */}
                          <motion.div
                            className="relative p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-100 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="text-3xl font-bold text-blue-600 mb-1">{todayStats.totalTime}</div>
                                <div className="text-sm font-medium text-blue-700">총 집중 시간</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <CircularProgress value={154} max={240} color="#3B82F6" size={48} strokeWidth={4} />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-blue-600">목표 대비</span>
                                <span className="font-semibold text-blue-700">64%</span>
                              </div>

                              <AnimatedLineChart
                                data={[2.1, 2.3, 2.2, 2.4, 2.6, 2.8, 2.9]}
                                color="#3B82F6"
                                gradientId="blueGradient"
                                height={32}
                              />

                              <div className="flex items-center justify-between text-xs text-blue-600">
                                <span>지난 7일 추이</span>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>+12%</span>
                                </div>
                              </div>
                            </div>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </motion.div>

                          {/* Average Focus Score */}
                          <motion.div
                            className="relative p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="text-3xl font-bold text-emerald-600 mb-1">{todayStats.avgScore}</div>
                                <div className="text-sm font-medium text-emerald-700">평균 집중도</div>
                              </div>
                              <div className="relative">
                                <CircularProgress value={87} max={100} color="#10B981" size={48} strokeWidth={4} />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-emerald-600">성과 등급</span>
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                                  우수
                                </Badge>
                              </div>

                              <MiniBarChart data={[82, 85, 83, 87, 89, 91, 87]} color="#10B981" label="집중도" />

                              <div className="flex items-center justify-between text-xs text-emerald-600">
                                <span>최근 세션 평균</span>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>+5점</span>
                                </div>
                              </div>
                            </div>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </motion.div>

                          {/* Distraction Events */}
                          <motion.div
                            className="relative p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl border border-orange-100 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="text-3xl font-bold text-orange-600 mb-1">{todayStats.distractions}</div>
                                <div className="text-sm font-medium text-orange-700">방해 요소</div>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <PulseIndicator count={todayStats.distractions} color="#F59E0B" size={8} />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-orange-600">주요 원인</span>
                                <span className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                                  휴대폰
                                </span>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-orange-600">휴대폰 확인</span>
                                  <span className="font-medium text-orange-700">2회</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-orange-600">자세 변화</span>
                                  <span className="font-medium text-orange-700">1회</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-orange-600">
                                <span>어제 대비</span>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 rotate-180" />
                                  <span>-2회</span>
                                </div>
                              </div>
                            </div>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </motion.div>
                        </div>

                        <div className="text-center">
                          <div className="inline-flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span>마지막 업데이트: {todayStats.lastUpdate}</span>
                          </div>
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* Focus Trend Chart */}
              <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900">주간 집중 패턴</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        상세 보기
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <EnhancedFocusTrendChart />
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      가장 취약한 시간대: 오후 2-4시
                    </Badge>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"></div>
                        <span>우수 (80+)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"></div>
                        <span>양호 (60-79)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"></div>
                        <span>개선 필요 (60미만)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Challenge Progress */}
              <ChallengeProgressCard className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm" />

              {/* AI 집중 상태 분석 히스토리 */}
              {sessionStateState.isRunning && (
                <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                      <Brain className="w-5 h-5 text-blue-500" />
                      AI 집중 분석
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 웹캠 분석 결과 - 집중도만 표시 */}
                    <WebcamAnalysisDisplay
                      analysisResult={mediaStream.webcamAnalysisResult}
                      focusFeatures={mediaStream.focusFeatures}
                      lastFocusScore={mediaStream.lastFocusScore}
                      isConnected={mediaStream.gestureWebSocketConnected}
                    />
                    
                    {/* 간단한 상태 표시 */}
                    <div className="text-center py-4 text-slate-500">
                      <Activity className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                      <div className="text-sm">웹캠을 통한 집중도 분석</div>
                      <div className="text-xs">실시간으로 집중 상태를 모니터링합니다</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Personalized Insights */}
              <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <Zap className="w-5 h-5 text-purple-500" />
                    맞춤 인사이트
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.map((insight, index) => (
                    <Alert key={index} className="border-blue-200 bg-blue-50">
                      <AlertDescription className="text-sm text-slate-700">{insight}</AlertDescription>
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Social Widget */}
          <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Users className="w-5 h-5 text-green-500" />
                소셜
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="friends" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="friends">친구 랭킹</TabsTrigger>
                  <TabsTrigger value="team">팀 목표</TabsTrigger>
                </TabsList>
                <TabsContent value="friends" className="mt-6">
                  <DashboardFriendRanking />
                </TabsContent>
                <TabsContent value="team" className="mt-6">
                  <DashboardTeamGoals />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 집중 세션 에러 표시 */}
      <FocusSessionErrorDisplay
        sessionStatus={mediaStream.sessionStatus}
        sessionErrors={mediaStream.sessionErrors}
        lastSessionError={mediaStream.lastSessionError}
        canRecoverFromError={mediaStream.canRecoverFromError}
        onRetryRecovery={mediaStream.retrySessionRecovery}
        onDismissError={() => setShowErrorDisplay(false)}
        isVisible={showErrorDisplay}
      />

      {/* 세션 종료 알림 */}
      {sessionStateEndData && (
        <SessionEndNotification
          isOpen={showSessionEndNotification}
          onClose={() => {
            setShowSessionEndNotification(false)
            setSessionEndData(null)
          }}
          onViewReport={() => {
            const today = new Date().toISOString().split('T')[0]
            window.open(`/report/daily/date/${today}`, '_blank')
            setShowSessionEndNotification(false)
            setSessionEndData(null)
          }}
          sessionData={sessionStateEndData}
        />
      )}
    </div>
  )
}
