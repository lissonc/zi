import click
import json
import os
from flask import current_app
from flask.cli import with_appcontext
from .models import db, Character, Primitive, Keyword

def init_db():
    """Initialize the database."""
    db.create_all()

@click.command('init-db')
@with_appcontext
def init_db_command():
    """Clear existing data and create new tables."""
    init_db()
    click.echo('Initialized the database.')

@click.command('import-json')
@with_appcontext
def import_json_command():
    """Import data from JSON file into the database."""
    data_path = os.path.join(current_app.static_folder, 'data', 'hanzi_data.json')
    
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        click.echo(f'Error reading JSON file: {e}')
        return

    # Clear existing data
    Character.query.delete()
    Primitive.query.delete()
    Keyword.query.delete()
    db.session.commit()

    # Create dictionaries to store unique primitives and keywords
    primitives = {}
    keywords = {}

    # First pass: Create primitives and keywords
    for char_data in data['characters']:
        # Process primitives
        for element in char_data.get('primitive_elements', []):
            if element not in primitives:
                meaning = next((m for m, e in zip(char_data.get('primitive_meanings', []), 
                                                char_data.get('primitive_elements', []))
                              if e == element), '')
                primitive = Primitive(element=element, meaning=meaning)
                primitives[element] = primitive
                db.session.add(primitive)

        # Process keywords
        for keyword in char_data.get('keywords', []):
            if keyword not in keywords:
                kw = Keyword(word=keyword)
                keywords[keyword] = kw
                db.session.add(kw)

    db.session.commit()

    # Second pass: Create characters and their relationships
    for char_data in data['characters']:
        character = Character(
            character=char_data['character'],
            frame_number=char_data.get('frame_number'),
            story=char_data.get('story', ''),
            volume=char_data.get('volume'),
            chapter=char_data.get('chapter')
        )

        # Add primitives
        for element in char_data.get('primitive_elements', []):
            if element in primitives:
                character.primitives.append(primitives[element])

        # Add keywords
        for keyword in char_data.get('keywords', []):
            if keyword in keywords:
                character.keywords.append(keywords[keyword])

        db.session.add(character)

    db.session.commit()
    click.echo('Successfully imported data from JSON file.')

def init_app(app):
    """Register database commands."""
    app.cli.add_command(init_db_command)
    app.cli.add_command(import_json_command) 