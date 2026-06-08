"use client"

import { useState, useEffect, useCallback } from "react"

export interface CartItem {
  id: string
  title: string
  price: number
  image: string
  sellerUsername: string
}

export type CartAction =
  | { type: "add"; item: CartItem }
  | { type: "remove"; id: string }
  | { type: "clear" }

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "add":
      if (state.some(i => i.id === action.item.id)) return state
      return [...state, action.item]
    case "remove":
      return state.filter(i => i.id !== action.id)
    case "clear":
      return []
    default:
      return state
  }
}

const STORAGE_KEY = "gallery_cart"

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setItems(JSON.parse(stored) as CartItem[])
    } catch {
      // corrupt data — start fresh
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const dispatch = useCallback((action: CartAction) => {
    setItems(prev => cartReducer(prev, action))
  }, [])

  const total = items.reduce((sum, i) => sum + i.price, 0)
  const count = items.length

  return { items, total, count, dispatch }
}
