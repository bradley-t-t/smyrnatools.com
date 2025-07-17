                    {isLoading ? (
                        <div className="loading-spinner-container">
                            <LoadingScreen message="Loading history..." inline={true} />
                        </div>
                    ) : error ? (
