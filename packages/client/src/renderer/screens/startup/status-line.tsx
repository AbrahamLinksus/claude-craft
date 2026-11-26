import type { ReactNode } from "react";
import type { LinkState } from "../../../preload/api.ts";
import { Box, Row, Text, type ColorToken } from "../../theme/index.ts";

const TONE: Record<LinkState["status"], ColorToken> = {
  connected: "committed",
  connecting: "textDim",
  reconnecting: "lab",
};

const LABEL: Record<LinkState["status"], string> = {
  connected: "connected",
  connecting: "connecting…",
  reconnecting: "reconnecting…",
};

export interface StatusLineProps {
  link: LinkState;
}

/** Bottom line: the state of the connection to Craft's background worker (US-17). */
export function StatusLine(props: StatusLineProps): ReactNode {
  const { link } = props;
  return (
    <Box padX={1} fill="surfaceRaised" borderTop>
      <Row>
        <Text tone={TONE[link.status]} bold>
          {LABEL[link.status]}
        </Text>
        {link.message === undefined ? null : <Text tone="textDim">{link.message}</Text>}
      </Row>
    </Box>
  );
}
