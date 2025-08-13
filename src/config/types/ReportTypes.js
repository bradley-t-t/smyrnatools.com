export const reportTypes = [
  {
    name: "district_manager",
    title: "District Manager Report",
    frequency: "weekly",
    assignment: ["reports.assigned.district_manager"],
    manage: ["reports.manage.district_manager"],
    fields: [
      { name: "monday", label: "Monday Recap", type: "textarea", required: true },
      { name: "tuesday", label: "Tuesday Recap", type: "textarea", required: true },
      { name: "wednesday", label: "Wednesday Recap", type: "textarea", required: true },
      { name: "thursday", label: "Thursday Recap", type: "textarea", required: true },
      { name: "friday", label: "Friday Recap", type: "textarea", required: true },
      { name: "saturday", label: "Saturday Recap", type: "textarea", required: true }
    ]
  },
  {
    name: "plant_manager",
    title: "Plant Manager Report",
    frequency: "weekly",
    assignment: ["reports.assigned.plant_manager"],
    manage: ["reports.manage.plant_manager"],
    fields: [
      { name: "yardage", label: "Yardage", type: "number", required: true },
      { name: "total_hours", label: "Total Hours", type: "number", required: true },
      { name: "total_yards_lost", label: "Total Yards Lost", type: "number", required: true },
      { name: "yards_resold", label: "Yards Resold", type: "number", required: true },
      { name: "monday_recap", label: "Monday Recap", type: "textarea", required: true },
      { name: "tuesday_recap", label: "Tuesday Recap", type: "textarea", required: true },
      { name: "wednesday_recap", label: "Wednesday Recap", type: "textarea", required: true },
      { name: "thursday_recap", label: "Thursday Recap", type: "textarea", required: true },
      { name: "friday_recap", label: "Friday Recap", type: "textarea", required: true },
      { name: "saturday_recap", label: "Saturday Recap", type: "textarea", required: true }
    ]
  },
  {
    name: "plant_production",
    title: "Weekly Plant Production Report",
    frequency: "weekly",
    assignment: ["reports.assigned.plant_production"],
    manage: ["reports.manage.plant_production"],
    fields: [
      {
        name: "rows",
        label: "Production Rows",
        type: "table",
        required: false
      }
    ]
  },
  {
    name: "general_manager",
    title: "General Manager Report",
    frequency: "weekly",
    assignment: ["reports.assigned.general_manager"],
    manage: ["reports.manage.general_manager"],
    fields: [
      {
        name: "plant_fields",
        label: "Plant Fields",
        type: "dynamic_plant_fields",
        required: true
      }
    ]
  }
]
