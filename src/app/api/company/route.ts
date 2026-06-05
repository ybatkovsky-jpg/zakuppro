/**
 * Company Settings API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint manages company details stored in Prisma.
 * Future migration: Create equivalent FastAPI company settings endpoints.
 */
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let company = await db.companyDetails.findFirst({
      where: { isDefault: true },
    })

    // Create default company if not exists
    if (!company) {
      company = await db.companyDetails.create({
        data: {
          companyName: 'Моя компания',
          isDefault: true,
        },
      })
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error('Company get error:', error)
    return NextResponse.json({ error: 'Failed to fetch company details' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyName,
      inn,
      kpp,
      ogrn,
      address,
      email,
      phone,
      bankName,
      bankAccount,
      korAccount,
      bik,
    } = body

    let company = await db.companyDetails.findFirst({
      where: { isDefault: true },
    })

    if (!company) {
      company = await db.companyDetails.create({
        data: {
          companyName: companyName?.trim() || 'Моя компания',
          inn: inn?.trim() || '',
          kpp: kpp?.trim() || '',
          ogrn: ogrn?.trim() || '',
          address: address?.trim() || '',
          email: email?.trim() || '',
          phone: phone?.trim() || '',
          bankName: bankName?.trim() || '',
          bankAccount: bankAccount?.trim() || '',
          korAccount: korAccount?.trim() || '',
          bik: bik?.trim() || '',
          isDefault: true,
        },
      })
    } else {
      const data: Record<string, unknown> = {}
      if (companyName !== undefined) data.companyName = companyName.trim()
      if (inn !== undefined) data.inn = inn.trim()
      if (kpp !== undefined) data.kpp = kpp.trim()
      if (ogrn !== undefined) data.ogrn = ogrn.trim()
      if (address !== undefined) data.address = address.trim()
      if (email !== undefined) data.email = email.trim()
      if (phone !== undefined) data.phone = phone.trim()
      if (bankName !== undefined) data.bankName = bankName.trim()
      if (bankAccount !== undefined) data.bankAccount = bankAccount.trim()
      if (korAccount !== undefined) data.korAccount = korAccount.trim()
      if (bik !== undefined) data.bik = bik.trim()

      company = await db.companyDetails.update({
        where: { id: company.id },
        data,
      })
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error('Company update error:', error)
    return NextResponse.json({ error: 'Failed to update company details' }, { status: 500 })
  }
}
