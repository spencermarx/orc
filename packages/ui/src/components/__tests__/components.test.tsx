import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Terminal } from "../Terminal.js";
import { PaneHeader } from "../PaneHeader.js";
import { PaneFooter } from "../PaneFooter.js";
import { AgentPane } from "../AgentPane.js";
import { StatusBar } from "../StatusBar.js";
import { TabBar } from "../TabBar.js";
import { NotificationToast } from "../NotificationToast.js";
import { BeadGraph } from "../BeadGraph.js";
import { DiffPreview } from "../DiffPreview.js";
import { CostDashboard } from "../CostDashboard.js";

describe("Terminal", () => {
  it("renders content", () => {
    const { lastFrame } = render(
      <Terminal content="hello world" cols={40} rows={5} />
    );
    expect(lastFrame()).toContain("hello world");
  });
});

describe("PaneHeader", () => {
  it("renders role icon and status", () => {
    const { lastFrame } = render(
      <PaneHeader role="goal" id="auth-bug" status="working" />
    );
    const frame = lastFrame();
    expect(frame).toContain("⚔");
    expect(frame).toContain("auth-bug");
    expect(frame).toContain("working");
  });

  it("renders engineer icon", () => {
    const { lastFrame } = render(
      <PaneHeader role="engineer" id="bd-a1b2" status="ready" />
    );
    expect(lastFrame()).toContain("●");
  });

  it("renders reviewer icon", () => {
    const { lastFrame } = render(
      <PaneHeader role="reviewer" id="review-1" status="reviewing" />
    );
    expect(lastFrame()).toContain("✓");
  });
});

describe("PaneFooter", () => {
  it("renders diff stats", () => {
    const { lastFrame } = render(
      <PaneFooter additions={10} deletions={3} fileCount={4} cost={0.5} />
    );
    const frame = lastFrame();
    expect(frame).toContain("+10");
    expect(frame).toContain("-3");
    expect(frame).toContain("4 files");
    expect(frame).toContain("$0.50");
  });
});

describe("AgentPane", () => {
  it("renders header, terminal, and footer", () => {
    const { lastFrame } = render(
      <AgentPane
        header={{ role: "engineer", id: "bd-a1b2", status: "working" }}
        terminal={{ content: "building...", cols: 30, rows: 3 }}
        footer={{ additions: 5, deletions: 2 }}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain("bd-a1b2");
    expect(frame).toContain("building...");
    expect(frame).toContain("+5");
  });
});

describe("StatusBar", () => {
  it("renders breadcrumb", () => {
    const { lastFrame } = render(
      <StatusBar
        breadcrumb={["orc", "my-project"]}
        workers={{ working: 2, review: 1, blocked: 0, dead: 0 }}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain("orc");
    expect(frame).toContain("my-project");
  });
});

describe("TabBar", () => {
  it("renders tabs", () => {
    const { lastFrame } = render(
      <TabBar
        tabs={[
          { id: "1", label: "Overview", active: true },
          { id: "2", label: "Goals", badge: "3" },
        ]}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain("Overview");
    expect(frame).toContain("Goals");
    expect(frame).toContain("3");
  });
});

describe("NotificationToast", () => {
  it("renders message", () => {
    const { lastFrame } = render(
      <NotificationToast message="Build succeeded" type="success" />
    );
    expect(lastFrame()).toContain("Build succeeded");
    expect(lastFrame()).toContain("✓");
  });
});

describe("BeadGraph", () => {
  it("renders nodes", () => {
    const { lastFrame } = render(
      <BeadGraph
        beads={[
          { id: "bd-a1b2", status: "done", dependencies: [] },
          { id: "bd-c3d4", status: "working", dependencies: ["bd-a1b2"] },
        ]}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain("bd-a1b2");
    expect(frame).toContain("bd-c3d4");
    expect(frame).toContain("done");
    expect(frame).toContain("working");
  });
});

describe("DiffPreview", () => {
  it("renders diff lines", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "@@ -1,3 +1,4 @@",
      " unchanged",
      "-removed line",
      "+added line",
    ].join("\n");
    const { lastFrame } = render(<DiffPreview diff={diff} />);
    const frame = lastFrame();
    expect(frame).toContain("+added line");
    expect(frame).toContain("-removed line");
  });
});

describe("CostDashboard", () => {
  it("renders total cost and agents", () => {
    const { lastFrame } = render(
      <CostDashboard
        totalCost={3.75}
        totalTokens={125000}
        perAgent={[
          { name: "engineer-1", cost: 2.50, tokens: 85000 },
          { name: "goal-orch", cost: 1.25, tokens: 40000 },
        ]}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain("$3.75");
    expect(frame).toContain("125,000");
    expect(frame).toContain("engineer-1");
    expect(frame).toContain("$2.50");
  });
});
