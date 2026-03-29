// Package config reads projects.toml and config.toml for the event daemon.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	toml "github.com/pelletier/go-toml/v2"
)

// Project represents a registered orc project.
type Project struct {
	Key  string
	Path string
}

// ProjectsFile holds the structure of projects.toml.
type ProjectsFile struct {
	Projects map[string]struct {
		Path string `toml:"path"`
	} `toml:"projects"`
}

// LoadProjects reads the projects.toml file and returns registered projects.
func LoadProjects(orcRoot string) ([]Project, error) {
	path := filepath.Join(orcRoot, "projects.toml")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // no projects registered yet
		}
		return nil, fmt.Errorf("reading projects.toml: %w", err)
	}

	var pf ProjectsFile
	if err := toml.Unmarshal(data, &pf); err != nil {
		return nil, fmt.Errorf("parsing projects.toml: %w", err)
	}

	var projects []Project
	for key, proj := range pf.Projects {
		projects = append(projects, Project{Key: key, Path: proj.Path})
	}
	return projects, nil
}

// ThemeConfig holds the [theme] section relevant to TUI rendering.
type ThemeConfig struct {
	Accent   string `toml:"accent"`
	BG       string `toml:"bg"`
	FG       string `toml:"fg"`
	Border   string `toml:"border"`
	Muted    string `toml:"muted"`
	Activity string `toml:"activity"`
}

// ConfigFile represents the top-level config.toml for fields we need.
type ConfigFile struct {
	Theme ThemeConfig `toml:"theme"`
}

// LoadConfig reads config.toml (or config.local.toml override) from orcRoot.
func LoadConfig(orcRoot string) (ConfigFile, error) {
	var cfg ConfigFile

	// Defaults
	cfg.Theme = ThemeConfig{
		Accent:   "#00ff88",
		BG:       "#0d1117",
		FG:       "#8b949e",
		Border:   "#30363d",
		Muted:    "#6e7681",
		Activity: "#d29922",
	}

	// Load committed defaults
	base := filepath.Join(orcRoot, "config.toml")
	if data, err := os.ReadFile(base); err == nil {
		toml.Unmarshal(data, &cfg) // best effort
	}

	// Override with local config
	local := filepath.Join(orcRoot, "config.local.toml")
	if data, err := os.ReadFile(local); err == nil {
		toml.Unmarshal(data, &cfg) // best effort
	}

	return cfg, nil
}
