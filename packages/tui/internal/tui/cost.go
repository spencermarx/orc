package tui

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// CostSummary holds parsed cost/token information from agent output.
type CostSummary struct {
	InputTokens  int
	OutputTokens int
	TotalTokens  int
	CostUSD      float64
	HasData      bool
}

// Common patterns for token/cost reporting across agent CLIs
var (
	// Claude Code: "Total tokens: 12,345 (input: 8,000, output: 4,345)"
	claudeTokensRe = regexp.MustCompile(`[Tt]otal (?:tokens|cost)[:\s]+([0-9,]+)`)
	// Claude Code: "Total cost: $1.23"
	claudeCostRe = regexp.MustCompile(`[Tt]otal cost[:\s]+\$([0-9.]+)`)
	// Generic: "tokens used: 12345" or "12345 tokens"
	genericTokensRe = regexp.MustCompile(`([0-9,]+)\s+tokens`)
	// Generic: "$1.23" at end of line (cost summary)
	genericCostRe = regexp.MustCompile(`\$([0-9]+\.[0-9]{2,})`)
)

// ParseCostFromOutput scans agent output lines for token/cost information.
func ParseCostFromOutput(lines []string) CostSummary {
	var summary CostSummary

	// Scan from the end (summary lines are usually last)
	for i := len(lines) - 1; i >= 0 && i >= len(lines)-30; i-- {
		line := lines[i]

		if matches := claudeCostRe.FindStringSubmatch(line); len(matches) > 1 {
			if cost, err := strconv.ParseFloat(matches[1], 64); err == nil {
				summary.CostUSD = cost
				summary.HasData = true
			}
		}

		if matches := claudeTokensRe.FindStringSubmatch(line); len(matches) > 1 {
			if tokens, err := parseCommaInt(matches[1]); err == nil {
				summary.TotalTokens = tokens
				summary.HasData = true
			}
		}

		if !summary.HasData {
			if matches := genericTokensRe.FindStringSubmatch(line); len(matches) > 1 {
				if tokens, err := parseCommaInt(matches[1]); err == nil {
					summary.TotalTokens = tokens
					summary.HasData = true
				}
			}
		}

		if summary.CostUSD == 0 {
			if matches := genericCostRe.FindStringSubmatch(line); len(matches) > 1 {
				if cost, err := strconv.ParseFloat(matches[1], 64); err == nil && cost < 100 {
					summary.CostUSD = cost
					summary.HasData = true
				}
			}
		}
	}

	return summary
}

// FormatCost returns a human-readable cost string.
func (c CostSummary) FormatCost() string {
	if !c.HasData {
		return ""
	}
	var parts []string
	if c.CostUSD > 0 {
		parts = append(parts, fmt.Sprintf("$%.2f", c.CostUSD))
	}
	if c.TotalTokens > 0 {
		parts = append(parts, fmt.Sprintf("%s tokens", formatNumber(c.TotalTokens)))
	}
	return strings.Join(parts, ", ")
}

func parseCommaInt(s string) (int, error) {
	return strconv.Atoi(strings.ReplaceAll(s, ",", ""))
}

func formatNumber(n int) string {
	if n < 1000 {
		return strconv.Itoa(n)
	}
	if n < 1000000 {
		return fmt.Sprintf("%.1fk", float64(n)/1000)
	}
	return fmt.Sprintf("%.1fM", float64(n)/1000000)
}
