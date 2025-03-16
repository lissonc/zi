# Hanzi Explorer

A Flask web application for managing and visualizing Chinese characters from Heisig's "Remembering Simplified Hanzi".

## Features

- Graph visualization of characters, keywords, and primitives
- Character information view
- Admin interface for managing the database

## Setup

1. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Initialize the database:
   ```
   flask db init
   flask db migrate
   flask db upgrade
   ```

4. Run the application:
   ```
   flask run
   ```

5. Access the application at http://localhost:5000

## Admin Interface

The admin interface is available at http://localhost:5000/admin 