import { Badge } from "@/components/ui/badge"

interface BookCardProps {
  title: string
  author: string
  publisher: string
  year: number
  coverUrl: string
  summary: string
  difficulty: "입문" | "중간" | "어려움"
  philosophicalContext: string
  matchReason: string
  tags: string[]
}

const difficultyStyles = {
  입문: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  중간: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  어려움: "bg-rose-100 text-rose-700 hover:bg-rose-100",
}

export function BookCard({
  title,
  author,
  publisher,
  year,
  coverUrl,
  summary,
  difficulty,
  philosophicalContext,
  matchReason,
  tags,
}: BookCardProps) {
  return (
    <article className="py-8">
      <div className="flex gap-5">
        <div className="shrink-0">
          <div className="relative w-[120px] aspect-[2/3] rounded-md overflow-hidden shadow-md">
            <img
              src={coverUrl}
              alt={`${title} 표지`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <Badge
            variant="secondary"
            className={`w-fit text-xs font-medium ${difficultyStyles[difficulty]}`}
          >
            {difficulty}
          </Badge>
          <h2 className="text-lg font-semibold text-foreground leading-tight text-balance">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {author} · {publisher} · {year}
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {summary}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <span className="text-xs text-muted-foreground block mb-1">
            철학적 맥락
          </span>
          <p className="text-sm text-foreground leading-relaxed">
            {philosophicalContext}
          </p>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block mb-1">
            이 질문에 맞는 이유
          </span>
          <p className="text-sm text-foreground leading-relaxed">
            {matchReason}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}
