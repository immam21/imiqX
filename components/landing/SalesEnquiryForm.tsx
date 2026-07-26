'use client'

import { FormEvent, useState } from 'react'

type EnquiryPayload = {
  name: string
  businessName: string
  whatsapp: string
  city: string
  message: string
}

const initialState: EnquiryPayload = {
  name: '',
  businessName: '',
  whatsapp: '',
  city: '',
  message: '',
}

export default function SalesEnquiryForm() {
  const [payload, setPayload] = useState<EnquiryPayload>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorText, setErrorText] = useState('We could not submit right now. Please try again.')

  const updateField = (key: keyof EnquiryPayload, value: string) => {
    setPayload((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus('idle')
    setErrorText('We could not submit right now. Please try again.')

    try {
      const response = await fetch('/api/platform/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const json = await response.json().catch(() => ({ error: 'Failed to send enquiry' }))
        throw new Error(json?.error || 'Failed to send enquiry')
      }

      setStatus('success')
      setPayload(initialState)
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'We could not submit right now. Please try again.'
      setErrorText(message)
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form className="mt-5 space-y-3.5" onSubmit={onSubmit}>
        <input
          className="w-full rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3.5 py-2.5 text-sm text-[#0f172a] outline-none transition focus:border-[#1d4ed8] focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]/15"
          placeholder="Full name"
          value={payload.name}
          onChange={(e) => updateField('name', e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3.5 py-2.5 text-sm text-[#0f172a] outline-none transition focus:border-[#1d4ed8] focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]/15"
          placeholder="Business name"
          value={payload.businessName}
          onChange={(e) => updateField('businessName', e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3.5 py-2.5 text-sm text-[#0f172a] outline-none transition focus:border-[#1d4ed8] focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]/15"
          placeholder="WhatsApp number"
          value={payload.whatsapp}
          onChange={(e) => updateField('whatsapp', e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3.5 py-2.5 text-sm text-[#0f172a] outline-none transition focus:border-[#1d4ed8] focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]/15"
          placeholder="City"
          value={payload.city}
          onChange={(e) => updateField('city', e.target.value)}
          required
        />
        <textarea
          className="h-24 w-full rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3.5 py-2.5 text-sm text-[#0f172a] outline-none transition focus:border-[#1d4ed8] focus:bg-white focus:ring-2 focus:ring-[#1d4ed8]/15"
          placeholder="Tell us what you sell"
          value={payload.message}
          onChange={(e) => updateField('message', e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#0369a1] px-4 py-3 text-sm font-bold text-[#eff6ff] shadow-[0_10px_24px_rgba(30,64,175,0.3)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Sending...' : 'Send Enquiry'}
        </button>
      </form>

      {status === 'success' && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">We have sent the details, Our Customer Support will getback you shortly.</p>
      )}
      {status === 'error' && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{errorText}</p>
      )}
    </>
  )
}