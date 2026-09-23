import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.profetasdelcodigo.polaris"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.profetasdelcodigo.polaris"
        minSdk = 26
        targetSdk = 36
        versionCode = 10
        versionName = "0.9.1"

        val supabaseUrl = providers.gradleProperty("POLARIS_SUPABASE_URL").orNull.orEmpty()
        val supabaseKey = providers.gradleProperty("POLARIS_SUPABASE_PUBLISHABLE_KEY").orNull.orEmpty()
        val apiUrl = providers.gradleProperty("POLARIS_API_URL").orNull ?: "http://10.0.2.2:8787"

        buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"$supabaseKey\"")
        buildConfigField("String", "POLARIS_API_URL", "\"$apiUrl\"")
    }

    signingConfigs {
        create("ciRelease") {
            val storeFilePath = providers.gradleProperty("POLARIS_SIGNING_STORE_FILE").orNull
            if (storeFilePath != null) {
                storeFile = rootProject.file(storeFilePath)
                storePassword = providers.gradleProperty("POLARIS_SIGNING_STORE_PASSWORD").orNull
                keyAlias = providers.gradleProperty("POLARIS_SIGNING_KEY_ALIAS").orNull
                keyPassword = providers.gradleProperty("POLARIS_SIGNING_KEY_PASSWORD").orNull
            }
        }
    }

    buildTypes {
        release {
            val ciStore = providers.gradleProperty("POLARIS_SIGNING_STORE_FILE").orNull
            if (ciStore != null) {
                signingConfig = signingConfigs.getByName("ciRelease")
            }
            isDebuggable = false
        }
        debug {
            isDebuggable = true
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation(platform("io.github.jan-tennert.supabase:bom:3.2.6"))
    implementation("io.github.jan-tennert.supabase:auth-kt")

    implementation("io.ktor:ktor-client-android:3.3.0")
    implementation("io.ktor:ktor-client-content-negotiation:3.3.0")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.3.0")
}
