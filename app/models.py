from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# Association tables for many-to-many relationships
character_primitives = db.Table('character_primitives',
    db.Column('character_id', db.Integer, db.ForeignKey('character.id'), primary_key=True),
    db.Column('primitive_id', db.Integer, db.ForeignKey('primitive.id'), primary_key=True)
)

character_keywords = db.Table('character_keywords',
    db.Column('character_id', db.Integer, db.ForeignKey('character.id'), primary_key=True),
    db.Column('keyword_id', db.Integer, db.ForeignKey('keyword.id'), primary_key=True)
)

class Character(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    character = db.Column(db.String(8), unique=True, nullable=False)
    frame_number = db.Column(db.Integer, unique=True)
    volume = db.Column(db.Integer)
    chapter = db.Column(db.Integer)
    story = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    primitives = db.relationship('Primitive', secondary=character_primitives, 
                               backref=db.backref('characters', lazy='dynamic'))
    keywords = db.relationship('Keyword', secondary=character_keywords,
                             backref=db.backref('characters', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'character': self.character,
            'frame_number': self.frame_number,
            'volume': self.volume,
            'chapter': self.chapter,
            'story': self.story,
            'primitive_elements': [p.element for p in self.primitives],
            'primitive_meanings': [p.meaning for p in self.primitives if p.meaning],
            'keywords': [k.word for k in self.keywords]
        }

class Primitive(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    element = db.Column(db.String(8), unique=True, nullable=False)
    meaning = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __str__(self):
        return f"{self.element} ({self.meaning})" if self.meaning else self.element

class Keyword(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.String(100), unique=True, nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __str__(self):
        return self.word 