import { Badge } from "@/components/ui/badge"
import { BookOpen } from "lucide-react"

interface BookCardProps {
  title: string
  author: string
  publisher: string | null
  pubYear: number | null
  coverImage: string | null
  oneLineSummary: string
  entryDifficulty: "입문" | "중간" | "어려움"
  philosophicalContext: string
  whyThisBook: string
  reasonTags: string[]
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
  pubYear,
  coverImage,
  oneLineSummary,
  entryDifficulty,
  philosophicalContext,
  whyThisBook,
  reasonTags,
}: BookCardProps) {
  return (
    <article className="py-8">
      <div className="flex gap-5">
        <div className="shrink-0">
          <div className="relative w-[120px] aspect-[2/3] rounded-md overflow-hidden shadow-md bg-muted">
            {coverImage ? (
              <img
                src={coverImage}
                alt={`${title} 표지`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                  e.currentTarget.nextElementSibling?.classList.remove("hidden")
                }}
              />
            ) : null}
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 ${coverImage ? "hidden" : ""}`}>
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground/60 text-center px-2">표지 준비중</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <Badge
            variant="secondary"
            className={`w-fit text-xs font-medium ${difficultyStyles[entryDifficulty]}`}
          >
            {entryDifficulty}
          </Badge>
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {author}
            {publisher && ` · ${publisher}`}
            {pubYear && ` · ${pubYear}`}
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {oneLineSummary}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <span className="text-xs text-muted-foreground block mb-1">철학적 맥락</span>
          <p className="text-sm text-foreground leading-relaxed">{philosophicalContext}</p>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block mb-1">이 질문에 맞는 이유</span>
          <p className="text-sm text-foreground leading-relaxed">{whyThisBook}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {reasonTags.map((tag) => (
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
