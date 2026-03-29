package events

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
)

// Bus manages event subscribers and broadcasts events via a Unix domain socket.
type Bus struct {
	socketPath string
	listener   net.Listener

	mu          sync.RWMutex
	subscribers map[net.Conn]struct{}

	persistPath string // path to events.jsonl
	persistFile *os.File
}

// NewBus creates a new event bus. socketPath is the Unix socket path.
// persistPath is the path to the events.jsonl file for persistence.
func NewBus(socketPath, persistPath string) *Bus {
	return &Bus{
		socketPath:  socketPath,
		persistPath: persistPath,
		subscribers: make(map[net.Conn]struct{}),
	}
}

// Start begins listening on the Unix socket and accepting subscribers.
func (b *Bus) Start() error {
	// Clean up stale socket
	os.Remove(b.socketPath)

	// Ensure socket directory exists
	if err := os.MkdirAll(filepath.Dir(b.socketPath), 0o755); err != nil {
		return fmt.Errorf("creating socket directory: %w", err)
	}

	ln, err := net.Listen("unix", b.socketPath)
	if err != nil {
		return fmt.Errorf("listening on %s: %w", b.socketPath, err)
	}
	b.listener = ln

	// Open persistence file
	if b.persistPath != "" {
		if err := os.MkdirAll(filepath.Dir(b.persistPath), 0o755); err != nil {
			return fmt.Errorf("creating persist directory: %w", err)
		}
		f, err := os.OpenFile(b.persistPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return fmt.Errorf("opening persist file: %w", err)
		}
		b.persistFile = f
	}

	go b.acceptLoop()
	return nil
}

// Stop closes the listener and all subscriber connections.
func (b *Bus) Stop() {
	if b.listener != nil {
		b.listener.Close()
	}
	b.mu.Lock()
	for conn := range b.subscribers {
		conn.Close()
	}
	b.subscribers = make(map[net.Conn]struct{})
	b.mu.Unlock()

	if b.persistFile != nil {
		b.persistFile.Close()
	}
	os.Remove(b.socketPath)
}

// Emit broadcasts an event to all subscribers and persists it.
func (b *Bus) Emit(e Event) {
	line := append(e.JSON(), '\n')

	// Persist to file
	if b.persistFile != nil {
		b.persistFile.Write(line)
	}

	// Broadcast to subscribers
	b.mu.RLock()
	defer b.mu.RUnlock()
	for conn := range b.subscribers {
		_, err := conn.Write(line)
		if err != nil {
			go b.removeSubscriber(conn)
		}
	}
}

// SocketPath returns the path to the Unix socket.
func (b *Bus) SocketPath() string {
	return b.socketPath
}

func (b *Bus) acceptLoop() {
	for {
		conn, err := b.listener.Accept()
		if err != nil {
			return // listener closed
		}
		b.mu.Lock()
		b.subscribers[conn] = struct{}{}
		b.mu.Unlock()

		// Read subscription filters (optional, for future use)
		go b.handleSubscriber(conn)
	}
}

func (b *Bus) handleSubscriber(conn net.Conn) {
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		line := scanner.Bytes()
		// Future: handle subscription filter messages like {"subscribe":["status_change"]}
		var msg struct {
			Subscribe []string `json:"subscribe"`
		}
		json.Unmarshal(line, &msg)
		// For now, all subscribers get all events
	}
	b.removeSubscriber(conn)
}

func (b *Bus) removeSubscriber(conn net.Conn) {
	b.mu.Lock()
	delete(b.subscribers, conn)
	b.mu.Unlock()
	conn.Close()
}
