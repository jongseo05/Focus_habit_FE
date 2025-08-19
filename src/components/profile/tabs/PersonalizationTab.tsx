import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Brain, RefreshCw, TrendingUp, Activity } from "lucide-react"

// Personalization Model Interface
interface PersonalizationModelInfo {
  focus_samples_collected: number
  non_focus_samples_collected: number
  total_samples_needed: number
  completion_percentage: number
  model_version: string
  last_updated: string
  model_accuracy: number
  training_status: 'idle' | 'collecting' | 'training' | 'completed' | 'error'
  next_training_date: string
}

// Mock personalization model data
const mockPersonalizationModel: PersonalizationModelInfo = {
  focus_samples_collected: 45,
  non_focus_samples_collected: 38,
  total_samples_needed: 100,
  completion_percentage: 83,
  model_version: "1.2.0",
  last_updated: "2024-12-01T00:00:00Z",
  model_accuracy: 87.5,
  training_status: 'completed',
  next_training_date: "2024-12-08T00:00:00Z"
}

export const PersonalizationTab = () => {
  return (
    <div className="space-y-6">
      {/* Model Status Card */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-purple-900 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            개인화 모델 상태
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-white/60 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">
                {mockPersonalizationModel.model_accuracy}%
              </div>
              <div className="text-sm text-purple-700">모델 정확도</div>
            </div>
            <div className="text-center p-3 bg-white/60 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">
                v{mockPersonalizationModel.model_version}
              </div>
              <div className="text-sm text-purple-700">모델 버전</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-purple-700">집중 샘플 수집</span>
              <span className="text-sm font-medium text-purple-900">
                {mockPersonalizationModel.focus_samples_collected} / {mockPersonalizationModel.total_samples_needed}
              </span>
            </div>
            <Progress 
              value={(mockPersonalizationModel.focus_samples_collected / mockPersonalizationModel.total_samples_needed) * 100} 
              className="h-2 bg-purple-200"
            />
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-purple-700">비집중 샘플 수집</span>
              <span className="text-sm font-medium text-purple-900">
                {mockPersonalizationModel.non_focus_samples_collected} / {mockPersonalizationModel.total_samples_needed}
              </span>
            </div>
            <Progress 
              value={(mockPersonalizationModel.non_focus_samples_collected / mockPersonalizationModel.total_samples_needed) * 100} 
              className="h-2 bg-purple-200"
            />
          </div>

          <Separator />
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-900">
              {mockPersonalizationModel.completion_percentage}%
            </div>
            <div className="text-sm text-purple-600">전체 완료율</div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-purple-900">
                {new Date(mockPersonalizationModel.last_updated).toLocaleDateString('ko-KR')}
              </div>
              <div className="text-purple-600">마지막 업데이트</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-purple-900">
                {new Date(mockPersonalizationModel.next_training_date).toLocaleDateString('ko-KR')}
              </div>
              <div className="text-purple-600">다음 학습 예정</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              샘플 재수집
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Brain className="w-4 h-4 mr-2" />
              모델 재학습
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Model Training History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            모델 학습 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="font-medium">v1.2.0 학습 완료</div>
                  <div className="text-sm text-gray-600">정확도: 87.5%</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {new Date(mockPersonalizationModel.last_updated).toLocaleDateString('ko-KR')}
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <div className="font-medium">v1.1.0 학습 완료</div>
                  <div className="text-sm text-gray-600">정확도: 82.3%</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">2024-11-15</div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <div>
                  <div className="font-medium">v1.0.0 초기 모델</div>
                  <div className="text-sm text-gray-600">정확도: 75.1%</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">2024-10-01</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            모델 성능 지표
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">집중 상태 감지</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>정확도</span>
                  <span className="font-medium">89.2%</span>
                </div>
                <Progress value={89.2} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>재현율</span>
                  <span className="font-medium">87.8%</span>
                </div>
                <Progress value={87.8} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>정밀도</span>
                  <span className="font-medium">91.5%</span>
                </div>
                <Progress value={91.5} className="h-2" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">비집중 상태 감지</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>정확도</span>
                  <span className="font-medium">85.8%</span>
                </div>
                <Progress value={85.8} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>재현율</span>
                  <span className="font-medium">83.2%</span>
                </div>
                <Progress value={83.2} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>정밀도</span>
                  <span className="font-medium">88.7%</span>
                </div>
                <Progress value={88.7} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
