import { Metadata } from "next"

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params
  return {
    title: `Daily Report • ${date}`,
    description: `${date} 일일 집중력 리포트 - FocusAI`,
  }
}

export default function DailyReportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 