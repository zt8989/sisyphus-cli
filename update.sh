#!/bin/bash

if [ -z "$1" ]; then
  echo "请输入message ./update.sh [message]"
else
  if [[ `git status --porcelain` ]]; then
    npm run build
    npm version patch
    git add .
    git commit -m "$1"
    npm publish
  fi
fi
