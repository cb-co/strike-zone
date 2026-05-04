import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Generate state token for CSRF protection
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TRADESTATION_CLIENT_ID!,
    redirect_uri: process.env.TRADESTATION_REDIRECT_URI!,
    scope: 'openid profile email MarketData ReadAccount Trade',
    audience: 'https://api.tradestation.com',
    state,
  })

  const authUrl = `https://signin.tradestation.com/authorize?${params.toString()}`

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('ts_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })
  return response
}
