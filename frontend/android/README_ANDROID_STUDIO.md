# ChargeGuard AI Pro — Android Studio Project & Publishing Guide

This directory contains the production-ready **Native Android Studio Project** for **ChargeGuard AI Pro**, packaged with the complete compiled UI assets, machine learning telemetry interfaces, and hardware bridge connectors.

---

## 📱 Project Specifications

| Property | Value |
| :--- | :--- |
| **Application Name** | ChargeGuard AI Pro |
| **Package Name / Application ID** | `io.chargeguard.app` |
| **Minimum SDK** | Android 7.0 (API Level 24) |
| **Target SDK / Compile SDK** | Android 14 / 15 (API Level 34 / 35) |
| **Gradle Version** | 8.14.3 |
| **Architecture** | Native Android Wrapper with Embedded High-Performance Web Engine |
| **Cleartext HTTP** | Enabled (`android:usesCleartextTraffic="true"` for local IP test servers) |

---

## 🚀 How to Open in Android Studio

1. **Launch Android Studio**.
2. Click **File** ➔ **Open...** (or select **Open** on the Welcome screen).
3. Navigate to and select this folder (`chargeguard-ai-pro-android` or `frontend/android`).
4. Click **OK**.
5. Android Studio will open the project and automatically start the **Gradle Sync**.
6. Wait for the sync to finish:
   - *"Gradle build finished in ... seconds"*

---

## 🧪 Running on Emulator or Physical Android Phone

### On a Physical Device via USB:
1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect your phone via USB cable to your PC.
3. Select your device from the target device dropdown at the top of Android Studio.
4. Click the green **Run 'app'** button (`Shift + F10` or the Play icon).

### On an Android Virtual Device (AVD Emulator):
1. In Android Studio, open **Device Manager** (`Tools` ➔ `Device Manager`).
2. Start any Pixel emulator with API 30, 33, or 34.
3. Click the green **Run 'app'** button.

---

## 📦 How to Build and Publish the App

### Option A: Generate Debug APK (For Immediate Direct Sideloading / Testing)
1. In Android Studio, click **Build** in the top menu.
2. Select **Build Bundle(s) / APK(s)** ➔ **Build APK(s)**.
3. Once completed, click the **locate** popup link.
4. Your APK will be at:
   ```text
   app/build/outputs/apk/debug/app-debug.apk
   ```
5. Transfer this `.apk` to any Android device to install and test immediately!

---

### Option B: Generate Signed Bundle (.aab) for Google Play Console

To publish on Google Play Store:
1. In Android Studio menu, click **Build** ➔ **Generate Signed Bundle / APK...**.
2. Select **Android App Bundle** (required by Google Play Store for new apps) and click **Next**.
3. **Key store path**:
   - If you have an existing keystore, click *Choose existing...*
   - If this is your first release, click **Create new...**:
     - Key store path: Save a `.jks` file (e.g. `chargeguard-release-key.jks`)
     - Enter and confirm a secure password.
     - Key Alias: `chargeguard`
     - Enter your Name / Organization.
     - Click **OK**.
4. Check **Remember passwords** and click **Next**.
5. Select destination folder and choose **release** build variant.
6. Click **Finish**.
7. Android Studio will generate the signed bundle:
   ```text
   app/release/app-release.aab
   ```
8. Log in to your **Google Play Console** (`play.google.com/console`), create an app, upload `app-release.aab`, fill in store listings, and publish!

---

## 🌐 Connecting to the Backend Server

The Android app communicates with the ChargeGuard AI Pro FastAPI backend server.

- **Local Machine Testing (Emulator)**:
  - Inside the Android emulator, use `http://10.0.2.2:8000` to refer to your PC's `localhost:8000`.
- **Physical Phone on the Same Wi-Fi Network**:
  - Find your PC's local IP address (e.g., `192.168.1.50`).
  - Ensure the FastAPI backend is running with `--host 0.0.0.0` or `--host 192.168.1.50`.
  - The app will automatically connect to `http://<your-pc-ip>:8000/api`.
- **Production Cloud Deployment**:
  - Deploy the FastAPI backend on your server, Google Cloud, or VPS with HTTPS, and the Android app connects directly without any configuration changes.

---

## 🛡️ Sensor & Hardware Support
- Real-time ESP32 hardware telemetry streaming over WebSocket (`ws://` / `wss://`).
- Automatic fallback to empirical screening physics when hardware is offline.
- Offline buffering and local state caching.
