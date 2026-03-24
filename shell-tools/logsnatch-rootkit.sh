#!/bin/bash

# Added the scan type to the log name to prevent overlaps with future modules
OUTPUT_FILE="/var/log/scan-rtkit-$(date -Iseconds).log"

# No function - basically a wrapper for chkrootkit
SCAN_OUTPUT=$(/usr/sbin/chkrootkit -q 2>&1 | grep -v "RTNETLINK answers: Invalid argument" | grep "INFECTED")
JSON_DATA=$(jq -n --arg out "$SCAN_OUTPUT" '{"status": "complete", "timestamp": "hmm", "results": $out}')

echo "$JSON_DATA" > "$OUTPUT_FILE"