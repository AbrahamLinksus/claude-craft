import { Fragment, type ReactNode } from "react";
import type { ParseResult } from "../input/index.ts";
import { Box } from "../theme/index.ts";
import { Dot, Span } from "./inline.tsx";

export interface WhichKeyProps {
  parse: ParseResult | undefined;
}

/** After a partial sentence: each next key with its name and owning graft (US-05). */
export function WhichKey(props: WhichKeyProps): ReactNode {
  const { parse } = props;
  if (parse?.status !== "partial" || parse.next.length === 0) return null;
  return (
    <div role="status" aria-label="which key">
      <Box padX={1} fill="surfaceSunken" borderTop>
        {parse.next.map((k, i) => (
          <Fragment key={k.key}>
            {i === 0 ? null : <Dot />}
            <Span tone="accent" bold>
              {k.key}
            </Span>
            <Span>{` ${k.name} `}</Span>
            <Span tone="textDim">{`(${k.owner})`}</Span>
          </Fragment>
        ))}
      </Box>
    </div>
  );
}
