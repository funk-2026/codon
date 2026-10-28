package media

import (
	"encoding/json"

	"github.com/google/uuid"
)

func parseJSONID(payload string, id *uuid.UUID) error {
	var p struct {
		MediaID uuid.UUID `json:"media_id"`
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return err
	}
	*id = p.MediaID
	return nil
}
