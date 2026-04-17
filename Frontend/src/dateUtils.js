export const parseDateValue = (value) => {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null

    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    )
  }

  if (typeof value === 'string') {
    const datePartMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (datePartMatch) {
      const [, year, month, day] = datePartMatch
      const date = new Date(Number(year), Number(month) - 1, Number(day))
      const isValid =
        date.getFullYear() === Number(year) &&
        date.getMonth() === Number(month) - 1 &&
        date.getDate() === Number(day)

      return isValid ? date : null
    }
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatDateInputValue = (value) => {
  const date = parseDateValue(value)
  if (!date) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatDisplayDate = (value, options) => {
  const date = parseDateValue(value)
  if (!date) return '-'

  return date.toLocaleDateString('en-US', options || {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export const getDateTimestamp = (value) => {
  const date = parseDateValue(value)
  return date ? date.getTime() : 0
}
