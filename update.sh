#!/bin/bash

if [ -z "$1" ]; then
  echo "请输入message ./update.sh [message]"
else
  if [ -z "$(git status --untracked-files=no --porcelain)" ]; then 
    echo "文件没有变化"
  else
    npm run build
    npm version patch
    git add .
    git commit -m "$1"
    npm publish
  fi
fi
