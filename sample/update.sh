#!/bin/bash

if [ -z "$1" ]; then
  echo "请输入message ./update.sh [message]"
else
  sisyphus
  if [ -z "$(git status --untracked-files=no --porcelain)" ]; then 
    echo "文件没有变化"
  else
    git add .
    git commit -m "$1"
    npm run build
    npm version patch
    npm publish
  fi
fi
