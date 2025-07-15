import React, {useEffect, useState} from 'react';
import supabase from '../../../core/clients/SupabaseClient';

const DebugConsole = ({onClose}) => {
    const [activeTab, setActiveTab] = useState('cache');
    const [cacheKeys, setCacheKeys] = useState([]);
    const [selectedCache, setSelectedCache] = useState(null);
    const [cacheContent, setCacheContent] = useState(null);
    const [debugLog, setDebugLog] = useState([]);
    const [dbTables, setDbTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        setCacheKeys(keys);
    }, []);

    useEffect(() => {
        setDebugLog(window.appDebugLog || []);
    }, []);

    useEffect(() => {
        const loadTables = async () => {
            try {
                setLoading(true);
                const tables = ['tractors', 'tractor_history', 'plants', 'operators', 'operator_history'];
                setDbTables(tables);
                setLoading(false);
            } catch (error) {
                setLoading(false);
            }
        };

        if (activeTab === 'database') {
            loadTables();
        }
    }, [activeTab]);

    const loadCacheContent = (key) => {
        setSelectedCache(key);
        try {
            const content = localStorage.getItem(key);
            setCacheContent(content ? JSON.parse(content) : null);
        } catch (error) {
            setCacheContent({error: `Error parsing cache: ${error.message}`});
        }
    };

    const clearCache = (key) => {
        if (window.confirm(`Are you sure you want to clear the cache for ${key}?`)) {
            localStorage.removeItem(key);
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                keys.push(localStorage.key(i));
            }
            setCacheKeys(keys);
            setCacheContent(null);
            setSelectedCache(null);
        }
    };

    const clearAllCache = () => {
        if (window.confirm('Are you sure you want to clear ALL cache data?')) {
            localStorage.clear();
            setCacheKeys([]);
            setCacheContent(null);
            setSelectedCache(null);
        }
    };

    const loadTableData = async (tableName) => {
        if (!tableName) return;

        try {
            setLoading(true);
            setSelectedTable(tableName);

            const {data, error} = await supabase
                .from(tableName)
                .select('*')
                .limit(10);

            if (error) throw error;

            setTableData(data || []);
            setLoading(false);
        } catch (error) {
            setTableData([]);
            setLoading(false);
        }
    };

    const clearDebugLog = () => {
        if (window.confirm('Clear debug log?')) {
            window.appDebugLog = [];
            setDebugLog([]);
        }
    };

    return (
        <div className="debug-console" style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Debug Console</h2>
                <button style={styles.closeButton} onClick={onClose}>×</button>
            </div>

            <div style={styles.tabs}>
                <button
                    style={activeTab === 'cache' ? {...styles.tab, ...styles.activeTab} : styles.tab}
                    onClick={() => setActiveTab('cache')}
                >
                    Cache
                </button>
                <button
                    style={activeTab === 'database' ? {...styles.tab, ...styles.activeTab} : styles.tab}
                    onClick={() => setActiveTab('database')}
                >
                    Database
                </button>
                <button
                    style={activeTab === 'logs' ? {...styles.tab, ...styles.activeTab} : styles.tab}
                    onClick={() => setActiveTab('logs')}
                >
                    Logs
                </button>
            </div>

            <div style={styles.content}>
                {activeTab === 'cache' && (
                    <div style={styles.cacheContainer}>
                        <div style={styles.leftPanel}>
                            <h3 style={styles.panelTitle}>Cache Keys</h3>
                            <button
                                style={{...styles.button, backgroundColor: '#ff3b30'}}
                                onClick={clearAllCache}
                            >
                                Clear All Cache
                            </button>
                            <div style={styles.keyList}>
                                {cacheKeys.length === 0 ? (
                                    <p style={styles.emptyMessage}>No cache entries found</p>
                                ) : (
                                    cacheKeys.map(key => (
                                        <div
                                            key={key}
                                            style={selectedCache === key ?
                                                {...styles.cacheKey, ...styles.selectedCacheKey} :
                                                styles.cacheKey
                                            }
                                            onClick={() => loadCacheContent(key)}
                                        >
                                            {key}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div style={styles.rightPanel}>
                            <h3 style={styles.panelTitle}>
                                Cache Content
                                {selectedCache && (
                                    <button
                                        style={{...styles.button, marginLeft: '10px', backgroundColor: '#ff3b30'}}
                                        onClick={() => clearCache(selectedCache)}
                                    >
                                        Clear
                                    </button>
                                )}
                            </h3>
                            <pre style={styles.cacheContent}>
                {selectedCache ?
                    JSON.stringify(cacheContent, null, 2) :
                    'Select a cache key to view content'}
              </pre>
                        </div>
                    </div>
                )}

                {activeTab === 'database' && (
                    <div style={styles.dbContainer}>
                        <div style={styles.leftPanel}>
                            <h3 style={styles.panelTitle}>Tables</h3>
                            <div style={styles.tableList}>
                                {loading ? (
                                    <p>Loading tables...</p>
                                ) : dbTables.length === 0 ? (
                                    <p style={styles.emptyMessage}>No tables found</p>
                                ) : (
                                    dbTables.map(table => (
                                        <div
                                            key={table}
                                            style={selectedTable === table ?
                                                {...styles.tableItem, ...styles.selectedTableItem} :
                                                styles.tableItem
                                            }
                                            onClick={() => loadTableData(table)}
                                        >
                                            {table}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div style={styles.rightPanel}>
                            <h3 style={styles.panelTitle}>
                                Table Data: {selectedTable || 'None'}
                            </h3>
                            <div style={styles.tableDataContainer}>
                                {loading ? (
                                    <p>Loading data...</p>
                                ) : !selectedTable ? (
                                    <p style={styles.emptyMessage}>Select a table to view data</p>
                                ) : tableData.length === 0 ? (
                                    <p style={styles.emptyMessage}>No data found in table</p>
                                ) : (
                                    <pre style={styles.tableData}>
                    {JSON.stringify(tableData, null, 2)}
                  </pre>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div style={styles.logsContainer}>
                        <div style={styles.logsHeader}>
                            <h3 style={styles.panelTitle}>Debug Logs</h3>
                            <button
                                style={{...styles.button, backgroundColor: '#ff3b30'}}
                                onClick={clearDebugLog}
                            >
                                Clear Logs
                            </button>
                        </div>

                        <div style={styles.logsList}>
                            {debugLog.length === 0 ? (
                                <p style={styles.emptyMessage}>No logs found</p>
                            ) : (
                                debugLog.map((log, index) => (
                                    <div key={index} style={styles.logEntry}>
                                        <div style={styles.logHeader}>
                                            <span style={styles.logTimestamp}>{log.timestamp}</span>
                                            <span style={{
                                                ...styles.logLevel,
                                                backgroundColor:
                                                    log.level === 'error' ? '#ff3b30' :
                                                        log.level === 'warning' ? '#ff9500' :
                                                            '#34c759'
                                            }}>
                        {log.level.toUpperCase()}
                      </span>
                                            <span style={styles.logLocation}>{log.location}</span>
                                        </div>
                                        <div style={styles.logMessage}>
                                            {log.data.message}
                                            {log.data.error && (
                                                <pre style={styles.logError}>
                          {JSON.stringify(log.data.error, null, 2)}
                        </pre>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: {
        position: 'fixed',
        top: '10px',
        right: '10px',
        bottom: '10px',
        width: '80%',
        maxWidth: '1200px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        borderBottom: '1px solid #eee',
    },
    title: {
        margin: 0,
        color: '#333',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#999',
    },
    tabs: {
        display: 'flex',
        borderBottom: '1px solid #eee',
    },
    tab: {
        padding: '10px 20px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#666',
    },
    activeTab: {
        borderBottom: '2px solid #007aff',
        color: '#007aff',
    },
    content: {
        flex: 1,
        overflow: 'hidden',
        padding: '20px',
        position: 'relative',
    },
    cacheContainer: {
        display: 'flex',
        height: '100%',
        gap: '20px',
    },
    dbContainer: {
        display: 'flex',
        height: '100%',
        gap: '20px',
    },
    leftPanel: {
        width: '30%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #eee',
    },
    rightPanel: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    panelTitle: {
        margin: '0 0 10px 0',
        fontSize: '16px',
        color: '#333',
    },
    keyList: {
        flex: 1,
        overflowY: 'auto',
        border: '1px solid #eee',
        borderRadius: '4px',
    },
    cacheKey: {
        padding: '8px 15px',
        borderBottom: '1px solid #eee',
        cursor: 'pointer',
        fontSize: '14px',
    },
    selectedCacheKey: {
        backgroundColor: '#f0f8ff',
        fontWeight: 'bold',
    },
    cacheContent: {
        flex: 1,
        padding: '10px',
        backgroundColor: '#f8f8f8',
        borderRadius: '4px',
        overflowY: 'auto',
        fontSize: '14px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
    },
    button: {
        padding: '8px 12px',
        backgroundColor: '#007aff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        cursor: 'pointer',
        marginBottom: '10px',
    },
    tableList: {
        flex: 1,
        overflowY: 'auto',
        border: '1px solid #eee',
        borderRadius: '4px',
    },
    tableItem: {
        padding: '8px 15px',
        borderBottom: '1px solid #eee',
        cursor: 'pointer',
        fontSize: '14px',
    },
    selectedTableItem: {
        backgroundColor: '#f0f8ff',
        fontWeight: 'bold',
    },
    tableDataContainer: {
        flex: 1,
        overflowY: 'auto',
        backgroundColor: '#f8f8f8',
        borderRadius: '4px',
        padding: '10px',
    },
    tableData: {
        margin: 0,
        fontSize: '14px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
    },
    emptyMessage: {
        padding: '20px',
        color: '#999',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    logsContainer: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    logsHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
    },
    logsList: {
        flex: 1,
        overflowY: 'auto',
        border: '1px solid #eee',
        borderRadius: '4px',
    },
    logEntry: {
        padding: '10px',
        borderBottom: '1px solid #eee',
        fontSize: '14px',
    },
    logHeader: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '5px',
    },
    logTimestamp: {
        color: '#999',
        marginRight: '10px',
        fontSize: '12px',
    },
    logLevel: {
        padding: '2px 6px',
        borderRadius: '4px',
        color: '#fff',
        fontSize: '10px',
        marginRight: '10px',
    },
    logLocation: {
        fontWeight: 'bold',
        color: '#333',
    },
    logMessage: {
        color: '#333',
    },
    logError: {
        margin: '5px 0 0 0',
        padding: '5px',
        backgroundColor: '#fff0f0',
        borderRadius: '4px',
        fontSize: '12px',
        maxHeight: '150px',
        overflowY: 'auto',
    }
};

export default DebugConsole;