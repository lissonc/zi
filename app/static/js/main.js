// Main JavaScript file for Hanzi Explorer

// Initialize the graph visualization when on the graph page
document.addEventListener('DOMContentLoaded', function() {
    const graphContainer = document.getElementById('graph-container');
    
    if (graphContainer) {
        initializeGraph();
    }
});

// Function to initialize the graph visualization
function initializeGraph() {
    fetch('/api/graph-data')
        .then(response => response.json())
        .then(data => {
            // Create a network visualization
            const container = document.getElementById('graph-container');
            
            // Configuration for the network
            const options = {
                nodes: {
                    shape: 'circle',
                    font: {
                        size: 18,
                        face: 'Arial',
                        color: '#ffffff'
                    },
                    borderWidth: 2
                },
                edges: {
                    width: 1,
                    color: {
                        color: '#848484',
                        highlight: '#1B5E20'
                    },
                    arrows: {
                        to: { enabled: true, scaleFactor: 0.5 }
                    }
                },
                physics: {
                    stabilization: true,
                    barnesHut: {
                        gravitationalConstant: -10000,
                        springConstant: 0.02,
                        springLength: 150
                    }
                },
                interaction: {
                    navigationButtons: true,
                    keyboard: true,
                    hover: true
                }
            };
            
            // Create the network
            const network = new vis.Network(container, data, options);
            
            // Add click event
            network.on("click", function(params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const nodeType = nodeId.startsWith('c_') ? 'characters' : 'primitives';
                    const realId = nodeId.substr(2); // Remove the prefix
                    
                    // Navigate to the detail page
                    window.location.href = `/${nodeType}/${realId}`;
                }
            });
        })
        .catch(error => {
            console.error('Error loading graph data:', error);
            document.getElementById('graph-container').innerHTML = 
                '<div class="alert alert-danger">Error loading graph data. Please try again later.</div>';
        });
} 