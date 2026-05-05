import { useMemo } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { useRitaActions, useRitaDashboardData } from '../lib/contracts/hooks'

export function DashboardPage() {
  const data = useRitaDashboardData()
  const actions = useRitaActions()

  const daysLeft = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    return data.nextPing ? Math.max(0, Number((data.nextPing - BigInt(Math.floor(Date.now() / 1000))) / 86400n)) : 0
  }, [data.nextPing])

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 p-6">
        <section className="flex flex-col items-center justify-between gap-4 rounded-xl border-2 border-[#5B7E3C] bg-[#E8F5BD] p-6 md:flex-row">
          <div>
            <h2 className="text-2xl font-semibold text-[#5B7E3C]">An inheritance is waiting for you</h2>
            <p className="text-sm text-[#43493d]">State: {data.ritaState ?? 'Loading...'}</p>
          </div>
          <button
            className="rounded-lg bg-[#5B7E3C] px-8 py-4 text-lg font-bold text-white disabled:opacity-60"
            disabled={!data.isHeir || actions.isPending}
            onClick={() => actions.claimEth()}
          >
            Claim Inheritance
          </button>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="rounded-xl border border-[#E8F5BD] bg-white p-6 md:col-span-7">
            <h3 className="mb-4 text-xl font-semibold">Guardian Quorum Status</h3>
            <p className="text-sm text-[#43493d]">{data.heirs.length} heirs configured</p>
            <p className="text-sm text-[#43493d]">{daysLeft} days remaining in claim window</p>
          </div>
          <div className="rounded-xl border border-[#E8F5BD] bg-white p-6 md:col-span-5">
            <h3 className="mb-4 text-xl font-semibold">Asset Summary</h3>
            <p className="text-sm">Delegate ETH: {Number(data.delegateEthBalance).toFixed(4)} ETH</p>
            <p className="text-sm">Tracked tokens: {data.supportedTokens.length}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.supportedTokens.slice(0, 3).map((token) => (
                <button
                  key={token}
                  className="rounded border border-stone-300 px-3 py-1 text-xs"
                  onClick={() => actions.claimToken(token)}
                >
                  Claim {token.slice(0, 6)}...
                </button>
              ))}
              {data.supportedTokens.length > 1 ? (
                <button className="rounded border border-stone-300 px-3 py-1 text-xs" onClick={() => actions.claimMultiple(data.supportedTokens)}>
                  Claim all tracked tokens
                </button>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-[#E8F5BD] bg-white p-6 md:col-span-12">
            <h3 className="mb-4 text-xl font-semibold">Protocol Event Timeline</h3>
            <p className="text-sm text-[#43493d]">Events wired: Ping, ThresholdUpdated, HeirAdded/Removed, AssetsClaimed.</p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
