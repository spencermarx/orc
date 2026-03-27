// @orc/ui — Theme tokens and type definitions

export type ThemeTokens = {
  // Surface colors
  bg: string;
  bgMuted: string;
  bgSubtle: string;
  surface: string;
  surfaceHover: string;

  // Foreground / text
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  fgOnAccent: string;

  // Accent / brand
  accent: string;
  accentMuted: string;
  accentSubtle: string;

  // Semantic: status
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  error: string;
  errorMuted: string;
  info: string;
  infoMuted: string;

  // Borders
  border: string;
  borderMuted: string;
  borderFocus: string;

  // Interactive
  link: string;
  selection: string;

  // Semantic: roles
  goalColor: string;
  beadColor: string;
  engineerColor: string;
  reviewerColor: string;
  plannerColor: string;
  orchestratorColor: string;

  // Misc
  shadow: string;
  overlay: string;
};

export type Theme = {
  name: string;
  variant: "dark" | "light";
  tokens: ThemeTokens;
};
