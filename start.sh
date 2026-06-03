#!/bin/bash
cd "$(dirname "$0")"

# Find node
if [ -f "/tmp/node20/bin/node" ]; then
  export PATH="/tmp/node20/bin:$PATH"
elif ! command -v node &>/dev/null; then
  echo "Node.js not found. Downloading..."
  mkdir -p /tmp/node20
  curl -fsSL https://nodejs.org/dist/v20.14.0/node-v20.14.0-darwin-x64.tar.gz | tar xz -C /tmp/node20 --strip-components=1
  export PATH="/tmp/node20/bin:$PATH"
fi

echo "Starting EPR Storage Manager..."
node server/src/server.js &
sleep 2
cd client && node node_modules/.bin/vite --host &
sleep 3

echo ""
echo "==================================="
echo "  Open: http://localhost:5173"
echo "  Password: admin123"
echo "==================================="
wait
