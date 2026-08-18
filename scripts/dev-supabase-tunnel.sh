#!/usr/bin/env bash
set -euo pipefail

region="ap-south-1"
instance_id="i-065a52a65dd660717"
os_user="ubuntu"
expected_host_fingerprint="SHA256:269xg8V17A6xWEX6izZfySziLi0fQHJ4DqExAS1eqAo"
mode="${1:-tunnel}"

if [[ "$mode" != "tunnel" && "$mode" != "--show-login" ]]; then
  echo "Usage: $0 [--show-login]" >&2
  exit 1
fi

for command_name in aws ssh ssh-keygen ssh-keyscan lsof; do
  command -v "$command_name" >/dev/null || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done

lock_directory="${TMPDIR:-/tmp}/cureocity-dev-supabase-tunnel.lock"
lock_acquired=false
if [[ "$mode" == "tunnel" ]]; then
  if lsof -nP -iTCP:54321 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "A Development Supabase tunnel is already running on port 54321."
    exit 0
  fi
  if ! mkdir "$lock_directory" 2>/dev/null; then
    if lsof -nP -iTCP:54321 -sTCP:LISTEN >/dev/null 2>&1; then
      echo "A Development Supabase tunnel is already running on port 54321."
      exit 0
    fi
    rmdir "$lock_directory" 2>/dev/null || true
    if ! mkdir "$lock_directory" 2>/dev/null; then
      echo "Could not acquire the Development tunnel lock." >&2
      exit 1
    fi
  fi
  lock_acquired=true
fi

temporary_directory="$(mktemp -d)"
cleanup() {
  rm -rf -- "$temporary_directory"
  if [[ "$lock_acquired" == "true" ]]; then
    rmdir "$lock_directory" 2>/dev/null || true
  fi
}
trap cleanup EXIT
stop_requested=false
trap 'stop_requested=true' INT TERM

prepare_connection() {
  local connection_number="$1"
  local key_file="$temporary_directory/id_ed25519.$connection_number"
  local known_hosts_file="$temporary_directory/known_hosts.$connection_number"

  read -r availability_zone public_ip state < <(
    aws ec2 describe-instances \
      --region "$region" \
      --instance-ids "$instance_id" \
      --query 'Reservations[0].Instances[0].[Placement.AvailabilityZone,PublicIpAddress,State.Name]' \
      --output text
  )

  if [[ "$state" != "running" || -z "$public_ip" || "$public_ip" == "None" ]]; then
    echo "Development EC2 instance is not running or has no public IP." >&2
    return 1
  fi

  ssh-keygen -q -t ed25519 -N '' -f "$key_file"
  aws ec2-instance-connect send-ssh-public-key \
    --region "$region" \
    --availability-zone "$availability_zone" \
    --instance-id "$instance_id" \
    --instance-os-user "$os_user" \
    --ssh-public-key "file://$key_file.pub" >/dev/null

  ssh-keyscan -T 10 -t ed25519 "$public_ip" > "$known_hosts_file" 2>/dev/null
  actual_host_fingerprint="$(ssh-keygen -lf "$known_hosts_file" | awk 'NR == 1 { print $2 }')"
  if [[ "$actual_host_fingerprint" != "$expected_host_fingerprint" ]]; then
    echo "EC2 SSH host identity did not match the pinned Development host." >&2
    return 1
  fi

  connection_key_file="$key_file"
  connection_known_hosts_file="$known_hosts_file"
}

prepare_connection 1

if [[ "$mode" == "--show-login" ]]; then
  ssh \
    -i "$connection_key_file" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$connection_known_hosts_file" \
    "$os_user@$public_ip" \
    "sudo cat /home/ubuntu/cureocity-dev-login.txt"
  exit 0
fi

echo "Keep this terminal open while running the app. Press Ctrl-C to stop."
connection_number=1
while true; do
  if (( connection_number > 1 )); then
    echo "Reconnecting Development tunnel…"
    if ! prepare_connection "$connection_number"; then
      echo "Reconnect preparation failed; retrying in 5 seconds." >&2
      sleep 5
      ((connection_number += 1))
      continue
    fi
  fi

  echo "Development Supabase tunnel ready at http://127.0.0.1:54321"
  if ssh -N \
    -i "$connection_key_file" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$connection_known_hosts_file" \
    -o ExitOnForwardFailure=yes \
    -o BatchMode=yes \
    -o ConnectTimeout=20 \
    -o ConnectionAttempts=3 \
    -o ServerAliveInterval=10 \
    -o ServerAliveCountMax=12 \
    -o TCPKeepAlive=yes \
    -o IPQoS=none \
    -L 54321:127.0.0.1:8000 \
    "$os_user@$public_ip"; then
    echo "Tunnel closed; reconnecting in 3 seconds."
  else
    echo "Tunnel interrupted; reconnecting in 3 seconds." >&2
  fi
  if [[ "$stop_requested" == "true" ]]; then
    echo "Tunnel stopped."
    exit 0
  fi
  sleep 3
  ((connection_number += 1))
done
