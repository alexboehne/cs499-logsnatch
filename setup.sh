#!/bin/bash
if [[ $(/usr/bin/id -u) -ne 0 ]]; then
    echo "[ERROR] Script must be run as root user; exiting..."
    exit 1
fi

# ---------------------------------------------------------------------------
# Cleanup Section - Remove previous installations
# ---------------------------------------------------------------------------
echo "[CLEANUP] Beginning cleanup of previous installations..."

# 1. Stop and disable existing systemd services
read -p "[CLEANUP] Stop and disable existing systemd services? [y/N] " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[CLEANUP] Stopping and disabling systemd services..."
    for unit in logsnatch@*.service logsnatch@*.path; do
        systemctl stop "$unit" 2>/dev/null || true
        systemctl disable "$unit" 2>/dev/null || true
    done
    systemctl daemon-reload
    systemctl reset-failed
else
    echo ""
    echo "[CLEANUP] Skipping systemd service cleanup"
fi

# 2. Remove existing scripts
read -p "[CLEANUP] Remove existing scripts from /usr/local/bin/? [y/N] " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[CLEANUP] Removing existing scripts..."
    rm -f /usr/local/bin/logsnatch-*.sh
else
    echo ""
    echo "[CLEANUP] Skipping script removal"
fi

# 3. Remove trigger files
read -p "[CLEANUP] Remove existing trigger files? [y/N] " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[CLEANUP] Removing trigger files..."
    rm -f /var/lib/logsnatch/*-trigger
else
    echo ""
    echo "[CLEANUP] Skipping trigger file removal"
fi

# 4. Remove systemd unit files
read -p "[CLEANUP] Remove existing systemd unit files? [y/N] " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[CLEANUP] Removing systemd unit files..."
    rm -f /etc/systemd/system/logsnatch@.service
    rm -f /etc/systemd/system/logsnatch@.path
else
    echo ""
    echo "[CLEANUP] Skipping systemd unit file removal"
fi

echo "[CLEANUP] Cleanup complete"
echo ""

# ---------------------------------------------------------------------------
# Main Installation
# ---------------------------------------------------------------------------
echo "[INFO] Creating Logsnatch user and directory structure..."

useradd -r -s /bin/false logsnatch || true # Ignore if user already exists
mkdir -p /var/lib/logsnatch/logs


echo "[INFO] Installing Systemd Template Units..."

# template service file (i don't understand the syntax either)
cat > /etc/systemd/system/logsnatch@.service <<EOF
[Unit]
Description=Logsnatch Scan: %I

[Service]
Type=oneshot
ExecStart=/usr/local/bin/logsnatch-%i.sh
User=root
Group=root
ProtectSystem=full
PrivateTmp=true
EOF

# template file path
cat > /etc/systemd/system/logsnatch@.path <<EOF
[Unit]
Description=Watch for Logsnatch %I Trigger

[Path]
PathModified=/var/lib/logsnatch/%i-trigger
Unit=logsnatch@%i.service

[Install]
WantedBy=multi-user.target
EOF

echo "[INFO] Deploying base Rootkit Scanner module..."

# Install jq if not present (required for rootkit scan JSON processing)
if ! command -v jq &> /dev/null; then
    echo "[INFO] Installing jq for JSON processing..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y jq
    elif command -v yum &> /dev/null; then
        yum install -y jq
    elif command -v dnf &> /dev/null; then
        dnf install -y jq
    else
        echo "[WARNING] Could not install jq - package manager not found"
    fi
fi

# rootkit Trigger File
touch /var/lib/logsnatch/rootkit-trigger
chown logsnatch:logsnatch /var/lib/logsnatch/rootkit-trigger
chmod 600 /var/lib/logsnatch/rootkit-trigger

echo "[INFO] Moving scripts to /usr/local/bin..."
chown -R root:root ./shell-tools/*
chmod -R 755 ./shell-tools/
cp ./shell-tools/* /usr/local/bin/
chmod 755 /usr/local/bin/logsnatch-*.sh

echo "[INFO] Reloading systemd..."
systemctl daemon-reload

echo "[INFO] Configuring triggers and listeners for all shell-tools..."

# Loop through every script we just copied
for script in /usr/local/bin/logsnatch-*.sh; do
    
    # Extract just the scan name (e.g., turns "/usr/local/bin/logsnatch-malware.sh" into "malware")
    # || true prevents the script from failing if no files are found
    filename=$(basename "$script")
    scan_name=$(echo "$filename" | sed 's/logsnatch-//; s/\.sh//')
    
    if [[ -z "$scan_name" || "$scan_name" == "*" ]]; then
        continue
    fi

    echo " -> Setting up: $scan_name"

    trigger_file="/var/lib/logsnatch/${scan_name}-trigger"
    touch "$trigger_file"
    chown logsnatch:logsnatch "$trigger_file"
    chmod 664 "$trigger_file"
    chmod g+w "$trigger_file"

    systemctl enable --now "logsnatch@${scan_name}.path"

done
find . -type f -print0 | xargs -0 dos2unix
echo "[SUCCESS] Setup complete. The system is now watching triggers for all installed modules."
