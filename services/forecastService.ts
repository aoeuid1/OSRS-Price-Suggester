import { PriceDataPoint } from '../types';

/**
 * Implements Damped Trend Exponential Smoothing for forecasting.
 * This method is more robust for financial time series as it prevents
 * the trend from continuing indefinitely.
 *
 * @param series The time series of historical prices.
 * @param alpha The smoothing factor for the level.
 * @param beta The smoothing factor for the trend.
 * @param phi The dampening factor for the trend.
 * @param forecastLength The number of periods to forecast.
 * @returns An object with the forecast, upper, and lower prediction intervals.
 */
const dampedTrendExponentialSmoothing = (
    series: number[],
    alpha: number,
    beta: number,
    phi: number,
    forecastLength: number
) => {
    if (series.length < 2) {
        return { forecast: [], upper: [], lower: [] };
    }

    let level = series[0];
    let trend = series[1] - series[0];
    const residuals: number[] = [0]; // No error for the first point

    // Train the model on historical data
    for (let i = 1; i < series.length; i++) {
        const value = series[i];
        const lastLevel = level;
        
        // The forecast for the current point was based on the damped trend from the previous point
        const historicalForecast = lastLevel + phi * trend;
        residuals.push(value - historicalForecast);

        // Update level and trend with damping
        level = alpha * value + (1 - alpha) * (lastLevel + phi * trend);
        trend = beta * (level - lastLevel) + (1 - beta) * phi * trend;
    }

    // Calculate standard deviation of residuals for confidence interval
    const meanResidual = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const squaredErrors = residuals.map(e => Math.pow(e - meanResidual, 2));
    const stdDev = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / (residuals.length - 1));

    const z = 1.96; // 95% confidence level
    const forecast = [];
    const upper = [];
    const lower = [];

    // Generate future forecast
    for (let i = 1; i <= forecastLength; i++) {
        // The forecast value is the current level plus the sum of the damped trend over i periods
        const trendComponent = (Array.from({length: i}, (_, k) => Math.pow(phi, k + 1)).reduce((a, b) => a + b, 0)) * trend;
        const forecastValue = level + trendComponent;
        forecast.push(forecastValue);

        // Confidence interval should widen as the forecast extends
        const errorMargin = z * stdDev * Math.sqrt(i);
        upper.push(forecastValue + errorMargin);
        lower.push(forecastValue - errorMargin);
    }

    return { forecast, upper, lower };
};

export const generateForecast = async (history: PriceDataPoint[]): Promise<PriceDataPoint[]> => {
    const extractSeries = (key: keyof PriceDataPoint) => history
        .map(p => p[key])
        .filter(p => typeof p === 'number' && p > 0) as number[];

    const historicalFairPrices = extractSeries('fairPrice');
    const historicalHighPrices = extractSeries('avgHighPrice');
    const historicalLowPrices = extractSeries('avgLowPrice');

    if (historicalFairPrices.length < 12 || historicalHighPrices.length < 12 || historicalLowPrices.length < 12) {
        console.log("Not enough data for a full forecast.");
        return [];
    }

    try {
        const forecastPoints = 72; // 6 hours (6 * 12 points/hour)
        const alpha = 0.8;  // Level smoothing: More weight to recent data.
        const beta = 0.05;  // Trend smoothing: Less reactive to recent trend changes.
        const phi = 0.98;   // Trend damping: Causes trend to flatten over time.

        const fairPriceForecast = dampedTrendExponentialSmoothing(historicalFairPrices, alpha, beta, phi, forecastPoints);
        const highPriceForecast = dampedTrendExponentialSmoothing(historicalHighPrices, alpha, beta, phi, forecastPoints);
        const lowPriceForecast = dampedTrendExponentialSmoothing(historicalLowPrices, alpha, beta, phi, forecastPoints);

        const lastTimestamp = history[history.length - 1].timestamp;
        const interval = 5 * 60; // 5 minutes in seconds

        const forecastData = fairPriceForecast.forecast.map((_, i) => ({
            timestamp: lastTimestamp + (i + 1) * interval,
            avgHighPrice: null,
            avgLowPrice: null,
            highPriceVolume: 0,
            lowPriceVolume: 0,
            fairPrice: null,
            // Fair price forecast (for the chart)
            forecastPrice: Math.max(0, fairPriceForecast.forecast[i]),
            forecastHigh: Math.max(0, fairPriceForecast.upper[i]),
            forecastLow: Math.max(0, fairPriceForecast.lower[i]),
            // High price forecast (for fulfilment calc)
            forecastHigh_mean: Math.max(0, highPriceForecast.forecast[i]),
            forecastHigh_upper: Math.max(0, highPriceForecast.upper[i]),
            forecastHigh_lower: Math.max(0, highPriceForecast.lower[i]),
            // Low price forecast (for fulfilment calc)
            forecastLow_mean: Math.max(0, lowPriceForecast.forecast[i]),
            forecastLow_upper: Math.max(0, lowPriceForecast.upper[i]),
            forecastLow_lower: Math.max(0, lowPriceForecast.lower[i]),
        }));

        return forecastData;

    } catch (error) {
        console.error("Forecast generation failed:", error);
        return [];
    }
};