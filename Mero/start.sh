#!/bin/bash

echo "🚀 Starting Mero - AI-Powered Infinite Canvas"
echo "====================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed or not in your PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Make sure the script has executable permissions
chmod +x start.js

# Run the start script
node start.js

exit_code=$?

if [ $exit_code -ne 0 ]; then
    echo ""
    echo "❌ Failed to start Mero. Please check the error messages above."
    exit $exit_code
fi