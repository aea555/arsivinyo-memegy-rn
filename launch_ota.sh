# Use first argument as message, fallback if empty
MESSAGE="${1:-No message}"

eas update --channel production --message "$MESSAGE"