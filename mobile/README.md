# Pulse# PulseExpends Mobile

Family Expense Management Application - React Native with Expo

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm! run ios
```

## Environment Configuration

Set the following in `app.json` under `expo.extra`:

- `apiBaseUrl`: Backend API base URL
- `googleWebClientId`: Google OAuth2 Web Client ID

## Building

```bash
# Build for Android (EAS)
eas build --platform android

# Build for iOS (EAS)
eas build --platform ios
```

## Project Structure

```
mobile/
├── src/
│   ├── types/          # TypeScript type definitions
│   ├── constants/      # Colors, currencies, categories, config
│   ├── store/          # Zustand state management
│   ├── api/            # API client and endpoint modules
│   ├── services/       # Platform services (auth, notifications, regex)
│   ├── context/        # React Context providers
│   ├── navigation/     # React Navigation setup
│   ├── screens/        # Screen components
│   │   ├── auth/       # Login, Register
│   │   ├── main/       # Dashboard, QuickEntry, Transactions, Cards, Profile
│   │   ├── notifications/ # NotificationSettings, PendingList
│   │   ├── cards/      # StatementUpload, StatementPreview
│   │   └── circle/     # Circle management
│   ├── components/     # Reusable UI components
│   └── utils/          # Formatting, validation, date utilities
├── android/            # Android native code (NotificationListenerService)
└── assets/             # Static assets
```