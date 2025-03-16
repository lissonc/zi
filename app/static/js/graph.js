// Graph data structure
let graphData = { nodes: [], links: [] };

// Initialize graph when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Initial load of all characters
    updateGraph();
});

function buildGraphData(characters) {
    // Clear existing data
    graphData.nodes = [];
    graphData.links = [];
    
    characters.forEach(char => {
        // Add character node
        graphData.nodes.push({
            id: char.character,
            type: 'character',
            label: char.character,
            keywords: char.keywords || [],
            frameNumber: char.frame_number,
            volume: char.volume,
            chapter: char.chapter
        });
        
        // Add keyword nodes and links
        if (char.keywords) {
            char.keywords.forEach(keyword => {
                // Check if keyword node already exists
                if (!graphData.nodes.some(n => n.id === keyword && n.type === 'keyword')) {
                    graphData.nodes.push({
                        id: keyword,
                        type: 'keyword',
                        label: keyword
                    });
                }
                
                // Add link between character and keyword
                graphData.links.push({
                    source: char.character,
                    target: keyword,
                    type: 'has_keyword'
                });
            });
        }
        
        // Add primitive element nodes and links
        if (char.primitive_elements) {
            char.primitive_elements.forEach(primitive => {
                // Check if primitive node already exists
                if (!graphData.nodes.some(n => n.id === primitive && n.type === 'primitive')) {
                    graphData.nodes.push({
                        id: primitive,
                        type: 'primitive',
                        label: primitive
                    });
                }
                
                // Add link between character and primitive
                graphData.links.push({
                    source: char.character,
                    target: primitive,
                    type: 'has_primitive'
                });
            });
        }
    });
}

function initGraph() {
    const container = document.getElementById('graph-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Create SVG element
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Define color scheme for different node types
    const color = d3.scaleOrdinal()
        .domain(['character', 'keyword', 'primitive'])
        .range(['#ff6b6b', '#4ecdc4', '#ffd166']);
    
    // Create simulation
    const simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));
    
    // Create links
    const link = svg.append('g')
        .selectAll('line')
        .data(graphData.links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1);
    
    // Create nodes
    const node = svg.append('g')
        .selectAll('circle')
        .data(graphData.nodes)
        .enter()
        .append('circle')
        .attr('r', d => d.type === 'character' ? 15 : 10)
        .attr('fill', d => color(d.type))
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Add labels to nodes
    const label = svg.append('g')
        .selectAll('text')
        .data(graphData.nodes)
        .enter()
        .append('text')
        .text(d => d.label)
        .attr('font-size', d => d.type === 'character' ? '14px' : '10px')
        .attr('dx', 15)
        .attr('dy', 4);
    
    // Add click event to nodes
    node.on('click', function(event, d) {
        if (d.type === 'character') {
            showCharacterInfo(d.id);
        } else if (d.type === 'keyword' || d.type === 'primitive') {
            searchCharacters(d.id);
        }
    });
    
    // Add tooltips
    node.append('title')
        .text(d => {
            if (d.type === 'character') {
                return `${d.label} (Frame ${d.frameNumber}, Vol ${d.volume} Ch ${d.chapter})`;
            }
            return d.label;
        });
    
    // Update positions on each tick of the simulation
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        
        label
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });
    
    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

function showCharacterInfo(character) {
    fetchWithCSRF(`/api/character/${character}`)
        .then(response => response.json())
        .then(data => {
            const infoContent = document.getElementById('info-content');
            
            let html = `
                <h3>${data.character}</h3>
                <p><strong>Frame:</strong> ${data.frame_number || 'N/A'}</p>
                <p><strong>Volume:</strong> ${data.volume || 'N/A'}</p>
                <p><strong>Chapter:</strong> ${data.chapter || 'N/A'}</p>
                <p><strong>Keywords:</strong> ${data.keywords ? data.keywords.join(', ') : 'None'}</p>
                <p><strong>Primitive Elements:</strong> ${data.primitive_elements ? data.primitive_elements.join(', ') : 'None'}</p>
                <p><strong>Primitive Meanings:</strong> ${data.primitive_meanings ? data.primitive_meanings.join(', ') : 'None'}</p>
                <p><strong>Story:</strong> ${data.story || 'No story available'}</p>
                <a href="/character/${data.character}" class="detail-link">View Full Details</a>
            `;
            
            infoContent.innerHTML = html;
        })
        .catch(error => {
            console.error('Error fetching character data:', error);
            document.getElementById('info-content').innerHTML = '<p>Error loading character data</p>';
        });
}

function searchCharacters(query) {
    if (!query) {
        query = document.getElementById('search').value;
    }
    
    if (!query) return;
    
    const params = new URLSearchParams(getFilterParams());
    params.append('q', query);
    
    fetch(`/api/search?${params}`)
        .then(response => response.json())
        .then(results => {
            const infoContent = document.getElementById('info-content');
            
            if (results.length === 0) {
                infoContent.innerHTML = '<p>No characters found matching your search.</p>';
                return;
            }
            
            let html = `<h3>Search Results for "${query}"</h3><ul>`;
            
            results.forEach(char => {
                html += `
                    <li>
                        <a href="#" onclick="showCharacterInfo('${char.character}'); return false;">
                            ${char.character} - ${char.keywords ? char.keywords.join(', ') : 'No keywords'}
                            (Vol ${char.volume}, Ch ${char.chapter})
                        </a>
                    </li>
                `;
            });
            
            html += '</ul>';
            infoContent.innerHTML = html;
        })
        .catch(error => {
            console.error('Error searching characters:', error);
            document.getElementById('info-content').innerHTML = '<p>Error searching characters</p>';
        });
} 