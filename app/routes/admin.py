from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.models.forms import CharacterForm, PrimitiveForm
from app.models.models import Character, Primitive
from app import db
from functools import wraps

dashboard_bp = Blueprint('dashboard', __name__)

# Admin decorator to restrict access to admin users
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('You do not have permission to access this page.', 'danger')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function

@dashboard_bp.route('/')
@login_required
@admin_required
def admin_index():
    characters_count = Character.query.count()
    primitives_count = Primitive.query.count()
    return render_template('admin/index.html', 
                          title='Admin Dashboard',
                          characters_count=characters_count,
                          primitives_count=primitives_count)

# Character routes
@dashboard_bp.route('/characters')
@login_required
@admin_required
def list_characters():
    characters = Character.query.order_by(Character.heisig_index).all()
    return render_template('admin/characters/index.html', 
                          title='Character Management',
                          characters=characters)

@dashboard_bp.route('/characters/add', methods=['GET', 'POST'])
@login_required
@admin_required
def add_character():
    form = CharacterForm()
    if form.validate_on_submit():
        character = Character(
            hanzi=form.hanzi.data,
            heisig_index=form.heisig_index.data,
            keyword=form.keyword.data,
            story=form.story.data,
            strokes=form.strokes.data,
            pinyin=form.pinyin.data,
            traditional=form.traditional.data
        )
        
        # Handle primitives
        if form.primitives.data:
            primitive_names = [name.strip() for name in form.primitives.data.split(',')]
            for name in primitive_names:
                primitive = Primitive.query.filter_by(name=name).first()
                if primitive:
                    character.primitives.append(primitive)
        
        db.session.add(character)
        db.session.commit()
        flash('Character added successfully!', 'success')
        return redirect(url_for('dashboard.list_characters'))
    
    # Pass all primitives to the form
    primitives = Primitive.query.order_by(Primitive.name).all()
    return render_template('admin/characters/add.html', 
                          title='Add Character',
                          form=form,
                          primitives=primitives)

@dashboard_bp.route('/characters/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_character(id):
    character = Character.query.get_or_404(id)
    form = CharacterForm(obj=character)
    
    if request.method == 'GET':
        # Prefill the primitives field with existing relationships
        primitive_names = [p.name for p in character.primitives]
        form.primitives.data = ', '.join(primitive_names)
    
    if form.validate_on_submit():
        character.hanzi = form.hanzi.data
        character.heisig_index = form.heisig_index.data
        character.keyword = form.keyword.data
        character.story = form.story.data
        character.strokes = form.strokes.data
        character.pinyin = form.pinyin.data
        character.traditional = form.traditional.data
        
        # Update primitives
        character.primitives = []
        if form.primitives.data:
            primitive_names = [name.strip() for name in form.primitives.data.split(',')]
            for name in primitive_names:
                primitive = Primitive.query.filter_by(name=name).first()
                if primitive:
                    character.primitives.append(primitive)
        
        db.session.commit()
        flash('Character updated successfully!', 'success')
        return redirect(url_for('dashboard.list_characters'))
    
    primitives = Primitive.query.order_by(Primitive.name).all()
    return render_template('admin/characters/edit.html', 
                          title='Edit Character',
                          form=form,
                          character=character,
                          primitives=primitives)

@dashboard_bp.route('/characters/delete/<int:id>', methods=['POST'])
@login_required
@admin_required
def delete_character(id):
    character = Character.query.get_or_404(id)
    db.session.delete(character)
    db.session.commit()
    flash('Character deleted successfully!', 'success')
    return redirect(url_for('dashboard.list_characters'))

# Primitive routes
@dashboard_bp.route('/primitives')
@login_required
@admin_required
def list_primitives():
    primitives = Primitive.query.order_by(Primitive.name).all()
    return render_template('admin/primitives/index.html', 
                          title='Primitive Management',
                          primitives=primitives)

@dashboard_bp.route('/primitives/add', methods=['GET', 'POST'])
@login_required
@admin_required
def add_primitive():
    form = PrimitiveForm()
    if form.validate_on_submit():
        primitive = Primitive(
            symbol=form.symbol.data,
            name=form.name.data,
            meaning=form.meaning.data
        )
        db.session.add(primitive)
        db.session.commit()
        flash('Primitive added successfully!', 'success')
        return redirect(url_for('dashboard.list_primitives'))
    
    return render_template('admin/primitives/add.html', 
                          title='Add Primitive',
                          form=form)

@dashboard_bp.route('/primitives/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_primitive(id):
    primitive = Primitive.query.get_or_404(id)
    form = PrimitiveForm(obj=primitive)
    
    if form.validate_on_submit():
        primitive.symbol = form.symbol.data
        primitive.name = form.name.data
        primitive.meaning = form.meaning.data
        db.session.commit()
        flash('Primitive updated successfully!', 'success')
        return redirect(url_for('dashboard.list_primitives'))
    
    return render_template('admin/primitives/edit.html', 
                          title='Edit Primitive',
                          form=form,
                          primitive=primitive)

@dashboard_bp.route('/primitives/delete/<int:id>', methods=['POST'])
@login_required
@admin_required
def delete_primitive(id):
    primitive = Primitive.query.get_or_404(id)
    db.session.delete(primitive)
    db.session.commit()
    flash('Primitive deleted successfully!', 'success')
    return redirect(url_for('dashboard.list_primitives')) 