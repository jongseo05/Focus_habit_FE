import { useMutation, useQueryClient } from '@tanstack/react-query'
import { profileKeys } from './useProfile'
import { useAuth } from './useAuth'

// 프로필 이미지 업로드
export const useUploadProfileImage = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '이미지 업로드에 실패했습니다.')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // 프로필 데이터 캐시 무효화
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: profileKeys.profile(user.id) })
      }
      
      // 성공 메시지 표시 (선택사항)
      console.log(data.message)
    },
    onError: (error) => {
      console.error('프로필 이미지 업로드 오류:', error)
    }
  })
}

// 프로필 이미지 삭제
export const useDeleteProfileImage = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/profile/upload-avatar', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '이미지 삭제에 실패했습니다.')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // 프로필 데이터 캐시 무효화
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: profileKeys.profile(user.id) })
      }
      
      // 성공 메시지 표시 (선택사항)
      console.log(data.message)
    },
    onError: (error) => {
      console.error('프로필 이미지 삭제 오류:', error)
    }
  })
}

