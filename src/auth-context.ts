import { createContext, useContext } from 'react'

// DEMO ONLY. These credentials ship inside the JavaScript bundle, so anyone can
// read them with DevTools. This gates the UI for a walkthrough; it is not a
// security control, and it does not protect /api/query.
export const DEMO_USERS = [
  { username: 'asha', password: 'sakshya-demo', name: 'Asha Menon' },
  { username: 'ravi', password: 'sakshya-demo', name: 'Ravi Kulkarni' },
  { username: 'demo', password: 'sakshya-demo', name: 'Demo Reviewer' },
] as const

export type DemoUser = { username: string; name: string }

export const SESSION_KEY = 'sakshya.demo-user'

export type AuthValue = {
  user: DemoUser | null
  signIn: (username: string, password: string) => string | null
  signOut: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
