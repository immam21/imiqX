"use client"

import React, { useState } from 'react'
import { useCart } from '../../hooks/useCart'

export default function AddToCartClient({ product }: { product: any }) {
  const { addItem } = useCart()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const add = () => {
    addItem({ productId: product.productId, name: product.name, price: product.offerPrice || product.price || 0, qty, image: product.images?.[0] })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center border rounded-md overflow-hidden">
        <button type="button" className="px-3" onClick={() => setQty((q) => Math.max(1, q - 1))}>-</button>
        <div className="px-3">{qty}</div>
        <button type="button" className="px-3" onClick={() => setQty((q) => q + 1)}>+</button>
      </div>
      <button type="button" onClick={add} className={`text-white px-4 py-2 rounded-md transition ${added ? 'bg-emerald-600' : 'bg-accent'}`}>
        {added ? '✓ Added!' : 'Add to cart'}
      </button>
    </div>
  )
}
