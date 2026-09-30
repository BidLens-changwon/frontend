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
    <main className="landing-cover">
      <section className="landing-main" aria-labelledby="service-title">
        <div className="landing-content">
          <h1 className="brand-wordmark landing-title" id="service-title">BidLens</h1>
          <p className="landing-description">
            입찰 공고를 들여다보는 렌즈
          </p>
          <button className="primary-button landing-button" type="button" onClick={openForm}>
            공고 초안 입력하기
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
      <div className="landing-bottom-line" aria-hidden="true" />
    </main>
  )
}

export default App
