from flask import Blueprint, render_template, request, jsonify, current_app
import json
import os

bp = Blueprint('main', __name__)

def load_hanzi_data():
    """Load data from JSON file"""
    data_path = os.path.join(current_app.static_folder, 'data', 'hanzi_data.json')
    
    # Default data structure
    default_data = {
        "characters": [
            {
                "character": "一",
                "frame_number": 1,
                "keywords": ["one", "single"],
                "primitive_elements": [],
                "primitive_meanings": ["one", "single"],
                "story": "The number one is represented by a single horizontal stroke.",
                "volume": 1,
                "chapter": 1
            },
            {
                "character": "二",
                "frame_number": 2,
                "keywords": ["two"],
                "primitive_elements": ["一"],
                "primitive_meanings": ["two"],
                "story": "The number two is represented by two horizontal strokes.",
                "volume": 1,
                "chapter": 1
            },
            {
                "character": "三",
                "frame_number": 3,
                "keywords": ["three"],
                "primitive_elements": ["一", "二"],
                "primitive_meanings": ["three"],
                "story": "The number three is represented by three horizontal strokes.",
                "volume": 1,
                "chapter": 1
            }
        ],
        "metadata": {
            "volumes": [
                {
                    "number": 1,
                    "title": "Book 1",
                    "chapters": [
                        {"number": 1, "title": "The First Elements"},
                        {"number": 2, "title": "The First Primitives"},
                        {"number": 3, "title": "Building Blocks"}
                    ]
                },
                {
                    "number": 2,
                    "title": "Book 2",
                    "chapters": [
                        {"number": 1, "title": "Advanced Elements"},
                        {"number": 2, "title": "Complex Characters"},
                        {"number": 3, "title": "Final Characters"}
                    ]
                }
            ]
        }
    }
    
    try:
        # Try to read existing file
        with open(data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        # If file doesn't exist or is invalid, create it with default data
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        with open(data_path, 'w', encoding='utf-8') as f:
            json.dump(default_data, f, ensure_ascii=False, indent=2)
        return default_data

@bp.route('/')
def index():
    """Main page with graph visualization"""
    data = load_hanzi_data()
    return render_template('index.html', volumes=data['metadata']['volumes'])

@bp.route('/api/characters')
def get_characters():
    """API endpoint to get all characters with optional volume and chapter filters"""
    volume = request.args.get('volume', type=int)
    chapter = request.args.get('chapter', type=int)
    
    data = load_hanzi_data()
    characters = data['characters']
    
    if volume is not None:
        characters = [c for c in characters if c['volume'] == volume]
        
    if chapter is not None:
        characters = [c for c in characters if c['chapter'] == chapter]
    
    return jsonify(characters)

@bp.route('/api/metadata')
def get_metadata():
    """API endpoint to get volumes and chapters information"""
    data = load_hanzi_data()
    return jsonify(data['metadata'])

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
    volume = request.args.get('volume', type=int)
    chapter = request.args.get('chapter', type=int)
    
    data = load_hanzi_data()
    characters = data['characters']
    
    # Apply volume and chapter filters first
    if volume is not None:
        characters = [c for c in characters if c['volume'] == volume]
        
    if chapter is not None:
        characters = [c for c in characters if c['chapter'] == chapter]
    
    results = []
    for character in characters:
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