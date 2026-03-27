import React from "react";
import { Box } from "ink";
import { PaneHeader } from "./PaneHeader.js";
import type { PaneHeaderProps } from "./PaneHeader.js";
import { Terminal } from "./Terminal.js";
import type { TerminalProps } from "./Terminal.js";
import { PaneFooter } from "./PaneFooter.js";
import type { PaneFooterProps } from "./PaneFooter.js";

export interface AgentPaneProps {
  header: PaneHeaderProps;
  terminal: TerminalProps;
  footer?: PaneFooterProps;
}

export function AgentPane({ header, terminal, footer }: AgentPaneProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <PaneHeader {...header} />
      <Terminal {...terminal} />
      {footer && <PaneFooter {...footer} />}
    </Box>
  );
}
