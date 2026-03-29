package tui

import (
	"os/exec"
	"runtime"
)

// sendDesktopNotification sends a native desktop notification.
// Works on Linux (notify-send), macOS (osascript), and falls back silently.
func sendDesktopNotification(title, body string) {
	switch runtime.GOOS {
	case "linux":
		// Try notify-send (most Linux desktops)
		exec.Command("notify-send", "-a", "Orc", title, body).Run()
	case "darwin":
		// macOS native notification via osascript
		script := `display notification "` + body + `" with title "` + title + `"`
		exec.Command("osascript", "-e", script).Run()
	}
	// Windows/other: silently skip
}
