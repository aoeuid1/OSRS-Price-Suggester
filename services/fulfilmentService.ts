import { PriceDataPoint, FulfilmentAnalysis, FulfilmentDataPoint } from '../types';

/**
 * A reasonably accurate approximation of the error function (erf),
 * which is needed to calculate the Cumulative Distribution Function (CDF)
 * of a normal distribution.
 * @param x The input value.
 * @returns The erf of x.
 */
const erf = (x: number): number => {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
};

/**
 * Calculates the Cumulative Distribution Function (CDF) for a normal distribution.
 * This tells us the probability that a random variable from the distribution
 * will be less than or equal to a certain value.
 * @param x The value to test.
 * @param mean The mean (mu) of the distribution.
 * @param stdDev The standard deviation (sigma) of the distribution.
 * @returns The probability P(X <= x).
 */
const normalCdf = (x: number, mean: number, stdDev: number): number => {
    if (stdDev <= 0) { // Standard deviation cannot be zero or negative
        return x < mean ? 0 : 1;
    }
    return 0.5 * (1 + erf((x - mean) / (stdDev * Math.sqrt(2))));
};


export const calculateFulfilmentProbability = (
    buyOffer: number,
    sellOffer: number,
    forecastData: PriceDataPoint[]
): FulfilmentAnalysis | null => {

    if (!forecastData || forecastData.length === 0) {
        return null;
    }

    const timeHorizons = [1, 3, 6]; // in hours
    const pointsPerHour = 12; // 60 minutes / 5 minute intervals

    const buyProbabilities: FulfilmentDataPoint[] = [];
    const sellProbabilities: FulfilmentDataPoint[] = [];

    for (const hours of timeHorizons) {
        const pointsToConsider = hours * pointsPerHour;
        const forecastSlice = forecastData.slice(0, pointsToConsider);

        if (forecastSlice.length === 0) {
            buyProbabilities.push({ timeHorizonHours: hours, probability: 0 });
            sellProbabilities.push({ timeHorizonHours: hours, probability: 0 });
            continue;
        }

        const probNotFillingBuyPerInterval: number[] = [];
        const probNotFillingSellPerInterval: number[] = [];

        for (const point of forecastSlice) {
            // Deconstruct the independent forecasts
            const { 
                forecastHigh_mean, forecastHigh_upper, forecastHigh_lower,
                forecastLow_mean, forecastLow_upper, forecastLow_lower 
            } = point;

            if (forecastHigh_mean == null || forecastHigh_upper == null || forecastHigh_lower == null ||
                forecastLow_mean == null || forecastLow_upper == null || forecastLow_lower == null) continue;

            // --- Buy Offer Fulfilment (vs. High Price Forecast) ---
            // A buy offer is fulfilled if the high price (seller's ask) comes DOWN to our offer.
            const stdDevHigh = (forecastHigh_upper - forecastHigh_lower) / 3.92;
            // Probability of the high price being AT OR BELOW our buy offer.
            const probFillingBuy = normalCdf(buyOffer, forecastHigh_mean, stdDevHigh);
            probNotFillingBuyPerInterval.push(1 - probFillingBuy);

            // --- Sell Offer Fulfilment (vs. Low Price Forecast) ---
            // A sell offer is fulfilled if the low price (buyer's bid) comes UP to our offer.
            const stdDevLow = (forecastLow_upper - forecastLow_lower) / 3.92;
            // Probability of the low price being AT OR ABOVE our sell offer.
            const probFillingSell = 1 - normalCdf(sellOffer, forecastLow_mean, stdDevLow);
            probNotFillingSellPerInterval.push(1 - probFillingSell);
        }

        // The probability of not filling over the whole period is the product
        // of not filling in each individual interval.
        const totalProbNotFillingBuy = probNotFillingBuyPerInterval.reduce((acc, p) => acc * p, 1);
        const totalProbNotFillingSell = probNotFillingSellPerInterval.reduce((acc, p) => acc * p, 1);

        // The probability of filling is 1 - the probability of not filling.
        buyProbabilities.push({ timeHorizonHours: hours, probability: 1 - totalProbNotFillingBuy });
        sellProbabilities.push({ timeHorizonHours: hours, probability: 1 - totalProbNotFillingSell });
    }

    return {
        buy: buyProbabilities,
        sell: sellProbabilities,
    };
};
