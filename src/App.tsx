function App() {
  return (
    <main className="landing">
      <section className="hero" aria-labelledby="service-title">
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <p className="eyebrow">BIDLENS</p>
        <h1 id="service-title">
          BidLens
          <span>입찰 공고를 들여다보는 렌즈</span>
        </h1>
        <p className="description">공고 게시 전 검토 지원</p>
        <p className="notice">
          입력한 공고 조건을 바탕으로 검토 우선순위와 과거 유사사례를
          확인할 수 있도록 준비하고 있습니다.
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" />
          서비스 준비 중
        </div>
      </section>
      <footer>더 신중한 공고 검토를 위한 첫 단계</footer>
    </main>
  )
}

export default App
