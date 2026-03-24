#!/bin/bash

# Define the output file using ISO 8601 format for easy parsing
OUTPUT_FILE="/var/log/scan_results$(date -Iseconds).log"

get_ssh_config_json() {
    local sshd_config="/etc/ssh/sshd_config"
    local violations=""

    if [[ ! -f "$sshd_config" ]]; then
        echo "{}"
        return
    fi

    # Function to get effective setting
    get_ssh_setting() {
        local setting="$1"
        local default="$2"
        local value
        value=$(grep -i "^[[:space:]]*$setting" "$sshd_config" 2>/dev/null | tail -1 | awk '{print $2}')
        echo "${value:-$default}"
    }

    # Helper function to safely append JSON key-value pairs
    add_violation() {
        local setting="$1"
        local severity="$2"
        local value="$3"
        local message="$4"
        
        if [[ -n "$violations" ]]; then
            violations+=","
        fi
        
        violations+="\"$setting\": {\"severity\": \"$severity\", \"value\": \"$value\", \"message\": \"$message\"}"
    }

    # --- Run Checks ---

    local root_login
    root_login=$(get_ssh_setting "PermitRootLogin" "prohibit-password")
    if [[ "$root_login" == "yes" ]]; then
        add_violation "PermitRootLogin" "CRITICAL" "$root_login" "Allows direct root password login"
    fi

    local password_auth
    password_auth=$(get_ssh_setting "PasswordAuthentication" "yes")
    if [[ "$password_auth" == "yes" ]]; then
        add_violation "PasswordAuthentication" "WARNING" "$password_auth" "Consider enforcing key-only authentication"
    fi

    local empty_pass
    empty_pass=$(get_ssh_setting "PermitEmptyPasswords" "no")
    if [[ "$empty_pass" == "yes" ]]; then
        add_violation "PermitEmptyPasswords" "CRITICAL" "$empty_pass" "Extremely dangerous: allows login without a password"
    fi

    local max_tries
    max_tries=$(get_ssh_setting "MaxAuthTries" "6")
    if [[ "$max_tries" -gt 6 ]]; then
        add_violation "MaxAuthTries" "WARNING" "$max_tries" "High limit makes brute-force attacks easier"
    fi

    if grep -qi "^[[:space:]]*Protocol[[:space:]]*1" "$sshd_config" 2>/dev/null; then
        add_violation "Protocol" "CRITICAL" "1" "Insecure and deprecated protocol enabled"
    fi

    if grep -qi "^[[:space:]]*Ciphers" "$sshd_config" 2>/dev/null; then
        local ciphers
        ciphers=$(grep -i "^[[:space:]]*Ciphers" "$sshd_config" | tail -1 | awk '{print $2}')
        if [[ "$ciphers" =~ (3des|arcfour|blowfish) ]]; then
            add_violation "Ciphers" "WARNING" "$ciphers" "Weak or deprecated encryption ciphers detected"
        fi
    fi

    # --- Output Result ---
    echo "{$violations}"
}

# --- Execution Block ---
echo "Starting SSH security scan..."

# Run the function and redirect the standard output to the log file
get_ssh_config_json > "$OUTPUT_FILE"