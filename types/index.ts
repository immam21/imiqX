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
}
