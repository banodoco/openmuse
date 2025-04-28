#!/bin/bash

# Default number of days
DAYS=5

# Check if a command-line argument is provided
if [ "$1" != "" ]; then
  # Validate if the argument is a positive integer
  if [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -gt 0 ]; then
    DAYS=$1
  else
    echo "Usage: $0 [number_of_days]"
    echo "Please provide a positive integer for the number of days."
    exit 1
  fi
fi

# Output file
OUTPUT_FILE="pushes.md"

# Get the date X days ago
SINCE_DATE=$(date -v-${DAYS}d '+%Y-%m-%d')

echo "Fetching commits and diffs from the last $DAYS days (since $SINCE_DATE)..."

# Get commit hashes in chronological order (oldest first)
COMMIT_HASHES=$(git log --reverse --since="$SINCE_DATE" --pretty=format:'%H')

# Check if any commits were found
if [ -z "$COMMIT_HASHES" ]; then
  echo "# Recent Pushes (Last $DAYS Days)" > "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "No commits found in the last $DAYS days." >> "$OUTPUT_FILE"
  echo "No commits found in the last $DAYS days. '$OUTPUT_FILE' created with a message."
  exit 0
fi

# Write the header to the output file
echo "# Recent Pushes (Last $DAYS Days)" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Process commits in chronological order
echo "$COMMIT_HASHES" | while IFS= read -r HASH; do
  echo "Processing commit $HASH..."
  # Append commit metadata and separator
  git show -s --pretty='format:---%n**Commit:** `%h`%n**Author:** %an%n**Date:** %ad%n**Message:** %s%n' --date=short "$HASH" >> "$OUTPUT_FILE"
  # Append diff in a code block
  echo '```diff' >> "$OUTPUT_FILE"
  # Use git show without the commit header (-s) but with the patch (-p or default)
  # Redirect stderr to /dev/null to avoid cluttering the output file if a diff is binary/unsupported
  git show --pretty=format:'' "$HASH" >> "$OUTPUT_FILE" 2>/dev/null
  echo '```' >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

echo "Successfully generated '$OUTPUT_FILE' with commit details and diffs from the last $DAYS days."

exit 0 