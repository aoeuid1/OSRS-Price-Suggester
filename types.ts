export interface Item {
    examine: string;
    id: number;
    members: boolean;
    lowalch: number;
    limit: number;
    value: number;
    highalch: number;
    icon: string;
    name: string;
    price?: number;
}

export interface PriceDataPoint {
    timestamp: number;
    avgHighPrice: number | null;
    avgLowPrice: number | null;
    highPriceVolume: number;
    lowPriceVolume: number;
    fairPrice?: number | null;
    // Fair Price Forecast
    forecastPrice?: number | null;
    forecastHigh?: number | null;
    forecastLow?: number | null;
    // High Price Forecast
    forecastHigh_mean?: number | null;
    forecastHigh_upper?: number | null;
    forecastHigh_lower?: number | null;
    // Low Price Forecast
    forecastLow_mean?: number | null;
    forecastLow_upper?: number | null;
    forecastLow_lower?: number | null;
    maxRealisticMargin?: number | null;
    maxRealisticMarginAfterTax?: number | null;
    p90LowSpread?: number | null;
    p90HighSpread?: number | null;
    buyOffer?: number | null;
    sellOffer?: number | null;
}

export interface FulfilmentDataPoint {
    timeHorizonHours: number;
    probability: number;
}

export interface FulfilmentAnalysis {
    buy: FulfilmentDataPoint[];
    sell: FulfilmentDataPoint[];
}

export interface OfferPriceAnalysis {
    recommendedBuy: number | null;
    recommendedSell: number | null;
    potentialProfit: number | null;
    potentialMargin: string | null;
    analysisMethod: 'Historical' | 'Hybrid Forecast';
    fulfilmentAnalysis: FulfilmentAnalysis | null;
}