'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Trophy, 
  Link, 
  Unlink, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react'
import type { GroupChallenge } from '@/types/social'

interface ChallengeTabProps {
  linkedChallenge: GroupChallenge | null
  availableChallenges: GroupChallenge[]
  isHost: boolean
  challengeLoading: boolean
  onLinkChallenge: (challengeId: string | null) => Promise<void>
  onShowLinkModal: () => void
}

export function ChallengeTab({
  linkedChallenge,
  availableChallenges,
  isHost,
  challengeLoading,
  onLinkChallenge,
  onShowLinkModal
}: ChallengeTabProps) {
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>('')

  const handleLinkChallenge = async () => {
    if (selectedChallengeId) {
      await onLinkChallenge(selectedChallengeId)
      setSelectedChallengeId('')
    }
  }

  const handleUnlinkChallenge = async () => {
    await onLinkChallenge(null)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-green-800">
            <Trophy className="h-5 w-5 text-green-600" />
            🏆 그룹 챌린지
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 연동된 챌린지 표시 */}
          {linkedChallenge ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Trophy className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">{linkedChallenge.title}</h3>
                    <p className="text-sm text-green-600">{linkedChallenge.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-green-700">
                                              <span>목표: {linkedChallenge.target_value} {linkedChallenge.type}</span>
                                             <span>기간: {Math.ceil((new Date(linkedChallenge.end_date).getTime() - new Date(linkedChallenge.start_date).getTime()) / (1000 * 60 * 60 * 24))}일</span>
                      <span>마감: {new Date(linkedChallenge.end_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    연동됨
                  </Badge>
                  {isHost && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnlinkChallenge}
                      disabled={challengeLoading}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      {challengeLoading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4 mr-1" />
                      )}
                      연동 해제
                    </Button>
                  )}
                </div>
              </div>

              {/* 챌린지 진행 상황 */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  진행 상황
                </h4>
                <div className="text-sm text-blue-700">
                  <p>이 챌린지는 스터디룸과 연동되어 있습니다.</p>
                  <p className="mt-1">스터디룸에서 공부하는 동안 챌린지 진행도가 자동으로 업데이트됩니다.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">연동된 챌린지가 없습니다</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {isHost ? '호스트가 챌린지를 연동하면 여기서 진행 상황을 확인할 수 있습니다.' : '호스트가 챌린지를 연동할 때까지 기다려주세요.'}
                </p>
                {isHost && (
                  <Button
                    onClick={onShowLinkModal}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Link className="h-4 w-4 mr-2" />
                    챌린지 연동하기
                  </Button>
                )}
              </div>

              {/* 챌린지 연동 모달 */}
              {isHost && (
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="p-6">
                    <h4 className="font-medium text-gray-800 mb-4">챌린지 연동</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          연동할 챌린지 선택
                        </label>
                        <Select value={selectedChallengeId} onValueChange={setSelectedChallengeId}>
                          <SelectTrigger>
                            <SelectValue placeholder="챌린지를 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableChallenges.map((challenge) => (
                              <SelectItem key={challenge.challenge_id} value={challenge.challenge_id}>
                                <div className="flex flex-col">
                                                                      <span className="font-medium">{challenge.title}</span>
                                  <span className="text-xs text-gray-500">
                                                                         {challenge.target_value} {challenge.type} • {Math.ceil((new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / (1000 * 60 * 60 * 24))}일
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {selectedChallengeId && (
                        <Button
                          onClick={handleLinkChallenge}
                          disabled={challengeLoading}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {challengeLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              연동 중...
                            </>
                          ) : (
                            <>
                              <Link className="h-4 w-4 mr-2" />
                              챌린지 연동하기
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
