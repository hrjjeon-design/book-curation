"use client"

interface TopicTileProps {
  topic: string
  onClick?: () => void
}

export function TopicTile({ topic, onClick }: TopicTileProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 bg-card border border-border rounded-lg text-sm text-foreground hover:border-primary/40 hover:bg-muted/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {topic}
    </button>
  )
}
