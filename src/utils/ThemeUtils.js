// ThemeUtils configuration based on company colors
const ThemeUtils = {
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
        return ThemeUtils.statusColors[status] || '#8e8e93';
    },

    // Get theme based on mode
    getTheme: (mode = 'light') => {
        return mode === 'dark' ? ThemeUtils.dark : ThemeUtils.light;
    },

    // Change the color seed to get a different distribution of colors
    // This will clear the color cache and generate new colors for all roles
    setColorSeed: function(seed) {
        if (typeof seed === 'string' && seed) {
            this._colorSeed = seed;
            this._usedRoleColors.clear();
            console.log(`Color seed changed to "${seed}". Colors will be regenerated.`);
            return true;
        }
        return false;
    },

    // Get the current color seed
    getColorSeed: function() {
        return this._colorSeed;
    },

    operatorStatusColors: {
        'Active': '#38a169',      // green
        'Light Duty': '#ecc94b',  // yellow
        'Pending Start': '#ed8936', // orange
        'Terminated': '#e53e3e',  // red
        'Training': '#3182ce',    // blue
        'default': '#718096'      // gray
    },

    // Manager role colors - dynamically assigned based on role weight
    roleColorByWeight: (weight) => {
        // Higher weights (more permissions) get warmer/stronger colors
        const colorMap = [
            '#718096', // Gray (lowest weight/default)
            '#3182ce', // Blue
            '#38a169', // Green
            '#ecc94b', // Yellow
            '#ed8936', // Orange
            '#e53e3e'  // Red (highest weight)
        ];

        // Default to gray for no weight or invalid weight
        if (typeof weight !== 'number' || isNaN(weight)) {
            return colorMap[0];
        }

        // Normalize weight to colorMap index (max 5)
        const index = Math.min(Math.floor(weight), colorMap.length - 1);
        return colorMap[index];
    },

    // Color configuration - change this to get different color sets
    _colorSeed: 'seed1', // Change this value to get a different color distribution

    // Store used role colors to ensure uniqueness
    _usedRoleColors: new Map(),

    // Large array of 40 distinct colors
    _roleColorPalette: [
        // Red spectrum
        '#e53e3e', // Red
        '#c53030', // Brick Red
        '#9b2c2c', // Maroon
        '#742a2a', // Dark Red
        '#feb2b2', // Light Red

        // Orange spectrum
        '#dd6b20', // Dark Orange
        '#ed8936', // Orange
        '#f6ad55', // Light Orange
        '#de751f', // Burnt Orange
        '#f6993f', // Tangerine

        // Yellow spectrum
        '#d69e2e', // Gold
        '#ecc94b', // Yellow
        '#f6e05e', // Light Yellow
        '#faf089', // Pale Yellow
        '#d97706', // Amber

        // Green spectrum
        '#38a169', // Green
        '#2f855a', // Dark Green
        '#48bb78', // Medium Green
        '#68d391', // Light Green
        '#9ae6b4', // Pale Green

        // Teal/Cyan spectrum
        '#319795', // Teal
        '#4fd1c5', // Aqua
        '#81e6d9', // Light Teal
        '#2c7a7b', // Dark Teal
        '#0d9488', // Ocean

        // Blue spectrum
        '#3182ce', // Blue
        '#2b6cb0', // Royal Blue
        '#4299e1', // Bright Blue
        '#63b3ed', // Sky Blue
        '#0369a1', // Deep Blue

        // Purple spectrum
        '#805ad5', // Purple
        '#6b46c1', // Indigo
        '#9f7aea', // Lavender
        '#553c9a', // Dark Purple
        '#b794f4', // Light Purple

        // Pink/Magenta spectrum
        '#d53f8c', // Pink
        '#b83280', // Magenta
        '#f687b3', // Light Pink
        '#97266d', // Dark Pink
        '#e9d8fd', // Pale Pink

        // Neutral colors
        '#718096', // Gray
        '#4a5568', // Dark Gray
        '#a0aec0', // Medium Gray
        '#975a16', // Brown
        '#1a202c'  // Almost Black
    ],

    // Get manager role color by role name
    getRoleColor: function(roleName = '', weight = 0) {
        // Basic validation
        if (!roleName) {
            return this.roleColorByWeight(weight);
        }

        // Reset our color cache periodically if getting too large
        if (this._usedRoleColors.size > 100) {
            this._usedRoleColors.clear();
        }

        // Normalize role name and use as our key
        const normalizedRoleName = roleName.toLowerCase().trim();

        // If we've already assigned a color to this role, return it
        if (this._usedRoleColors.has(normalizedRoleName)) {
            return this._usedRoleColors.get(normalizedRoleName);
        }

        // Set of already used colors for this session
        const usedColorValues = new Set([...this._usedRoleColors.values()]);

        // Function to determine if a color is too similar to existing colors
        const isTooSimilar = (color) => {
            // Check if color is already in use
            return usedColorValues.has(color);
        };

        // Find a color based on hashing the role name with the seed
        const getHashedColor = () => {
            // Use the seed to modify the input to the hash function
            const hashInput = this._colorSeed + normalizedRoleName;

            let hash = 0;
            for (let i = 0; i < hashInput.length; i++) {
                hash = hashInput.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % this._roleColorPalette.length;
            return this._roleColorPalette[index];
        };

        // Try to get a color from our hashing function
        let color = getHashedColor();

        // If the hash-generated color is already used, find the first unused color
        if (isTooSimilar(color)) {
            // Find first unused color
            for (let i = 0; i < this._roleColorPalette.length; i++) {
                if (!usedColorValues.has(this._roleColorPalette[i])) {
                    color = this._roleColorPalette[i];
                    break;
                }
            }

            // If all colors are used, generate a slightly modified version of the hashed color
            if (isTooSimilar(color)) {
                // Convert hex to RGB
                const hexToRgb = (hex) => {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    return [r, g, b];
                };

                // Convert RGB to hex
                const rgbToHex = (r, g, b) => {
                    return '#' + 
                        ((1 << 24) + (r << 16) + (g << 8) + b)
                        .toString(16)
                        .slice(1);
                };

                // Generate a new hash for color modification
                let hashValue = 0;
                for (let i = 0; i < normalizedRoleName.length; i++) {
                    hashValue = normalizedRoleName.charCodeAt(i) + ((hashValue << 5) - hashValue);
                }

                // Modify the color slightly
                const [r, g, b] = hexToRgb(color);
                color = rgbToHex(
                    (r + hashValue % 64) % 256,
                    (g + hashValue % 32) % 256,
                    (b + hashValue % 16) % 256
                );
            }
        }

        // Store this color for this role name
        this._usedRoleColors.set(normalizedRoleName, color);
        console.log(`Assigned color ${color} to role ${roleName}`);

        return color;
    }
};

export default ThemeUtils;
