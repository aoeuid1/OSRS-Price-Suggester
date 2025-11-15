import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { Item, PriceDataPoint, OfferPriceAnalysis } from '../types';
import { calculateOfferPrices } from '../services/analysisService';
import LoadingSpinner from './LoadingSpinner';

interface PriceChartModalProps {
    item: Item;
    priceHistory: PriceDataPoint[] | null;
    isLoading: boolean;
    onClose: () => void;
}

const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatPrice = (price: number | null | undefined) => {
    if (price === null || typeof price === 'undefined') return 'N/A';
    return Math.round(price).toLocaleString();
};

const formatVolume = (volume: number | null) => {
    if (volume === null) return 'N/A';
    if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}m`;
    if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}k`;
    return volume.toLocaleString();
};

const PriceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isForecast = data.forecastPrice != null;

        return (
            <div className="bg-gray-700 p-3 rounded-lg border border-gray-600 shadow-lg text-sm">
                <p className="label text-gray-200 font-bold mb-2">
                    {isForecast && <span className="text-orange-400">[Forecast] </span>}
                    {`${formatTimestamp(label)}`}
                </p>
                {isForecast ? (
                     <>
                        <p className="intro text-orange-300 font-semibold">{`Forecast Price: ${formatPrice(data.forecastPrice)}`}</p>
                        <p className="intro text-gray-400">{`Forecast High: ${formatPrice(data.forecastHigh)}`}</p>
                        <p className="intro text-gray-400">{`Forecast Low: ${formatPrice(data.forecastLow)}`}</p>
                    </>
                ) : (
                    <>
                        <p className="intro text-violet-300 font-semibold">{`Fair Price: ${formatPrice(data.fairPrice)}`}</p>
                        <p className="intro text-cyan-400">{`Avg High: ${formatPrice(data.avgHighPrice)}`}</p>
                        <p className="intro text-green-400">{`Avg Low: ${formatPrice(data.avgLowPrice)}`}</p>
                    </>
                )}
            </div>
        );
    }
    return null;
};

const VolumeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-700 p-3 rounded-lg border border-gray-600 shadow-lg text-sm">
                 <p className="label text-gray-200 font-bold mb-2">{`${formatTimestamp(label)}`}</p>
                <p className="intro text-amber-400">{`High Vol: ${formatVolume(data.highPriceVolume)}`}</p>
                <p className="intro text-red-400">{`Low Vol: ${formatVolume(data.lowPriceVolume)}`}</p>
            </div>
        );
    }
    return null;
}

const MarginTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-700 p-3 rounded-lg border border-gray-600 shadow-lg text-sm">
                <p className="label text-gray-200 font-bold mb-2">{`${formatTimestamp(label)}`}</p>
                 <p className="intro text-pink-400 font-semibold">{`Max Realistic Margin: ${formatPrice(data.maxRealisticMargin)}`}</p>
                 <p className="intro text-purple-400 font-semibold">{`Margin (After Tax): ${formatPrice(data.maxRealisticMarginAfterTax)}`}</p>
            </div>
        );
    }
    return null;
}

