https://smyrnatools.com

# Project Overview

A React application backed by Supabase providing fleet and operations management (mixers, equipment, tractors,
operators, plants, regions, tasks) plus role based access, commenting, issues tracking, history, and real time chat.

# Tech Stack

- React (react-scripts with react-app-rewired)
- Supabase (@supabase/supabase-js) for data, auth, realtime
- Express (serverless function style endpoints proxied via APIUtility calls)
- Utility layer: caching, validation, formatting, grammar cleanup, crypto, date handling
- Image optimization (sharp) prebuild scripts
- MailerSend (via EmailUtility) for transactional email

# Implemented Features (Verified In Code)

## Authentication & Users

- Email and password sign up, sign in, sign out
- Session restoration and client side session persistence (sessionStorage userId)
- Update email and password endpoints
- Automatic creation of default user preference rows

## User Roles & Permissions

- Fetch roles, role by id/name
- Assign, remove, create, update, delete roles
- Permission checks: single, any, all
- Highest role lookup and per menu visibility calculation

## User Preferences

- Retrieval and saving of mixer filters and last viewed filters
- Stored UI preferences (theme mode, accent color, navbar state, tips visibility, online overlay, auto overview, per
  entity filters)

## Core Domain Entities & Operations

### Mixers

- CRUD (create, fetch all/active/by id/update/delete)
- Search by truck number and VIN
- Assignment to operators and status management (including verification logic)
- History tracking retrieval and verification status derivation
- Cleanliness history retrieval
- Comments (add, list, delete)
- Issues (add, list, complete, delete) with severity validation
- Image management (fetch, upload with base64 encoding, delete)

### Equipment

- CRUD (create, fetch all/active/by id/update/delete)
- History retrieval
- Cleanliness and condition history retrieval
- Status filtered retrieval and search by identifying number
- Service threshold retrieval
- Comments (add, list, delete)
- Issues (add, list, complete, delete)

### Tractors

- CRUD (create, fetch all/active/by id/update/delete)
- History retrieval
- Cleanliness history retrieval
- Status filtered retrieval and search by truck number
- Service threshold retrieval
- Comments (add, list, delete)
- Issues (add, list, complete, delete)
- Verification workflow

### Operators

- Create, update, delete operators
- Fetch all, active, by plant, tractor operators, trainers
- Generate UUID for operators when missing
- Availability calculation relative to active mixers

### Plants

- CRUD for plants
- Fetch all and by code with caching
- Retrieve plant with regions

### Regions

- CRUD for regions (with type validation: Concrete, Aggregate, Office)
- Fetch by code, list all, fetch by plant code
- Retrieve region plants and region with plants

### Task List (List Service)

- Fetch list items with creator profiles (cached)
- Create, update, toggle completion, delete tasks
- Plant level filtering, text search, status filtering (overdue, pending, completed)
- Deadline handling and status classification (Overdue, Due Soon, Upcoming, Completed, No Deadline)
- Plant distribution aggregation (Total/Pending/Completed/Overdue)
- Grammar cleanup for descriptions and comments

### Chat

- Fetch messages per list item
- Send and delete messages with user authentication enforcement
- Real time subscription to list item message changes via Supabase channel

### Issues & Comments (Cross Entity)

- Consistent patterns for adding/listing/deleting comments across mixers, equipment, tractors
- Consistent issue lifecycle (add, complete, delete) with severity constraints

### History & Verification

- History retrieval for mixers, equipment, tractors
- Latest history date lookup to compute verification state
- Verification actions for mixers and tractors

### Search & Filtering Utilities

- Partial text searches for mixers, equipment, tractors via dedicated endpoints
- Utility provided partial text ilike filter construction

### Caching Layer

- In memory caching for list items, plants, entities, per id lookups, and user role caches
- Explicit cache invalidation on mutations

### Database Utilities

- Raw SQL execution proxy
- Table existence check
- Generic fetch/insert/update/delete wrappers
- Date formatting and partial text filtering helpers

### Validation & Formatting Utilities

- UUID validation and requirement assertions
- ID presence enforcement
- Grammar cleanup for descriptions and comments
- Date utilities, formatting, truncation, status computations

### Image Handling

- Mixer image upload with FileReader to base64 and content type preservation

### Environment & Configuration

- Supabase client creation with environment variable checks
- Supabase auth refresh workflow (refreshSession, getSession, getUser fallback)
- Error extraction and logging helpers

### Email Capability

- MailerSend integration via EmailUtility (config validation, message building, request preparation, environment driven)

### Scripts & Tooling

- Image optimization pre start/build/test
- CSS cleanup scripts (dry run and apply)
- Supabase management scripts (login, init, start/stop, status, functions lifecycle)

### Quality & Error Handling

- Centralized error logging via ErrorUtility and Supabase error detail extraction
- Validation guards across service methods

### Real Time

- Supabase realtime subscription for chat channels

### Miscellaneous Utilities

- Caching, crypto, network, history, lookup, user, theme, vitals, email formatting helpers (utility files present)

# Proposed Enhancements (Not Yet Implemented)

- Automated test suite expansion (unit and integration around services and utilities)
- TypeScript migration or incremental typing for models and services
- Centralized error boundary and user facing diagnostics UI
- Role and permission management UI screens
- Bulk operations (multi entity status updates, assignment changes)
- Notification system (real time toasts or email triggers for issues, comments, overdue tasks)
- Offline caching and optimistic updates for key entities
- Advanced search with multi field filtering and pagination
- Audit log UI for history entries beyond raw retrieval
- Metrics dashboard (service/verification rates, overdue trends)
- CI pipeline with lint, test, build, and security scanning
- Environment variable schema validation step
- Dark mode theming extension and user defined accent palette constraints
- Accessibility review and ARIA enhancements
- Internationalization framework setup
- File attachments for equipment/issues (beyond mixer images)
- Presence indicators leveraging UserPresenceService (file exists)

# Getting Started

Install dependencies: npm install
Start development server: npm start
Run tests: npm test
Build production bundle: npm run build

# Conventions

- All feature claims in this README are sourced directly from inspected service and utility code
- No inferred UI behavior is listed unless code paths support it

# License

Internal project (license not specified)
