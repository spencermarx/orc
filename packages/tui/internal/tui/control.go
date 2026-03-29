package tui

// ControlLevel defines the 5-level autonomy spectrum.
type ControlLevel int

const (
	ControlYOLO       ControlLevel = 1 // Full autopilot, no approvals, no notifications
	ControlNotify     ControlLevel = 2 // Proceed automatically, user sees what happened
	ControlApproveMaj ControlLevel = 3 // Pause for goals and delivery, auto for beads
	ControlApproveAll ControlLevel = 4 // Pause at every gate (current "ask" default)
	ControlStepThru   ControlLevel = 5 // Pause after every agent action (debugging mode)
)

// ControlLevelName returns the human-readable name of a control level.
func ControlLevelName(level ControlLevel) string {
	switch level {
	case ControlYOLO:
		return "YOLO"
	case ControlNotify:
		return "Notify Only"
	case ControlApproveMaj:
		return "Approve Major"
	case ControlApproveAll:
		return "Approve All"
	case ControlStepThru:
		return "Step-Through"
	default:
		return "Unknown"
	}
}

// ControlLevelDescription returns a brief description of the level.
func ControlLevelDescription(level ControlLevel) string {
	switch level {
	case ControlYOLO:
		return "Full autopilot. No approvals, no notifications."
	case ControlNotify:
		return "Auto-proceed with notifications. User sees what happened."
	case ControlApproveMaj:
		return "Approve goals + delivery. Auto for beads and reviews."
	case ControlApproveAll:
		return "Pause at every gate. Human confirms each step."
	case ControlStepThru:
		return "Debug mode. Pause after every agent action."
	default:
		return ""
	}
}

// GatePolicy maps a control level to specific gate behaviors.
type GatePolicy struct {
	PlanCreation string // "ask", "auto", "auto+notify"
	BeadDispatch string
	ReviewStart  string
	BeadMerge    string
	GoalDelivery string
	MergeToMain  string
}

// GatePolicyForLevel returns the gate configuration for a given control level.
func GatePolicyForLevel(level ControlLevel) GatePolicy {
	switch level {
	case ControlYOLO:
		return GatePolicy{
			PlanCreation: "auto",
			BeadDispatch: "auto",
			ReviewStart:  "auto",
			BeadMerge:    "auto",
			GoalDelivery: "auto",
			MergeToMain:  "auto+notify",
		}
	case ControlNotify:
		return GatePolicy{
			PlanCreation: "auto+notify",
			BeadDispatch: "auto+notify",
			ReviewStart:  "auto",
			BeadMerge:    "auto+notify",
			GoalDelivery: "auto+notify",
			MergeToMain:  "ask",
		}
	case ControlApproveMaj:
		return GatePolicy{
			PlanCreation: "auto+notify",
			BeadDispatch: "auto",
			ReviewStart:  "auto",
			BeadMerge:    "auto",
			GoalDelivery: "ask",
			MergeToMain:  "ask",
		}
	case ControlApproveAll:
		return GatePolicy{
			PlanCreation: "ask",
			BeadDispatch: "ask",
			ReviewStart:  "auto",
			BeadMerge:    "ask",
			GoalDelivery: "ask",
			MergeToMain:  "ask",
		}
	case ControlStepThru:
		return GatePolicy{
			PlanCreation: "ask",
			BeadDispatch: "ask",
			ReviewStart:  "ask",
			BeadMerge:    "ask",
			GoalDelivery: "ask",
			MergeToMain:  "ask",
		}
	default:
		return GatePolicyForLevel(ControlApproveMaj) // default
	}
}
