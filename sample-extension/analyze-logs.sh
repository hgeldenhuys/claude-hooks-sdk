#!/usr/bin/env bash
# Analyze event logs

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/event-logger/logs/events.jsonl"

if [ ! -f "$LOG_FILE" ]; then
  echo "L Log file not found: $LOG_FILE"
  exit 1
fi

echo "=Ê Event Log Analysis"
echo "===================="
echo

echo "Total events: $(wc -l < "$LOG_FILE")"
echo

echo "Events by type:"
jq -r '.input.hook.hook_event_name' "$LOG_FILE" | sort | uniq -c | sort -rn
echo

echo "Recent events:"
tail -5 "$LOG_FILE" | jq -r '.input.hook.hook_event_name + " - " + .input.timestamp'
echo

echo "=Ý View full log: tail -f $LOG_FILE | jq '.'"
