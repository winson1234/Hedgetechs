package utils

import (
	"math/rand"
	"time"
)

// GenerateRandomInt64 generates a random int64 between min and max (inclusive)
func GenerateRandomInt64(min, max int64) int64 {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return r.Int63n(max-min+1) + min
}
