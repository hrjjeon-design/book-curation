import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BookCard } from "@/components/book-card"

const sampleBooks = [
  {
    title: "불안",
    author: "알랭 드 보통",
    publisher: "은행나무",
    year: 2012,
    coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=240&h=360&fit=crop",
    summary: "사회적 지위에 대한 불안을 철학적으로 분석하고 위안을 찾는 에세이",
    difficulty: "입문" as const,
    philosophicalContext:
      "고대 스토아 철학부터 현대 사회학까지, 인간의 지위 불안이 어디서 오는지 탐구합니다. 에피쿠로스, 세네카, 쇼펜하우어 등의 사상을 현대적 맥락에서 재해석합니다.",
    matchReason:
      "일상에서 느끼는 막연한 불안감의 원인을 이해하고 싶다면, 이 책이 철학적 통찰과 함께 실질적인 위안을 제공합니다.",
    tags: ["스토아철학", "현대사회", "자기이해", "심리철학"],
  },
  {
    title: "정의란 무엇인가",
    author: "마이클 샌델",
    publisher: "와이즈베리",
    year: 2014,
    coverUrl: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=240&h=360&fit=crop",
    summary: "하버드대 명강의를 바탕으로 정의의 본질을 탐구하는 정치철학 입문서",
    difficulty: "중간" as const,
    philosophicalContext:
      "공리주의(벤담, 밀), 자유지상주의(노직), 공동체주의(아리스토텔레스, 롤스) 등 주요 정의론을 실제 사례를 통해 비교 분석합니다.",
    matchReason:
      "옳고 그름의 기준, 공정한 사회란 무엇인지 고민한다면, 다양한 철학적 관점을 균형 있게 배울 수 있습니다.",
    tags: ["정치철학", "윤리학", "공리주의", "자유주의", "공동체주의"],
  },
  {
    title: "존재와 시간",
    author: "마르틴 하이데거",
    publisher: "까치",
    year: 2016,
    coverUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=240&h=360&fit=crop",
    summary: "현존재 분석을 통해 존재의 의미를 묻는 20세기 철학의 기념비적 저작",
    difficulty: "어려움" as const,
    philosophicalContext:
      "서양 형이상학의 전통을 근본적으로 재검토하며, 현상학적 방법을 통해 인간 존재의 구조를 해명합니다. 실존주의와 해석학의 토대가 된 작품입니다.",
    matchReason:
      "삶의 유한성, 본래적 존재 방식에 대해 깊이 사유하고 싶다면 도전해볼 만한 고전입니다. 단, 철학적 배경지식이 필요합니다.",
    tags: ["현상학", "실존주의", "형이상학", "해석학", "존재론"],
  },
]

export default function ResultsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          주제 선택으로 돌아가기
        </Link>

        <div className="border-l-2 border-primary pl-4 mb-8">
          <p className="text-muted-foreground text-sm leading-relaxed">
            선택하신 주제와 관련된 철학 도서를 추천해 드립니다.
            <br />
            난이도와 관심사에 맞는 책을 선택해 보세요.
          </p>
        </div>

        <div className="divide-y divide-border">
          {sampleBooks.map((book) => (
            <BookCard key={book.title} {...book} />
          ))}
        </div>
      </div>
    </div>
  )
}
