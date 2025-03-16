from flask import Blueprint, render_template, request, jsonify
import json
import os

bp = Blueprint('main', __name__)

def load_hanzi_data():
    """Load data from JSON file"""
    from flask import current_app
    data_path = os.path.join(current_app.static_folder, 'data', 'hanzi_data.json')
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        # Return empty data if file doesn't exist yet
        return {"characters": []}

@bp.route('/')
def index():
    """Main page with graph visualization"""
    return render_template('index.html')

@bp.route('/api/characters')
def get_characters():
    """API endpoint to get all characters"""
    data = load_hanzi_data()
    return jsonify(data['characters'])

@bp.route('/api/character/<char>')
def get_character(char):
    """API endpoint to get details for a specific character"""
    data = load_hanzi_data()
    for character in data['characters']:
        if character['character'] == char:
            return jsonify(character)
    return jsonify({"error": "Character not found"}), 404

@bp.route('/api/search')
def search():
    """API endpoint to search characters by keyword or primitive element"""
    query = request.args.get('q', '').lower()
    data = load_hanzi_data()
    results = []
    
    for character in data['characters']:
        # Search in keywords
        keywords = [k.lower() for k in character.get('keywords', [])]
        # Search in primitive elements
        primitives = [p.lower() for p in character.get('primitive_elements', [])]
        # Search in primitive meanings
        primitive_meanings = [m.lower() for m in character.get('primitive_meanings', [])]
        
        if (query in keywords or 
            query in primitives or 
            query in primitive_meanings or
            query in character.get('story', '').lower()):
            results.append(character)
    
    return jsonify(results)

@bp.route('/character/<char>')
def character_detail(char):
    """Page to display detailed information about a character"""
    return render_template('character_detail.html', character=char) 