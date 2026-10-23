import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabase.js'
import { AuthContext } from './AuthContext.js'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

function consumeOAuthError() {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code = query.get('error') || hash.get('error')
  if (!code) return ''
  let description = query.get('error_description') || hash.get('error_description') || 'Google sign-in did not complete.'
  try { description = decodeURIComponent(description) } catch { /* Keep the provider's original message. */ }
  window.history.replaceState({}, document.title, window.location.pathname)
  return `Google sign-in failed: ${description.replace(/\+/g, ' ')}`
}

async function syncProfile(accessToken) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/profiles/google_auth/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new Error('You are signed in, but ExamPilot could not reach the profile service. Check that the backend is running, then retry profile sync.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'You are signed in, but your ExamPilot profile could not be synced.')
  }
  return data.profile
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState(isSupabaseConfigured ? 'loading' : 'unconfigured')
  const [authError, setAuthError] = useState('')
  const [profileSync, setProfileSync] = useState({ token: null, attempt: 0, status: 'idle', profile: null, error: '' })
  const [syncAttempt, setSyncAttempt] = useState(0)

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    const oauthError = consumeOAuthError()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setStatus('ready')
      setAuthError(nextSession?.access_token ? '' : oauthError)
      if (!nextSession?.access_token) {
        setProfileSync({ token: null, attempt: 0, status: 'idle', profile: null, error: '' })
      }
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthError('Your saved session could not be restored. Please sign in again.')
      else if (oauthError) setAuthError(oauthError)
      setSession(data?.session || null)
      if (!data?.session?.access_token) {
        setProfileSync({ token: null, attempt: 0, status: 'idle', profile: null, error: '' })
      }
      setStatus('ready')
    }).catch(() => {
      if (!active) return
      setStatus('ready')
      setAuthError('Your saved session could not be restored. Please sign in again.')
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!session?.access_token) return undefined

    const accessToken = session.access_token
    const attempt = syncAttempt
    syncProfile(accessToken).then((profile) => {
      if (!active) return
      setProfileSync({ token: accessToken, attempt, profile, status: 'ready', error: '' })
    }).catch((error) => {
      if (!active) return
      setProfileSync({ token: accessToken, attempt, profile: null, status: 'error', error: error.message || 'Your profile could not be synced.' })
    })

    return () => { active = false }
  }, [session?.access_token, syncAttempt])

  const profileStateMatchesSession = Boolean(session?.access_token)
    && profileSync.token === session.access_token
    && profileSync.attempt === syncAttempt
  const profile = profileStateMatchesSession ? profileSync.profile : null
  const profileStatus = profileStateMatchesSession ? profileSync.status : session?.access_token ? 'loading' : 'idle'
  const profileError = profileStateMatchesSession ? profileSync.error : ''

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return
    setAuthError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) setAuthError(error.message || 'Google sign-in could not be started. Please try again.')
    } catch {
      setAuthError('Google sign-in could not be started. Check your connection and try again.')
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    setAuthError('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setAuthError(error.message || 'You could not be signed out. Please try again.')
    } catch {
      setAuthError('You could not be signed out. Check your connection and try again.')
    }
  }, [])

  const value = useMemo(() => {
    const sessionUser = session?.user
    const metadata = sessionUser?.user_metadata || {}
    const user = sessionUser ? {
      ...sessionUser,
      email: sessionUser.email || metadata.email || null,
      user_metadata: {
        ...metadata,
        full_name: metadata.full_name || metadata.name || null,
        avatar_url: metadata.avatar_url || metadata.picture || null,
      },
    } : null
    return {
      user,
      status,
      isConfigured: isSupabaseConfigured,
      authError,
      clearAuthError: () => setAuthError(''),
      signInWithGoogle,
      signOut,
      profile,
      profileStatus,
      profileError,
      retryProfileSync: () => setSyncAttempt((attempt) => attempt + 1),
    }
  }, [session, status, authError, signInWithGoogle, signOut, profile, profileStatus, profileError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
