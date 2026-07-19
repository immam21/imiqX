export function encodeMessage(message: string) {
  return encodeURIComponent(message)
}

export function generateWhatsAppLink(number: string, message: string) {
  const encoded = encodeMessage(message)
  const clean = number.replace(/\D/g, '')
  return `https://wa.me/${clean}?text=${encoded}`
}
