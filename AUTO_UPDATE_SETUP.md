# Auto-Update Setup Guide

This guide explains how to set up automatic updates for your Electron application.

## Prerequisites

1. **GitHub Repository**: You need a GitHub repository to host your releases
2. **GitHub Token**: A personal access token with repo permissions

## Setup Steps

### 1. Update package.json

Replace the placeholder values in your `package.json`:

```json
"publish": [
  {
    "provider": "github",
    "owner": "YOUR_GITHUB_USERNAME",
    "repo": "YOUR_REPO_NAME"
  }
]
```

### 2. Set up GitHub Releases

1. Create a new release on GitHub
2. Upload your built application files
3. Tag the release with a version number (e.g., `v1.0.1`)

### 3. Build and Publish

```bash
# Build the application
npm run build

# Publish to GitHub (this will create a release)
npm run publish
```

### 4. Environment Variables (Optional)

For private repositories, you may need to set:
- `GH_TOKEN`: Your GitHub personal access token

## How It Works

1. **Check for Updates**: Users click the "Check for Update" button
2. **Download**: If an update is available, it downloads automatically
3. **Install**: The app installs the update and restarts
4. **No Update**: Shows "Latest version already installed" message

## Testing

1. Build and publish version 1.0.0
2. Update version to 1.0.1 in package.json
3. Build and publish version 1.0.1
4. Run version 1.0.0 and test the update button

## Troubleshooting

- **No updates found**: Check that your GitHub repository and release are public
- **Download errors**: Verify your internet connection and GitHub access
- **Installation fails**: Ensure the app has write permissions to its directory

## Notes

- Updates only work for installed applications (not portable versions)
- The app must be signed for macOS updates
- Windows updates require proper code signing for production use 