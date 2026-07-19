"use client"

import React from 'react'
import AddToCartClient from './AddToCartClient'

export default function ProductDetailClient({ product }: { product: any }) {
  return (
    <div>
      <AddToCartClient product={product} />
    </div>
  )
}
