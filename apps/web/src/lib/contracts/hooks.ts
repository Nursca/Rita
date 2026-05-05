import { useMemo, useState } from 'react'
import { formatEther } from 'viem'
import { useAccount, useBalance, useReadContracts, useWriteContract, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { useWallets } from '@privy-io/react-auth'
import { ritaDelegateAbi, ritaRegistryAbi } from './abi'
import { checkDelegation, upgradeAndInitialize } from './eip7702'
import { usePrivyEIP7702 } from './usePrivyEIP7702'
import { CONTRACTS } from './config'

export function useRitaDashboardData() {
  const { address } = useAccount()
  
  const { data } = useReadContracts({
    contracts: [
      { abi: ritaDelegateAbi, address: address, functionName: 'getRitaState' },
      { abi: ritaDelegateAbi, address: address, functionName: 'getNextPingtime' },
      { abi: ritaDelegateAbi, address: address, functionName: 'getThreshold' },
      { abi: ritaDelegateAbi, address: address, functionName: 'getSupportedTokens' },
      { abi: ritaDelegateAbi, address: address, functionName: 'getHeirs' },
      {
        abi: ritaRegistryAbi,
        address: CONTRACTS.ritaRegistry,
        functionName: 'getOwnersByHeir',
        args: [address ?? '0x0000000000000000000000000000000000000000'],
      },
    ],
    query: { enabled: Boolean(address) },
  })
  
  const { data: ethBalance } = useBalance({
    address: address,
  })
  
  const ownersByHeir = useMemo(() => {
    return (data?.[5].result as `0x${string}`[] | undefined) ?? []
  }, [data?.[5].result])
  
  return useMemo(
    () => ({
      ritaState: data?.[0].result as string | undefined,
      nextPing: data?.[1].result as bigint | undefined,
      threshold: data?.[2].result as bigint | undefined,
      supportedTokens: (data?.[3].result as `0x${string}`[] | undefined) ?? [],
      heirs: (data?.[4].result as `0x${string}`[] | undefined) ?? [],
      ownersByHeir,
      isHeir: ownersByHeir.length > 0,
      delegateEthBalance: ethBalance ? formatEther(ethBalance.value) : '0',
    }),
    [data, ethBalance, ownersByHeir],
  )
}

// ---------------------------------------------------------------------------
// useInheritances — heir-centric hook
// ---------------------------------------------------------------------------
// Fetches all wills the connected wallet is a beneficiary of.
// For each owner returned by RitaRegistry.getOwnersByHeir we batch-read the
// relevant state from the owner's delegated account (RitaDelegate ABI).
// ---------------------------------------------------------------------------

export interface InheritanceEntry {
  owner: `0x${string}`
  ritaState: string | undefined
  nextPingtime: bigint | undefined
  supportedTokens: `0x${string}`[]
  ethBalance: string
  isClaimable: boolean
}

export function useInheritances() {
  const { address } = useAccount()
  
  // Step 1: get the list of owners who registered this address as an heir
  const { data: ownersData, isLoading: ownersLoading } = useReadContracts({
    contracts: [
      {
        abi: ritaRegistryAbi,
        address: CONTRACTS.ritaRegistry,
        functionName: 'getOwnersByHeir',
        args: [address ?? '0x0000000000000000000000000000000000000000'],
      },
    ],
    query: { enabled: Boolean(address) },
  })
  
  const owners = useMemo<`0x${string}`[]>(
    () => (ownersData?.[0].result as `0x${string}`[] | undefined) ?? [],
    [ownersData],
  )
  
  // Step 2: for each owner, read state + tokens from their delegated account
  const perOwnerContracts = useMemo(
    () =>
      owners.flatMap((owner) => [
        { abi: ritaDelegateAbi, address: owner, functionName: 'getRitaState' as const },
        { abi: ritaDelegateAbi, address: owner, functionName: 'getNextPingtime' as const },
        { abi: ritaDelegateAbi, address: owner, functionName: 'getSupportedTokens' as const },
      ]),
    [owners],
  )
  
  const { data: perOwnerData, isLoading: detailsLoading } = useReadContracts({
    contracts: perOwnerContracts,
    query: { enabled: owners.length > 0 },
  })
  
  // Step 3: read ETH balances for each owner
  // wagmi's useBalance only handles one address at a time, so we use
  // a public client query to fetch each owner's ETH balance.
  // for the first owner only and note the limitation. For a full multi-owner
  // balance read we rely on the owner's ETH balance via a public client query.
  const publicClient = usePublicClient()
  
  const { data: ethBalances } = useQuery({
    queryKey: ['heir-eth-balances', owners.join(',')],
    queryFn: async () => {
      if (!publicClient || owners.length === 0) return []
      return Promise.all(
        owners.map((owner) =>
          publicClient.getBalance({ address: owner }).then(formatEther).catch(() => '0'),
        ),
      )
    },
    enabled: owners.length > 0 && Boolean(publicClient),
  })
  
  // Step 4: assemble InheritanceEntry[]
  const inheritances = useMemo<InheritanceEntry[]>(() => {
    if (owners.length === 0) return []
    const now = BigInt(Math.floor(Date.now() / 1000))
    
    return owners.map((owner, i) => {
      const base = i * 3
      const ritaState = perOwnerData?.[base]?.result as string | undefined
      const nextPingtime = perOwnerData?.[base + 1]?.result as bigint | undefined
      const supportedTokens = (perOwnerData?.[base + 2]?.result as `0x${string}`[] | undefined) ?? []
      const ethBalance = ethBalances?.[i] ?? '0'
      const isClaimable = ritaState === 'CLAIMABLE' || (nextPingtime !== undefined && now >= nextPingtime)
      
      return { owner, ritaState, nextPingtime, supportedTokens, ethBalance, isClaimable }
    })
  }, [owners, perOwnerData, ethBalances])
  
  return {
    inheritances,
    isLoading: ownersLoading || (owners.length > 0 && detailsLoading),
    hasInheritance: inheritances.length > 0,
  }
}

// ---------------------------------------------------------------------------
// useClaimInheritance — per-owner claim actions
// ---------------------------------------------------------------------------

export function useClaimInheritance(owner: `0x${string}`) {
  const { writeContractAsync, isPending } = useWriteContract()
  
  return {
    isPending,
    claimEth: () =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: owner,
        functionName: 'claimETH',
      }),
    claimToken: (token: `0x${string}`) =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: owner,
        functionName: 'claimERC20',
        args: [token],
      }),
    claimMultiple: (tokens: `0x${string}`[]) =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: owner,
        functionName: 'claimMultipleTokens',
        args: [tokens],
      }),
  }
}

