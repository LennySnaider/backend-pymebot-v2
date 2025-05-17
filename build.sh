#!/bin/bash
npm install
# Run with minimal type checking to focus on functionality
node -r esbuild-register src/app.ts