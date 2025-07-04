const ActionButton = ({title, icon, isDestructive = false, onClick, primary = false}) => (
    <button
        className={`action-button ${isDestructive ? 'destructive' : ''} ${primary ? 'primary' : ''}`}
        onClick={onClick}
    >
        <div className="action-icon">{icon}</div>
        <div className="action-title">{title}</div>
        {primary && <div className="action-shine"></div>}
    </button>
);
