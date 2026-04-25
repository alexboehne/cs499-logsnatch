#!/bin/bash

# logsnatch-envcheck.sh - Check for sensitive data in environment variables
# Does not require sudo privileges

# Allow OUTPUT_FILE to be overridden by environment variable
OUTPUT_FILE=${OUTPUT_FILE:-"/tmp/scan-envcheck-$(date -Iseconds).log"}

get_env_check_json() {
    local sensitive_vars=""
    local first=true

    # Check for sensitive patterns in environment variables
    while IFS= read -r line; do
        # Skip internal variables and empty lines
        if [[ "$line" =~ ^_|^$ ]]; then
            continue
        fi

        # Check for sensitive patterns
        if echo "$line" | grep -qiE '(pass|secret|key|token|credential)'; then
            local var_name=$(echo "$line" | cut -d'=' -f1)
            local var_value=$(echo "$line" | cut -d'=' -f2-)

            # Mask sensitive values in output (show first 2 chars + ***)
            if [ ${#var_value} -gt 2 ]; then
                local masked_value="${var_value:0:2}***"
            else
                local masked_value="$var_value"
            fi

            if [[ "$first" == "true" ]]; then
                first=false
            else
                sensitive_vars+=","
            fi

            # Extract the specific pattern that matched
            local matched_pattern=$(echo "$line" | grep -oiE '(pass|secret|key|token|credential)' | head -1)
            sensitive_vars+="\"$var_name\": {\"pattern\": \"$matched_pattern\", \"value\": \"$masked_value\"}"
        fi
    done <<< "$(env)"

    echo "{\"sensitive_environment_variables\": {$sensitive_vars}}"
}

# --- Execution Block ---
echo "Starting environment variable security scan..."

# Run the function and redirect the standard output to the log file
get_env_check_json > "$OUTPUT_FILE"
