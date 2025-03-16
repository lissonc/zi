from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
from flask_admin.form import Select2Widget
from wtforms import TextAreaField
from .models import db, Character, Primitive, Keyword
from flask import redirect, url_for

class BaseModelView(ModelView):
    def is_accessible(self):
        # For now, allow all access since we haven't implemented authentication
        return True

    def inaccessible_callback(self, name, **kwargs):
        return redirect(url_for('main.index'))

class CharacterView(BaseModelView):
    column_list = ['character', 'frame_number', 'volume', 'chapter', 'keywords', 'primitives']
    column_searchable_list = ['character', 'story']
    column_filters = ['volume', 'chapter']
    form_excluded_columns = ['created_at', 'updated_at']
    
    form_overrides = {
        'story': TextAreaField
    }
    
    form_widget_args = {
        'story': {
            'rows': 5
        }
    }
    
    form_ajax_refs = {
        'primitives': {
            'fields': ['element', 'meaning'],
            'page_size': 10
        },
        'keywords': {
            'fields': ['word'],
            'page_size': 10
        }
    }
    
    def __init__(self, model, session, **kwargs):
        super(CharacterView, self).__init__(model, session, **kwargs)
        self.static_folder = 'static'

class PrimitiveView(BaseModelView):
    column_list = ['element', 'meaning', 'notes']
    column_searchable_list = ['element', 'meaning', 'notes']
    form_excluded_columns = ['created_at', 'characters']
    
    form_overrides = {
        'notes': TextAreaField
    }
    
    form_widget_args = {
        'notes': {
            'rows': 3
        }
    }

class KeywordView(BaseModelView):
    column_list = ['word', 'notes']
    column_searchable_list = ['word', 'notes']
    form_excluded_columns = ['created_at', 'characters']
    
    form_overrides = {
        'notes': TextAreaField
    }
    
    form_widget_args = {
        'notes': {
            'rows': 3
        }
    }

def init_admin(app):
    admin = Admin(app, name='Heisig Character Admin', template_mode='bootstrap4')
    admin.add_view(CharacterView(Character, db.session))
    admin.add_view(PrimitiveView(Primitive, db.session))
    admin.add_view(KeywordView(Keyword, db.session)) 