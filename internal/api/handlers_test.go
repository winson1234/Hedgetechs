package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"brokerageProject/internal/models"
)

// Test cache miss then hit: first request should be MISS and populate cache; second should be HIT
func TestHandleKlines_CacheMissThenHit(t *testing.T) {
	// ensure cache is clean
	klineCache.Flush()

	// mock upstream Binance REST server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return a single kline as Binance would (array of arrays)
		resp := [][]interface{}{
			{int64(1620000000000), "100", "110", "90", "105", "10", int64(1620000059999), "1000", float64(100), "5", "500", "0"},
		}
		b, _ := json.Marshal(resp)
		w.WriteHeader(http.StatusOK)
		w.Write(b)
	}))
	defer ts.Close()

	// override upstream base and restore later
	oldBase := binanceRestBase
	binanceRestBase = ts.URL
	defer func() { binanceRestBase = oldBase }()

	// First request -> MISS
	req1 := httptest.NewRequest("GET", "/api/v1/klines?symbol=BTCUSDT&interval=1h&limit=1", nil)
	rr1 := httptest.NewRecorder()
	HandleKlines(rr1, req1)

	if rr1.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: body=%s", rr1.Code, rr1.Body.String())
	}
	if rr1.Header().Get("X-Cache") != "MISS" {
		t.Fatalf("expected X-Cache MISS on first request, got %s", rr1.Header().Get("X-Cache"))
	}

	var out1 []models.Kline
	if err := json.Unmarshal(rr1.Body.Bytes(), &out1); err != nil {
		t.Fatalf("failed to unmarshal response body: %v", err)
	}
	if len(out1) != 1 {
		t.Fatalf("expected 1 kline, got %d", len(out1))
	}

	// Second request -> HIT
	req2 := httptest.NewRequest("GET", "/api/v1/klines?symbol=BTCUSDT&interval=1h&limit=1", nil)
	rr2 := httptest.NewRecorder()
	HandleKlines(rr2, req2)

	if rr2.Code != http.StatusOK {
		t.Fatalf("expected status 200 on second request, got %d", rr2.Code)
	}
	if rr2.Header().Get("X-Cache") != "HIT" {
		t.Fatalf("expected X-Cache HIT on second request, got %s", rr2.Header().Get("X-Cache"))
	}

	var out2 []models.Kline
	if err := json.Unmarshal(rr2.Body.Bytes(), &out2); err != nil {
		t.Fatalf("failed to unmarshal second response body: %v", err)
	}

	if !reflect.DeepEqual(out1, out2) {
		t.Fatalf("expected identical responses for cached request; got out1=%v out2=%v", out1, out2)
	}
}

// Test upstream error path: upstream returns 500 and handler should return 502 Bad Gateway
func TestHandleKlines_UpstreamError(t *testing.T) {
	klineCache.Flush()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer ts.Close()

	oldBase := binanceRestBase
	binanceRestBase = ts.URL
	defer func() { binanceRestBase = oldBase }()

	req := httptest.NewRequest("GET", "/api/v1/klines?symbol=BTCUSDT&interval=1h&limit=1", nil)
	rr := httptest.NewRecorder()
	HandleKlines(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected status 502 Bad Gateway, got %d", rr.Code)
	}
}
