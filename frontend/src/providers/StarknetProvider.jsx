import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  fetchPoolFee,
  fetchShieldedBalances,
  getProvider,
  getRpcUrl,
  getSession,
  initWalletStore,
  refreshMaturity,
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
      disconnect: disconnectWallet,
      shield: shieldAmount,
      transfer: transferAmount,
      unshield: unshieldAmount,
      fetchFee: fetchPoolFee,
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
