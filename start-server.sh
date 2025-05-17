#!/bin/bash

# Start the server in the background and save output
cd /Users/masi/Documents/chatbot-builderbot-supabase/v2-backend-pymebot
npm run dev &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Waiting for server to be ready..."
sleep 5

# Test the API
echo "Testing chat API..."
curl -X POST http://localhost:3090/api/text/chat \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: afa60b0a-3046-4607-9c48-266af6e1d322" \
  -d '{
    "text": "hola",
    "user_id": "test-user-buttons",
    "session_id": "test-session-buttons",
    "bot_id": "default",
    "template_id": "flujo-basico-lead",
    "mode": "auto-flow"
  }' | json_pp

# Kill the server
echo -e "\n\nStopping server..."
kill $SERVER_PID