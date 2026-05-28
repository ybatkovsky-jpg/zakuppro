#!/bin/bash
cd /home/z/my-project
while true; do
  npx next dev -p 3000
  echo "Server died, restarting in 3 seconds..." >> /home/z/my-project/dev.log
  sleep 3
done
