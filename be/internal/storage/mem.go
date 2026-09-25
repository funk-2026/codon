package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"sync"
	"time"
)

// MemBackend is an in-memory Backend for tests and local experiments.
type MemBackend struct {
	mu    sync.Mutex
	Files map[string][]byte
	Types map[string]string
}

func NewMem() *MemBackend {
	return &MemBackend{Files: map[string][]byte{}, Types: map[string]string{}}
}

func (m *MemBackend) Put(key, contentType string, data []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Files[key] = append([]byte(nil), data...)
	m.Types[key] = contentType
}

func (m *MemBackend) Has(key string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.Files[key]
	return ok
}

func (m *MemBackend) PresignPutSized(_ context.Context, key, _ string, size int64, _ time.Duration) (string, error) {
	return fmt.Sprintf("mem://put/%s?size=%d", key, size), nil
}

func (m *MemBackend) PresignGet(_ context.Context, key string, exp time.Duration) (string, error) {
	return fmt.Sprintf("mem://get/%s?exp=%d&sig=%d", key, int64(exp.Seconds()), time.Now().UnixNano()), nil
}

func (m *MemBackend) DownloadObject(_ context.Context, key string) (io.ReadCloser, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.Files[key]
	if !ok {
		return nil, ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(b)), nil
}

func (m *MemBackend) PutObject(_ context.Context, key, contentType string, data []byte) error {
	m.Put(key, contentType, data)
	return nil
}

func (m *MemBackend) HeadObject(_ context.Context, key string) (ObjectInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.Files[key]
	if !ok {
		return ObjectInfo{}, ErrNotFound
	}
	return ObjectInfo{Size: int64(len(b)), ContentType: m.Types[key]}, nil
}

func (m *MemBackend) DeleteObject(_ context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.Files, key)
	delete(m.Types, key)
	return nil
}
