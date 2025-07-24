CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    report_name VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    plant_code VARCHAR(20),
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT TRUE
);

