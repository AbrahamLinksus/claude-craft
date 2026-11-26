import type { ReactNode } from "react";
import { useCraft, type ScreenDef } from "../../state/index.ts";
import { StartupView } from "./startup-view.tsx";
import { StatusLine } from "./status-line.tsx";
import { useStartup } from "./use-startup.ts";

function Startup(): ReactNode {
  const model = useStartup();
  const link = useCraft((s) => s.link);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <StartupView repos={model.repos} selected={model.selected} error={model.error} />
      </div>
      <StatusLine link={link} />
    </div>
  );
}

export const screen: ScreenDef = {
  id: "startup",
  title: "Startup",
  render: () => <Startup />,
};
