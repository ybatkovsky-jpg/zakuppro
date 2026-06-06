/**
 * AI Assistant Chat API Route
 * Proxies to the /api/assistant endpoint for the chat interface
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Forward to the main assistant endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : `http://localhost:${process.env.PORT || 3000}`
    
    const response = await fetch(`${baseUrl}/api/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Assistant chat error:', error)
    return NextResponse.json(
      { error: 'Ошибка при обработке запроса' },
      { status: 500 }
    )
  }
}

