import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Levenshtein distance for name similarity scoring
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function nameSimilarity(a: string, b: string): number {
  const s1 = a.trim().toLowerCase()
  const s2 = b.trim().toLowerCase()
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0
  const maxLen = Math.max(s1.length, s2.length)
  return 1 - levenshteinDistance(s1, s2) / maxLen
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch invoice with items
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        project: true,
        supplier: true,
        items: {
          include: {
            projectItem: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 })
    }

    // Find purchase requests for the same project and supplier
    const purchaseRequests = await db.purchaseRequest.findMany({
      where: {
        projectId: invoice.projectId,
        supplierId: invoice.supplierId,
        status: { in: ['sent', 'responded'] },
      },
      include: {
        items: {
          include: {
            projectItem: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Also get all project items for broader matching
    const projectItems = await db.projectItem.findMany({
      where: { projectId: invoice.projectId },
    })

    // Use the most recent purchase request if exists, otherwise use project items directly
    const requestItems = purchaseRequests.length > 0
      ? purchaseRequests[0].items.map((ri) => ({
          id: ri.id,
          name: ri.projectItem?.name || `Позиция ${ri.projectItemId}`,
          quantity: ri.quantity,
          price: ri.price,
          unit: ri.projectItem?.unit || 'шт',
          projectItemId: ri.projectItemId,
        }))
      : projectItems.map((pi) => ({
          id: pi.id,
          name: pi.name,
          quantity: pi.quantity,
          price: pi.price,
          unit: pi.unit,
          projectItemId: pi.id,
        }))

    const invoiceItems = invoice.items.map((ii) => ({
      id: ii.id,
      name: ii.name,
      quantity: ii.quantity,
      price: ii.price,
      projectItemId: ii.projectItemId,
    }))

    // Auto-matching logic
    const matchedRequestItemIds = new Set<string>()
    const matchedInvoiceItemIds = new Set<string>()

    interface MatchResult {
      requestItem: { id: string; name: string; quantity: number; price: number }
      invoiceItem: { id: string; name: string; quantity: number; price: number }
      nameMatch: boolean
      quantityMatch: boolean
      priceMatch: boolean
      matchScore: number
    }

    const matches: MatchResult[] = []

    // First pass: match by projectItemId (exact link)
    for (const invItem of invoiceItems) {
      if (invItem.projectItemId) {
        const reqItem = requestItems.find((ri) => ri.projectItemId === invItem.projectItemId || ri.id === invItem.projectItemId)
        if (reqItem && !matchedRequestItemIds.has(reqItem.id)) {
          const score = nameSimilarity(invItem.name, reqItem.name)
          matches.push({
            requestItem: { id: reqItem.id, name: reqItem.name, quantity: reqItem.quantity, price: reqItem.price },
            invoiceItem: { id: invItem.id, name: invItem.name, quantity: invItem.quantity, price: invItem.price },
            nameMatch: score >= 0.8,
            quantityMatch: invItem.quantity === reqItem.quantity,
            priceMatch: Math.abs(invItem.price - reqItem.price) < 0.01,
            matchScore: score,
          })
          matchedRequestItemIds.add(reqItem.id)
          matchedInvoiceItemIds.add(invItem.id)
        }
      }
    }

    // Second pass: match by name similarity for remaining items
    const remainingInvoiceItems = invoiceItems.filter((ii) => !matchedInvoiceItemIds.has(ii.id))
    const remainingRequestItems = requestItems.filter((ri) => !matchedRequestItemIds.has(ri.id))

    // Create a score matrix and use greedy matching
    const scoreMatrix: Array<{ invIdx: number; reqIdx: number; score: number }> = []
    for (let i = 0; i < remainingInvoiceItems.length; i++) {
      for (let j = 0; j < remainingRequestItems.length; j++) {
        const score = nameSimilarity(remainingInvoiceItems[i].name, remainingRequestItems[j].name)
        if (score >= 0.4) {
          scoreMatrix.push({ invIdx: i, reqIdx: j, score })
        }
      }
    }

    // Sort by score descending for greedy matching
    scoreMatrix.sort((a, b) => b.score - a.score)

    const usedInvIndices = new Set<number>()
    const usedReqIndices = new Set<number>()

    for (const { invIdx, reqIdx, score } of scoreMatrix) {
      if (usedInvIndices.has(invIdx) || usedReqIndices.has(reqIdx)) continue

      const invItem = remainingInvoiceItems[invIdx]
      const reqItem = remainingRequestItems[reqIdx]

      matches.push({
        requestItem: { id: reqItem.id, name: reqItem.name, quantity: reqItem.quantity, price: reqItem.price },
        invoiceItem: { id: invItem.id, name: invItem.name, quantity: invItem.quantity, price: invItem.price },
        nameMatch: score >= 0.8,
        quantityMatch: invItem.quantity === reqItem.quantity,
        priceMatch: Math.abs(invItem.price - reqItem.price) < 0.01,
        matchScore: score,
      })

      usedInvIndices.add(invIdx)
      usedReqIndices.add(reqIdx)
      matchedInvoiceItemIds.add(invItem.id)
      matchedRequestItemIds.add(reqItem.id)
    }

    // Unmatched items
    const unmatchedRequestItems = requestItems
      .filter((ri) => !matchedRequestItemIds.has(ri.id))
      .map((ri) => ({ id: ri.id, name: ri.name, quantity: ri.quantity, price: ri.price }))

    const unmatchedInvoiceItems = invoiceItems
      .filter((ii) => !matchedInvoiceItemIds.has(ii.id))
      .map((ii) => ({ id: ii.id, name: ii.name, quantity: ii.quantity, price: ii.price }))

    // Summary
    const matchedItems = matches.length
    const quantityDiscrepancies = matches.filter((m) => !m.quantityMatch).length
    const priceDiscrepancies = matches.filter((m) => !m.priceMatch).length
    const totalRequestAmount = requestItems.reduce((sum, ri) => sum + ri.quantity * ri.price, 0)
    const totalInvoiceAmount = invoiceItems.reduce((sum, ii) => sum + ii.quantity * ii.price, 0)

    const result = {
      invoiceId: invoice.id,
      requestId: purchaseRequests.length > 0 ? purchaseRequests[0].id : null,
      invoiceNumber: invoice.invoiceNumber,
      projectName: invoice.project.name,
      supplierName: invoice.supplier.name,
      invoiceStatus: invoice.status,
      matches,
      unmatchedRequestItems,
      unmatchedInvoiceItems,
      summary: {
        totalRequestItems: requestItems.length,
        totalInvoiceItems: invoiceItems.length,
        matchedItems,
        quantityDiscrepancies,
        priceDiscrepancies,
        unmatchedRequestItems: unmatchedRequestItems.length,
        unmatchedInvoiceItems: unmatchedInvoiceItems.length,
        totalRequestAmount,
        totalInvoiceAmount,
        amountDifference: totalInvoiceAmount - totalRequestAmount,
      },
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json({ error: 'Ошибка сверки счёта' }, { status: 500 })
  }
}
