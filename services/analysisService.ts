import { PriceDataPoint, OfferPriceAnalysis } from '../types';
import { calculateFulfilmentProbability } from './fulfilmentService';


// --- CONFIGURATION ---
const TAX_RATE = 0.01;
const TAX_CAP = 5_000_000;

// STRATEGY PARAMETERS
const SMOOTHING_WINDOW = 12; // 1 Hour EMA (12 * 5m ticks)
const MARGIN_WINDOW = 48;    // 4 Hours Lookback (48 * 5m ticks)
const LOWBALL_FACTOR = 1.1;  // Buy Depth Multiplier
const PROFIT_TARGET = 1.015; // 1.5% Target Return

// --- HELPERS ---

const calculateTax = (price: number): number => {
    return Math.min(Math.floor(price * TAX_RATE), TAX_CAP);
};

// Standard EMA Calculation (matches Pandas ewm(span=window))
const calculateEMA = (values: (number | null)[], span: number): (number | null)[] => {
    const alpha = 2 / (span + 1);
    let ema: number | null = null;
    const result: (number | null)[] = [];

    for (const val of values) {
        if (val === null) {
            result.push(ema);
            continue;
        }

        if (ema === null) {
            ema = val; // Start with first valid value
        } else {
            ema = (val - ema) * alpha + ema;
        }
        result.push(ema);
    }
    return result;
};

// Rolling Maximum (matches Pandas rolling(window).max())
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

// Forward Fill logic (simple version to handle nulls in raw data)
const cleanData = (history: PriceDataPoint[]): PriceDataPoint[] => {
    let lastHigh: number | null = null;
    let lastLow: number | null = null;

    return history.map(p => {
        // Update reference if current is valid
        if (p.avgHighPrice) lastHigh = p.avgHighPrice;
        if (p.avgLowPrice) lastLow = p.avgLowPrice;
        
        return {
            ...p,
            // If current is null, use last known (Forward Fill)
            avgHighPrice: p.avgHighPrice ?? lastHigh,
            avgLowPrice: p.avgLowPrice ?? lastLow,
        };
    });
};

const calculateGETax = (price: number): number => {
    const tax = Math.floor(price * 0.02);
    return Math.min(tax, 5_000_000);
};

export const calculateOfferPrices = (
    priceHistory: PriceDataPoint[]
): OfferPriceAnalysis | null => {
    if (!priceHistory || priceHistory.length < MARGIN_WINDOW) {
        return null;
    }

    // 1. Clean Data (Forward Fill to ensure continuity)
    const cleanedHistory = cleanData(priceHistory);

    // 2. Extract Series for vectorized-style calculations
    // We need arrays of numbers for the helper functions
    const highs = cleanedHistory.map(p => p.avgHighPrice);
    const lows = cleanedHistory.map(p => p.avgLowPrice);

    // 3. Calculate Indicators
    const mids: (number | null)[] = [];
    for (let i = 0; i < cleanedHistory.length; i++) {
        const h = highs[i];
        const l = lows[i];
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

    // 4. Get "Previous" Data Point (Index N-2, since N-1 is "Latest/Current")
    // In simulation logic, we use `prev` to make decisions for `curr`.
    // So we want the indicators from the second-to-last available data point.
    const prevIndex = cleanedHistory.length - 2;
    if (prevIndex < 0) return null;

    const prevFair = fairPrices[prevIndex];
    const prevMarginDeep = marginDeeps[prevIndex];

    if (prevFair === null || prevMarginDeep === null) {
        return null;
    }

    // 5. Strategy Calculation (V13 Logic)
    
    // BUY LOGIC: Deep Value (Lowball)
    // Target = Fair - (Max Historical Dip * 1.1)
    const targetBuy = Math.floor(prevFair - (prevMarginDeep * LOWBALL_FACTOR));

    // SELL LOGIC: Fixed Markup
    // Target = Buy Price * 1.015
    const targetSell = Math.floor(targetBuy * PROFIT_TARGET);

    // 6. Profitability Check
    const tax = calculateTax(targetSell);
    const expectedProfit = targetSell - targetBuy - tax;

    // If the spread is inverted or unprofitable (e.g., marginDeep is negative or too small), return null
    if (expectedProfit <= 0) {
        return {
            recommendedBuy: null,
            recommendedSell: null,
            potentialProfit: null,
            potentialMargin: null,
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
        // Fulfilment analysis is outside the scope of the raw V13 pricing logic, 
        // but required by the interface.
        fulfilmentAnalysis: null 
    };

    
};
