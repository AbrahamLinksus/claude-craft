import type { ReactNode } from "react";
import type { OpenPrompt } from "@craft/protocol";
import { Row, Text } from "../theme/index.ts";
import { Dot, Frame, Span } from "./inline.tsx";
import { queuePosition } from "./model.ts";

export interface PromptOverlayProps {
  prompt: OpenPrompt | undefined;
  /** Label of the session the prompt belongs to (`s2`), shown first. */
  session?: string | undefined;
}

const OVERLAY_COLS = 90;

/** The head of the prompt queue; while it is open it gets every key (US-08). */
export function PromptOverlay(props: PromptOverlayProps): ReactNode {
  const { prompt } = props;
  if (prompt === undefined) return null;
  return (
    <div role="dialog" aria-label="prompt">
      <Frame tone="accent" maxCols={OVERLAY_COLS}>
        <Text>
          <Span tone="accent" bold>
            {queuePosition(prompt)}
          </Span>
          <Dot />
          {props.session === undefined ? null : (
            <>
              <Span bold>{props.session}</Span>
              <Dot />
            </>
          )}
          <Span bold>{prompt.title}</Span>
        </Text>
        {(prompt.body ?? []).map((line) => (
          <Text key={line} tone="textDim">
            {line}
          </Text>
        ))}
        <Row>
          {prompt.options.map((o) => (
            <span key={o.key}>
              <Span tone="accent" bold>
                {o.key}
              </Span>
              <Span>{` ${o.label}`}</Span>
            </span>
          ))}
        </Row>
      </Frame>
    </div>
  );
}
