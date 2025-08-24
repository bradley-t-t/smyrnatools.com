import React from 'react'

const ActionButton = ({title, icon, isDestructive = false, onClick, primary = false}) => (
    <button
        className={`action-button ${isDestructive ? 'destructive' : ''} ${primary ? 'primary' : ''}`}
        onClick={onClick}
        type="button"
    >
        <div className="action-icon">{icon}</div>
        <div className="action-title">{title}</div>
        {primary && <div className="action-shine"></div>}
    </button>
)
export default ActionButton
