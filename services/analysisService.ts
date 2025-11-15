import { PriceDataPoint, OfferPriceAnalysis } from '../types';
import { calculateFulfilmentProbability } from './fulfilmentService';

const calculateGETax = (price: number): number => {
    const tax = Math.floor(price * 0.02);
    return Math.min(tax, 5_000_000);
};

const calculateHistoricalOffers = (
    priceHistory: PriceDataPoint[],
    hasRecentBuySideActivity: boolean,
    hasRecentSellSideActivity: boolean
): OfferPriceAnalysis | null => {
    const lastValidPoint = [...priceHistory].reverse().find(
        p => p.fairPrice != null && p.p90LowSpread != null && p.p90HighSpread != null
    );

    if (!lastValidPoint || !lastValidPoint.fairPrice || !lastValidPoint.p90LowSpread || !lastValidPoint.p90HighSpread) {
        return null;
    }
    
    const { fairPrice, p90LowSpread, p90HighSpread } = lastValidPoint;

    let recommendedBuy: number | null = Math.round(fairPrice - p90LowSpread);
    let recommendedSell: number | null = Math.round(fairPrice + p90HighSpread);

    if (!hasRecentBuySideActivity) {
        recommendedBuy = null;
    }
    if (!hasRecentSellSideActivity) {
        recommendedSell = null;
    }

    let potentialProfit: number | null = null;
    let potentialMargin: string | null = null;

    if (recommendedBuy != null && recommendedSell != null && recommendedBuy > 0) {
        const taxOnSale = calculateGETax(recommendedSell);
        potentialProfit = recommendedSell - recommendedBuy - taxOnSale;
        potentialMargin = ((potentialProfit / recommendedBuy) * 100).toFixed(2) + '%';
    }
    
    return { 
        recommendedBuy, 
        recommendedSell, 
        potentialProfit, 
        potentialMargin,
        analysisMethod: 'Historical',
        fulfilmentAnalysis: null
    };
};

export const calculateOfferPrices = (
    priceHistory: PriceDataPoint[]
): OfferPriceAnalysis | null => {
    
    const forecastData = priceHistory.filter(p => p.forecastPrice != null);
    const historicalData = priceHistory.filter(p => p.forecastPrice == null);

    if (historicalData.length === 0) {
        return null;
    }

    // --- Liquidity Check ---
    // Check for buy/sell activity in the last 3 hours to ensure suggestions are actionable.
    const recentHistoryWindow = 36; // 3 hours (3 * 12 points/hour)
    const recentHistoricalData = historicalData.slice(-recentHistoryWindow);
    const totalRecentHighVolume = recentHistoricalData.reduce((sum, p) => sum + p.highPriceVolume, 0);
    const totalRecentLowVolume = recentHistoricalData.reduce((sum, p) => sum + p.lowPriceVolume, 0);
    const hasRecentSellSideActivity = totalRecentHighVolume > 0;
    const hasRecentBuySideActivity = totalRecentLowVolume > 0;


    // If there's no forecast or not enough data, fall back to the historical method
    if (forecastData.length < 12) {
        return calculateHistoricalOffers(historicalData, hasRecentBuySideActivity, hasRecentSellSideActivity);
    }
    
    const lastHistoricalPoint = historicalData[historicalData.length - 1];
    if (!lastHistoricalPoint.fairPrice || !lastHistoricalPoint.p90LowSpread || !lastHistoricalPoint.p90HighSpread) {
        return calculateHistoricalOffers(historicalData, hasRecentBuySideActivity, hasRecentSellSideActivity); // Fallback if last point is invalid
    }

    // --- Hybrid Forecast Method ---

    // 1. Volatility Adjustment (Risk Management)
    const forecastIntervalWidth = forecastData[forecastData.length - 1].forecastHigh! - forecastData[forecastData.length - 1].forecastLow!;
    const historicalMargin = lastHistoricalPoint.p90LowSpread + lastHistoricalPoint.p90HighSpread;

    // Normalize interval width against the historical margin to get a volatility factor
    // A factor > 1 means future volatility is expected to be higher than historical.
    const volatilityFactor = historicalMargin > 0 ? forecastIntervalWidth / historicalMargin : 1;
    
    // Dampen the effect to avoid extreme adjustments. We'll scale it between 0.75x and 1.5x
    const clampedVolatilityFactor = Math.max(0.75, Math.min(1.5, volatilityFactor));

    const riskAdjustedLowSpread = lastHistoricalPoint.p90LowSpread * clampedVolatilityFactor;
    const riskAdjustedHighSpread = lastHistoricalPoint.p90HighSpread * clampedVolatilityFactor;

    // 2. Trend Adjustment (Momentum)
    const oneHourForecastIndex = Math.min(11, forecastData.length - 1); // 1 hour ahead (12 * 5 min)
    const forecastTrendDelta = forecastData[oneHourForecastIndex].forecastPrice! - lastHistoricalPoint.fairPrice;

    // Apply a fraction of the trend to the offers. We don't want to chase the full trend.
    const trendInfluenceFactor = 0.25; 
    const trendAdjustment = forecastTrendDelta * trendInfluenceFactor;

    const baseBuy = lastHistoricalPoint.fairPrice - riskAdjustedLowSpread;
    const baseSell = lastHistoricalPoint.fairPrice + riskAdjustedHighSpread;

    let recommendedBuy: number | null = Math.round(baseBuy + trendAdjustment);
    let recommendedSell: number | null = Math.round(baseSell + trendAdjustment);
    
    if (!hasRecentBuySideActivity) {
        recommendedBuy = null;
    }
    if (!hasRecentSellSideActivity) {
        recommendedSell = null;
    }

    let potentialProfit: number | null = null;
    let potentialMargin: string | null = null;

    if (recommendedBuy != null && recommendedSell != null && recommendedBuy > 0) {
        const taxOnSale = calculateGETax(recommendedSell);
        potentialProfit = recommendedSell - recommendedBuy - taxOnSale;
        potentialMargin = ((potentialProfit / recommendedBuy) * 100).toFixed(2) + '%';
    }

    const fulfilmentAnalysis = (recommendedBuy != null && recommendedSell != null) 
        ? calculateFulfilmentProbability(recommendedBuy, recommendedSell, forecastData)
        : null;
    
    return {
        recommendedBuy,
        recommendedSell,
        potentialProfit,
        potentialMargin,
        analysisMethod: 'Hybrid Forecast',
        fulfilmentAnalysis
    };
}