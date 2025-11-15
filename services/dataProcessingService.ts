import { PriceDataPoint } from '../types';

type RawPriceDataPoint = Omit<PriceDataPoint, 'fairPrice' | 'maxRealisticMargin' | 'maxRealisticMarginAfterTax' | 'p90LowSpread' | 'p90HighSpread'>;

const percentile = (arr: number[], p: number): number | null => {
    if (!arr.length) return null;
    const sortedArr = [...arr].sort((a, b) => a - b);
    const index = Math.floor((p / 100) * (sortedArr.length - 1));
    return sortedArr[index];
};

const calculateGETax = (price: number): number => {
    const tax = Math.floor(price * 0.02);
    return Math.min(tax, 5_000_000);
};

export const processRawPriceData = (rawData: RawPriceDataPoint[]): PriceDataPoint[] => {
    if (rawData.length < 2) {
        return [];
    }

    // FIX: Limit the time window to the last 30 days to prevent performance issues
    // with items that have a very sparse trading history over a long period.
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const lastTimestamp = rawData[rawData.length - 1].timestamp;
    const minTimestampThreshold = lastTimestamp - thirtyDaysInSeconds;
    const filteredRawData = rawData.filter(p => p.timestamp >= minTimestampThreshold);

    if (filteredRawData.length < 2) {
        // Not enough data in the relevant time window to perform analysis.
        return [];
    }

    // Step 0: Regularize the time series to handle sparse data correctly.
    // This creates a dense dataset with entries for every 5-minute interval.
    const regularizedData: RawPriceDataPoint[] = [];
    const rawDataMap = new Map(filteredRawData.map(p => [p.timestamp, p]));
    
    const minTimestamp = filteredRawData[0].timestamp;
    const maxTimestamp = filteredRawData[filteredRawData.length - 1].timestamp;
    const interval = 5 * 60; // 5 minutes in seconds

    let lastKnownPoint: RawPriceDataPoint | null = null;

    for (let ts = minTimestamp; ts <= maxTimestamp; ts += interval) {
        if (rawDataMap.has(ts)) {
            const point = rawDataMap.get(ts)!;
            regularizedData.push(point);
            lastKnownPoint = point;
        } else if (lastKnownPoint) {
            // Forward-fill the gap with the last known price but zero volume.
            regularizedData.push({ 
                ...lastKnownPoint, 
                timestamp: ts, 
                highPriceVolume: 0, 
                lowPriceVolume: 0 
            });
        }
    }

    // Step 1: Calculate derived raw values (VWAP) using the regularized data
    const dataWithVwap = regularizedData.map(point => {
        const { avgHighPrice, highPriceVolume, avgLowPrice, lowPriceVolume } = point;

        // Calculate VWAP
        let vwap: number | null = null;
        const weightedHigh = avgHighPrice !== null ? avgHighPrice * highPriceVolume : 0;
        const weightedLow = avgLowPrice !== null ? avgLowPrice * lowPriceVolume : 0;
        let effectiveVolume = 0;
        if (avgHighPrice !== null) effectiveVolume += highPriceVolume;
        if (avgLowPrice !== null) effectiveVolume += lowPriceVolume;
        if (effectiveVolume > 0) {
            vwap = (weightedHigh + weightedLow) / effectiveVolume;
        }

        return { ...point, vwap };
    });

    // Step 2: Calculate smoothed values (Fair Price SMA)
    const smaPeriod = 24; // Represents 2 hours of data (24 * 5 minutes)
    const historyWithFairPrice = dataWithVwap.map((point, index, arr) => {
        const { vwap, ...rest } = point;

        if (index < smaPeriod - 1) {
            return { ...rest, fairPrice: null };
        }

        const window = arr.slice(index - smaPeriod + 1, index + 1);

        // Calculate Fair Price (SMA of VWAP)
        const vwapValues = window.map(p => p.vwap).filter(v => v !== null) as number[];
        const fairPrice = vwapValues.length > 0
            ? vwapValues.reduce((a, b) => a + b, 0) / vwapValues.length
            : null;

        return { ...rest, fairPrice };
    });

    // Step 3: Calculate statistical benchmarks (Max Realistic Margin) on a rolling basis
    const marginWindowPeriod = 36; // 3 hours of data (36 * 5 minutes)
    const finalHistory = historyWithFairPrice.map((point, index, arr) => {
        if (index < marginWindowPeriod - 1) {
            return { ...point, maxRealisticMargin: null, maxRealisticMarginAfterTax: null, p90LowSpread: null, p90HighSpread: null };
        }

        const window = arr.slice(index - marginWindowPeriod + 1, index + 1);

        const lowDiffs: number[] = [];
        const highDiffs: number[] = [];

        window.forEach(p => {
            if (p.fairPrice && p.avgLowPrice) {
                lowDiffs.push(Math.abs(p.fairPrice - p.avgLowPrice));
            }
            if (p.fairPrice && p.avgHighPrice) {
                highDiffs.push(Math.abs(p.avgHighPrice - p.fairPrice));
            }
        });

        if (lowDiffs.length < 5 || highDiffs.length < 5) {
            return { ...point, maxRealisticMargin: null, maxRealisticMarginAfterTax: null, p90LowSpread: null, p90HighSpread: null };
        }
        
        const lowP90 = percentile(lowDiffs, 90) ?? 0;
        const highP90 = percentile(highDiffs, 90) ?? 0;
        const maxRealisticMargin = lowP90 + highP90;

        // Calculate After-Tax Margin
        let maxRealisticMarginAfterTax = null;
        if (point.fairPrice && maxRealisticMargin > 0) {
            // Estimate the sell price to be the fair price plus the high-side of the margin
            const estimatedSellPrice = point.fairPrice + highP90;
            const tax = calculateGETax(estimatedSellPrice);
            maxRealisticMarginAfterTax = maxRealisticMargin - tax;
        }

        return {
            ...point,
            maxRealisticMargin: maxRealisticMargin > 0 ? maxRealisticMargin : null,
            maxRealisticMarginAfterTax: maxRealisticMarginAfterTax !== null && maxRealisticMarginAfterTax > 0 ? maxRealisticMarginAfterTax : null,
            p90LowSpread: lowP90 > 0 ? lowP90 : null,
            p90HighSpread: highP90 > 0 ? highP90 : null
        };
    });


    return finalHistory;
};