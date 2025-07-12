function PreferencesProvider({children}) {
    const [preferences, setPreferences] = useState(() => {
        const savedPrefs = localStorage.getItem('userPreferences');
        return savedPrefs ? JSON.parse(savedPrefs) : {
            accentColor: 'blue',
            operatorFilters: {
                searchText: '',
                selectedPlant: '',
                statusFilter: ''
            },
            managerFilters: {
                searchText: '',
                selectedPlant: '',
                roleFilter: ''
            },
        };
    });
