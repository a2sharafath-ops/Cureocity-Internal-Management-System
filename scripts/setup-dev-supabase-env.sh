#!/usr/bin/env bash
set -euo pipefail

region="ap-south-1"
instance_id="i-065a52a65dd660717"
os_user="ubuntu"
expected_host_fingerprint="SHA256:269xg8V17A6xWEX6izZfySziLi0fQHJ4DqExAS1eqAo"
destination=".env.development.local"

if [[ -e "$destination" ]]; then
  echo "$destination already exists; refusing to overwrite it." >&2
  exit 1
fi

for command_name in aws ssh ssh-keygen ssh-keyscan; do
  command -v "$command_name" >/dev/null || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done

read -r availability_zone public_ip state < <(
  aws ec2 describe-instances \
    --region "$region" \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].[Placement.AvailabilityZone,PublicIpAddress,State.Name]' \
    --output text
)

if [[ "$state" != "running" || -z "$public_ip" || "$public_ip" == "None" ]]; then
  echo "Development EC2 instance is not running or has no public IP." >&2
  exit 1
fi

temporary_directory="$(mktemp -d)"
cleanup() { rm -rf -- "$temporary_directory"; }
trap cleanup EXIT

ssh-keygen -q -t ed25519 -N '' -f "$temporary_directory/id_ed25519"
aws ec2-instance-connect send-ssh-public-key \
  --region "$region" \
  --availability-zone "$availability_zone" \
  --instance-id "$instance_id" \
  --instance-os-user "$os_user" \
  --ssh-public-key "file://$temporary_directory/id_ed25519.pub" >/dev/null

ssh-keyscan -T 10 -t ed25519 "$public_ip" > "$temporary_directory/known_hosts" 2>/dev/null
actual_host_fingerprint="$(ssh-keygen -lf "$temporary_directory/known_hosts" | awk 'NR == 1 { print $2 }')"
if [[ "$actual_host_fingerprint" != "$expected_host_fingerprint" ]]; then
  echo "EC2 SSH host identity did not match the pinned Development host." >&2
  exit 1
fi

environment_file="$temporary_directory/environment"
ssh \
  -i "$temporary_directory/id_ed25519" \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$temporary_directory/known_hosts" \
  "$os_user@$public_ip" \
  "sudo awk '
    /^ANON_KEY=/ { print \"NEXT_PUBLIC_SUPABASE_ANON_KEY=\" substr(\$0, index(\$0, \"=\") + 1) }
    /^SERVICE_ROLE_KEY=/ { print \"SUPABASE_SERVICE_ROLE_KEY=\" substr(\$0, index(\$0, \"=\") + 1) }
  ' /opt/cureocity-dev/supabase/.env" > "$environment_file"

if [[ "$(wc -l < "$environment_file" | tr -d ' ')" != "2" ]]; then
  echo "Development keys could not be retrieved safely." >&2
  exit 1
fi

{
  printf '%s\n' 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321'
  cat "$environment_file"
  printf '%s\n' \
    'BILLING_ATOMIC_RPC_ENABLED=false' \
    'PAYMENT_PROVIDER=' \
    'HEALTH_COACH_COPILOT_ENABLED=false' \
    'TZ=Asia/Kolkata' \
    'NEXT_PUBLIC_APP_URL=http://localhost:3000'
} > "$destination"
chmod 600 "$destination"

echo "Created $destination for the isolated Development stack."
echo "No Production credentials were copied."
