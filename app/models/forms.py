from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField, TextAreaField, IntegerField
from wtforms.validators import DataRequired, Email, EqualTo, Length, ValidationError, Optional
from app.models.models import User, Character, Primitive

# Authentication Forms
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')
    submit = SubmitField('Sign In')

class RegistrationForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=64)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=8)])
    password2 = PasswordField('Repeat Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Register')
    
    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user is not None:
            raise ValidationError('Please use a different username.')
    
    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError('Please use a different email address.')

# Character Forms
class CharacterForm(FlaskForm):
    hanzi = StringField('Hanzi Character', validators=[DataRequired(), Length(min=1, max=1)])
    heisig_index = IntegerField('Heisig Index', validators=[DataRequired()])
    keyword = StringField('Keyword', validators=[DataRequired(), Length(max=50)])
    story = TextAreaField('Story/Mnemonic', validators=[Optional()])
    strokes = IntegerField('Stroke Count', validators=[Optional()])
    pinyin = StringField('Pinyin', validators=[Optional(), Length(max=20)])
    traditional = StringField('Traditional Form', validators=[Optional(), Length(min=0, max=1)])
    primitives = StringField('Primitives (comma separated)', validators=[Optional()])
    submit = SubmitField('Save Character')
    
    def validate_hanzi(self, hanzi):
        if self.id.data is None:  # Only check when creating new
            character = Character.query.filter_by(hanzi=hanzi.data).first()
            if character is not None:
                raise ValidationError('This character already exists in the database.')

    def validate_heisig_index(self, heisig_index):
        if self.id.data is None:  # Only check when creating new
            character = Character.query.filter_by(heisig_index=heisig_index.data).first()
            if character is not None:
                raise ValidationError('This Heisig index is already assigned.')

# Primitive Forms
class PrimitiveForm(FlaskForm):
    symbol = StringField('Symbol', validators=[DataRequired(), Length(min=1, max=1)])
    name = StringField('Name', validators=[DataRequired(), Length(max=50)])
    meaning = TextAreaField('Meaning', validators=[Optional()])
    submit = SubmitField('Save Primitive')
    
    def validate_name(self, name):
        if self.id.data is None:  # Only check when creating new
            primitive = Primitive.query.filter_by(name=name.data).first()
            if primitive is not None:
                raise ValidationError('This primitive name already exists in the database.') 