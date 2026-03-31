import { cookies } from 'next/headers'

const APP_PASSWORD = process.env.APP_PASSWORD || 'PreferredMaint2026!'
const API_KEY = process.env.API_KEY || 'default-api-key'
const SESSION_NAME = 'payroll_session'

export async function checkWebAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_NAME)
  return !!session?.value
}

export async function setWebSession(): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = Buffer.from(Date.now().toString()).toString('base64')
  cookieStore.set(SESSION_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })
}

export function validatePassword(password: string): boolean {
  return password === APP_PASSWORD
}

export function validateApiKey(apiKey: string): boolean {
  return apiKey === API_KEY
}

export function checkApiAuth(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key')
  return !!apiKey && validateApiKey(apiKey)
}
