#!/bin/sh
# Regia Tempi - server locale (doppio clic su Mac)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js non è installato: scaricalo da https://nodejs.org (versione LTS) e riprova."
  read -r _
  exit 1
fi
node regia-server.js
