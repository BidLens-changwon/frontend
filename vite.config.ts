import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Windows/OneDrive 환경에서 출력 디렉터리 정리와 Oxc 압축이
    // 출력 없이 종료되는 문제를 피하고 재현 가능한 로컬 빌드를 유지한다.
    emptyOutDir: false,
    minify: false,
  },
})
