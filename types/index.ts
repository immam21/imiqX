export type Product = {
  productId: string
  name: string
  category?: string
  brand?: string
  description?: string
  price: number
  offerPrice: number
  discount?: number
  stock?: number
  rating?: number
  images?: string[]
}

export type Order = {
  OrderID: string
  Date: string
  CustomerName: string
  CustomerMobile: string
  FullAddress: string
  ProductsJSON: string
  Subtotal: number
  DeliveryCharge: number
  GrandTotal: number
  OrderStatus: string
  WhatsAppSent?: boolean
  CouponCode?: string
  CouponDiscount?: number
}

export type Banner = {
  bannerId: string
  title: string
  subtitle?: string
  imageUrl: string
  linkUrl?: string
  buttonText?: string
}

export type Review = {
  reviewId?: string
  productId: string
  name: string
  rating: number
  review: string
  date?: string
}

export type Coupon = {
  code: string
  type: 'percent' | 'flat'
  value: number
  minOrder?: number
  expiry?: string
}

export type AppliedCoupon = {
  code: string
  type: 'percent' | 'flat'
  value: number
  discountAmount: number
}
