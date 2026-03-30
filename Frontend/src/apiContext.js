import { createContext, useContext } from 'react'

export const ApiContext = createContext(null)

export function useApi() {
  const context = useContext(ApiContext)
  if (!context) {
    throw new Error('useApi must be used within an ApiContext provider')
  }
  return context
}
