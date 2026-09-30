const minutePrecisionPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export const toKoreanIso = (value: string) => {
  if (!value) return ''

  const withSeconds = minutePrecisionPattern.test(value) ? `${value}:00` : value
  return `${withSeconds}+09:00`
}
