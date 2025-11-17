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
 * Calculates EMA matching Pandas ewm(span=window, adjust=True).
 * Uses weighted sum formula:
 * Y_t = (x_t + (1-a)*x_{t-1} + ...) / (1 + (1-a) + ...)
 */
const calculateEMA = (values: number[], span: number): number[] => {
    const alpha = 2 / (span + 1);
    const decay = 1 - alpha;
    
    let numerator = 0;
    let denominator = 0;
    const result: number[] = [];

    for (const val of values) {
        numerator = val + (decay * numerator);
        denominator = 1 + (decay * denominator);
        result.push(numerator / denominator);
    }
    return result;
};

/**
 * Calculates Rolling Maximum.
 */
const calculateRollingMax = (values: number[], windowSize: number): number[] => {
    const result: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
        let maxVal = -Infinity;
        const start = Math.max(0, i - windowSize + 1);
        
        for (let j = start; j <= i; j++) {
            if (values[j] > maxVal) {
                maxVal = values[j];
            }
        }
        result.push(maxVal);
    }
    return result;
};

/**
 * 1. Forward Fills null values.
 * 2. Filters out rows that remain invalid (leading nulls).
 * This matches `df.ffill().dropna()` in Python.
 */
const prepareSeries = (history: PriceDataPoint[]): { mids: number[], spreadLowers: number[] } | null => {
    let lastHigh: number | null = null;
    let lastLow: number | null = null;

    const validMids: number[] = [];
    const validSpreads: number[] = [];

    // Pass 1: Forward Fill & Filter
    // We don't return the objects, just the derived numbers needed for calc
    for (const p of history) {
        // Update State
        if (p.avgHighPrice !== null && p.avgHighPrice !== undefined) lastHigh = p.avgHighPrice;
        if (p.avgLowPrice !== null && p.avgLowPrice !== undefined) lastLow = p.avgLowPrice;

        // If we have valid data (either current or carried forward), process it
        if (lastHigh !== null && lastLow !== null) {
            const mid = (lastHigh + lastLow) / 2;
            validMids.push(mid);
            // We calculate spread later? No, spread requires Fair Price first.
            // We just return the raw data streams aligned.
        }
    }

    if (validMids.length === 0) return null;

    return {
        mids: validMids,
        // Recalculating spread requires Fair Value, which is calculated from Mids.
        // So we actually need the raw Highs/Lows aligned with Mids.
        spreadLowers: [] // Placeholder, we'll do this in main body for clarity
    };
};

// --- MAIN FUNCTION ---

export const calculateOfferPrices = (
    priceHistory: PriceDataPoint[]
): OfferPriceAnalysis | null => {
    // 1. Pre-process (FFill + DropNA)
    // We need the aligned lists of Highs and Lows to calculate everything
    const cleanHighs: number[] = [];
    const cleanLows: number[] = [];

    let lastHigh: number | null = null;
    let lastLow: number | null = null;

    for (const p of priceHistory) {
        if (p.avgHighPrice !== null && p.avgHighPrice !== undefined) lastHigh = p.avgHighPrice;
        if (p.avgLowPrice !== null && p.avgLowPrice !== undefined) lastLow = p.avgLowPrice;

        if (lastHigh !== null && lastLow !== null) {
            cleanHighs.push(lastHigh);
            cleanLows.push(lastLow);
        }
    }

    // Need enough data
    if (cleanHighs.length < MARGIN_WINDOW + 2) {
        return null;
    }

    // 2. Calculate Mids
    const mids = cleanHighs.map((h, i) => (h + cleanLows[i]) / 2);

    // 3. Calculate Fair Value (EMA)
    const fairPrices = calculateEMA(mids, SMOOTHING_WINDOW);

    // 4. Calculate Spreads (Fair - Low)
    // Note: fairPrices array aligns perfectly with cleanLows
    const spreadLowers = fairPrices.map((fair, i) => fair - cleanLows[i]);

    // 5. Calculate Deep Margin (Rolling Max)
    const marginDeeps = calculateRollingMax(spreadLowers, MARGIN_WINDOW);

    // 6. Select Target Index (Second to last)
    // Python: iloc[-2]
    const targetIndex = cleanHighs.length - 2;

    const prevFair = fairPrices[targetIndex];
    const prevMarginDeep = marginDeeps[targetIndex];

    // 7. Strategy Calculation
    const targetBuy = Math.floor(prevFair - (prevMarginDeep * LOWBALL_FACTOR));
    const targetSell = Math.floor(targetBuy * PROFIT_TARGET);

    // 8. Profitability Check
    const tax = calculateTax(targetSell);
    const expectedProfit = targetSell - targetBuy - tax;

    if (expectedProfit <= 0) {
        return {
            recommendedBuy: null,
            recommendedSell: null,
            potentialProfit: 0,
            potentialMargin: '0.00%',
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
