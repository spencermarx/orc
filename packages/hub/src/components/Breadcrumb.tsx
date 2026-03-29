/**
 * Breadcrumb.tsx — Navigation breadcrumb showing current hierarchy path.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ThemeConfig } from "../lib/config.js";

type BreadcrumbProps = {
  path: string[];
  theme: ThemeConfig;
};

export function Breadcrumb({ path, theme }: BreadcrumbProps) {
  return (
    <Box>
      <Text color={theme.accent} bold>
        ⚔ orc
      </Text>
      {path.map((segment) => (
        <React.Fragment key={segment}>
          <Text color={theme.secondary}> ▸ </Text>
          <Text color={theme.fg}>{segment}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
}
