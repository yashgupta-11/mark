#!/bin/bash

# Auto Release Script for Mark
# This script automatically creates GitHub releases and uploads DMG files

set -e

echo "🚀 Auto Release Script for Mark"
echo "================================"

# Configuration
REPO_OWNER="yashgupta-11"
REPO_NAME="mark"
VERSION="v0.9.1"
RELEASE_NAME="v0.9.1"
RELEASE_BODY="Full automatic updates! Download and install with just 2 clicks. Improved update system with progress bars."

# Check if files exist
if [ ! -f "dist/Mark-arm64.dmg" ] || [ ! -f "dist/Mark-x64.dmg" ]; then
    echo "❌ DMG files not found. Building them now..."
    npm run build-dmg
fi

echo "📁 Files to upload:"
ls -lh dist/*.dmg
echo ""

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "🔑 GitHub token needed for API access."
    echo ""
    echo "Please create a token at: https://github.com/settings/tokens"
    echo "Required permissions: repo (full control)"
    echo ""
    read -p "Enter your GitHub token: " GITHUB_TOKEN
    
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "❌ Token required. Exiting."
        exit 1
    fi
    
    # Save token for future use
    echo "export GITHUB_TOKEN=$GITHUB_TOKEN" >> ~/.zshrc
    echo "✅ Token saved to ~/.zshrc"
fi

echo "🔍 Checking if release exists..."

# Check if release already exists
RELEASE_ID=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/$VERSION" \
    | grep '"id"' | head -n 1 | cut -d ':' -f 2 | cut -d ',' -f 1 | tr -d ' ')

if [ ! -z "$RELEASE_ID" ] && [ "$RELEASE_ID" != "null" ]; then
    echo "🗑️ Release $VERSION already exists. Deleting it..."
    curl -s -X DELETE -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/$RELEASE_ID"
    echo "✅ Old release deleted"
fi

echo "📝 Creating new release..."

# Create release
RELEASE_RESPONSE=$(curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"tag_name\": \"$VERSION\",
        \"target_commitish\": \"main\",
        \"name\": \"$RELEASE_NAME\",
        \"body\": \"$RELEASE_BODY\",
        \"draft\": false,
        \"prerelease\": false
    }" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases")

# Extract release ID and upload URL
RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep '"id"' | head -n 1 | cut -d ':' -f 2 | cut -d ',' -f 1 | tr -d ' ')
UPLOAD_URL=$(echo "$RELEASE_RESPONSE" | grep '"upload_url"' | cut -d '"' -f 4 | cut -d '{' -f 1)

if [ -z "$RELEASE_ID" ] || [ "$RELEASE_ID" = "null" ]; then
    echo "❌ Failed to create release. Response:"
    echo "$RELEASE_RESPONSE"
    exit 1
fi

echo "✅ Release created with ID: $RELEASE_ID"
echo "📤 Uploading DMG files..."

# Upload ARM64 DMG
echo "   Uploading Mark-arm64.dmg..."
curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"dist/Mark-arm64.dmg" \
    "${UPLOAD_URL}?name=Mark-arm64.dmg&label=Mark-arm64.dmg" > /dev/null

echo "   ✅ Mark-arm64.dmg uploaded"

# Upload x64 DMG
echo "   Uploading Mark-x64.dmg..."
curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"dist/Mark-x64.dmg" \
    "${UPLOAD_URL}?name=Mark-x64.dmg&label=Mark-x64.dmg" > /dev/null

echo "   ✅ Mark-x64.dmg uploaded"

echo ""
echo "🎉 SUCCESS! Release created and files uploaded!"
echo ""
echo "🔗 View release: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/$VERSION"
echo ""
echo "💡 Users will now get automatic update notifications!"
echo "   They can download and install with just 2 clicks."
echo "" 