from app import db
from flask_login import UserMixin
from datetime import datetime

# Association tables for many-to-many relationships
character_primitive = db.Table('character_primitive',
    db.Column('character_id', db.Integer, db.ForeignKey('character.id'), primary_key=True),
    db.Column('primitive_id', db.Integer, db.ForeignKey('primitive.id'), primary_key=True)
)

# User model for authentication
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    date_registered = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<User {self.username}>'

# Hanzi Character model
class Character(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    hanzi = db.Column(db.String(1), unique=True, nullable=False)
    heisig_index = db.Column(db.Integer, unique=True, nullable=False)
    keyword = db.Column(db.String(50), nullable=False)
    story = db.Column(db.Text)
    strokes = db.Column(db.Integer)
    pinyin = db.Column(db.String(20))
    traditional = db.Column(db.String(1))
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    date_modified = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    primitives = db.relationship('Primitive', secondary=character_primitive, 
                                 backref=db.backref('characters', lazy='dynamic'))
    
    def __repr__(self):
        return f'<Character {self.hanzi} ({self.keyword})>'

# Primitive model
class Primitive(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(1), nullable=False)
    name = db.Column(db.String(50), unique=True, nullable=False)
    meaning = db.Column(db.Text)
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    date_modified = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Primitive {self.name}>' 