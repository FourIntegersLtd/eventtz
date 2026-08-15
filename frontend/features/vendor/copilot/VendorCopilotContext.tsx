"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type CopilotView = { name: "home" } | { name: "chat"; initialQ?: string };

type VendorCopilotContextValue = {
  open: boolean;
  view: CopilotView;
  openCopilot: (view?: CopilotView) => void;
  closeCopilot: () => void;
  setView: (view: CopilotView) => void;
};

const VendorCopilotContext = createContext<VendorCopilotContextValue | null>(null);

export function VendorCopilotProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CopilotView>({ name: "home" });

  useEffect(() => {
    setOpen(false);
    setView({ name: "home" });
  }, [pathname]);

  const openCopilot = useCallback((next: CopilotView = { name: "home" }) => {
    setView(next);
    setOpen(true);
  }, []);

  const closeCopilot = useCallback(() => {
    setOpen(false);
    setView({ name: "home" });
  }, []);

  const value = useMemo(
    () => ({ open, view, openCopilot, closeCopilot, setView }),
    [open, view, openCopilot, closeCopilot],
  );

  return (
    <VendorCopilotContext.Provider value={value}>{children}</VendorCopilotContext.Provider>
  );
}

export function useVendorCopilot(): VendorCopilotContextValue {
  const ctx = useContext(VendorCopilotContext);
  if (!ctx) {
    throw new Error("useVendorCopilot must be used within VendorCopilotProvider");
  }
  return ctx;
}

/** Safe when co-pilot provider is absent (e.g. tests). */
export function useVendorCopilotOptional(): VendorCopilotContextValue | null {
  return useContext(VendorCopilotContext);
}
