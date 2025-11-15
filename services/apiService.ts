import { Item, PriceDataPoint } from '../types';

const API_BASE_URL = 'https://prices.runescape.wiki/api/v1/osrs';

export const fetchItemMapping = async (): Promise<Item[]> => {
    const response = await fetch(`${API_BASE_URL}/mapping`);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const data: Item[] = await response.json();
    return data;
};

interface LatestPricesResponse {
    data: {
        [id: string]: {
            high: number;
            low: number;
        };
    };
}

export const fetchLatestPrices = async (): Promise<LatestPricesResponse['data']> => {
    const response = await fetch(`${API_BASE_URL}/latest`);
    if (!response.ok) {
        throw new Error('Failed to fetch latest prices');
    }
    const data: LatestPricesResponse = await response.json();
    return data.data;
};

interface TimeSeriesResponse {
    data: Omit<PriceDataPoint, 'fairPrice'>[];
}

export const fetchTimeSeriesData = async (itemId: number): Promise<Omit<PriceDataPoint, 'fairPrice'>[]> => {
    const response = await fetch(`${API_BASE_URL}/timeseries?id=${itemId}&timestep=5m`);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const responseData: TimeSeriesResponse = await response.json();
    return responseData.data;
}
