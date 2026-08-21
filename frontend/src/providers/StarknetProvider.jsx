import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  fetchPoolFee,
  fetchPoolRegistration,
  fetchShieldedBalances,
  getProvider,
  getRpcUrl,
  getSession,
  initWalletStore,
  refreshMaturity,
  rescanWallets,
  shieldAmount,
  subscribeSession,
  transferAmount,
  unshieldAmount,
} from "../lib/starknetWallet";

const StarknetContext = createContext(null);

export function StarknetProvider({ children }) {
  const [session, setSession] = useState(getSession);

  useEffect(() => {
    initWalletStore();
    return subscribeSession(setSession);
  }, []);

  const value = useMemo(
    () => ({
      ...session,
      provider: getProvider(),
      rpcUrl: getRpcUrl(),
      connect: connectWallet,
      rescan: rescanWallets,
      disconnect: disconnectWallet,
      shield: shieldAmount,
      transfer: transferAmount,
      unshield: unshieldAmount,
      fetchFee: fetchPoolFee,
      fetchRegistration: fetchPoolRegistration,
      fetchBalances: fetchShieldedBalances,
      refreshMaturity,
    }),
    [session]
  );

  return (
    <StarknetContext.Provider value={value}>{children}</StarknetContext.Provider>
  );
}

export function useStarknet() {
  const ctx = useContext(StarknetContext);
  if (!ctx) {
    throw new Error("useStarknet must be used inside StarknetProvider");
  }
  return ctx;
}
