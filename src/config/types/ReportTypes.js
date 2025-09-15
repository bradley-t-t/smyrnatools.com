function createReportType({name, title, frequency, assignment, review, fields}) {
    return {
        name,
        title,
        frequency,
        assignment: Array.isArray(assignment) ? assignment : [],
        review: Array.isArray(review) ? review : [],
        fields: Array.isArray(fields)
            ? fields.map(f => ({
                ...f,
                required: !!f.required,
                type: f.type || 'text',
                label: f.label || f.name
            }))
            : []
    }
}

const reportTypes = [
    createReportType({
        name: "district_manager",
        title: "District Manager Report",
        frequency: "weekly",
        assignment: ["reports.assigned.district_manager"],
        review: ["reports.review.district_manager"],
        fields: [
            {name: "monday", label: "Monday Recap", type: "textarea", required: true},
            {name: "tuesday", label: "Tuesday Recap", type: "textarea", required: true},
            {name: "wednesday", label: "Wednesday Recap", type: "textarea", required: true},
            {name: "thursday", label: "Thursday Recap", type: "textarea", required: true},
            {name: "friday", label: "Friday Recap", type: "textarea", required: true},
            {name: "saturday", label: "Saturday Recap", type: "textarea", required: true}
        ]
    }),
    createReportType({
        name: "plant_manager",
        title: "Plant Manager Report",
        frequency: "weekly",
        assignment: ["reports.assigned.plant_manager"],
        review: ["reports.review.plant_manager"],
        fields: [
            {name: "yardage", label: "Yardage", type: "number", required: true},
            {name: "total_hours", label: "Total Hours", type: "number", required: true},
            {name: "total_yards_lost", label: "Total Yards Lost", type: "number", required: true},
            {name: "yards_resold", label: "Yards Resold", type: "number", required: true},
        ]
    }),
    createReportType({
        name: "plant_production",
        title: "Weekly Plant Efficiency Report",
        frequency: "weekly",
        assignment: ["reports.assigned.plant_production"],
        review: ["reports.review.plant_production"],
        fields: [
            {
                name: "rows",
                label: "Production Rows",
                type: "table",
                required: false
            }
        ]
    }),
    createReportType({
        name: "aggregate_production",
        title: "Aggregate Production",
        frequency: "weekly",
        assignment: ["reports.assigned.aggregate_production"],
        review: ["reports.review.aggregate_production"],
        fields: [
            {name: "sand", label: "Sand", type: "number", required: true},
            {name: "fill_dirt", label: "Fill Dirt", type: "number", required: true},
            {name: "black_dirt", label: "Black Dirt", type: "number", required: true},
            {name: "select_fill", label: "Select Fill", type: "number", required: true},
            {name: "crushed_concrete", label: "Crushed Concrete", type: "number", required: true},
            {name: "three_by_five_crushed", label: "3 x 5 Crushed", type: "number", required: true},
            {name: "stabilized_sand", label: "Stabilized Sand", type: "number", required: true},
            {name: "stabilized_crushed_concrete", label: "Stabilized Crushed Concrete", type: "number", required: true},
            {name: "beach_quality_sand", label: "Beach Quality Sand", type: "number", required: true},
            {name: "limestone_one_inch", label: "Limestone - 1\"", type: "number", required: true},
            {name: "white_screened_sand", label: "White Screened Sand", type: "number", required: true},
            {name: "pea_gravel_three_eighths", label: "3/8\" Pea Gravel", type: "number", required: true},
            {name: "crushed_asphalt", label: "Crushed Asphalt", type: "number", required: true},
            {name: "screened_sand", label: "Screened Sand", type: "number", required: true},
            {name: "washout", label: "Washout", type: "number", required: true},
            {name: "paverstone_base", label: "Paverstone Base", type: "number", required: true},
            {name: "rip_rap", label: "Rip Rap", type: "number", required: true}
        ]
    }),
    createReportType({
        name: "safety_manager",
        title: "Safety Manager Report",
        frequency: "weekly",
        assignment: ["reports.assigned.safety_manager"],
        review: ["reports.review.safety_manager"],
        fields: [
            {name: "issues", label: "Issues", type: "table", required: false}
        ]
    }),
    createReportType({
        name: "general_manager",
        title: "General Manager Report",
        frequency: "weekly",
        assignment: ["reports.assigned.general_manager"],
        review: ["reports.review.general_manager"],
        fields: []
    }),
    createReportType({
        name: "test",
        title: "Test",
        frequency: "weekly",
        assignment: ["reports.assigned.test"],
        review: ["reports.review.test"],
        fields: [
            {name: "test", label: "test", type: "text", required: true}
        ]
    })
]

const reportTypeMap = Object.fromEntries(reportTypes.map(rt => [rt.name, rt]))

export {reportTypes, reportTypeMap}
