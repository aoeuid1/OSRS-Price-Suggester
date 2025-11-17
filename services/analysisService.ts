import { PriceDataPoint, OfferPriceAnalysis } from '../types';

// --- CONFIGURATION ---
const TAX_RATE = 0.01;
const TAX_CAP = 5_000_000;

// STRATEGY PARAMETERS (V13 "The Under-Cutter")
const SMOOTHING_WINDOW = 12; // 1 Hour EMA
const MARGIN_WINDOW = 48;    // 4 Hours Lookback
const LOWBALL_FACTOR = 1.1;  // Buy Depth
const PROFIT_TARGET = 1.015; // 1.5% Target

// --- HELPERS ---

const calculateTax = (price: number): number => {
    return Math.min(Math.floor(price * TAX_RATE), TAX_CAP);
};

/**
 * Calculates Exponential Moving Average (EMA).
 * Matches Pandas ewm(span=window, adjust=True).
 */
const calculateEMA = (values: number[], span: number): number[] => {
    const alpha = 2 / (span + 1);
    const decay = 1 - alpha;
    
    let weightedSum = 0;
    let weightSum = 0;
    const result: number[] = [];

    for (const val of values) {
        weightedSum = val + (decay * weightedSum);
        weightSum = 1 + (decay * weightSum);
        result.push(weightedSum / weightSum);
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
        // Window start index (inclusive)
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

// --- MAIN FUNCTION ---

export const calculateOfferPrices = (
    priceHistory: PriceDataPoint[]
): OfferPriceAnalysis | null => {
    // 1. Pre-process (FFill + DropNA Equivalent)
    // We filter out the initial period where data might be sparse or null
    const cleanHighs: number[] = [];
    const cleanLows: number[] = [];
    let lastHigh: number | null = null;
    let lastLow: number | null = null;

    for (const p of priceHistory) {
        // Update state if current value is valid
        if (p.avgHighPrice !== null && p.avgHighPrice !== undefined) lastHigh = p.avgHighPrice;
        if (p.avgLowPrice !== null && p.avgLowPrice !== undefined) lastLow = p.avgLowPrice;

        // Only push to our calc arrays if we have a full set of data (mimics dropna)
        if (lastHigh !== null && lastLow !== null) {
            cleanHighs.push(lastHigh);
            cleanLows.push(lastLow);
        }
    }

    // Ensure we have enough data points for the Rolling Window calculation
    // We need at least Window + 2 points to safely look back
    if (cleanHighs.length < MARGIN_WINDOW + 2) {
        return null;
    }

    // 2. Calculate Mids
    const mids = cleanHighs.map((h, i) => (h + cleanLows[i]) / 2);

    // 3. Calculate Fair Value (EMA)
    const fairPrices = calculateEMA(mids, SMOOTHING_WINDOW);

    // 4. Calculate Spread Lower (Fair - Low)
    const spreadLowers = fairPrices.map((fair, i) => fair - cleanLows[i]);

    // 5. Calculate Deep Margin (Rolling Max)
    const marginDeeps = calculateRollingMax(spreadLowers, MARGIN_WINDOW);

    // 6. Select Target Index
    // We use the SECOND to last data point (length - 2) to generate the signal.
    // This mimics the Python logic of using "Previous Candle" to predict "Next Action",
    // ensuring we aren't painting the target based on incomplete current-bucket data.
    const targetIndex = cleanHighs.length - 2;

    const prevFair = fairPrices[targetIndex];
    const prevMarginDeep = marginDeeps[targetIndex];

    // 7. Strategy Calculation
    // Buy Logic: Fair Value - (Max Historical Dip * 1.1)
    const targetBuy = Math.floor(prevFair - (prevMarginDeep * LOWBALL_FACTOR));
    
    // Sell Logic: Fixed Markup
    const targetSell = Math.floor(targetBuy * PROFIT_TARGET);

    // 8. Profitability Check
    const tax = calculateTax(targetSell);
    const expectedProfit = targetSell - targetBuy - tax;

    // If the algo suggests a trade that loses money (inverted spread or high tax),
    // we return a "Null" analysis or a 0-profit warning.
    if (expectedProfit <= 0) {
        return {
            recommendedBuy: null,
            recommendedSell: null,
            potentialProfit: 0,
            potentialMargin: '0.00%',
            analysisMethod: 'Historical',
        };
    }

    return {
        recommendedBuy: targetBuy,
        recommendedSell: targetSell,
        potentialProfit: expectedProfit,
        potentialMargin: ((expectedProfit / targetBuy) * 100).toFixed(2) + '%',
        analysisMethod: 'Historical',
    };
};
