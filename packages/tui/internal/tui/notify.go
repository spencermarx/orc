package tui

import (
	"os/exec"
	"runtime"
	"strings"
)

// sendDesktopNotification sends a native desktop notification.
// Works on Linux (notify-send), macOS (osascript), and falls back silently.
func sendDesktopNotification(title, body string) {
	switch runtime.GOOS {
	case "linux":
		// Try notify-send (most Linux desktops)
		exec.Command("notify-send", "-a", "Orc", title, body).Run()
	case "darwin":
		// Escape double quotes and backslashes to prevent AppleScript injection
		safeBody := strings.ReplaceAll(strings.ReplaceAll(body, `\`, `\\`), `"`, `\"`)
		safeTitle := strings.ReplaceAll(strings.ReplaceAll(title, `\`, `\\`), `"`, `\"`)
		script := `display notification "` + safeBody + `" with title "` + safeTitle + `"`
		exec.Command("osascript", "-e", script).Run()
	}
	// Windows/other: silently skip
}
