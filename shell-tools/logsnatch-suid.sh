#!/bin/bash

# Allow OUTPUT_FILE to be overridden by environment variable
OUTPUT_FILE=${OUTPUT_FILE:-"/var/log/scan-suid-$(date -Iseconds).log"}

get_suid_files_json() {
    local suid_files=""
    local first=true

    # Find all SUID files
    while IFS= read -r -d '' file; do
        local file_info
        file_info=$(stat -c '%A %U %G %n' "$file")
        local perms=$(echo "$file_info" | awk '{print $1}')
        local owner=$(echo "$file_info" | awk '{print $2}')
        local group=$(echo "$file_info" | awk '{print $3}')
        local path=$(echo "$file_info" | awk '{$1=$2=$3=""; print substr($0,4)}')

        if [[ "$first" == "true" ]]; then
            first=false
        else
            suid_files+=","
        fi

        suid_files+="\"$path\": {\"permissions\": \"$perms\", \"owner\": \"$owner\", \"group\": \"$group\"}"
    done < <(find / -type f -perm -4000 -print0 2>/dev/null)

    echo "{$suid_files}"
}

# --- Execution Block ---
echo "Starting SUID/SGID scan..."

# Run the function and redirect the standard output to the log file
get_suid_files_json > "$OUTPUT_FILE"
