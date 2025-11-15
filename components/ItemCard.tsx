import React from 'react';
import { Item } from '../types';

interface ItemCardProps {
    item: Item;
    onClick: () => void;
}

const formatPrice = (price: number | null | undefined) => {
    if (price === null || typeof price === 'undefined' || price <= 0) return 'N/A';
    
    if (price >= 1_000_000_000) {
        return (price / 1_000_000_000).toFixed(2) + 'B';
    }
    if (price >= 1_000_000) {
        const value = (price / 1_000_000).toFixed(1);
        if (value === '1000.0') return '1B';
        return value.replace(/\.0$/, '') + 'M';
    }
    if (price >= 1_000) {
        const value = (price / 1_000).toFixed(1);
        if (value === '1000.0') return '1M';
        return value.replace(/\.0$/, '') + 'K';
    }
    return price.toLocaleString();
};

const ItemCard: React.FC<ItemCardProps> = ({ item, onClick }) => {
    return (
        <div
            onClick={onClick}
            className="bg-gray-800 p-3 rounded-lg flex flex-col items-center justify-between text-center cursor-pointer
                       border-2 border-transparent hover:border-yellow-500 transition-all duration-200 transform hover:-translate-y-1 h-24"
        >
            <p className="text-xs text-gray-300 leading-tight">{item.name}</p>
            {item.price != null && item.price > 0 && (
                <p className="text-xs font-bold text-yellow-400 mt-1">{formatPrice(item.price)} gp</p>
            )}
        </div>
    );
};

export default ItemCard;