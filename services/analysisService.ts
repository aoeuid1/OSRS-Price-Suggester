import { PriceDataPoint, OfferPriceAnalysis } from './types';

// --- CONFIGURATION ---
const TAX_RATE = 0.01;
const TAX_CAP = 5_000_000;

// STRATEGY PARAMETERS
const SMOOTHING_WINDOW = 12; // 1 Hour EMA
const MARGIN_WINDOW = 48;    // 4 Hours Lookback
const LOWBALL_FACTOR = 1.1;  // Buy Depth
const PROFIT_TARGET = 1.015; // 1.5% Target

// --- HELPERS ---

const calculateTax = (price: number): number => {
    return Math.min(Math.floor(price * TAX_RATE), TAX_CAP);
};

/**
 * Calculates Exponential Moving Average (EMA) matching Pandas ewm(span=window).
 * Uses simple recursion: EMA_t = alpha * x_t + (1 - alpha) * EMA_{t-1}
 */
const calculateEMA = (values: (number | null)[], span: number): (number | null)[] => {
    const alpha = 2 / (span + 1);
    let ema: number | null = null;
    const result: (number | null)[] = [];

    for (const val of values) {
        if (val === null) {
            result.push(null);
            continue;
        }

        if (ema === null) {
            ema = val; // Initialize with first valid value
        } else {
            ema = (val * alpha) + (ema * (1 - alpha));
        }
        result.push(ema);
    }
    return result;
};

/**
 * Calculates Rolling Maximum matching Pandas rolling(window).max().
 */
const calculateRollingMax = (values: (number | null)[], windowSize: number): (number | null)[] => {
    const result: (number | null)[] = [];
    
    for (let i = 0; i < values.length; i++) {
        let maxVal: number | null = null;
        // Window start index (inclusive)
        const start = Math.max(0, i - windowSize + 1);
        
        for (let j = start; j <= i; j++) {
            const v = values[j];
            if (v !== null) {
                // Initialize maxVal if it's null, or update if v is larger
                if (maxVal === null || v > maxVal) {
                    maxVal = v;
                }
            }
        }
        result.push(maxVal);
    }
    return result;
};

/**
 * Implements Forward Fill logic (ffill).
 * If a value is null, it takes the previous known value.
 */
const cleanData = (history: PriceDataPoint[]): PriceDataPoint[] => {
    let lastHigh: number | null = null;
    let lastLow: number | null = null;

    return history.map(p => {
        // Update references if current values exist (check !== null to allow 0)
        if (p.avgHighPrice !== null && p.avgHighPrice !== undefined) lastHigh = p.avgHighPrice;
        if (p.avgLowPrice !== null && p.avgLowPrice !== undefined) lastLow = p.avgLowPrice;
        
        return {
            ...p,
            // Use current if valid, otherwise use last known (Forward Fill)
            avgHighPrice: (p.avgHighPrice !== null && p.avgHighPrice !== undefined) ? p.avgHighPrice : lastHigh,
            avgLowPrice: (p.avgLowPrice !== null && p.avgLowPrice !== undefined) ? p.avgLowPrice : lastLow,
        };
    });
};

// --- MAIN FUNCTION ---

export const calculateOfferPrices = (
    priceHistory: PriceDataPoint[]
): OfferPriceAnalysis | null => {
    // Need enough data to calculate the rolling window
    if (!priceHistory || priceHistory.length < MARGIN_WINDOW) {
        return null;
    }

    // 1. Clean Data (Forward Fill)
    // We clone the array to avoid mutating the input
    const cleanedHistory = cleanData([...priceHistory]);

    // 2. Extract Series
    const highs = cleanedHistory.map(p => p.avgHighPrice);
    const lows = cleanedHistory.map(p => p.avgLowPrice);

    // 3. Calculate Indicators
    const mids: (number | null)[] = [];
    
    for (let i = 0; i < cleanedHistory.length; i++) {
        const h = highs[i];
        const l = lows[i];
        
        // We need both High and Low to calculate Mid. 
        // If ffill failed (start of array), we have nulls.
        if (h !== null && l !== null) {
            mids.push((h + l) / 2);
        } else {
            mids.push(null);
        }
    }

    // Fair Price (EMA 12 of Mid)
    const fairPrices = calculateEMA(mids, SMOOTHING_WINDOW);

    // Spread Lower (Fair - Low)
    const spreadLowers: (number | null)[] = [];
    for (let i = 0; i < cleanedHistory.length; i++) {
        const f = fairPrices[i];
        const l = lows[i];
        if (f !== null && l !== null) {
            spreadLowers.push(f - l);
        } else {
            spreadLowers.push(null);
        }
    }

    // Deep Margin (Rolling Max of Spread Lower)
    const marginDeeps = calculateRollingMax(spreadLowers, MARGIN_WINDOW);

    // 4. Select "Latest" Data Point
    // We use the very last index to make the decision for "Now".
    const lastIndex = cleanedHistory.length - 1;
    
    const latestFair = fairPrices[lastIndex];
    const latestMarginDeep = marginDeeps[lastIndex];

    // Verify we have valid indicators at the tip
    if (latestFair === null || latestMarginDeep === null) {
        return null;
    }

    // 5. Strategy Calculation (V13 Logic)
    
    // BUY LOGIC: Deep Value (Lowball)
    // Target = Fair - (Max Historical Dip * 1.1)
    const targetBuy = Math.floor(latestFair - (latestMarginDeep * LOWBALL_FACTOR));

    // SELL LOGIC: Fixed Markup
    // Target = Buy Price * 1.015
    const targetSell = Math.floor(targetBuy * PROFIT_TARGET);

    // 6. Profitability Check
    const tax = calculateTax(targetSell);
    const expectedProfit = targetSell - targetBuy - tax;

    if (expectedProfit <= 0) {
        return {
            recommendedBuy: null,
            recommendedSell: null,
            potentialProfit: 0,
            potentialMargin: '0%',
            analysisMethod: 'Historical',
            fulfilmentAnalysis: null
        };
    }

    return {
        recommendedBuy: targetBuy,
        recommendedSell: targetSell,
        potentialProfit: expectedProfit,
        potentialMargin: ((expectedProfit / targetBuy) * 100).toFixed(2) + '%',
        analysisMethod: 'Historical',
        fulfilmentAnalysis: null
    };
};
