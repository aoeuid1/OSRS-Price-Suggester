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
    maxRealisticMargin?: number | null;
    maxRealisticMarginAfterTax?: number | null;
    p90LowSpread?: number | null;
    p90HighSpread?: number | null;
    buyOffer?: number | null;
    sellOffer?: number | null;
    // Fix: Add forecast properties
    forecastPrice?: number | null;
    forecastHigh?: number | null;
    forecastLow?: number | null;
    forecastHigh_mean?: number | null;
    forecastHigh_upper?: number | null;
    forecastHigh_lower?: number | null;
    forecastLow_mean?: number | null;
    forecastLow_upper?: number | null;
    forecastLow_lower?: number | null;
}

export interface OfferPriceAnalysis {
    recommendedBuy: number | null;
    recommendedSell: number | null;
    potentialProfit: number | null;
    potentialMargin: string | null;
    analysisMethod: 'Historical';
}

// Fix: Add FulfilmentDataPoint interface
export interface FulfilmentDataPoint {
    timeHorizonHours: number;
    probability: number;
}

// Fix: Add FulfilmentAnalysis interface
export interface FulfilmentAnalysis {
    buy: FulfilmentDataPoint[];
    sell: FulfilmentDataPoint[];
}
