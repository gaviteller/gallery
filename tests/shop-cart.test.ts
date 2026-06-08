import { describe, it, expect } from "vitest"
import { cartReducer } from "@/lib/cart"
import type { CartItem } from "@/lib/cart"

const ITEM_A: CartItem = { id: "a", title: "Brush Pack", price: 9.99, image: "https://res.cloudinary.com/x/a.jpg", sellerUsername: "artist1" }
const ITEM_B: CartItem = { id: "b", title: "Reference Sheet", price: 4.99, image: "https://res.cloudinary.com/x/b.jpg", sellerUsername: "artist2" }

describe("cartReducer", () => {
  it("add: inserts a new item", () => {
    const next = cartReducer([], { type: "add", item: ITEM_A })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe("a")
  })

  it("add: does not duplicate an existing item", () => {
    const next = cartReducer([ITEM_A], { type: "add", item: ITEM_A })
    expect(next).toHaveLength(1)
  })

  it("remove: removes the matching item", () => {
    const next = cartReducer([ITEM_A, ITEM_B], { type: "remove", id: "a" })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe("b")
  })

  it("remove: is a no-op when id is not in cart", () => {
    const next = cartReducer([ITEM_A], { type: "remove", id: "zzz" })
    expect(next).toHaveLength(1)
  })

  it("clear: empties the cart", () => {
    const next = cartReducer([ITEM_A, ITEM_B], { type: "clear" })
    expect(next).toHaveLength(0)
  })

  it("total: sums all item prices", () => {
    const items = cartReducer(cartReducer([], { type: "add", item: ITEM_A }), { type: "add", item: ITEM_B })
    const total = items.reduce((s, i) => s + i.price, 0)
    expect(total).toBeCloseTo(14.98)
  })
})
