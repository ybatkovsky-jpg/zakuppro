import { NextRequest, NextResponse } from 'next/server'

// In-memory read state shared via module-level Map
// (Same module-level store as parent route since Next.js may create separate instances)
const itemReadState = new Map<string, boolean>()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { read } = body as { read?: boolean }

    if (read !== undefined) {
      itemReadState.set(id, read)
    } else {
      // Default: mark as read
      itemReadState.set(id, true)
    }

    return NextResponse.json({
      success: true,
      id,
      read: itemReadState.get(id) ?? true,
    })
  } catch (error) {
    console.error('Notification PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    itemReadState.set(id, true)

    return NextResponse.json({
      success: true,
      id,
      deleted: true,
    })
  } catch (error) {
    console.error('Notification DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}
