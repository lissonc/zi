from flask import Blueprint, render_template, request, jsonify
from sqlalchemy import or_
from .models import db, Character, Primitive, Keyword

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    """Main page with graph visualization"""
    volumes = db.session.query(Character.volume).distinct().all()
    volume_data = []
    
    for (volume_num,) in volumes:
        if volume_num:  # Skip None values
            chapters = db.session.query(Character.chapter).filter(
                Character.volume == volume_num
            ).distinct().all()
            
            volume_data.append({
                'number': volume_num,
                'title': f'Book {volume_num}',
                'chapters': [
                    {'number': chapter[0], 'title': f'Chapter {chapter[0]}'}
                    for chapter in chapters if chapter[0]
                ]
            })
    
    return render_template('index.html', volumes=volume_data)

@bp.route('/api/characters')
def get_characters():
    """API endpoint to get all characters with optional volume and chapter filters"""
    volume = request.args.get('volume', type=int)
    chapter = request.args.get('chapter', type=int)
    
    query = Character.query
    
    if volume is not None:
        query = query.filter(Character.volume == volume)
        
    if chapter is not None:
        query = query.filter(Character.chapter == chapter)
    
    characters = query.all()
    return jsonify([char.to_dict() for char in characters])

@bp.route('/api/metadata')
def get_metadata():
    """API endpoint to get volumes and chapters information"""
    volumes = db.session.query(Character.volume).distinct().all()
    metadata = {'volumes': []}
    
    for (volume_num,) in volumes:
        if volume_num:  # Skip None values
            chapters = db.session.query(Character.chapter).filter(
                Character.volume == volume_num
            ).distinct().all()
            
            metadata['volumes'].append({
                'number': volume_num,
                'title': f'Book {volume_num}',
                'chapters': [
                    {'number': chapter[0], 'title': f'Chapter {chapter[0]}'}
                    for chapter in chapters if chapter[0]
                ]
            })
    
    return jsonify(metadata)

@bp.route('/api/character/<char>')
def get_character(char):
    """API endpoint to get details for a specific character"""
    character = Character.query.filter_by(character=char).first()
    if character:
        return jsonify(character.to_dict())
    return jsonify({"error": "Character not found"}), 404

@bp.route('/api/search')
def search():
    """API endpoint to search characters by keyword or primitive element"""
    query = request.args.get('q', '').lower()
    volume = request.args.get('volume', type=int)
    chapter = request.args.get('chapter', type=int)
    
    char_query = Character.query
    
    if volume is not None:
        char_query = char_query.filter(Character.volume == volume)
        
    if chapter is not None:
        char_query = char_query.filter(Character.chapter == chapter)
    
    if query:
        # Search in keywords and primitives
        char_query = char_query.join(Character.keywords).join(Character.primitives).filter(
            or_(
                Character.character.ilike(f'%{query}%'),
                Character.story.ilike(f'%{query}%'),
                Keyword.word.ilike(f'%{query}%'),
                Primitive.element.ilike(f'%{query}%'),
                Primitive.meaning.ilike(f'%{query}%')
            )
        ).distinct()
    
    characters = char_query.all()
    return jsonify([char.to_dict() for char in characters])

@bp.route('/character/<char>')
def character_detail(char):
    """Page to display detailed information about a character"""
    return render_template('character_detail.html', character=char) 