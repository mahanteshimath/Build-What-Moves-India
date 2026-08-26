import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext, DEMO_USERS, SESSION_KEY } from './auth-context'
import type { DemoUser } from './auth-context'

function readSession(): DemoUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as DemoUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(readSession)

  const signIn = useCallback((username: string, password: string) => {
    const match = DEMO_USERS.find(
      (candidate) =>
        candidate.username === username.trim().toLowerCase() &&
        candidate.password === password,
    )
    if (!match) return 'That username and password do not match a demo account.'

    const session = { username: match.username, name: match.name }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
    return null
  }, [])

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
