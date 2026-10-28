package generation

import (
	"log"
	"sync/atomic"
	"time"
)

type metrics struct {
	generated, relaxed, emptyPool, totalMs, maxMs atomic.Int64
}

// Metrics are process-local generation counters, exposed on the admin metrics
// endpoint and logged per generation (latency, relaxations, empty pools).
var Metrics = &metrics{}

func (m *metrics) record(d time.Duration, relaxed bool) {
	ms := d.Milliseconds()
	m.generated.Add(1)
	m.totalMs.Add(ms)
	for {
		cur := m.maxMs.Load()
		if ms <= cur || m.maxMs.CompareAndSwap(cur, ms) {
			break
		}
	}
	if relaxed {
		m.relaxed.Add(1)
	}
	if ms > 500 {
		log.Printf("[generation] slow generation: %dms", ms)
	}
}

func (m *metrics) Snapshot() map[string]interface{} {
	n := m.generated.Load()
	avg := int64(0)
	if n > 0 {
		avg = m.totalMs.Load() / n
	}
	return map[string]interface{}{
		"generated": n, "with_relaxations": m.relaxed.Load(), "empty_pool_rejections": m.emptyPool.Load(),
		"avg_latency_ms": avg, "max_latency_ms": m.maxMs.Load(),
	}
}
