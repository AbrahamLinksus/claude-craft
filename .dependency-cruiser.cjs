/** Layer rules of LLD 0.3. All rules are errors. */
const GRAFT_NODE_IO = "^node:(fs|child_process|net|http|https|worker_threads|dgram)";
const GRAFT_NODE_BARE = "^(fs|child_process|net|http|https)$";

module.exports = {
  forbidden: [
    {
      name: "graft-public-api-only",
      severity: "error",
      from: { path: "^grafts/([^/]+)/daemon" },
      to: { pathNot: ["^packages/(graft-api|protocol)/", "^grafts/$1/", "node_modules/zod/"] },
    },
    {
      name: "graft-ui-public-api-only",
      severity: "error",
      from: { path: "^grafts/([^/]+)/ui" },
      to: { pathNot: ["^packages/(graft-ui|protocol)/", "^grafts/$1/", "node_modules/react/"] },
    },
    {
      name: "graft-no-cross-graft",
      severity: "error",
      from: { path: "^grafts/([^/]+)/" },
      to: { path: "^grafts/", pathNot: "^grafts/$1/" },
    },
    {
      name: "graft-no-node-io",
      severity: "error",
      from: { path: "^grafts/" },
      to: { path: [GRAFT_NODE_IO, GRAFT_NODE_BARE] },
    },
    {
      name: "sdk-only-in-adapter",
      severity: "error",
      from: { pathNot: "^packages/daemon/src/agent/sdk-adapter/" },
      to: { path: "@anthropic-ai/claude-agent-sdk" },
    },
    {
      name: "spawn-only-in-allowed",
      severity: "error",
      from: {
        pathNot:
          "^packages/daemon/src/(git/worker|agent/sdk-adapter|process)/|^packages/client/src/main/",
      },
      to: { path: "^node:child_process$|^child_process$" },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      from: { path: "^packages/daemon/src/domain/" },
      to: { path: ["^node:", "^packages/daemon/src/(?!domain/)"] },
    },
    {
      name: "module-via-index",
      severity: "error",
      from: { path: "^packages/daemon/src/([^/]+)/" },
      to: { path: "^packages/daemon/src/(?!$1/)[^/]+/(?!index[.]ts$)" },
    },
    {
      name: "client-not-daemon",
      severity: "error",
      from: { path: "^packages/client/" },
      to: { path: "^packages/(daemon|graft-api)/" },
    },
    {
      name: "renderer-no-node",
      severity: "error",
      from: { path: "^packages/client/src/renderer/" },
      to: { path: ["^node:", "^electron$", "^packages/client/src/main/"] },
    },
    {
      name: "protocol-leaf",
      severity: "error",
      from: { path: "^packages/protocol/" },
      to: { path: "^packages/(?!protocol/)|^grafts/" },
    },
    {
      name: "graft-api-leaf",
      severity: "error",
      from: { path: "^packages/graft-(api|ui)/" },
      to: { path: "^packages/(daemon|client)/|^grafts/" },
    },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    exclude: { path: "(^|/)(node_modules|dist|coverage|out)/" },
  },
};
