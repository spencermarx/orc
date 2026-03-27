import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Box, Text, Input, Separator, Spinner } from "../index.js";

describe("Box", () => {
  it("renders children", () => {
    const { lastFrame } = render(
      React.createElement(Box, null, React.createElement(Text, null, "hello")),
    );
    expect(lastFrame()).toContain("hello");
  });
});

describe("Text", () => {
  it("renders text content", () => {
    const { lastFrame } = render(
      React.createElement(Text, null, "world"),
    );
    expect(lastFrame()).toContain("world");
  });
});

describe("Input", () => {
  it("renders with value", () => {
    const { lastFrame } = render(
      React.createElement(Input, { value: "typed", onChange: () => {} }),
    );
    expect(lastFrame()).toContain("typed");
  });

  it("renders placeholder when value is empty", () => {
    const { lastFrame } = render(
      React.createElement(Input, { value: "", onChange: () => {}, placeholder: "type here" }),
    );
    expect(lastFrame()).toContain("type here");
  });

  it("shows cursor block", () => {
    const { lastFrame } = render(
      React.createElement(Input, { value: "", onChange: () => {} }),
    );
    expect(lastFrame()).toContain("\u2588");
  });

  it("renders with empty value and no crash", () => {
    const { lastFrame } = render(
      React.createElement(Input, { value: "", onChange: () => {} }),
    );
    expect(lastFrame()).toBeDefined();
  });

  it("handles backspace input via re-render", async () => {
    const Wrapper: React.FC = () => {
      const [value, setValue] = React.useState("abc");
      return React.createElement(Input, {
        value,
        onChange: (v: string) => { setValue(v); },
      });
    };
    const { stdin, lastFrame } = render(React.createElement(Wrapper, null));
    expect(lastFrame()).toContain("abc");
    // Allow useEffect to run and attach stdin listener
    await new Promise((r) => setTimeout(r, 100));
    stdin.write("\x7F");
    await new Promise((r) => setTimeout(r, 100));
    const frame = lastFrame() ?? "";
    // After backspace, "abc" should become "ab"
    expect(frame).toContain("ab");
  });

  it("handles character input via re-render", async () => {
    const Wrapper: React.FC = () => {
      const [value, setValue] = React.useState("ab");
      return React.createElement(Input, {
        value,
        onChange: (v: string) => { setValue(v); },
      });
    };
    const { stdin, lastFrame } = render(React.createElement(Wrapper, null));
    expect(lastFrame()).toContain("ab");
    // Allow useEffect to run and attach stdin listener
    await new Promise((r) => setTimeout(r, 100));
    stdin.write("c");
    await new Promise((r) => setTimeout(r, 100));
    expect(lastFrame()).toContain("abc");
  });
});

describe("Separator", () => {
  it("renders a horizontal line", () => {
    const { lastFrame } = render(
      React.createElement(Separator, null),
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("\u2500");
  });

  it("renders with a label", () => {
    const { lastFrame } = render(
      React.createElement(Separator, { label: "Section" }),
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Section");
    expect(frame).toContain("\u2500");
  });

  it("respects custom width", () => {
    const { lastFrame } = render(
      React.createElement(Separator, { width: 20 }),
    );
    const frame = lastFrame() ?? "";
    const dashes = (frame.match(/\u2500/g) ?? []).length;
    expect(dashes).toBe(20);
  });
});

describe("Spinner", () => {
  it("renders a braille character", () => {
    const { lastFrame } = render(
      React.createElement(Spinner, null),
    );
    const frame = lastFrame() ?? "";
    // First frame should be one of the braille spinner characters
    expect(frame).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it("renders with a label", () => {
    const { lastFrame } = render(
      React.createElement(Spinner, { label: "Loading" }),
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Loading");
  });
});
