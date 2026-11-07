plugins { id("com.android.application") }

android {
    namespace = "com.almasry.elec"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.almasry.elec"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }
    // Fixed test key so every CI build installs over the previous one. Not for Play Store.
    signingConfigs {
        getByName("debug") {
            storeFile = file("elec-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
