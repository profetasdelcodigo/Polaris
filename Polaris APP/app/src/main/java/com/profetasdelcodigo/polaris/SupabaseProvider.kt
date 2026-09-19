package com.profetasdelcodigo.polaris

import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient

object SupabaseProvider {
    val client by lazy {
        require(BuildConfig.SUPABASE_URL.isNotBlank()) { "Configura POLARIS_SUPABASE_URL en Gradle properties." }
        require(BuildConfig.SUPABASE_PUBLISHABLE_KEY.isNotBlank()) { "Configura POLARIS_SUPABASE_PUBLISHABLE_KEY en Gradle properties." }
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
        ) {
            install(Auth) { alwaysAutoRefresh = true }
        }
    }
}
