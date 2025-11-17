import { PriceDataPoint } from '../types';
import { fetchTimeSeriesData } from './apiService';
import { processRawPriceData } from './dataProcessingService';

export const fetchPriceHistory = async (itemId: number): Promise<PriceDataPoint[]> => {
    // 1. Fetch raw time-series data from the API
    const rawData = await fetchTimeSeriesData(itemId);
    
    // 2. Process raw data to calculate VWAP, Fair Price (SMA), margins, etc.
    const processedHistory = processRawPriceData(rawData);

    // 3. Return the processed historical data
    return processedHistory;
};
