const JOB_TYPE_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/

export const normalizeJobTypeName = (value) => String(value || '').trim()

export const normalizeJobTypeKey = (value) => normalizeJobTypeName(value).toLowerCase()

export const normalizeJobTypeColor = (value) => {
  const trimmed = String(value || '').trim()
  return JOB_TYPE_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : ''
}

const hexToRgb = (value) => {
  const hex = normalizeJobTypeColor(value)
  if (!hex) return null

  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  }
}

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const mixColor = (first, second, ratio) => {
  const source = hexToRgb(first)
  const target = hexToRgb(second)
  if (!source || !target) return first

  return rgbToHex({
    r: Math.round(source.r + ((target.r - source.r) * ratio)),
    g: Math.round(source.g + ((target.g - source.g) * ratio)),
    b: Math.round(source.b + ((target.b - source.b) * ratio))
  })
}

const getContrastTextColor = (backgroundColor) => {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return '#f8fafc'

  const luminance = (0.2126 * rgb.r) + (0.7152 * rgb.g) + (0.0722 * rgb.b)
  return luminance > 150 ? '#0f172a' : '#f8fafc'
}

export const buildFallbackJobTypeColor = (value) => {
  const normalized = normalizeJobTypeKey(value)
  let hash = 0

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0
  }

  const red = 96 + (hash & 0x3f)
  const green = 96 + ((hash >> 6) & 0x3f)
  const blue = 96 + ((hash >> 12) & 0x3f)

  return rgbToHex({
    r: clamp(red, 0, 255),
    g: clamp(green, 0, 255),
    b: clamp(blue, 0, 255)
  })
}

export const buildJobTypePalette = (color, fallbackSeed) => {
  const background = normalizeJobTypeColor(color) || buildFallbackJobTypeColor(fallbackSeed)
  return {
    background,
    border: mixColor(background, '#000000', 0.18),
    text: getContrastTextColor(background)
  }
}

export const getJobTypeRecord = (value, jobTypes = []) => {
  const normalizedValue = normalizeJobTypeName(value)
  const normalizedKey = normalizeJobTypeKey(value)

  return jobTypes.find((jobType) => {
    if (jobType.id !== undefined && String(jobType.id) === normalizedValue) {
      return true
    }

    return (
      normalizeJobTypeKey(jobType.name) === normalizedKey ||
      normalizeJobTypeKey(jobType.normalized_name) === normalizedKey
    )
  }) || null
}

export const getJobTypePalette = (value, jobTypes = []) => {
  const record = getJobTypeRecord(value, jobTypes)
  if (normalizeJobTypeColor(value) && !record) {
    return buildJobTypePalette(value, value)
  }
  return buildJobTypePalette(record?.color, record?.name || value)
}

export const getJobTypeLabel = (value, jobTypes = []) => {
  const record = getJobTypeRecord(value, jobTypes)
  return record?.name || normalizeJobTypeName(value)
}

export const getJobTypeOptions = (jobTypes = []) =>
  [...jobTypes].sort((first, second) => {
    const firstOrder = Number(first.sort_order ?? first.sortOrder ?? 0)
    const secondOrder = Number(second.sort_order ?? second.sortOrder ?? 0)
    if (firstOrder !== secondOrder) return firstOrder - secondOrder
    return normalizeJobTypeName(first.name).localeCompare(normalizeJobTypeName(second.name))
  })

export const buildJobTypeSuggestionSet = (jobTypes = []) =>
  getJobTypeOptions(jobTypes).map((jobType) => jobType.name)
