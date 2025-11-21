#!/usr/bin/env bash
# Test automatic queue draining

echo ">ê Testing Automatic Queue Draining"
echo "===================================="
echo

HOOK_FILE="failure-queue-demo.ts"

if [ ! -f "$HOOK_FILE" ]; then
  echo "L Hook file not found: $HOOK_FILE"
  exit 1
fi

echo "1. Running hook with failure queue enabled..."
echo '{"hook_event_name":"SessionStart","session_id":"test","transcript_path":"/tmp/test.jsonl","cwd":"/tmp","source":"startup"}' | bun "$HOOK_FILE"
echo

echo "2. Check queue status:"
QUEUE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/failure-demo/error-queue.jsonl"
if [ -f "$QUEUE_FILE" ]; then
  echo "   Queue size: $(wc -l < "$QUEUE_FILE")"
  echo "   Contents:"
  jq -r '.error + " (retry: " + (.retryCount|tostring) + ")"' "$QUEUE_FILE"
else
  echo "   Queue is empty"
fi

echo
echo " Test complete. Check logs at .claude/hooks/failure-demo/"
