
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Item, PriceDataPoint } from './types';
import { fetchItemMapping, fetchLatestPrices } from './services/apiService';
import { fetchPriceHistory } from './services/runescapeService';
import SearchBar from './components/SearchBar';
import ItemGrid from './components/ItemGrid';
import PriceChartModal from './components/PriceChartModal';
import LoadingSpinner from './components/LoadingSpinner';

const App: React.FC = () => {
    const [allItems, setAllItems] = useState<Item[]>([]);
    const [filteredItems, setFilteredItems] = useState<Item[]>([]);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [priceHistory, setPriceHistory] = useState<PriceDataPoint[] | null>(null);
    const [isLoadingItems, setIsLoadingItems] = useState<boolean>(true);
    const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const processedUrlParam = useRef(false);

    useEffect(() => {
        const getItemsAndPrices = async () => {
            try {
                setIsLoadingItems(true);
                setError(null);
                const [items, prices] = await Promise.all([
                    fetchItemMapping(),
                    fetchLatestPrices()
                ]);

                const itemsWithPrices = items.map(item => {
                    const priceData = prices[item.id];
                    const price = priceData ? (priceData.high + priceData.low) / 2 : item.value;
                    return { ...item, price };
                });

                itemsWithPrices.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

                setAllItems(itemsWithPrices);
            } catch (err) {
                setError('Failed to fetch item data. Please try again later.');
                console.error(err);
            } finally {
                setIsLoadingItems(false);
            }
        };
        getItemsAndPrices();
    }, []);

    const handleItemClick = useCallback(async (item: Item) => {
        try {
            const params = new URLSearchParams(window.location.search);
            params.set('item', item.name);
            window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
        } catch (e) {
            console.warn('Could not update URL: History API is not available in this environment.');
        }

        setSelectedItem(item);
        setIsLoadingPrice(true);
        setPriceHistory(null);
        try {
            const data = await fetchPriceHistory(item.id);
            setPriceHistory(data);
        } catch (err)
        {
            setError('Failed to fetch price history.');
            console.error(err);
            setPriceHistory(null);
        } finally {
            setIsLoadingPrice(false);
        }
    }, []);

    useEffect(() => {
        // This effect runs once after items are loaded to check for a URL parameter.
        if (isLoadingItems || allItems.length === 0 || processedUrlParam.current) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const itemNameFromUrl = params.get('item');

        if (itemNameFromUrl) {
            processedUrlParam.current = true; // Ensure we only process this once on load

            const decodedItemName = decodeURIComponent(itemNameFromUrl.replace(/\+/g, ' '));
            const itemToSelect = allItems.find(
                item => item.name.toLowerCase() === decodedItemName.toLowerCase()
            );

            if (itemToSelect) {
                handleItemClick(itemToSelect);
            }
        }
    }, [allItems, isLoadingItems, handleItemClick]);

    useEffect(() => {
        const lowercasedFilter = searchTerm.toLowerCase();

        if (lowercasedFilter === '') {
            // When search is empty, hide "3rd age" items
            const defaultFiltered = allItems.filter(
                item => !item.name.toLowerCase().startsWith('3rd age')
            );
            setFilteredItems(defaultFiltered);
        } else {
            // When searching, include all items
            const searchFiltered = allItems.filter(item =>
                item.name.toLowerCase().includes(lowercasedFilter)
            );
            setFilteredItems(searchFiltered);
        }
    }, [searchTerm, allItems]);

    const closeModal = () => {
        setSelectedItem(null);
        setPriceHistory(null);
        try {
            const params = new URLSearchParams(window.location.search);
            params.delete('item');
            const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        } catch (e) {
            console.warn('Could not update URL: History API is not available in this environment.');
        }
    };

    const header = useMemo(() => (
        <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-yellow-400 tracking-wider" style={{ fontFamily: 'RuneScape UF', textShadow: '2px 2px #000' }}>
                OSRS prices
            </h1>
            <p className="text-gray-400 mt-2">Browse items and view their Grand Exchange price history.</p>
        </div>
    ), []);

    return (
        <div className="bg-gray-900 min-h-screen text-gray-200 font-sans p-4 md:p-8">
            <div className="container mx-auto">
                {header}
                <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

                {isLoadingItems ? (
                    <div className="flex justify-center items-center h-64">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <p className="text-center text-red-500 mt-8">{error}</p>
                ) : (
                    <ItemGrid items={filteredItems} onItemClick={handleItemClick} />
                )}

                {selectedItem && (
                    <PriceChartModal
                        item={selectedItem}
                        priceHistory={priceHistory}
                        isLoading={isLoadingPrice}
                        onClose={closeModal}
                    />
                )}
            </div>
        </div>
    );
};

export default App;
