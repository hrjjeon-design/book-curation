"use client"

import { TopicTile } from "./topic-tile"

interface TopicGroupProps {
  title: string
  topics: {
    themeId: string
    name: string
  }[]
  onTopicClick?: (id: string) => void
}

export function TopicGroup({ title, topics, onTopicClick }: TopicGroupProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {topics.map((topic) => (
          <TopicTile
            key={topic.themeId}
            topic={topic}
            onClick={onTopicClick}
          />
        ))}
      </div>
    </section>
  )
}
