// All cart state lives in useCart.tsx (the canonical implementation).
// This file is a thin re-export so any direct imports of useCartClient
// still work and point to the same CartContext instance.
'use client'
export { CartProvider, useCart } from './useCart'
export type { CartItem } from './useCart'
