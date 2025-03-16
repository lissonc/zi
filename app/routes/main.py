from flask import Blueprint, render_template, redirect, url_for, jsonify, request
from flask_login import current_user
from app.models.models import Character, Primitive
from app import db
import json
import networkx as nx
from pyvis.network import Network

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    # Get some statistics for the dashboard
    character_count = Character.query.count()
    primitive_count = Primitive.query.count()
    recent_characters = Character.query.order_by(Character.date_added.desc()).limit(5).all()
    
    return render_template('index.html', 
                          title='Hanzi Explorer',
                          character_count=character_count,
                          primitive_count=primitive_count,
                          recent_characters=recent_characters)

@main_bp.route('/characters')
def characters():
    page = request.args.get('page', 1, type=int)
    per_page = 20
    characters = Character.query.order_by(Character.heisig_index).paginate(page=page, per_page=per_page)
    return render_template('characters.html', 
                          title='Characters',
                          characters=characters)

@main_bp.route('/characters/<int:id>')
def character_detail(id):
    character = Character.query.get_or_404(id)
    return render_template('character_detail.html', 
                          title=f'Character {character.hanzi}',
                          character=character)

@main_bp.route('/primitives')
def primitives():
    page = request.args.get('page', 1, type=int)
    per_page = 20
    primitives = Primitive.query.order_by(Primitive.name).paginate(page=page, per_page=per_page)
    return render_template('primitives.html', 
                          title='Primitives',
                          primitives=primitives)

@main_bp.route('/primitives/<int:id>')
def primitive_detail(id):
    primitive = Primitive.query.get_or_404(id)
    return render_template('primitive_detail.html', 
                          title=f'Primitive {primitive.name}',
                          primitive=primitive)

@main_bp.route('/graph')
def graph():
    return render_template('graph.html', title='Character Graph')

@main_bp.route('/api/graph-data')
def graph_data():
    """Generate graph data for visualization"""
    # Create a directed graph
    G = nx.DiGraph()
    
    # Add character nodes
    characters = Character.query.all()
    for character in characters:
        G.add_node(f"c_{character.id}", 
                  id=character.id,
                  label=character.hanzi,
                  title=character.keyword,
                  type="character",
                  heisig_index=character.heisig_index)
    
    # Add primitive nodes
    primitives = Primitive.query.all()
    for primitive in primitives:
        G.add_node(f"p_{primitive.id}", 
                  id=primitive.id,
                  label=primitive.symbol,
                  title=primitive.name,
                  type="primitive")
    
    # Add edges
    for character in characters:
        for primitive in character.primitives:
            G.add_edge(f"p_{primitive.id}", f"c_{character.id}")
    
    # Convert to PyVis network for visualization
    net = Network(notebook=False, height="800px", width="100%", directed=True)
    
    # Add nodes with specific styles
    for node, attrs in G.nodes(data=True):
        color = "#3498db" if attrs.get('type') == "character" else "#e74c3c"
        net.add_node(node, 
                     label=attrs.get('label', ''), 
                     title=attrs.get('title', ''),
                     color=color)
    
    # Add edges
    for edge in G.edges():
        net.add_edge(edge[0], edge[1])
    
    # Get the network HTML and extract just the graph data
    html_data = net.generate_html()
    start_idx = html_data.find('var nodes = new vis.DataSet(')
    end_idx = html_data.find(');', start_idx)
    nodes_data = html_data[start_idx + len('var nodes = new vis.DataSet('):end_idx]
    
    start_idx = html_data.find('var edges = new vis.DataSet(')
    end_idx = html_data.find(');', start_idx)
    edges_data = html_data[start_idx + len('var edges = new vis.DataSet('):end_idx]
    
    # Check if data is empty and provide fallback
    if not nodes_data.strip():
        nodes_data = '[]'
    if not edges_data.strip():
        edges_data = '[]'
    
    # Combine the data
    graph_data = {
        'nodes': json.loads(nodes_data),
        'edges': json.loads(edges_data)
    }
    
    return jsonify(graph_data)

@main_bp.route('/search')
def search():
    query = request.args.get('q', '')
    if not query:
        return render_template('search.html', title='Search', query='', results=None)
    
    # Search in characters
    character_results = Character.query.filter(
        (Character.hanzi.like(f'%{query}%')) |
        (Character.keyword.like(f'%{query}%')) |
        (Character.story.like(f'%{query}%'))
    ).all()
    
    # Search in primitives
    primitive_results = Primitive.query.filter(
        (Primitive.symbol.like(f'%{query}%')) |
        (Primitive.name.like(f'%{query}%')) |
        (Primitive.meaning.like(f'%{query}%'))
    ).all()
    
    return render_template('search.html', 
                          title='Search',
                          query=query,
                          character_results=character_results,
                          primitive_results=primitive_results) 