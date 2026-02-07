import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface WalletModalContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const WalletModalContext = createContext<WalletModalContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <WalletModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </WalletModalContext.Provider>
  );
}

export function useWalletModal() {
  return useContext(WalletModalContext);
}
