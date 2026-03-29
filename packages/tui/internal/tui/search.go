package tui

import (
	"strings"
)

// SearchResult represents a single search match.
type SearchResult struct {
	Category string // "Agent", "Bead", "Goal", "Timeline"
	Scope    string // project/goal/bead
	Text     string // matched text
	Score    int    // relevance score (higher = better)
}

// fuzzyMatch checks if pattern matches target using a simple fuzzy algorithm.
// Returns true and a score if matched.
func fuzzyMatch(pattern, target string) (bool, int) {
	pattern = strings.ToLower(pattern)
	target = strings.ToLower(target)

	if pattern == "" {
		return true, 0
	}

	// Exact substring match gets highest score
	if strings.Contains(target, pattern) {
		return true, 100
	}

	// Fuzzy: each pattern character must appear in order in target
	pi := 0
	score := 0
	lastMatchIdx := -1
	for ti := 0; ti < len(target) && pi < len(pattern); ti++ {
		if target[ti] == pattern[pi] {
			pi++
			// Bonus for consecutive matches
			if lastMatchIdx == ti-1 {
				score += 10
			}
			// Bonus for matching at word boundary
			if ti == 0 || target[ti-1] == ' ' || target[ti-1] == '/' || target[ti-1] == '-' {
				score += 5
			}
			score += 1
			lastMatchIdx = ti
		}
	}

	if pi == len(pattern) {
		return true, score
	}
	return false, 0
}

// searchAll searches across all available data for the given query.
func searchAll(query string, projects []ProjectState, attention []AttentionItem) []SearchResult {
	var results []SearchResult

	if query == "" {
		return results
	}

	for _, proj := range projects {
		// Search project name
		if matched, score := fuzzyMatch(query, proj.Key); matched {
			results = append(results, SearchResult{
				Category: "Project",
				Scope:    proj.Key,
				Text:     proj.Key,
				Score:    score,
			})
		}

		for _, goal := range proj.Goals {
			scope := proj.Key + "/" + goal.Name

			// Search goal name
			if matched, score := fuzzyMatch(query, goal.Name); matched {
				results = append(results, SearchResult{
					Category: "Goal",
					Scope:    scope,
					Text:     goal.Name + " (" + goal.Status + ")",
					Score:    score,
				})
			}

			// Search bead names
			for _, bead := range goal.Beads {
				beadScope := scope + "/" + bead.Name
				if matched, score := fuzzyMatch(query, bead.Name+" "+bead.Title); matched {
					results = append(results, SearchResult{
						Category: "Bead",
						Scope:    beadScope,
						Text:     bead.Name + " " + bead.Status,
						Score:    score,
					})
				}
			}
		}
	}

	// Search attention items
	for _, item := range attention {
		if matched, score := fuzzyMatch(query, item.Scope+" "+item.Message); matched {
			results = append(results, SearchResult{
				Category: "Attention",
				Scope:    item.Scope,
				Text:     item.Level + ": " + item.Message,
				Score:    score,
			})
		}
	}

	// Sort by score (simple insertion sort — small lists)
	for i := 1; i < len(results); i++ {
		key := results[i]
		j := i - 1
		for j >= 0 && results[j].Score < key.Score {
			results[j+1] = results[j]
			j--
		}
		results[j+1] = key
	}

	// Limit results
	if len(results) > 50 {
		results = results[:50]
	}

	return results
}
