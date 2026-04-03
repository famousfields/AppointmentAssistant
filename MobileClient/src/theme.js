import { StyleSheet } from 'react-native'

export const colors = {
  bg: '#0a0f1d',
  panel: '#161f35',
  card: '#18233b',
  input: '#0f172a',
  text: '#9ea9c7',
  textMuted: '#7e89a8',
  heading: '#f5f7ff',
  border: 'rgba(148, 163, 184, 0.16)',
  borderStrong: 'rgba(165, 180, 252, 0.32)',
  accent: '#6d7cff',
  accentStrong: '#8b5cf6',
  success: '#34d399',
  error: '#fb7185'
}

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16
  },
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 18,
    gap: 14
  },
  title: {
    color: colors.heading,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6
  },
  sectionTitle: {
    color: colors.heading,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4
  },
  heading3: {
    color: colors.heading,
    fontSize: 18,
    fontWeight: '700'
  },
  text: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22
  },
  muted: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  label: {
    color: colors.heading,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    color: colors.heading,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  buttonPrimary: {
    backgroundColor: colors.accent
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border
  },
  buttonText: {
    color: colors.heading,
    fontWeight: '800',
    fontSize: 15
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(109, 124, 255, 0.14)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignSelf: 'flex-start'
  },
  chipText: {
    color: colors.heading,
    fontWeight: '700',
    fontSize: 12
  },
  errorText: {
    color: colors.error,
    fontSize: 14
  },
  successText: {
    color: colors.success,
    fontSize: 14
  }
})
