# Heisig Traditional Chinese Characters Visualization

A web application for visualizing and exploring traditional Chinese characters using the Heisig method. This application provides an interactive graph visualization of characters, their primitive elements, and relationships, along with filtering by volume and chapter, search functionality, and an admin interface for managing the data.

## Features

- Interactive graph visualization of characters and their relationships
- Filter characters by volume and chapter
- Search characters by keyword, primitive element, or meaning
- Detailed character information display
- Responsive design for both desktop and mobile
- Admin interface for managing characters, primitives, and keywords

## Project Structure

```
zi/
├── app/
│   ├── __init__.py          # Application factory and configuration
│   ├── models.py            # Database models (Character, Primitive, Keyword)
│   ├── routes.py            # API and view routes
│   ├── admin.py             # Flask-Admin interface configuration
│   ├── cli.py               # Command-line interface commands
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css    # Application styles
│   │   ├── js/
│   │   │   └── graph.js     # Graph visualization code
│   │   └── data/
│   │       └── hanzi_data.json  # Initial data for import
│   └── templates/
│       ├── index.html       # Main visualization page
│       └── character_detail.html # Character detail page
├── migrations/              # Database migration files
├── instance/                # Instance-specific files (database)
└── README.md                # This file
```

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd zi
   ```

2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. Install the required packages:
   ```bash
   pip install flask flask-sqlalchemy flask-migrate flask-admin flask-wtf
   ```

4. Set the Flask application environment variable:
   ```bash
   # On Windows
   set FLASK_APP=app
   
   # On macOS/Linux
   export FLASK_APP=app
   ```

### Database Setup

1. Initialize the database:
   ```bash
   flask init-db
   ```

2. Set up database migrations:
   ```bash
   flask db init
   flask db migrate -m "Initial migration"
   flask db upgrade
   ```

3. Import initial data from the JSON file:
   ```bash
   flask import-json
   ```

## Running the Application

1. Start the Flask development server:
   ```bash
   flask run
   ```
   
   If port 5000 is already in use (common on macOS due to AirPlay), specify a different port:
   ```bash
   flask run --port 5001
   ```

2. Access the application in your web browser:
   - Main application: http://127.0.0.1:5000/ (or the port you specified)
   - Admin interface: http://127.0.0.1:5000/admin/ (or the port you specified)

## Usage

### Main Application

- **Graph Visualization**: The main page displays an interactive graph of characters.
- **Filtering**: Use the volume and chapter dropdowns to filter characters.
- **Search**: Enter keywords, primitive elements, or meanings in the search box.
- **Character Details**: Click on a character in the graph to view its details.

### Admin Interface

- **Characters**: Manage character entries, including their relationships to primitives and keywords.
- **Primitives**: Manage primitive elements and their meanings.
- **Keywords**: Manage keywords associated with characters.

## Development

### Making Database Changes

If you modify the database models, you need to create and apply a new migration:

```bash
flask db migrate -m "Description of changes"
flask db upgrade
```

### Adding New Data

You can add new data either through the admin interface or by modifying the JSON file and re-importing:

```bash
flask import-json
```

## License

[Your License Information]

## Acknowledgements

- [Heisig method](https://en.wikipedia.org/wiki/Remembering_the_Kanji_and_Remembering_the_Hanzi) for learning Chinese characters
- [D3.js](https://d3js.org/) for graph visualization
- [Flask](https://flask.palletsprojects.com/) web framework 