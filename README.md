# Getting Started with Create React App

# Concrete Mixer Management Web App

![React](https://img.shields.io/badge/React-19.1.0-61dafb)
![Supabase](https://img.shields.io/badge/Supabase-2.39.7-3fcf8e)

A modern web application for managing a fleet of concrete mixers. Built with React and Supabase for a seamless user
experience.

## Features

- **Modern UI**: iOS-inspired interface with smooth animations
- **Mixer Management**: View, create, update, and delete mixer records
- **Filtering & Searching**: Find mixers by truck number, operator, plant, or status
- **History Tracking**: Complete audit trail of all changes made to mixers
- **Real-time Updates**: Changes are immediately reflected across the application
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Screenshot

![App Screenshot Placeholder](https://via.placeholder.com/800x450)

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a `.env` file in the root directory with your Supabase credentials:

```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project dashboard under Settings > API.

### 3. Set up the database

The app requires the following tables in your Supabase database:

- `mixers`: Stores mixer information
- `mixer_history`: Tracks changes to mixers
- `operators`: Stores operator information
- `plants`: Stores plant information
- `regions`: Stores region information

Full schema details are available in the Database Schema section below.

### 4. Start the development server

```bash
npm start
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

## Database Schema

### mixers

- id (uuid, primary key)
- truck_number (text)
- assigned_plant (text)
- assigned_operator (text)
- last_service_date (timestamp)
- last_chip_date (timestamp)
- cleanliness_rating (integer)
- status (text)
- created_at (timestamp)
- updated_at (timestamp)
- updated_last (timestamp)
- updated_by (uuid)

### mixer_history

- id (uuid, primary key)
- mixer_id (uuid, foreign key to mixers.id)
- field_name (text)
- old_value (text)
- new_value (text)
- changed_at (timestamp)
- changed_by (uuid)

### operators

- id (uuid, primary key)
- employee_id (text)
- name (text)
- plant_code (text)
- status (text)
- is_trainer (boolean)
- assigned_trainer (text)
- position (text)
- created_at (timestamp)
- updated_at (timestamp)

### plants

- id (uuid, primary key)
- plant_code (text)
- plant_name (text)
- created_at (timestamp)
- updated_at (timestamp)

### regions

- id (uuid, primary key)
- region_code (text)
- region_name (text)
- created_at (timestamp)
- updated_at (timestamp)

## Architecture

The application follows a component-based architecture using React with the following structure:

- **Components**: UI components for different views and functionality
- **Models**: Data models that map to database tables
- **Services**: API services for interacting with Supabase
- **Theme**: Global styling and theme definitions

## Technologies Used

- **React**: UI library for building the user interface
- **Supabase**: Backend as a service for database and authentication
- **CSS**: Custom styling for all components
- **JavaScript (ES6+)**: Modern JavaScript features

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more
information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will
remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right
into your project so you have full control over them. All of the commands except `eject` will still work, but they will
point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you
shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't
customize it when you are ready for it.

## Learn More

You can learn more in
the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved
here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved
here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved
here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved
here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

# Mixers Management Web App

This React application displays a list of concrete mixers with functionality similar to the iOS app. It uses Supabase as
the backend database.

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a `.env` file in the root directory with your Supabase credentials:

```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project dashboard under Settings > API.

### 3. Start the development server

```bash
npm start
```

## Supabase Database Structure

Ensure your Supabase database has the following tables:

### mixers

- id (uuid, primary key)
- truck_number (text)
- assigned_plant (text)
- assigned_operator (text)
- last_service_date (timestamp)
- last_chip_date (timestamp)
- cleanliness_rating (integer)
- status (text)
- created_at (timestamp)
- updated_at (timestamp)
- updated_last (timestamp)
- updated_by (uuid)

### mixer_history

- id (uuid, primary key)
- mixer_id (uuid, foreign key to mixers.id)
- field_name (text)
- old_value (text)
- new_value (text)
- changed_at (timestamp)
- changed_by (uuid)

### operators

- id (uuid, primary key)
- employee_id (text)
- name (text)
- plant_code (text)
- status (text)
- is_trainer (boolean)
- assigned_trainer (text)
- position (text)
- created_at (timestamp)
- updated_at (timestamp)

### plants

- id (uuid, primary key)
- plant_code (text)
- plant_name (text)
- created_at (timestamp)
- updated_at (timestamp)

### regions

- id (uuid, primary key)
- region_code (text)
- region_name (text)
- created_at (timestamp)
- updated_at (timestamp)

### region_plants

- region_id (uuid, foreign key to regions.id)
- plant_code (text, foreign key to plants.plant_code)
- created_at (timestamp)

## Features

- View a list of all mixers with iOS-style UI
- Search mixers by truck number or operator name
- Filter mixers by plant and status
- View detailed mixer information
- Status indicators with color coding
- Overview screen with stats and metrics

## iOS Design

This web app follows iOS design principles with:

- iOS-style navigation bar
- Card-based UI with rounded corners
- iOS color palette and typography
- iOS-style input controls and buttons
- Subtle animations and interactions
  This section has moved
  here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved
here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
