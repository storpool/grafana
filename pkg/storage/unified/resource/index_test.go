package resource

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/assert"
	"golang.org/x/exp/rand"
)

func TestIndexBatch(t *testing.T) {
	tracingCfg := tracing.NewEmptyTracingConfig()
	trace, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		t.Fatal(err)
	}

	index := &Index{
		tracer: trace,
		shards: make(map[string]Shard),
		log:    log.New("unifiedstorage.search.index"),
		opts: Opts{
			ListLimit: 5000,
			Workers:   10,
			BatchSize: 1000,
		},
	}

	ctx := context.Background()
	startAll := time.Now()

	ns := namespaces()
	// simulate 10 List calls
	for i := 0; i < 10; i++ {
		list := &ListResponse{Items: loadTestItems(strconv.Itoa(i), ns)}
		start := time.Now()
		_, err = index.AddToBatches(ctx, list)
		if err != nil {
			t.Fatal(err)
		}
		elapsed := time.Since(start)
		fmt.Println("Time elapsed:", elapsed)
	}

	// index all batches for each shard/tenant
	err = index.IndexBatches(ctx, 1, ns)
	if err != nil {
		t.Fatal(err)
	}

	elapsed := time.Since(startAll)
	fmt.Println("Total Time elapsed:", elapsed)

	assert.Equal(t, len(ns), len(index.shards))

	total, err := index.Count()
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, uint64(100000), total)
}

func loadTestItems(uid string, tenants []string) []*ResourceWrapper {
	resource := `{
		"kind": "<kind>",
		"title": "test",
		"metadata": {
			"uid": "<uid>",
			"name": "test",
			"namespace": "<ns>"
		},
		"spec": {
			"title": "test",
			"description": "test",
			"interval": "5m"
		}
	}`

	items := []*ResourceWrapper{}
	for i := 0; i < 10000; i++ {
		res := strings.Replace(resource, "<uid>", strconv.Itoa(i)+uid, 1)
		// shuffle kinds
		kind := kinds[rand.Intn(len(kinds))]
		res = strings.Replace(res, "<kind>", kind, 1)
		// shuffle namespaces
		ns := tenants[rand.Intn(len(tenants))]
		res = strings.Replace(res, "<ns>", ns, 1)
		items = append(items, &ResourceWrapper{Value: []byte(res)})
	}
	return items
}

var kinds = []string{
	"playlist",
	"folder",
}

// simulate many tenants ( cloud )
func namespaces() []string {
	ns := []string{}
	for i := 0; i < 1000; i++ {
		ns = append(ns, "tenant"+strconv.Itoa(i))
	}
	return ns
}
