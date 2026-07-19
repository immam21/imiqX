"use client"

import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
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

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
