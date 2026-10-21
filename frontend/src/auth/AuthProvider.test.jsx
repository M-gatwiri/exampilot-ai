// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider.jsx'
import { useAuth } from './useAuth.js'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

vi.mock('./supabase.js', () => ({ isSupabaseConfigured: true, supabase: mockSupabase }))

function AuthProbe() {
  const { user, status, profile, profileStatus, profileError, retryProfileSync, authError, signInWithGoogle, signOut } = useAuth()
  return (
    <div>
      <span data-testid="auth-state">{status}:{user?.email || 'guest'}</span>
      <span data-testid="profile-state">{profileStatus}:{profile?.username || ''}</span>
      {profileError && <p role="alert">{profileError}</p>}
      {authError && <p role="alert">{authError}</p>}
      <button onClick={signInWithGoogle}>Sign in</button>
      <button onClick={signOut}>Sign out</button>
      <button onClick={retryProfileSync}>Retry profile sync</button>
    </div>
  )
}

const session = {
  access_token: 'verified-access-token',
  user: { id: 'verified-user', email: 'learner@example.com', user_metadata: { full_name: 'A Learner' } },
}

let authCallback

function renderProvider() {
  return render(<AuthProvider><AuthProbe /></AuthProvider>)
}

beforeEach(() => {
  authCallback = null
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authCallback = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null })
  mockSupabase.auth.signOut.mockImplementation(async () => {
    authCallback?.('SIGNED_OUT', null)
    return { error: null }
  })
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ profile: { username: 'A Learner' } }),
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Supabase authentication provider', () => {
  it('restores an existing session and syncs the verified account profile', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null })
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('auth-state').textContent).toBe('ready:learner@example.com'))
    await waitFor(() => expect(screen.getByTestId('profile-state').textContent).toBe('ready:A Learner'))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/profiles/google_auth/', {
      method: 'POST',
      headers: { Authorization: 'Bearer verified-access-token' },
    })
  })

  it('starts Google OAuth and clears the session on logout', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('auth-state').textContent).toBe('ready:learner@example.com'))

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in' })) })
    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign out' })) })
    await waitFor(() => expect(screen.getByTestId('auth-state').textContent).toBe('ready:guest'))
    expect(screen.getByTestId('profile-state').textContent).toBe('idle:')
  })

  it('shows a profile sync network error and retries without losing the session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null })
    globalThis.fetch.mockRejectedValueOnce(new TypeError('network unavailable'))
    renderProvider()

    expect((await screen.findByRole('alert')).textContent).toContain('could not reach the profile service')
    expect(screen.getByTestId('auth-state').textContent).toBe('ready:learner@example.com')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry profile sync' })) })
    await waitFor(() => expect(screen.getByTestId('profile-state').textContent).toBe('ready:A Learner'))
  })
})
