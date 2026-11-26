import { Component, type ReactNode } from "react";
import { Frame } from "../shell/inline.tsx";
import { Box, Text } from "../theme/index.ts";

export interface PanelBoundaryProps {
  graft: string;
  /** "panel" or "widget"; part of the failure line. */
  kind: string;
  children?: ReactNode;
}

interface BoundaryState {
  message: string | undefined;
}

/** Keeps one graft's crash inside its own box (US-30, G-01). */
export class GraftBoundary extends Component<PanelBoundaryProps, BoundaryState> {
  override state: BoundaryState = { message: undefined };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override render(): ReactNode {
    const { message } = this.state;
    if (message === undefined) return this.props.children;
    return (
      <Text tone="modified">{`${this.props.graft} ${this.props.kind} failed: ${message}`}</Text>
    );
  }
}

export interface PanelEntry {
  id: string;
  graft: string;
  title: string;
  /** The panel element; it renders inside the boundary, so a throw stays in its own box. */
  element: ReactNode;
  focused?: boolean;
}

export interface PanelHostProps {
  panels: readonly PanelEntry[];
}

/** Every panel in its own framed box with its own error boundary. */
export function PanelHost(props: PanelHostProps): ReactNode {
  if (props.panels.length === 0) {
    return (
      <Box padX={1}>
        <Text tone="textDim">no panels open</Text>
      </Box>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {props.panels.map((p) => (
        <Frame key={p.id} tone={p.focused === true ? "accent" : "line"}>
          <Text tone="textDim" bold>
            {p.title}
          </Text>
          <GraftBoundary graft={p.graft} kind="panel">
            {p.element}
          </GraftBoundary>
        </Frame>
      ))}
    </div>
  );
}
