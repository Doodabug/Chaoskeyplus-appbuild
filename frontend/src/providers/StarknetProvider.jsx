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
<<<<<<< HEAD
  rescanWallets,
=======
  registerInPool,
>>>>>>> 4e368b48ee43aca05b6d080201b2b622bd8c5ec9
  shieldAmount,
  subscribeSession,
  switchToSepolia,
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
      switchToSepolia,
      rescan: rescanWallets,
      disconnect: disconnectWallet,
      switchToSepolia,
      register: registerInPool,
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
