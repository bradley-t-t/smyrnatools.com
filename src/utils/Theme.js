// Theme configuration based on company colors
const Theme = {
    // Main colors using company branding
    colors: {
        background: '#f4f6f4', // Light scheme background
        label: '#212122', // Light scheme label
        blue: '#002F6C', // Smyrna Blue
        red: '#E31837', // Smyrna Red
        white: '#ffffff', // White
        black: '#2a2a2a', // Black accent color
        gray: '#cccccc' // Gray accent color
    },

    // Status colors for mixers
    statusColors: {
        'Active': '#34c759', // Green
        'Spare': '#ffcc00', // Yellow
        'In Shop': '#ff9500', // Orange
        'Retired': '#c12033', // Red from theme
        'default': '#8e8e93' // Gray
    },

    // Text colors
    text: {
        primary: '#212122',
        secondary: '#666666',
        light: '#ffffff'
    },

    // Background colors
    background: {
        primary: '#ffffff',
        secondary: '#f4f6f4',
        tertiary: '#e5e5ea'
    },

    // Border colors
    border: {
        light: '#e5e5ea',
        medium: '#c7c7cc'
    },

    // Helper functions
    getAccentColor: (selection = 'blue') => {
        const accentColors = {
            blue: '#003896',
            red: '#b80017',
            white: '#ffffff',
            black: '#2a2a2a',
            gray: '#cccccc'
        };
        return accentColors[selection.toLowerCase()] || accentColors.blue;
    },

    // Get status color
    statusColor: (status) => {
        return Theme.statusColors[status] || '#8e8e93';
    }
};

export default Theme;
