import Link from 'next/link'

export default function PlatformHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#dbe7ff]/90 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ImiqX home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1d4ed8] via-[#0369a1] to-[#0f766e] text-sm font-extrabold text-[#eff6ff] shadow-[0_8px_18px_rgba(30,64,175,0.3)]">
            IX
          </span>
          <div className="leading-none">
            <p className="text-sm font-bold tracking-wide text-[#0b1f4d]">ImiqX</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[#64748b]">Commerce OS</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-semibold text-[#334155] md:flex">
          <a href="#home" className="transition hover:text-[#1b4f73]">Home</a>
          <a href="#features" className="transition hover:text-[#1b4f73]">Features</a>
          <a href="#clients" className="transition hover:text-[#1b4f73]">Clients</a>
          <a href="#pricing" className="transition hover:text-[#1b4f73]">Pricing</a>
          <a href="#faq" className="transition hover:text-[#1b4f73]">FAQ</a>
          <a href="#help" className="transition hover:text-[#1b4f73]">Help</a>
        </nav>

        <a
          href="#contact-sales"
          className="rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#0369a1] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#eff6ff] shadow-[0_10px_22px_rgba(30,64,175,0.28)] transition hover:-translate-y-0.5"
        >
          Send Enquiry
        </a>
      </div>
    </header>
  )
}
