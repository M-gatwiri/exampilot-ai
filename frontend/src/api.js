import { supabase } from './auth/supabase.js'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export async function apiFetch(path, options = {}, accessToken) {
  let token = accessToken
  if (token === undefined && supabase) {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    token = data?.session?.access_token
  }

  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const requestHeaders = Object.fromEntries(headers.entries())
  if (token) {
    requestHeaders.Authorization = headers.get('Authorization')
    delete requestHeaders.authorization
  }
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers: requestHeaders })
}
