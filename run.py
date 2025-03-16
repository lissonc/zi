from app import create_app
import json
import os

app = create_app()

if __name__ == '__main__':
    # Create necessary directories if they don't exist
    os.makedirs(os.path.join('app/static', 'data'), exist_ok=True)
    
    # Create sample data file if it doesn't exist
    if not os.path.exists(os.path.join('app/static/data', 'hanzi_data.json')):
        sample_data = {
            "characters": [
                {
                    "character": "一",
                    "frame_number": 1,
                    "keywords": ["one", "single"],
                    "primitive_elements": [],
                    "primitive_meanings": ["one", "single"],
                    "story": "The number one is represented by a single horizontal stroke."
                },
                {
                    "character": "二",
                    "frame_number": 2,
                    "keywords": ["two"],
                    "primitive_elements": ["一"],
                    "primitive_meanings": ["two"],
                    "story": "The number two is represented by two horizontal strokes."
                },
                {
                    "character": "三",
                    "frame_number": 3,
                    "keywords": ["three"],
                    "primitive_elements": ["一", "二"],
                    "primitive_meanings": ["three"],
                    "story": "The number three is represented by three horizontal strokes."
                }
            ]
        }
        with open(os.path.join('app/static/data', 'hanzi_data.json'), 'w', encoding='utf-8') as f:
            json.dump(sample_data, f, ensure_ascii=False, indent=2)
    
    app.run(debug=True)
