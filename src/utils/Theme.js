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
        'Active': '#38a169', // Green - same as operatorStatusColors
        'Spare': '#007AFF', // Blue
        'In Shop': '#FF9500', // Orange
        'Retired': '#e53e3e', // Red - same as operatorStatusColors
        'default': '#718096' // Gray - same as operatorStatusColors
    },

    // Light mode colors
    light: {
        text: {
            primary: '#212122',
            secondary: '#666666',
            light: '#ffffff'
        },
        background: {
            primary: '#ffffff',
            secondary: '#f4f6f4',
            tertiary: '#e5e5ea',
            navbar: '#f5f5f5'
        },
        border: {
            light: '#e5e5ea',
            medium: '#c7c7cc'
        }
    },

    // Dark mode colors
    dark: {
        text: {
            primary: '#f5f5f5',
            secondary: '#aaaaaa',
            light: '#f5f5f5'
        },
        background: {
            primary: '#1e1e1e',
            secondary: '#121212',
            tertiary: '#2a2a2a',
            navbar: '#1e1e1e'
        },
        border: {
            light: '#333333',
            medium: '#333333'
        }
    },

    // Accent colors
    accent: {
        blue: {
            primary: '#003896',
            secondary: '#2563eb',
            hover: '#1d4ed8',
            light: '#dbeafe',
            border: '#93c5fd'
        },
        red: {
            primary: '#b80017',
            secondary: '#dc2626',
            hover: '#b91c1c',
            light: '#fee2e2',
            border: '#fca5a5'
        }
    },

    // Helper functions
        getAccentColor: (selection = 'red') => {
        const accentColors = {
            red: '#b80017',
            blue: '#003896',
            white: '#ffffff',
            black: '#2a2a2a',
            gray: '#cccccc'
        };
        return accentColors[selection.toLowerCase()] || accentColors.blue;
    },

    // Get status color
    statusColor: (status) => {
        return Theme.statusColors[status] || '#8e8e93';
    },

    // Get theme based on mode
    getTheme: (mode = 'light') => {
        return mode === 'dark' ? Theme.dark : Theme.light;
    },
    operatorStatusColors: {
        'Active': '#38a169',      // green
        'Light Duty': '#ecc94b',  // yellow
        'Pending Start': '#ed8936', // orange
        'Terminated': '#e53e3e',  // red
        'Training': '#3182ce',    // blue
        'default': '#718096'      // gray
    }
};

export default Theme;
