#!/bin/bash

echo "Starting Swiss Tournament Manager..."
echo "Once the server is running, open http://localhost:8000 in your browser"

# Check if python3 is available
if command -v python3 &>/dev/null; then
    echo "Starting server with Python 3..."
    python3 -m http.server 8000
# Check if python is available and is Python 3
elif command -v python &>/dev/null && python -c 'import sys; sys.exit(0 if sys.version_info.major == 3 else 1)' &>/dev/null; then
    echo "Starting server with Python 3..."
    python -m http.server 8000
# Check if python2 is available
elif command -v python2 &>/dev/null; then
    echo "Starting server with Python 2..."
    python2 -m SimpleHTTPServer 8000
# Check if python is available and is Python 2
elif command -v python &>/dev/null; then
    echo "Starting server with Python..."
    python -m SimpleHTTPServer 8000
# If no Python is available, check for alternatives
elif command -v npx &>/dev/null; then
    echo "Starting server with Node.js http-server..."
    npx http-server -p 8000
else
    echo "ERROR: Could not find Python or Node.js to start a web server."
    echo "Please install either Python or Node.js, or manually open the index.html file in your browser."
    exit 1
fi 