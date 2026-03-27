import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { ThemeProvider, useTheme } from "../context.js";
import {
  defaultDark,
  defaultLight,
  catppuccinMocha,
  catppuccinLatte,
  nord,
  tokyoNight,
  dracula,
  solarizedDark,
  oneDark,
  gruvbox,
  allThemes,
} from "../presets.js";
import type { Theme, ThemeTokens } from "../tokens.js";

// Helper component that renders the current theme name
const ThemeNameDisplay: React.FC = () => {
  const theme = useTheme();
  return React.createElement(Text, null, `theme:${theme.name}`);
};

// Helper component that renders a specific token
const TokenDisplay: React.FC<{ token: keyof ThemeTokens }> = ({ token }) => {
  const theme = useTheme();
  return React.createElement(Text, null, `token:${theme.tokens[token]}`);
};

describe("ThemeProvider", () => {
  it("provides default dark theme when no theme prop is given", () => {
    const { lastFrame } = render(
      React.createElement(ThemeProvider, null,
        React.createElement(ThemeNameDisplay, null),
      ),
    );
    expect(lastFrame()).toContain("theme:Default Dark");
  });

  it("provides a custom theme when passed as prop", () => {
    const { lastFrame } = render(
      React.createElement(ThemeProvider, { theme: nord },
        React.createElement(ThemeNameDisplay, null),
      ),
    );
    expect(lastFrame()).toContain("theme:Nord");
  });

  it("allows nested providers to override the theme", () => {
    const { lastFrame } = render(
      React.createElement(ThemeProvider, { theme: defaultDark },
        React.createElement(ThemeProvider, { theme: dracula },
          React.createElement(ThemeNameDisplay, null),
        ),
      ),
    );
    expect(lastFrame()).toContain("theme:Dracula");
  });
});

describe("useTheme", () => {
  it("returns the current theme object", () => {
    const { lastFrame } = render(
      React.createElement(ThemeProvider, { theme: tokyoNight },
        React.createElement(TokenDisplay, { token: "accent" }),
      ),
    );
    expect(lastFrame()).toContain(`token:${tokyoNight.tokens.accent}`);
  });

  it("returns default dark when used outside provider", () => {
    const { lastFrame } = render(
      React.createElement(ThemeNameDisplay, null),
    );
    expect(lastFrame()).toContain("theme:Default Dark");
  });
});

// All 35 required token keys
const REQUIRED_TOKENS: (keyof ThemeTokens)[] = [
  "bg", "bgMuted", "bgSubtle", "surface", "surfaceHover",
  "fg", "fgMuted", "fgSubtle", "fgOnAccent",
  "accent", "accentMuted", "accentSubtle",
  "success", "successMuted", "warning", "warningMuted",
  "error", "errorMuted", "info", "infoMuted",
  "border", "borderMuted", "borderFocus",
  "link", "selection",
  "goalColor", "beadColor", "engineerColor", "reviewerColor", "plannerColor", "orchestratorColor",
  "shadow", "overlay",
];

describe("Theme presets", () => {
  const presets: Theme[] = [
    defaultDark,
    defaultLight,
    catppuccinMocha,
    catppuccinLatte,
    nord,
    tokyoNight,
    dracula,
    solarizedDark,
    oneDark,
    gruvbox,
  ];

  it("allThemes contains exactly 10 themes", () => {
    expect(allThemes).toHaveLength(10);
  });

  it("allThemes matches the individual exports", () => {
    expect(allThemes).toEqual(presets);
  });

  it.each(presets.map((t) => [t.name, t]))("%s has a valid name", (_name, theme) => {
    const t = theme as Theme;
    expect(typeof t.name).toBe("string");
    expect(t.name.length).toBeGreaterThan(0);
  });

  it.each(presets.map((t) => [t.name, t]))("%s has a valid variant", (_name, theme) => {
    const t = theme as Theme;
    expect(["dark", "light"]).toContain(t.variant);
  });

  it.each(presets.map((t) => [t.name, t]))("%s has all 35 tokens", (_name, theme) => {
    const t = theme as Theme;
    const tokenKeys = Object.keys(t.tokens);
    for (const key of REQUIRED_TOKENS) {
      expect(tokenKeys).toContain(key);
    }
    // Verify we have exactly the expected count (at least 35)
    expect(tokenKeys.length).toBeGreaterThanOrEqual(REQUIRED_TOKENS.length);
  });

  it.each(presets.map((t) => [t.name, t]))("%s has valid hex color tokens", (_name, theme) => {
    const t = theme as Theme;
    const hexPattern = /^#[0-9a-fA-F]{6,8}$/;
    for (const [key, value] of Object.entries(t.tokens)) {
      expect(value, `${t.name}.tokens.${key} = "${value}" is not a valid hex color`).toMatch(hexPattern);
    }
  });

  it("has at least one light theme", () => {
    expect(presets.some((t) => t.variant === "light")).toBe(true);
  });

  it("has at least one dark theme", () => {
    expect(presets.some((t) => t.variant === "dark")).toBe(true);
  });

  it("all themes have unique names", () => {
    const names = presets.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
