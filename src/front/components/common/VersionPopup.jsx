import React from 'react'

function VersionPopup({version}) {
    if (!version) return null;
    return <div className="version-popup-centered">Version: {version}</div>
}

export default VersionPopup

