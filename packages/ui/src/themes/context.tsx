// @orc/ui — Theme context and provider
import React, { createContext, useContext, type FC, type ReactNode } from "react";
import type { Theme } from "./tokens.js";
import { defaultDark } from "./presets.js";

const ThemeContext = createContext<Theme>(defaultDark);

export type ThemeProviderProps = {
  theme?: Theme;
  children: ReactNode;
};

export const ThemeProvider: FC<ThemeProviderProps> = ({
  theme = defaultDark,
  children,
}) => {
  return React.createElement(ThemeContext.Provider, { value: theme }, children);
};

export const useTheme = (): Theme => {
  return useContext(ThemeContext);
};