const TradingTerminal: React.FC<{ analysis: OfferPriceAnalysis | null; }> = ({ analysis }) => {
    const [copiedBuy, setCopiedBuy] = useState(false);
    const [copiedSell, setCopiedSell] = useState(false);

    const handleCopy = (value: number | null, type: 'buy' | 'sell') => {
        if (value === null) return;
        navigator.clipboard.writeText(value.toString());

        if (type === 'buy') {
            setCopiedBuy(true);
            setTimeout(() => setCopiedBuy(false), 1500);
        } else {
            setCopiedSell(true);
            setTimeout(() => setCopiedSell(false), 1500);
        }
    };

    const CopyIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    );

    const CheckIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    );

    return (
        <div className="mb-6 p-4 bg-gray-900 rounded-lg">
            <h3 className="text-lg font-bold text-center text-yellow-400 mb-4">Offer Suggestion</h3>
            
            {analysis ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-gray-800 p-4 rounded-lg border border-green-500/50 relative">
                             {analysis.recommendedBuy && (
                                <button
                                    onClick={() => handleCopy(analysis.recommendedBuy, 'buy')}
                                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors"
                                    aria-label="Copy buy offer"
                                >
                                    {copiedBuy ? <CheckIcon /> : <CopyIcon />}
                                </button>
                            )}
                            <p className="text-sm font-semibold text-gray-400">Suggested Buy Offer</p>
                            <p className="text-2xl font-bold text-green-400 my-1">{formatPrice(analysis.recommendedBuy)} gp</p>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-red-500/50 relative">
                            {analysis.recommendedSell && (
                                <button
                                    onClick={() => handleCopy(analysis.recommendedSell, 'sell')}
                                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors"
                                    aria-label="Copy sell offer"
                                >
                                    {copiedSell ? <CheckIcon /> : <CopyIcon />}
                                </button>
                            )}
                            <p className="text-sm font-semibold text-gray-400">Suggested Sell Offer</p>
                            <p className="text-2xl font-bold text-red-400 my-1">{formatPrice(analysis.recommendedSell)} gp</p>
                        </div>
                        <div className={`bg-gray-800 p-4 rounded-lg border ${analysis.potentialProfit && analysis.potentialProfit > 0 ? 'border-yellow-500/50' : 'border-gray-600/50'}`}>
                            <p className="text-sm font-semibold text-gray-400">Potential Profit (After Tax)</p>
                            <p className={`text-2xl font-bold my-1 ${analysis.potentialProfit && analysis.potentialProfit > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                {formatPrice(analysis.potentialProfit)} gp
                            </p>
                            <p className="text-xs text-gray-500">Margin: {analysis.potentialMargin ?? 'N/A'}</p>
                        </div>
                    </div>
                     <div className="mt-6">
                         <h4 className="text-md font-bold text-center text-gray-300 mb-3">Offer Analysis</h4>
                         {analysis.fulfilmentAnalysis ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {/* Buy Offer Analysis */}
                                 <div className="bg-gray-800 p-4 rounded-lg">
                                     <p className="font-semibold text-green-400 mb-2 text-center">Buy Offer Fulfilment</p>
                                     <table className="w-full text-sm">
                                         <thead>
                                             <tr className="border-b border-gray-700">
                                                 <th className="text-left font-semibold text-gray-400 pb-1">Time Horizon</th>
                                                 <th className="text-right font-semibold text-gray-400 pb-1">Est. Probability</th>
                                             </tr>
                                         </thead>
                                         <tbody>
                                            {analysis.fulfilmentAnalysis.buy.map(p => (
                                                <tr key={p.timeHorizonHours}>
                                                    <td className="text-gray-300 py-1">Within {p.timeHorizonHours} Hour{p.timeHorizonHours > 1 ? 's' : ''}</td>
                                                    <td className="text-right text-gray-200 font-mono">{(p.probability * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                         </tbody>
                                     </table>
                                 </div>
                                 {/* Sell Offer Analysis */}
                                  <div className="bg-gray-800 p-4 rounded-lg">
                                     <p className="font-semibold text-red-400 mb-2 text-center">Sell Offer Fulfilment</p>
                                     <table className="w-full text-sm">
                                         <thead>
                                             <tr className="border-b border-gray-700">
                                                 <th className="text-left font-semibold text-gray-400 pb-1">Time Horizon</th>
                                                 <th className="text-right font-semibold text-gray-400 pb-1">Est. Probability</th>
                                             </tr>
                                         </thead>
                                         <tbody>
                                            {analysis.fulfilmentAnalysis.sell.map(p => (
                                                <tr key={p.timeHorizonHours}>
                                                    <td className="text-gray-300 py-1">Within {p.timeHorizonHours} Hour{p.timeHorizonHours > 1 ? 's' : ''}</td>
                                                    <td className="text-right text-gray-200 font-mono">{(p.probability * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                         </tbody>
                                     </table>
                                 </div>
                            </div>
                         ) : (
                            <div className="text-center text-gray-500 p-4 bg-gray-800 rounded-lg text-sm">
                                Not enough forecast data to estimate fulfilment probabilities.
                            </div>
                         )}
                     </div>
                </>
            ) : (
                 <div className="text-center text-gray-400 p-4 bg-gray-800 rounded-lg">
                    Not enough recent trade data to generate a recommendation.
                </div>
            )}
             <p className="text-center text-xs text-gray-500 mt-4">
                Disclaimer: These are statistical suggestions, not financial advice. Market conditions can change rapidly.
            </p>
        </div>
    );
};


const PriceChartModal: React.FC<PriceChartModalProps> = ({ item, priceHistory, isLoading, onClose }) => {
    
    const analysis = useMemo(() => {
        if (!priceHistory || priceHistory.length === 0) return null;
        return calculateOfferPrices(priceHistory);
    }, [priceHistory]);

    const chartData = useMemo(() => {
        if (!priceHistory || priceHistory.length === 0) return [];
        
        if (analysis && (analysis.recommendedBuy || analysis.recommendedSell)) {
            const historyCopy: PriceDataPoint[] = JSON.parse(JSON.stringify(priceHistory));
            
            let lastHistoricalPointIndex = -1;
            for (let i = historyCopy.length - 1; i >= 0; i--) {
                if (historyCopy[i].fairPrice != null) {
                    lastHistoricalPointIndex = i;
                    break;
                }
            }
            
            if (lastHistoricalPointIndex !== -1) {
                if (analysis.recommendedBuy) {
                    historyCopy[lastHistoricalPointIndex].buyOffer = analysis.recommendedBuy;
                }
                if (analysis.recommendedSell) {
                    historyCopy[lastHistoricalPointIndex].sellOffer = analysis.recommendedSell;
                }
            }
            return historyCopy;
        }

        return priceHistory;
    }, [priceHistory, analysis]);

    const forecastStartIndex = useMemo(() => chartData.findIndex(p => p.forecastPrice != null), [chartData]);
    const forecastStartTimestamp = useMemo(() => forecastStartIndex !== -1 ? chartData[forecastStartIndex].timestamp : null, [chartData, forecastStartIndex]);
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center">
                        <h2 className="text-xl font-bold text-yellow-400">{item.name} - Price Analysis</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="p-4 md:p-6 flex-grow overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full min-h-[400px]">
                            <LoadingSpinner />
                        </div>
                    ) : chartData && chartData.length > 0 ? (
                        <>
                            <TradingTerminal analysis={analysis} />
                            <div className="w-full">
                                <h4 className="text-lg font-semibold text-center text-gray-300 mb-2">Price History & Forecast</h4>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={chartData} syncId="priceVolumeSync" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                                        <XAxis dataKey="timestamp" tickLine={false} axisLine={false} tick={false} />
                                        <YAxis 
                                            tickFormatter={formatPrice} 
                                            stroke="#9CA3AF" 
                                            tick={{ fontSize: 12 }}
                                            domain={['dataMin', 'dataMax']}
                                            width={80}
                                        />
                                        <Tooltip content={<PriceTooltip />} cursor={{ stroke: '#9CA3AF', strokeDasharray: '3 3' }} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        
                                        {forecastStartTimestamp && (
                                            <ReferenceLine 
                                                x={forecastStartTimestamp} 
                                                stroke="white" 
                                                strokeDasharray="3 3"
                                                label={{ value: 'Forecast', position: 'insideTopLeft', fill: 'white', fontSize: 12 }}
                                            />
                                        )}
                                                                                
                                        <Line type="monotone" dataKey="fairPrice" name="Fair Price (SMA)" stroke="#C4B5FD" dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls />
                                        <Line type="monotone" dataKey="avgHighPrice" name="Avg. High Price" stroke="#2DD4BF" dot={false} strokeWidth={2} connectNulls />
                                        <Line type="monotone" dataKey="avgLowPrice" name="Avg. Low Price" stroke="#4ADE80" dot={false} strokeWidth={2} connectNulls />
                                        
                                        <Line type="monotone" dataKey="forecastPrice" name="Forecast Price" stroke="#FFA500" dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls />
                                        <Line type="monotone" dataKey="forecastHigh" name="Forecast High" stroke="#FFA500" dot={false} strokeWidth={1.5} strokeOpacity={0.8} strokeDasharray="3 7" connectNulls />
                                        <Line type="monotone" dataKey="forecastLow" name="Forecast Low" stroke="#FFA500" dot={false} strokeWidth={1.5} strokeOpacity={0.8} strokeDasharray="3 7" connectNulls />

                                        <Line type="monotone" dataKey="buyOffer" name="Suggested Buy" stroke="#4ADE80" strokeWidth={0} activeDot={{ r: 8 }} dot={{ r: 6, fill: '#4ADE80' }} connectNulls={false} />
                                        <Line type="monotone" dataKey="sellOffer" name="Suggested Sell" stroke="#F87171" strokeWidth={0} activeDot={{ r: 8 }} dot={{ r: 6, fill: '#F87171' }} connectNulls={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                                
                                <h4 className="text-lg font-semibold text-center text-gray-300 mb-2 mt-8">Margin Analysis</h4>
                                <div className="text-center text-sm text-gray-400 mb-2">
                                     <p><strong>Max Realistic Margin</strong> is a rolling benchmark of the typical spread. <strong>After Tax</strong> margin accounts for the 2% G.E. tax.</p>
                                </div>
                                <ResponsiveContainer width="100%" height={150}>
                                     <LineChart data={chartData} syncId="priceVolumeSync" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                                        <XAxis dataKey="timestamp" tickLine={false} axisLine={false} tick={false} />
                                        <YAxis
                                            orientation="left"
                                            tickFormatter={formatPrice}
                                            stroke="#9CA3AF"
                                            tick={{ fontSize: 12 }}
                                            domain={['dataMin', 'dataMax']}
                                            width={80}
                                        />
                                        <Tooltip content={<MarginTooltip />} cursor={{ stroke: '#9CA3AF', strokeDasharray: '3 3' }}/>
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        <Line type="monotone" dataKey="maxRealisticMargin" name="Max Realistic Margin" stroke="#F472B6" dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls />
                                        <Line type="monotone" dataKey="maxRealisticMarginAfterTax" name="Margin (After Tax)" stroke="#C084FC" dot={false} strokeWidth={2} strokeDasharray="5 5" connectNulls />

                                        {forecastStartTimestamp && (
                                            <ReferenceLine x={forecastStartTimestamp} stroke="white" strokeDasharray="3 3" />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>

                                <h4 className="text-lg font-semibold text-center text-gray-300 mb-2 mt-8">Trade Volume</h4>
                                <ResponsiveContainer width="100%" height={150}>
                                     <LineChart data={chartData} syncId="priceVolumeSync" margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                                        <XAxis 
                                            dataKey="timestamp" 
                                            tickFormatter={(ts) => new Date(ts * 1000).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                                            stroke="#9CA3AF" 
                                            tick={{ fontSize: 12 }} 
                                        />
                                        <YAxis
                                            orientation="left"
                                            tickFormatter={formatVolume}
                                            stroke="#9CA3AF"
                                            tick={{ fontSize: 12 }}
                                            domain={['dataMin', 'dataMax']}
                                            width={80}
                                        />
                                        <Tooltip content={<VolumeTooltip />} cursor={{ stroke: '#9CA3AF', strokeDasharray: '3 3' }}/>
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        <Line type="monotone" dataKey="highPriceVolume" name="High Price Volume" stroke="#FBBF24" dot={false} strokeWidth={2} />
                                        <Line type="monotone" dataKey="lowPriceVolume" name="Low Price Volume" stroke="#F87171" dot={false} strokeWidth={2} />
                                        {forecastStartTimestamp && (
                                            <ReferenceLine x={forecastStartTimestamp} stroke="white" strokeDasharray="3 3" />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    ) : (
                        <p className="text-center text-gray-400 h-full flex items-center justify-center">No price data available for this item.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PriceChartModal;