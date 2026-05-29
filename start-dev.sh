#!/bin/bash
cd /home/z/my-project

# Start Telegram Bot mini-service in background
(
  cd /home/z/my-project/mini-services/telegram-bot
  while true; do
    bun index.ts
    echo "Telegram Bot service died, restarting in 3 seconds..." >> /home/z/my-project/dev.log
    sleep 3
  done
) &

# Start main Next.js dev server
while true; do
  npx next dev -p 3000
  echo "Server died, restarting in 3 seconds..." >> /home/z/my-project/dev.log
  sleep 3
done
