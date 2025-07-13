import React, { useState, useEffect } from 'react';
import {MixerService} from '../../services/mixers/MixerService';
import './CleanlinessHistoryChart.css';

const CleanlinessHistoryChart = ({mixers}) => {
    const [cleanlinessHistory, setCleanlinessHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('6m');

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            if (mixers && mixers.length > 0) {
                fetchCleanlinessHistory();
            } else {
                setIsLoading(false);
                setCleanlinessHistory([]);
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [mixers, selectedPeriod]);

    const fetchCleanlinessHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const months = selectedPeriod === '1m' ? 1 :
                selectedPeriod === '3m' ? 3 :
                    selectedPeriod === '1y' ? 12 : 6;
            const cleanlinessData = await MixerService.getCleanlinessHistory(null, months);
            const filteredData = mixers.length > 0
                ? cleanlinessData.filter(entry =>
                    mixers.some(mixer => mixer.id === entry.mixerId || mixer.id === entry.mixer_id))
                : cleanlinessData;
            const historyByDate = {};
            for (const entry of filteredData) {
                const date = new Date(entry.changedAt || entry.changed_at);
                const dateKey = date.toISOString().split('T')[0];
                if (!historyByDate[dateKey]) {
                    historyByDate[dateKey] = {
                        date: dateKey,
                        totalRating: 0,
                        count: 0,
                        mixerIds: new Set()
                    };
                }
                const newValue = parseInt(entry.newValue || entry.new_value) || 0;
                historyByDate[dateKey].totalRating += newValue;
                historyByDate[dateKey].count += 1;
                historyByDate[dateKey].mixerIds.add(entry.mixerId || entry.mixer_id);
            }
            let historyArray = Object.values(historyByDate)
                .map(item => ({
                    date: item.date,
                    avgRating: item.totalRating / item.count,
                    count: item.count,
                    uniqueMixers: item.mixerIds.size
                }))
                .sort((a, b) => a.date.localeCompare(b.date));
            setCleanlinessHistory(historyArray);
        } catch (err) {
            setError('Failed to load cleanliness history data');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
    };

    const chartHeight = 150;
    const chartWidth = '100%';
    const maxRating = 5;

    const getChartPoints = () => {
        if (cleanlinessHistory.length === 0) return '';
        const xStep = 100 / (cleanlinessHistory.length - 1 || 1);
        return cleanlinessHistory.map((point, index) => {
            const x = index * xStep;
            const y = ((maxRating - point.avgRating) / maxRating) * 100;
            return `${x},${y}`;
        }).join(' ');
    };

    if (isLoading) {
        return (
            <div className="cleanliness-history-chart loading">
                <div className="chart-header">
                    <h2>Cleanliness Trend</h2>
                </div>
                <div className="chart-loading">
                    <div className="static-loading">Loading...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="cleanliness-history-chart error">
                <div className="chart-header">
                    <h2>Cleanliness Trend</h2>
                </div>
                <div className="chart-error">
                    <p>{error}</p>
                    <button onClick={fetchCleanlinessHistory}>Retry</button>
                </div>
            </div>
        );
    }

    if (cleanlinessHistory.length === 0) {
        return (
            <div className="cleanliness-history-chart empty">
                <div className="chart-header">
                    <h2>Cleanliness Trend</h2>
                    <div className="period-selector">
                        <button
                            className={selectedPeriod === '1m' ? 'active' : ''}
                            onClick={() => setSelectedPeriod('1m')}
                        >
                            1M
                        </button>
                        <button
                            className={selectedPeriod === '3m' ? 'active' : ''}
                            onClick={() => setSelectedPeriod('3m')}
                        >
                            3M
                        </button>
                        <button
                            className={selectedPeriod === '6m' ? 'active' : ''}
                            onClick={() => setSelectedPeriod('6m')}
                        >
                            6M
                        </button>
                        <button
                            className={selectedPeriod === '1y' ? 'active' : ''}
                            onClick={() => setSelectedPeriod('1y')}
                        >
                            1Y
                        </button>
                    </div>
                </div>
                <div className="chart-empty">
                    <div className="empty-icon">📊</div>
                    <p>No cleanliness history found for selected mixers in this time period.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cleanliness-history-chart">
            <div className="chart-header">
                <h2>Cleanliness Trend</h2>
                <div className="period-selector">
                    <button
                        className={selectedPeriod === '1m' ? 'active' : ''}
                        onClick={() => setSelectedPeriod('1m')}
                    >
                        1M
                    </button>
                    <button
                        className={selectedPeriod === '3m' ? 'active' : ''}
                        onClick={() => setSelectedPeriod('3m')}
                    >
                        3M
                    </button>
                    <button
                        className={selectedPeriod === '6m' ? 'active' : ''}
                        onClick={() => setSelectedPeriod('6m')}
                    >
                        6M
                    </button>
                    <button
                        className={selectedPeriod === '1y' ? 'active' : ''}
                        onClick={() => setSelectedPeriod('1y')}
                    >
                        1Y
                    </button>
                </div>
            </div>

            <div className="chart-container" style={{height: chartHeight}}>
                <div className="y-axis">
                    <div className="y-label">0</div>
                    <div className="y-label">1</div>
                    <div className="y-label">2</div>
                    <div className="y-label">3</div>
                    <div className="y-label">4</div>
                    <div className="y-label">5</div>
                </div>

                <div className="chart">
                    <div className="grid-lines">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="grid-line"
                                 style={{bottom: `${((maxRating - i) / maxRating) * 100}%`}}></div>
                        ))}
                    </div>

                    <svg width={chartWidth} height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                            points={getChartPoints()}
                            fill="none"
                            stroke="var(--accent-primary)"
                            strokeWidth="2"
                        />
                        {cleanlinessHistory.map((point, index) => {
                            const xStep = 100 / (cleanlinessHistory.length - 1 || 1);
                            const x = index * xStep;
                            const y = ((maxRating - point.avgRating) / maxRating) * 100;
                            return (
                                <circle
                                    key={index}
                                    cx={x}
                                    cy={y}
                                    r="3"
                                    fill="var(--accent-primary)"
                                    className="data-point"
                                    data-date={point.date}
                                    data-value={point.avgRating.toFixed(1)}
                                    data-count={point.count}
                                />
                            );
                        })}
                    </svg>

                    <div className="x-axis">
                        {cleanlinessHistory
                            .filter((_, i, arr) => {
                                if (arr.length <= 4) return true;
                                if (i === 0 || i === arr.length - 1) return true;
                                return i % Math.ceil(arr.length / 3) === 0 && i < arr.length - 1;
                            })
                            .map((point, i, filteredArr) => (
                                <div key={i} className="x-label" style={{
                                    left: `${(cleanlinessHistory.indexOf(point) / (cleanlinessHistory.length - 1)) * 100}%`,
                                    width: '40px',
                                    marginLeft: '-20px',
                                    textAlign: 'center',
                                    fontSize: '0.75rem'
                                }}>
                                    {formatDate(point.date)}
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            <div className="chart-legend">
                <div className="legend-item">
                    <div className="legend-color" style={{backgroundColor: 'var(--accent-primary)'}}></div>
                    <div className="legend-label">Avg. Rating</div>
                </div>
                <div className="chart-summary">
                    <span>
                        {cleanlinessHistory.length} ratings
                    </span>
                </div>
            </div>
        </div>
    );
};

export default CleanlinessHistoryChart;