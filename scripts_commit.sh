#!/usr/bin/env bash
# usage: ./scripts_commit.sh "message"   — bumps v0.1.N, commits, pushes
set -e
cd "$(dirname "$0")"
cur=$(node -p "require('./package.json').version")
IFS=. read -r a b c <<<"$cur"
new="$a.$b.$((c+1))"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='$new';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
git add -A
git commit -q -m "v$new — $1

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URpNaESM75J54XSi8ynaog"
for i in 1 2 3 4 5; do git push -q -u origin main && break || sleep $((2**i)); done
echo "committed v$new"
