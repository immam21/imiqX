"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

export type CartItem = {
  productId: string
  name: string
  price: number
  qty: number
  image?: string
}

type CartContextValue = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clear: () => void
  totalItems: number
  subtotal: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

const STORAGE_KEY = 'miqx_cart_v1'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  // Prevents the write-effect from wiping localStorage before the read-effect
  // has populated state on the first render.
  const hydrated = useRef(false)

  // ── Load from localStorage after mount ─────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      // ignore corrupt data
    }
    hydrated.current = true
  }, [])

  // ── Persist whenever items change (skip the very first render) ──────────
  useEffect(() => {
    if (!hydrated.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (e) {
      console.warn('Failed to write cart to storage', e)
    }
  }, [items])

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const found = prev.find((p) => p.productId === item.productId)
      if (found) return prev.map((p) => (p.productId === item.productId ? { ...p, qty: p.qty + item.qty } : p))
      return [...prev, item]
    })
  }

  const removeItem = (productId: string) => setItems((prev) => prev.filter((p) => p.productId !== productId))

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) return removeItem(productId)
    setItems((prev) => prev.map((p) => (p.productId === productId ? { ...p, qty } : p)))
  }

  const clear = () => setItems([])

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.price * it.qty, 0), [items])
  const totalItems = useMemo(() => items.reduce((s, it) => s + it.qty, 0), [items])

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clear, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  // Return safe defaults during SSR / prerendering when no CartProvider is
  // in the tree yet — real values arrive after hydration.
  if (!ctx) {
    return {
      items:      [],
      addItem:    () => {},
      removeItem: () => {},
      updateQty:  () => {},
      clear:      () => {},
      totalItems: 0,
      subtotal:   0,
    }
  }
  return ctx
}
