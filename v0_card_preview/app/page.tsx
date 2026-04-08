"use client"

import { SearchInput } from "@/components/search-input"
import { TopicGroup } from "@/components/topic-group"

const topicGroups = [
  {
    title: "생활형",
    topics: [
      "불안할 때 읽는 철학",
      "삶의 방향을 잃었을 때 읽는 철학",
      "관계가 힘들 때 읽는 철학",
      "사랑을 다시 생각하게 하는 철학",
      "죽음과 상실을 생각할 때 읽는 철학",
      "행복하게 산다는 게 무엇인지 묻는 철학",
      "내 선택이 맞는지 흔들릴 때 읽는 철학",
      "혼자 있는 시간이 버거울 때 읽는 철학",
    ],
  },
  {
    title: "관심사형",
    topics: [
      "AI와 인간을 생각하게 하는 철학",
      "기술과 윤리를 함께 생각하게 하는 철학",
      "자유의지를 생각하게 하는 철학",
      "인간이란 무엇인지 묻게 하는 철학",
      "의식과 마음을 생각하게 하는 철학",
    ],
  },
  {
    title: "사회·기술형",
    topics: [
      "정의와 공정함을 생각하게 하는 철학",
      "정치와 사회를 다르게 보게 하는 철학",
      "책임과 판단을 생각하게 하는 철학",
      "AI·자율주행 같은 기술 문제를 철학으로 보는 책",
    ],
  },
  {
    title: "입문·출발형",
    topics: [
      "철학을 처음 시작하고 싶을 때",
      "한 권의 책에서 더 넓게 읽고 싶을 때",
      "한 철학자에서 시작하고 싶을 때",
    ],
  },
]

export default function Home() {
  const handleSearch = (query: string) => {
    console.log("Search:", query)
  }

  const handleTopicClick = (topic: string) => {
    console.log("Topic:", topic)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        {/* Header */}
        <header className="text-center mb-10 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight text-balance">
            철학 도서 큐레이션
          </h1>
          <p className="mt-3 text-muted-foreground text-base sm:text-lg">
            삶의 질문에 맞는 철학 도서를 찾아드립니다
          </p>
        </header>

        {/* Search Input */}
        <div className="mb-12 sm:mb-16">
          <SearchInput onSearch={handleSearch} />
        </div>

        {/* Topic Groups */}
        <div className="space-y-10 sm:space-y-12">
          {topicGroups.map((group) => (
            <TopicGroup
              key={group.title}
              title={group.title}
              topics={group.topics}
              onTopicClick={handleTopicClick}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