export function useRitaActions() {
  const { address } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const dashboard = useRitaDashboardData()
  
  // For heir actions, we typically act on the owner's account.
  // For owner actions, we act on our own account (address).
  const targetAddress = address
  
  return {
    isPending,
    claimEth: () => {
      const owner = dashboard.ownersByHeir[0]
      if (!owner) return Promise.reject('No inheritance to claim')
      return writeContractAsync({
        abi: ritaDelegateAbi,
        address: owner,
        functionName: 'claimETH',
      })
    },
    claimToken: (token: `0x${string}`) => {
      const owner = dashboard.ownersByHeir[0]
      if (!owner) return Promise.reject('No inheritance to claim')
      return writeContractAsync({
        abi: ritaDelegateAbi,
        address: owner,
        functionName: 'claimERC20',
        args: [token],
      })
    },
    claimMultiple: (tokens: `0x${string}`[]) => {
      const owner = dashboard.ownersByHeir[0]
      if (!owner) return Promise.reject('No inheritance to claim')
      return writeContractAsync({
        abi: ritaDelegateAbi,
        address: owner,
        functionName: 'claimMultipleTokens',
        args: [tokens],
      })
    },
    ping: () =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: targetAddress!,
        functionName: 'ping',
      }),
    updateThreshold: (value: bigint) =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: targetAddress!,
        functionName: 'updateThreshold',
        args: [value],
      }),
    addHeir: (heir: `0x${string}`) =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: targetAddress!,
        functionName: 'addHeir',
        args: [heir],
      }),
    removeHeir: (heir: `0x${string}`) =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: targetAddress!,
        functionName: 'removeHeir',
        args: [heir],
      }),
    addToken: (token: `0x${string}`) =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: targetAddress!,
        functionName: 'addToken',
        args: [token],
      }),
    removeToken: (token: `0x${string}`) =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: targetAddress!,
        functionName: 'removeToken',
        args: [token],
      }),
    initialize: (heirs: `0x${string}`[], threshold: bigint, coreStables: `0x${string}`[]) =>
      writeContractAsync({
        abi: ritaDelegateAbi,
        address: targetAddress!,
        functionName: 'initialize',
        args: [heirs, threshold, coreStables],
      }),
    registerHeir: (heir: `0x${string}`) =>
      writeContractAsync({
        abi: ritaRegistryAbi,
        address: CONTRACTS.ritaRegistry,
        functionName: 'registerHeir',
        args: [heir],
      }),
    deregisterHeir: (heir: `0x${string}`) =>
      writeContractAsync({
        abi: ritaRegistryAbi,
        address: CONTRACTS.ritaRegistry,
        functionName: 'deregisterHeir',
        args: [heir],
      }),
  }
}

export function useIsUpgraded() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  
  const { data: code } = useQuery({
    queryKey: ['account-code', address],
    queryFn: () => publicClient?.getCode({ address: address! }),
    enabled: !!address && !!publicClient,
  })
  
  return code?.startsWith('0xef0100') ?? false
}

export function useEIP7702() {
  const { address } = useAccount()
  const { wallets } = useWallets()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const privy7702 = usePrivyEIP7702()
  
  const upgrade = async (
    heirs: string[],
    thresholdDays: number,
    stableTokens: string[],
  ) => {
    setIsPending(true)
    setError(null)
    
    try {
      const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
      
      if (embeddedWallet) {
        console.log('Detected Privy embedded wallet, using Privy EIP-7702 path...');
        await privy7702.upgrade(
          heirs as `0x${string}`[],
          thresholdDays,
          stableTokens as `0x${string}`[]
        );
      } else {
        console.log('No Privy embedded wallet, using standard EIP-7702 path...');
        await upgradeAndInitialize(heirs, thresholdDays, stableTokens)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Upgrade failed')
      throw err
    } finally {
      setIsPending(false)
    }
  }
  
  const checkStatus = async () => {
    if (!address) return false
    const result = await checkDelegation(address)
    return result.isDelegated
  }
  
  return { upgrade, checkStatus, isPending, error }
}
