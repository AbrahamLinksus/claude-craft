import type { ReactNode } from "react";
import type { RepoView } from "../../../../../protocol/src/index.ts";
import { Box, Row, Text } from "../../theme/index.ts";

export interface StartupViewProps {
  repos: readonly RepoView[];
  selected: number;
  error: string | undefined;
}

const HINT = "j/k move · enter or number picks · o open folder · : commands";

function RepoRow(props: { repo: RepoView; index: number; active: boolean }): ReactNode {
  const { repo, index, active } = props;
  const missing = repo.missing === true;
  return (
    <Row>
      <Text tone={active ? "accent" : "textDim"}>{active ? ">" : " "}</Text>
      <Text tone="textDim">{String(index + 1)}</Text>
      <Text tone={missing ? "textDim" : "text"} bold={active}>
        {repo.name}
      </Text>
      <Text tone="textDim" truncate>
        {missing ? "missing · x forget" : repo.path}
      </Text>
    </Row>
  );
}

/** The first screen: where the agent will work (US-01). Presentational only. */
export function StartupView(props: StartupViewProps): ReactNode {
  const { repos, selected, error } = props;
  return (
    <Box padX={2} padY={1} maxCols={80}>
      <Text tone="accent" bold>
        Craft
      </Text>
      <Box padY={1}>
        <Text tone="textDim">recent repos</Text>
        {repos.length === 0 ? (
          <Text tone="textDim">no repos yet</Text>
        ) : (
          repos.map((repo, i) => (
            <RepoRow key={repo.repoKey} repo={repo} index={i} active={i === selected} />
          ))
        )}
      </Box>
      <Text tone="text">o open folder…</Text>
      {error === undefined ? null : <Text tone="modified">{error}</Text>}
      <Box padY={1}>
        <Text tone="textDim">{HINT}</Text>
      </Box>
    </Box>
  );
}
