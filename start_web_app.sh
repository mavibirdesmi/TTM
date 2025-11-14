#!/bin/bash

# Time-to-Move Cut & Drag - Web Application Launcher
# This script starts both the FastAPI backend and React frontend

set -e

echo "🚀 Starting Time-to-Move Cut & Drag Web Application..."
echo ""

# Check if we're in the correct directory
if [ ! -d "GUIs" ]; then
    echo "❌ Error: Please run this script from the TTM root directory"
    exit 1
fi

# Check Python
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python not found. Please install Python 3.8+"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found. Please install Node.js 16+"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm not found. Please install npm"
    exit 1
fi

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if ports are available
if check_port 8000; then
    echo "⚠️  Warning: Port 8000 is already in use. Backend may fail to start."
fi

if check_port 3000; then
    echo "⚠️  Warning: Port 3000 is already in use. Frontend may fail to start."
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd GUIs/backend
if command -v uv &> /dev/null; then
    uv pip install -r requirements-backend.txt
else
    pip install -r requirements-backend.txt
fi
cd ../..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd GUIs/frontend
npm install
cd ../..

echo ""
echo "✅ Dependencies installed!"
echo ""

# Create a trap to kill both processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "🔧 Starting FastAPI backend on http://localhost:8000 ..."
cd GUIs/backend
python app.py > backend.log 2>&1 &
BACKEND_PID=$!
cd ../..

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Error: Backend failed to start. Check GUIs/backend/backend.log for details."
    exit 1
fi

# Start frontend
echo "🎨 Starting React frontend on http://localhost:3000 ..."
cd GUIs/frontend
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

# Wait a moment for frontend to start
sleep 2

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Error: Frontend failed to start. Check GUIs/frontend/frontend.log for details."
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "✅ Application started successfully!"
echo ""
echo "📍 Backend API:  http://localhost:8000"
echo "📍 Frontend UI:  http://localhost:3000"
echo "📍 API Docs:     http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both services..."
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
