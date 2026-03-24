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

# ... (Keep everything above the "Deploying base Rootkit Scanner module..." line the same) ...

echo "[INFO] Moving scripts to /usr/local/bin..."
chown -R root:root ./shell-tools/*
chmod -R 700 ./shell-tools/
cp ./shell-tools/* /usr/local/bin/

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
    chmod 600 "$trigger_file"

    systemctl enable --now "logsnatch@${scan_name}.path"

done

echo "[SUCCESS] Setup complete. The system is now watching triggers for all installed modules."