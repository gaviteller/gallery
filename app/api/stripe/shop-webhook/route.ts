import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { calculateFee } from "@/lib/shopFees"
import { sendShopPurchaseEmail, sendShopSaleEmail } from "@/lib/email"
import Stripe from "stripe"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 })
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const meta = session.metadata ?? {}
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? ""

  // Idempotency guard
  const existing = await prisma.shopOrder.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  })
  if (existing) return NextResponse.json({ received: true })

  if (meta.type === "shop_single") {
    await handleSinglePurchase({ meta, paymentIntentId })
  } else if (meta.type === "shop_cart") {
    await handleCartPurchase({ meta, paymentIntentId })
  }

  return NextResponse.json({ received: true })
}

async function handleSinglePurchase({
  meta,
  paymentIntentId,
}: {
  meta: Record<string, string>
  paymentIntentId: string
}) {
  const { itemId, buyerId, sellerId } = meta

  const [item, buyer, seller] = await Promise.all([
    prisma.shopItem.findUnique({ where: { id: itemId } }),
    prisma.user.findUnique({ where: { id: buyerId }, select: { id: true, email: true, name: true } }),
    prisma.user.findUnique({ where: { id: sellerId }, select: { id: true, email: true, name: true, username: true, stripeConnectId: true } }),
  ])

  if (!item || !buyer || !seller) return

  const fees = calculateFee(item.price)

  const order = await prisma.shopOrder.create({
    data: {
      buyerId,
      sellerId,
      itemId,
      amountTotal: item.price,
      galleryFee: fees.galleryFee,
      sellerPayout: fees.sellerPayout,
      stripePaymentIntentId: paymentIntentId,
      downloadTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: "PURCHASED",
    },
  })

  await prisma.shopItem.update({
    where: { id: itemId },
    data: { purchaseCount: { increment: 1 } },
  })

  // Issue transfer to seller
  if (seller.stripeConnectId) {
    stripe.transfers.create({
      amount: fees.sellerPayoutCents,
      currency: "usd",
      destination: seller.stripeConnectId,
      transfer_group: paymentIntentId,
      metadata: { orderId: order.id },
    }).catch(e => console.error("Transfer failed for order", order.id, e))
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  const downloadUrl = `${baseUrl}/api/shop/download/${order.downloadToken}`

  if (buyer.email) {
    sendShopPurchaseEmail({
      to: buyer.email,
      buyerName: buyer.name ?? "there",
      itemTitle: item.title,
      sellerUsername: seller.username ?? sellerId,
      downloadUrl,
      amountPaid: item.price,
    }).catch(console.error)
  }

  if (seller.email) {
    sendShopSaleEmail({
      to: seller.email,
      artistName: seller.name ?? "there",
      itemTitle: item.title,
      buyerUsername: buyer.name ?? buyerId,
      sellerPayout: fees.sellerPayout,
    }).catch(console.error)
  }
}

async function handleCartPurchase({
  meta,
  paymentIntentId,
}: {
  meta: Record<string, string>
  paymentIntentId: string
}) {
  const { buyerId, itemIds: itemIdsJson } = meta
  const itemIds: string[] = JSON.parse(itemIdsJson)

  const [items, buyer] = await Promise.all([
    prisma.shopItem.findMany({
      where: { id: { in: itemIds } },
      include: { user: { select: { id: true, email: true, name: true, username: true, stripeConnectId: true } } },
    }),
    prisma.user.findUnique({ where: { id: buyerId }, select: { id: true, email: true, name: true } }),
  ])

  if (!buyer || items.length === 0) return

  const totalAmount = items.reduce((sum, item) => sum + item.price, 0)
  const totalFees = items.reduce((sum, item) => sum + calculateFee(item.price).galleryFee, 0)

  const cartOrder = await prisma.cartOrder.create({
    data: {
      buyerId,
      amountTotal: totalAmount,
      galleryFee: totalFees,
      stripePaymentIntentId: paymentIntentId,
      status: "PAID",
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

  for (const item of items) {
    const fees = calculateFee(item.price)

    const order = await prisma.shopOrder.create({
      data: {
        buyerId,
        sellerId: item.userId,
        itemId: item.id,
        cartOrderId: cartOrder.id,
        amountTotal: item.price,
        galleryFee: fees.galleryFee,
        sellerPayout: fees.sellerPayout,
        stripePaymentIntentId: paymentIntentId,
        downloadTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "PURCHASED",
      },
    })

    await prisma.shopItem.update({
      where: { id: item.id },
      data: { purchaseCount: { increment: 1 } },
    })

    if (item.user.stripeConnectId) {
      stripe.transfers.create({
        amount: fees.sellerPayoutCents,
        currency: "usd",
        destination: item.user.stripeConnectId,
        transfer_group: paymentIntentId,
        metadata: { orderId: order.id },
      }).catch(e => console.error("Transfer failed for order", order.id, e))
    }

    const downloadUrl = `${baseUrl}/api/shop/download/${order.downloadToken}`

    if (buyer.email) {
      sendShopPurchaseEmail({
        to: buyer.email,
        buyerName: buyer.name ?? "there",
        itemTitle: item.title,
        sellerUsername: item.user.username ?? item.userId,
        downloadUrl,
        amountPaid: item.price,
      }).catch(console.error)
    }

    if (item.user.email) {
      sendShopSaleEmail({
        to: item.user.email,
        artistName: item.user.name ?? "there",
        itemTitle: item.title,
        buyerUsername: buyer.name ?? buyerId,
        sellerPayout: fees.sellerPayout,
      }).catch(console.error)
    }
  }
}
