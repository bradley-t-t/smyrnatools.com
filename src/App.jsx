function renderContent() {
        switch (activeView) {
            case 'List':
                return <ListView title="Tasks List" onStatusFilterChange={handleListStatusFilterChange} />;
