import { useRef, useState } from 'react'
import DraftReviewForm from './components/DraftReviewForm'

function App() {
  const [showForm, setShowForm] = useState(false)
  const formHeadingRef = useRef<HTMLHeadingElement>(null)

  const openForm = () => {
    setShowForm(true)
    window.setTimeout(() => formHeadingRef.current?.focus(), 0)
  }

  if (showForm) {
    return (
      <DraftReviewForm
        headingRef={formHeadingRef}
        onBack={() => setShowForm(false)}
      />
    )
  }

  return (
    <main className="landing">
      <section className="hero" aria-labelledby="service-title">
        <div className="hero-copy">
          <h1 className="brand-wordmark" id="service-title">
            BidLens
            <span>- 입찰 공고를 들여다보는 렌즈</span>
          </h1>
          <p>공고를 게시하기 전, 검토가 필요한 지점을 더 선명하게.</p>
          <button className="primary-button landing-cta" type="button" onClick={openForm}>
            공고 초안 입력하기
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
