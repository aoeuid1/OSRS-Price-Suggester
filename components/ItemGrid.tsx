
import React, { useState } from 'react';
import { Item } from '../types';
import ItemCard from './ItemCard';

interface ItemGridProps {
    items: Item[];
    onItemClick: (item: Item) => void;
}

const ITEMS_PER_PAGE = 48;

const ItemGrid: React.FC<ItemGridProps> = ({ items, onItemClick }) => {
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    const loadMore = () => {
        setVisibleCount(prevCount => prevCount + ITEMS_PER_PAGE);
    };

    return (
        <div>
            {items.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {items.slice(0, visibleCount).map((item) => (
                        <ItemCard key={item.id} item={item} onClick={() => onItemClick(item)} />
                    ))}
                </div>
            ) : (
                <p className="text-center text-gray-400 mt-8">No items found matching your search.</p>
            )}
            
            {visibleCount < items.length && (
                <div className="text-center mt-8">
                    <button
                        onClick={loadMore}
                        className="bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-yellow-400 transition-colors"
                    >
                        Load More
                    </button>
                </div>
            )}
        </div>
    );
};

export default ItemGrid;
