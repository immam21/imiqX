import React from 'react'

export default function StickyCartBar({ items = 0, total = 0 }: { items?: number; total?: number }) {
  if (items === 0) return null
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="bg-white rounded-lg p-3 shadow-lg flex items-center justify-between">
        <div className="text-sm">🛒 {items} items</div>
        <div className="text-sm font-semibold">₹{total}</div>
        <a href="/cart" className="ml-3 bg-accent text-white px-3 py-2 rounded-md text-sm">View Cart</a>
      </div>
    </div>
  )
}
