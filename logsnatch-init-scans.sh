#!/bin/bash
if [[ $(/usr/bin/id -u) -ne 0 ]]; then
    echo "[ERROR] Script must be run as root; exiting..."
    exit 1
fi

echo "[INFO] Running all LogSnatch scans..."

bash /usr/local/bin/logsnatch-ssh.sh
chmod 644 /var/log/scan-ssh*.log

bash /usr/local/bin/logsnatch-suid.sh
chmod 644 /var/log/scan-suid*.log

bash /usr/local/bin/logsnatch-rootkit.sh
chmod 644 /var/log/scan-rtkit*.log

echo "[SUCCESS] All scans complete and log files are readable."
