#!/bin/bash
if [[ $(/usr/bin/id -u) -ne 0 ]]; then
    echo "[ERROR] Script must be run as root user; exiting..."
    exit 1
fi

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

# rootkit Trigger File
touch /var/lib/logsnatch/rootkit-trigger
chown logsnatch:logsnatch /var/lib/logsnatch/rootkit-trigger
chmod 600 /var/lib/logsnatch/rootkit-trigger

# add the Rootkit Scan Script
cat > /usr/local/bin/logsnatch-rootkit.sh <<"EOF"
#!/bin/bash

# Added the scan type to the log name to prevent overlaps with future modules
OUTPUT_FILE="/var/log/scan_results_rootkit_$(date -Iseconds).log"

SCAN_OUTPUT=$(/usr/sbin/chkrootkit -q 2>&1 | grep -v "RTNETLINK answers: Invalid argument" | grep "INFECTED")
JSON_DATA=$(jq -n --arg out "$SCAN_OUTPUT" '{"status": "complete", "timestamp": "hmm", "results": $out}')

echo "$JSON_DATA" > "$OUTPUT_FILE"
EOF

chown root:root /usr/local/bin/logsnatch-rootkit.sh
chmod 700 /usr/local/bin/logsnatch-rootkit.sh

echo "[INFO] Reloading systemd and enabling the rootkit path monitor..."

systemctl daemon-reload
systemctl enable --now logsnatch@rootkit.path

echo "[SUCCESS] Setup complete. The system is now watching for changes to /var/lib/logsnatch/rootkit-trigger."