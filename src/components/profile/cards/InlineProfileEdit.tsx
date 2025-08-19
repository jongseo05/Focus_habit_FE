import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, Trash2, School, BookOpen } from "lucide-react"
import { UserProfile, UserStatus } from "@/types/profile"
import { StatusBadge } from "./StatusBadge"

interface InlineProfileEditProps {
  profile: UserProfile | null
  onSave: (data: Partial<UserProfile>) => void
  onCancel: () => void
  onImageUpload: (file: File) => void
  onImageDelete: () => void
}

export const InlineProfileEdit = ({ 
  profile, 
  onSave, 
  onCancel,
  onImageUpload,
  onImageDelete
}: InlineProfileEditProps) => {
  const [formData, setFormData] = useState({
    display_name: '',
    handle: '',
    bio: '',
    school: '',
    major: ''
  })

  // profile이 변경될 때 formData 업데이트
  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        handle: profile.handle || '',
        bio: profile.bio || '',
        school: profile.school || '',
        major: profile.major || ''
      })
    }
  }, [profile])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onImageUpload(file)
    }
  }

  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="flex items-start gap-6">
            <div className="relative group">
              <Avatar className="w-24 h-24 cursor-pointer">
                <AvatarImage src={profile?.avatar_url} alt={profile?.display_name} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {profile?.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {profile?.avatar_url && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onImageDelete}
                  className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <Input
                    value={formData.display_name}
                    onChange={(e) => handleInputChange('display_name', e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="text-2xl font-bold"
                    required
                  />
                  <Input
                    value={formData.handle}
                    onChange={(e) => handleInputChange('handle', e.target.value)}
                    placeholder="핸들을 입력하세요"
                    className="text-gray-500"
                    required
                  />
                </div>
                <StatusBadge status={profile?.status as UserStatus || UserStatus.ONLINE} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    저장
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                    취소
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="자신에 대해 소개해주세요"
                  rows={2}
                  className="text-gray-600 text-lg"
                />
              </div>
              
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4" />
                  <Input
                    value={formData.school}
                    onChange={(e) => handleInputChange('school', e.target.value)}
                    placeholder="학교명"
                    className="w-32"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <Input
                    value={formData.major}
                    onChange={(e) => handleInputChange('major', e.target.value)}
                    placeholder="전공명"
                    className="w-32"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
