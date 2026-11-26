import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { CraftBridge } from "../../preload/api.ts";
import type { ClientState } from "./client-state.ts";
import type { ClientStore } from "./store.ts";

const StoreContext = createContext<ClientStore | undefined>(undefined);
const BridgeContext = createContext<CraftBridge | undefined>(undefined);

export interface CraftProviderProps {
  store: ClientStore;
  bridge: CraftBridge;
  children?: ReactNode;
}

/** Feeds the store from the bridge for as long as the app is mounted. */
export function CraftProvider(props: CraftProviderProps): ReactNode {
  const { store, bridge } = props;
  useEffect(() => {
    const offMessage = bridge.onMessage((m) => {
      if (m.kind === "snapshot") store.applySnapshot(m.state, m.seq);
      else store.applyEvents(m.items);
    });
    const offLink = bridge.onLinkState((s) => {
      store.setLink(s);
    });
    void bridge.ready();
    return () => {
      offMessage();
      offLink();
    };
  }, [store, bridge]);
  return (
    <BridgeContext value={bridge}>
      <StoreContext value={store}>{props.children}</StoreContext>
    </BridgeContext>
  );
}

/** The only way components read state (LLD 13.2). */
export function useCraft<T>(selector: (s: ClientState) => T): T {
  const store = useContext(StoreContext);
  if (store === undefined) throw new Error("useCraft needs a CraftProvider");
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => selector(store.getState()),
  );
}

/** Commands and the folder dialog for screens; never the pipe itself. */
export function useBridge(): CraftBridge {
  const bridge = useContext(BridgeContext);
  if (bridge === undefined) throw new Error("useBridge needs a CraftProvider");
  return bridge;
}
