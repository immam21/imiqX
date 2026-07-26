export default function PlatformFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[#d6e3f8] bg-[#eef5ff]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0b1f4d]">ImiqX Commerce OS</p>
            <p className="mt-1 text-xs text-[#475569]">Website + WhatsApp + Android + iOS for brand growth.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#475569]">
            <a href="#home" className="transition hover:text-[#1b4f73]">Home</a>
            <a href="#features" className="transition hover:text-[#1b4f73]">Features</a>
            <a href="#clients" className="transition hover:text-[#1b4f73]">Clients</a>
            <a href="#pricing" className="transition hover:text-[#1b4f73]">Pricing</a>
            <a href="#faq" className="transition hover:text-[#1b4f73]">FAQ</a>
            <a href="#help" className="transition hover:text-[#1b4f73]">Help</a>
          </div>
        </div>

        <div className="mt-6 border-t border-[#d6e3f8] pt-4 text-xs text-[#64748b]">
          <p>© {year} ImiqX. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
