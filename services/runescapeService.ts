import { PriceDataPoint } from '../types';
import { fetchTimeSeriesData } from './apiService';
import { generateForecast } from './forecastService';
import { processRawPriceData } from './dataProcessingService';

export const fetchPriceHistory = async (itemId: number): Promise<PriceDataPoint[]> => {
    // 1. Fetch raw time-series data from the API
    const rawData = await fetchTimeSeriesData(itemId);
    
    // 2. Process raw data to calculate VWAP and Fair Price (SMA)
    const processedHistory = processRawPriceData(rawData);

    // 3. Generate a forecast based on the processed historical data
    const forecast = await generateForecast(processedHistory);

    // 4. Combine historical data with the forecast and return
    return [...processedHistory, ...forecast];
};
