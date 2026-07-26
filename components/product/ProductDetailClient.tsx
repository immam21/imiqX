"use client"

import React from 'react'
import AddToCartClient from './AddToCartClient'

export default function ProductDetailClient({
  product,
  routePrefix = '',
  businessType = 'ecommerce_product',
  whatsappNumber = '',
}: {
  product: any
  routePrefix?: string
  businessType?: 'ecommerce_product' | 'ecommerce_services'
  whatsappNumber?: string
}) {
  return (
    <div>
      <AddToCartClient product={product} routePrefix={routePrefix} businessType={businessType} whatsappNumber={whatsappNumber} />
    </div>
  )
}
