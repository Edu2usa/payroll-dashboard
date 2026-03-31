import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validatePassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!validatePassword(password)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    const cookieStore = await cookies()
    const sessionToken = Buffer.from(Date.now().toString()).toString('base64')
    cookieStore.set('payroll_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
