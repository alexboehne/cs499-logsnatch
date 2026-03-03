#!/bin/bash

# LOGSNATCH DAEMON/USER SETUP
if [[ $(/usr/bin/id -u) -ne 0 ]]; then
	echo "Script must be run as root user; exiting..."
	exit
fi

# CREATE LOGSNATCH USER/DIR STRUCT
useradd -r -s /bin/false logsnatch

mkdir -p /var/lib/logsnatch
touch /var/lib/logsnatch/rootkit-trigger
chown logsnatch /var/lib/logsnatch/rootkit-trigger
chmod 600 /var/lib/logsnatch/rootkit-trigger

# ADD LOGGING STRUCT
mkdir -p /var/lib/logsnatch/logs

# ADD SCAN SCRIPT
cat > /usr/local/bin/logsnatch-rootkit.sh <<END
#!/bin/bash
OUTPUT_FILE="/var/log/scan_results$(date -Iseconds).log"
SCAN_OUTPUT=$(/usr/sbin/chkrootkit -q 2>&1 | grep -v "RTNETLINK answers: Invalid argument" | grep "INFECTED")
JSON_DATA=$(jq -n --arg out "$SCAN_OUTPUT" '{"status": "complete", "timestamp": "hmm", "results": $out}')

echo "$JSON_DATA" > "$OUTPUT_FILE"
END

chown root:root /usr/local/bin/logsnatch-rootkit.sh
chmod 700 /usr/local/bin/logsnatch-rootkit.sh

# SETUP TRIGGER SERVICE
cat > /etc/systemd/system/logsnatch-rootkit.service<<END
[Unit]
Description=Run Rootkit Detection Script
Conflicts=rootkit-scanner.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/logsnatch-rootkit.sh
User=root
Group=root
ProtectSystem=full
PrivateTmp=true
END

cat > /etc/systemd/system/logsnatch-rootkit.path<<END
[Unit]
Description=Watch for Rootkit Scan Trigger

[Path]
PathModified=/var/lib/logsnatch/rootkit-trigger
Unit=rootkit-scanner.service

[Install]
WantedBy=multi-user.target
END

sudo systemctl daemon-reload
sudo systemctl enable --now logsnatch-rookit.path
echo "Setup successful - proceed to next install steps"