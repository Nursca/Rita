import type { PropsWithChildren } from 'react'
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { usePrivy, useWallets, type ConnectedWallet } from '@privy-io/react-auth'
const navItems = [
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/my-will', label: 'My Will' },
  { to: '/app/guardians', label: 'Guardians' },
  { to: '/app/pulse', label: 'Pulse' },
  { to: '/app/assets', label: 'Assets' },
  { to: '/app/settings', label: 'Settings' },
] as const
export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation()
  const { login, logout, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const embeddedWallet = wallets.find((w: ConnectedWallet) => w.walletClientType === 'privy')
  const address = embeddedWallet?.address as `0x${string}` | undefined
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const handleCopy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="min-h-screen bg-[#F9FBF2]">
      <aside className="fixed left-0 top-0 z-40 flex h-full w-[260px] flex-col border-r border-stone-800 bg-stone-900 py-6">
        <div className="mb-6 px-6">
          <h1 className="text-xl font-bold text-white">Rita Protocol</h1>
          <p className="text-xs text-stone-400">Beneficiary Portal</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block rounded-lg px-4 py-3 text-sm transition ${
                  active ? 'bg-stone-800 text-lime-500' : 'text-stone-400 hover:bg-stone-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4">
          {authenticated ? (
            <button className="w-full rounded-lg bg-stone-800 px-4 py-3 text-sm text-white hover:bg-stone-700 transition" onClick={() => logout()}>
              Logout
            </button>
          ) : (
            <button
              className="w-full rounded-lg bg-stone-800 px-4 py-3 text-sm text-white hover:bg-stone-700 transition"
              onClick={() => login()}
            >
              Login with Privy
            </button>
          )}
        </div>
      </aside>
      
      <header className="fixed right-0 top-0 z-30 flex h-16 w-[calc(100%-260px)] items-center justify-end border-b border-stone-200 bg-[#F9FBF2] px-8">
        {address ? (
          <div ref={dropdownRef} className="relative">
            {/* Trigger pill */}
            <button
              id="wallet-address-trigger"
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-1.5 text-xs font-mono text-stone-700 shadow-sm transition hover:border-stone-300 hover:shadow-md"
            >
              {/* Green dot */}
              <span className="h-2 w-2 rounded-full bg-lime-500 shrink-0" />
              {address.slice(0, 6)}...{address.slice(-4)}
              {/* Chevron */}
              <svg
                className={`h-3 w-3 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* Dropdown panel */}
            {open && (
              <div className="absolute right-0 top-full mt-2 w-[340px] rounded-xl border border-stone-200 bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
                <div className="border-b border-stone-100 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Connected Wallet</p>
                </div>
                {/* Full address display */}
                <div className="px-4 py-3">
                  <p
                    id="wallet-full-address"
                    className="break-all font-mono text-[13px] leading-relaxed text-stone-800 select-all"
                  >
                    {address}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-stone-100 px-4 py-3">
                  <button
                    id="wallet-copy-button"
                    onClick={handleCopy}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      copied
                        ? 'bg-lime-50 text-lime-700 border border-lime-200'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {copied ? (
                      <>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="5" y="5" width="9" height="9" rx="1.5" />
                          <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" strokeLinecap="round" />
                        </svg>
                        Copy Address
                      </>
                    )}
                  </button>
                  <a
                    href={`https://sepolia.etherscan.io/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-200 transition"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3" strokeLinecap="round" />
                      <path d="M10 2h4v4M14 2L8 8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Etherscan
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <span className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-xs text-stone-400">
            Not authenticated
          </span>
        )}
      </header>
      <main className="ml-[260px] min-h-screen pt-16">{children}</main>
    </div>
  )
}
