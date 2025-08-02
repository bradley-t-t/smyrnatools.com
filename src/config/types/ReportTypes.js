export const reportTypes = [
  {
    name: "district_manager",
    title: "District Manager Report",
    frequency: "weekly",
    assignment: ["reports.assigned.district_manager"],
    manage: ["reports.manage.district_manager"],
    fields: [
      { name: "monday", label: "Monday Recap", type: "textarea", required: false },
      { name: "tuesday", label: "Tuesday Recap", type: "textarea", required: false },
      { name: "wednesday", label: "Wednesday Recap", type: "textarea", required: false },
      { name: "thursday", label: "Thursday Recap", type: "textarea", required: false },
      { name: "friday", label: "Friday Recap", type: "textarea", required: false },
      { name: "saturday", label: "Saturday Recap", type: "textarea", required: false }
    ]
  },
  {
    name: "plant_manager",
    title: "Plant Manager Report",
    frequency: "weekly",
    assignment: ["reports.assigned.plant_manager"],
    manage: ["reports.manage.plant_manager"],
    fields: [
      { name: "plant", label: "Plant", type: "text", required: false },
      { name: "yardage", label: "Yardage", type: "number", required: false },
      { name: "total_hours", label: "Total Hours", type: "number", required: false },
      { name: "total_yards_lost", label: "Total Yards Lost", type: "number", required: false },
      { name: "monday_recap", label: "Monday Recap", type: "textarea", required: false },
      { name: "tuesday_recap", label: "Tuesday Recap", type: "textarea", required: false },
      { name: "wednesday_recap", label: "Wednesday Recap", type: "textarea", required: false },
      { name: "thursday_recap", label: "Thursday Recap", type: "textarea", required: false },
      { name: "friday_recap", label: "Friday Recap", type: "textarea", required: false },
      { name: "saturday_recap", label: "Saturday Recap", type: "textarea", required: false }
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
  }
]
