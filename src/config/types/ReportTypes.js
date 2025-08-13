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
    name: "aggregate_production",
    title: "Aggregate Production",
    frequency: "weekly",
    assignment: ["reports.assigned.aggregate_production"],
    manage: ["reports.manage.aggregate_production"],
    fields: [
      { name: "sand", label: "Sand", type: "number", required: true },
      { name: "fill_dirt", label: "Fill Dirt", type: "number", required: true },
      { name: "black_dirt", label: "Black Dirt", type: "number", required: true },
      { name: "select_fill", label: "Select Fill", type: "number", required: true },
      { name: "crushed_concrete_freeport", label: "Crushed Concrete - Freeport", type: "number", required: true },
      { name: "three_by_five_crushed", label: "3 x 5 Crushed", type: "number", required: true },
      { name: "stabilized_sand", label: "Stabilized Sand", type: "number", required: true },
      { name: "stabilized_crushed_concrete", label: "Stabilized Crushed Concrete", type: "number", required: true },
      { name: "beach_quality_sand", label: "Beach Quality Sand", type: "number", required: true },
      { name: "limestone_one_inch", label: "Limestone - 1\"", type: "number", required: true },
      { name: "stabilized_cc", label: "Stabilized CC", type: "number", required: true },
      { name: "pea_gravel_three_eighths", label: "3/8\" Pea Gravel", type: "number", required: true },
      { name: "crushed_asphalt", label: "Crushed Asphalt", type: "number", required: true },
      { name: "screened_sand", label: "Screened Sand", type: "number", required: true },
      { name: "washout", label: "Washout", type: "number", required: true },
      { name: "paverstone_base", label: "Paverstone Base", type: "number", required: true },
      { name: "rip_rap", label: "Rip Rap", type: "number", required: true }
    ]
  }
]
