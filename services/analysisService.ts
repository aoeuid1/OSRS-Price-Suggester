import { PriceDataPoint, OfferPriceAnalysis } from './types';

// --- CONFIGURATION ---
const TAX_RATE = 0.01;
const TAX_CAP = 5_000_000;

// STRATEGY PARAMETERS (Must match Python V13)
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
 * Matches Pandas ewm(span=window).
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
            ema = val; 
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
        const start = Math.max(0, i - windowSize + 1);
        
        for (let j = start; j <= i; j++) {
            const v = values[j];
            if (v !== null) {
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
 * Forward Fill Logic.
 * Matches Pandas ffill() behavior: propagates last valid observation forward.
 */
const cleanData = (history: PriceDataPoint[]): PriceDataPoint[] => {
    let lastHigh: number | null = null;
    let lastLow: number | null = null;

    return history.map(p => {
        // Note: We use !== null to ensure we don't skip 0 values
        if (p.avgHighPrice !== null && p.avgHighPrice !== undefined) lastHigh = p.avgHighPrice;
        if (p.avgLowPrice !== null && p.avgLowPrice !== undefined) lastLow = p.avgLowPrice;
        
        return {
            ...p,
            avgHighPrice: (p.avgHighPrice !== null && p.avgHighPrice !== undefined) ? p.avgHighPrice : lastHigh,
            avgLowPrice: (p.avgLowPrice !== null && p.avgLowPrice !== undefined) ? p.avgLowPrice : lastLow,
        };
    });
};

// --- MAIN EXPORT ---

export const calculateOfferPrices = (
    priceHistory: PriceDataPoint[]
): OfferPriceAnalysis | null => {
    // Ensure we have enough data for the rolling window + the offset
    if (!priceHistory || priceHistory.length < MARGIN_WINDOW + 2) {
        return null;
    }

    // 1. Clean Data (Forward Fill)
    const cleanedHistory = cleanData([...priceHistory]);

    // 2. Extract Series
    const highs = cleanedHistory.map(p => p.avgHighPrice);
    const lows = cleanedHistory.map(p => p.avgLowPrice);

    // 3. Calculate Indicators
    const mids: (number | null)[] = [];
    const spreadLowers: (number | null)[] = [];

    // Calculate Mids first
    for (let i = 0; i < cleanedHistory.length; i++) {
        const h = highs[i];
        const l = lows[i];
        if (h !== null && l !== null) {
            mids.push((h + l) / 2);
        } else {
            mids.push(null);
        }
    }

    // Calculate Fair Price (EMA)
    const fairPrices = calculateEMA(mids, SMOOTHING_WINDOW);

    // Calculate Spread Lower (Fair - Low)
    for (let i = 0; i < cleanedHistory.length; i++) {
        const f = fairPrices[i];
        const l = lows[i];
        if (f !== null && l !== null) {
            spreadLowers.push(f - l);
        } else {
            spreadLowers.push(null);
        }
    }

    // Calculate Deep Margin (Rolling Max)
    const marginDeeps = calculateRollingMax(spreadLowers, MARGIN_WINDOW);

    // 4. Select Data Point
    // Python uses iloc[-2] (Second to last candle) for stability.
    const prevIndex = cleanedHistory.length - 2;
    
    const prevFair = fairPrices[prevIndex];
    const prevMarginDeep = marginDeeps[prevIndex];

    if (prevFair === null || prevMarginDeep === null) {
        return null;
    }

    // 5. Strategy Calculation
    // Buy Logic: Fair Value - (Max Historical Dip * 1.1)
    const targetBuy = Math.floor(prevFair - (prevMarginDeep * LOWBALL_FACTOR));

    // Sell Logic: Target Profit (1.5%)
    const targetSell = Math.floor(targetBuy * PROFIT_TARGET);

    // 6. Profitability Check
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
