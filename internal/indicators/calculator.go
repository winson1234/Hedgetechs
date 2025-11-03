package indicators

import (
	"math"
)

// CalculateRSI calculates the Relative Strength Index
// period: typically 14
// returns: RSI value between 0-100
func CalculateRSI(closes []float64, period int) float64 {
	if len(closes) < period+1 {
		return 0
	}

	gains := make([]float64, 0)
	losses := make([]float64, 0)

	// Calculate price changes
	for i := 1; i < len(closes); i++ {
		change := closes[i] - closes[i-1]
		if change > 0 {
			gains = append(gains, change)
			losses = append(losses, 0)
		} else {
			gains = append(gains, 0)
			losses = append(losses, math.Abs(change))
		}
	}

	// Calculate initial average gain and loss
	var avgGain, avgLoss float64
	for i := 0; i < period; i++ {
		avgGain += gains[i]
		avgLoss += losses[i]
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	// Calculate RSI using smoothed averages
	for i := period; i < len(gains); i++ {
		avgGain = (avgGain*float64(period-1) + gains[i]) / float64(period)
		avgLoss = (avgLoss*float64(period-1) + losses[i]) / float64(period)
	}

	if avgLoss == 0 {
		return 100
	}

	rs := avgGain / avgLoss
	rsi := 100 - (100 / (1 + rs))

	return rsi
}

// CalculateSMA calculates Simple Moving Average
func CalculateSMA(closes []float64, period int) []float64 {
	if len(closes) < period {
		return []float64{}
	}

	sma := make([]float64, len(closes)-period+1)
	for i := period - 1; i < len(closes); i++ {
		sum := 0.0
		for j := 0; j < period; j++ {
			sum += closes[i-j]
		}
		sma[i-period+1] = sum / float64(period)
	}

	return sma
}

// CalculateEMA calculates Exponential Moving Average
func CalculateEMA(closes []float64, period int) []float64 {
	if len(closes) < period {
		return []float64{}
	}

	ema := make([]float64, len(closes))
	multiplier := 2.0 / float64(period+1)

	// First EMA is SMA
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += closes[i]
	}
	ema[period-1] = sum / float64(period)

	// Calculate subsequent EMAs
	for i := period; i < len(closes); i++ {
		ema[i] = (closes[i]-ema[i-1])*multiplier + ema[i-1]
	}

	return ema[period-1:]
}

// MACDResult holds MACD calculation results
type MACDResult struct {
	MACD      []float64 `json:"macd"`
	Signal    []float64 `json:"signal"`
	Histogram []float64 `json:"histogram"`
}

// CalculateMACD calculates Moving Average Convergence Divergence
// Standard periods: 12, 26, 9
func CalculateMACD(closes []float64, fastPeriod, slowPeriod, signalPeriod int) MACDResult {
	if len(closes) < slowPeriod {
		return MACDResult{}
	}

	// Calculate fast and slow EMAs
	fastEMA := CalculateEMA(closes, fastPeriod)
	slowEMA := CalculateEMA(closes, slowPeriod)

	// Align arrays (slow EMA is shorter)
	offset := len(fastEMA) - len(slowEMA)
	macdLine := make([]float64, len(slowEMA))
	for i := 0; i < len(slowEMA); i++ {
		macdLine[i] = fastEMA[i+offset] - slowEMA[i]
	}

	// Calculate signal line (EMA of MACD)
	signalLine := CalculateEMA(macdLine, signalPeriod)

	// Calculate histogram
	histogramOffset := len(macdLine) - len(signalLine)
	histogram := make([]float64, len(signalLine))
	for i := 0; i < len(signalLine); i++ {
		histogram[i] = macdLine[i+histogramOffset] - signalLine[i]
	}

	return MACDResult{
		MACD:      macdLine[histogramOffset:],
		Signal:    signalLine,
		Histogram: histogram,
	}
}

// GetLatestValue returns the last value from a slice, or 0 if empty
func GetLatestValue(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	return values[len(values)-1]
}
