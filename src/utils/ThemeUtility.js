const ThemeUtility = {
    colors: {
        background: '#f4f6f4',
        label: '#212122',
        blue: '#002F6C',
        red: '#E31837',
        white: '#ffffff',
        black: '#2a2a2a',
        gray: '#cccccc'
    },

    statusColors: {
        Active: '#38a169',
        Spare: '#7c3aed',
        'In Shop': '#3182ce',
        Retired: '#1a202c',
        default: '#718096'
    },

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
            navbar: '#f5f5f5',
            main: '#f4f6f4'
        },
        border: {
            light: '#e5e5ea',
            medium: '#c7c7cc'
        }
    },

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
            navbar: '#1e1e1e',
            main: '#121212'
        },
        border: {
            light: '#333333',
            medium: '#333333'
        }
    },

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

    operatorStatusColors: {
        Active: '#38a169',
        'Light Duty': '#ecc94b',
        'Pending Start': '#ed8936',
        Terminated: '#e53e3e',
        Training: '#3182ce',
        default: '#718096'
    },

    _colorSeed: 'seed1',
    _usedRoleColors: new Map(),
    _roleColorPalette: [
        '#e53e3e', '#c53030', '#9b2c2c', '#742a2a', '#feb2b2',
        '#dd6b20', '#ed8936', '#f6ad55', '#de751f', '#f6993f',
        '#d69e2e', '#ecc94b', '#f6e05e', '#faf089', '#d97706',
        '#38a169', '#2f855a', '#48bb78', '#68d391', '#9ae6b4',
        '#319795', '#4fd1c5', '#81e6d9', '#2c7a7b', '#0d9488',
        '#3182ce', '#2b6cb0', '#4299e1', '#63b3ed', '#0369a1',
        '#805ad5', '#6b46c1', '#9f7aea', '#553c9a', '#b794f4',
        '#d53f8c', '#b83280', '#f687b3', '#97266d', '#e9d8fd',
        '#718096', '#4a5568', '#a0aec0', '#975a16', '#1a202c'
    ],

    getAccentColor(selection = 'red') {
        const accentColors = {
            red: '#b80017',
            blue: '#003896',
            white: '#ffffff',
            black: '#2a2a2a',
            gray: '#cccccc'
        };
        return accentColors[selection.toLowerCase()] ?? accentColors.blue;
    },

    statusColor(status) {
        return this.statusColors[status] ?? this.statusColors.default;
    },

    getTheme(mode = 'light') {
        return mode === 'dark' ? this.dark : this.light;
    },

    getThemeStyles(mode = 'light') {
        const theme = this.getTheme(mode);
        return {
            backgroundColor: theme.background.primary,
            color: theme.text.primary,
            borderColor: theme.border.light
        };
    },

    getLoadingScreenStyles(mode = 'light') {
        const theme = this.getTheme(mode);
        return {
            content: {
                backgroundColor: theme.background.primary,
                color: theme.text.primary,
                boxShadow: mode === 'dark' ? '0 4px 8px rgba(0, 0, 0, 0.7)' : '0 4px 6px rgba(0, 0, 0, 0.1)'
            },
            background: {
                backgroundColor: theme.background.main
            },
            text: {
                color: theme.text.primary
            }
        };
    },

    setColorSeed(seed) {
        if (typeof seed === 'string' && seed) {
            this._colorSeed = seed;
            this._usedRoleColors.clear();
            return true;
        }
        return false;
    },

    getColorSeed() {
        return this._colorSeed;
    },

    roleColorByWeight(weight) {
        const colorMap = [
            '#718096', '#3182ce', '#38a169', '#ecc94b', '#ed8936', '#e53e3e'
        ];
        return typeof weight === 'number' && !isNaN(weight)
            ? colorMap[Math.min(Math.floor(weight), colorMap.length - 1)]
            : colorMap[0];
    },

    getRoleColor(roleName = '', weight = 0) {
        if (!roleName) return this.roleColorByWeight(weight);

        if (this._usedRoleColors.size > 100) this._usedRoleColors.clear();

        const normalizedRoleName = roleName.toLowerCase().trim();
        if (this._usedRoleColors.has(normalizedRoleName)) {
            return this._usedRoleColors.get(normalizedRoleName);
        }

        const usedColorValues = new Set(this._usedRoleColors.values());
        const hashInput = this._colorSeed + normalizedRoleName;
        let hash = 0;
        for (let i = 0; i < hashInput.length; i++) {
            hash = hashInput.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = this._roleColorPalette[Math.abs(hash) % this._roleColorPalette.length];

        if (usedColorValues.has(color)) {
            color = this._roleColorPalette.find(c => !usedColorValues.has(c)) ?? this._generateUniqueColor(color, normalizedRoleName);
        }

        this._usedRoleColors.set(normalizedRoleName, color);
        return color;
    },

    _generateUniqueColor(baseColor, roleName) {
        const hexToRgb = hex => [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)
        ];

        const rgbToHex = (r, g, b) =>
            '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

        let hash = 0;
        for (let i = 0; i < roleName.length; i++) {
            hash = roleName.charCodeAt(i) + ((hash << 5) - hash);
        }

        const [r, g, b] = hexToRgb(baseColor);
        return rgbToHex(
            (r + hash % 64) % 256,
            (g + hash % 32) % 256,
            (b + hash % 16) % 256
        );
    }
};

export default ThemeUtility;