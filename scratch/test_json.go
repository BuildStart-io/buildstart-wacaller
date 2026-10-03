package main

import (
	"encoding/json"
	"fmt"
)

type AuthSnapshot struct {
	State  string `json:"state"`
	Paired bool   `json:"paired"`
	QR     string `json:"qr,omitempty"`
}

type SessionInfo struct {
	ID         string `json:"id"`
	BusinessID string `json:"business_id"`
	JID        string `json:"jid"`
	State      string `json:"state"`
	Paired     bool   `json:"paired"`
	QR         string `json:"qr,omitempty"`
}

func main() {
	infos := []SessionInfo{
		{
			ID:         "test-id",
			BusinessID: "test-biz",
			JID:        "",
			State:      "qr",
			Paired:     false,
			QR:         "https://wa.me/test",
		},
	}
	
	events := []any{map[string]any{"type": "session-list", "sessions": infos}}
	for _, info := range infos {
		if info.QR != "" {
			events = append(events, map[string]any{"type": "session-qr", "sessionId": info.ID, "session_id": info.ID, "qr": info.QR})
		}
	}
	
	for _, ev := range events {
		b, _ := json.Marshal(ev)
		fmt.Println(string(b))
	}
}
