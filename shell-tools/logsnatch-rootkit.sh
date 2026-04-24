#!/bin/bash

# Added the scan type to the log name to prevent overlaps with future modules
# Allow OUTPUT_FILE to be overridden by environment variable
OUTPUT_FILE=${OUTPUT_FILE:-"/var/log/scan-rtkit-$(date -Iseconds).log"}

# No function - basically a wrapper for chkrootkit
SCAN_OUTPUT=$(/usr/sbin/chkrootkit -q 2>&1 | grep -v "RTNETLINK answers: Invalid argument" | grep "INFECTED")

# Check if jq is available, if not use simple JSON formatting
TIMESTAMP=$(date -Iseconds)
if command -v jq &> /dev/null; then
    JSON_DATA=$(jq -n --arg out "$SCAN_OUTPUT" --arg ts "$TIMESTAMP" '{"status": "complete", "timestamp": $ts, "results": $out}')
else
    # Fallback when jq is not available
    if [[ -n "$SCAN_OUTPUT" ]]; then
        JSON_DATA='{"status": "complete", "timestamp": "'$TIMESTAMP'", "results": "$SCAN_OUTPUT"}'
    else
        JSON_DATA='{"status": "complete", "timestamp": "'$TIMESTAMP'", "results": ""}'
    fi
fi

echo "$JSON_DATA" > "$OUTPUT_FILE"