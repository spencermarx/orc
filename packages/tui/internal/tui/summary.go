package tui

import (
	"fmt"
	"strings"
	"time"
)

// GoalSummary holds completion stats for a goal.
type GoalSummary struct {
	GoalName     string
	ProjectKey   string
	BeadCount    int
	TotalElapsed time.Duration
	TotalCost    CostSummary
	ReviewRounds int
	AllDone      bool
}

// ComputeGoalSummary checks if all beads are done and aggregates stats.
func ComputeGoalSummary(proj ProjectState, goal GoalState) *GoalSummary {
	if len(goal.Beads) == 0 {
		return nil
	}

	allDone := true
	var maxElapsed time.Duration
	totalCost := CostSummary{}

	for _, bead := range goal.Beads {
		if !strings.HasPrefix(bead.Status, "done") {
			allDone = false
		}
		if bead.Elapsed > maxElapsed {
			maxElapsed = bead.Elapsed
		}
		// Aggregate cost from bead output
		output := readAgentLog(proj.Path, bead.Name)
		beadCost := ParseCostFromOutput(output)
		if beadCost.HasData {
			totalCost.TotalTokens += beadCost.TotalTokens
			totalCost.CostUSD += beadCost.CostUSD
			totalCost.HasData = true
		}
	}

	if !allDone {
		return nil
	}

	return &GoalSummary{
		GoalName:     goal.Name,
		ProjectKey:   proj.Key,
		BeadCount:    len(goal.Beads),
		TotalElapsed: maxElapsed,
		TotalCost:    totalCost,
		AllDone:      true,
	}
}

// FormatSummary returns a human-readable goal completion summary.
func (gs *GoalSummary) FormatSummary() string {
	var parts []string
	parts = append(parts, fmt.Sprintf("✓ %s complete", gs.GoalName))
	parts = append(parts, fmt.Sprintf("%d beads", gs.BeadCount))
	if gs.TotalElapsed > 0 {
		parts = append(parts, formatElapsed(gs.TotalElapsed))
	}
	if costStr := gs.TotalCost.FormatCost(); costStr != "" {
		parts = append(parts, costStr)
	}
	return strings.Join(parts, "  •  ")
}
