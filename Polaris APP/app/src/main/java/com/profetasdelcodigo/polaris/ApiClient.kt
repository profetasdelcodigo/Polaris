package com.profetasdelcodigo.polaris

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class ChatRequest(val conversationId: String? = null, val content: String)

@Serializable
data class ChatResponse(
    val conversationId: String,
    val userMessageId: String,
    val assistantMessageId: String,
    val content: String
)

class PolarisApiClient(private val supabase: SupabaseClient) {
    private val client = HttpClient(Android) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    suspend fun chat(content: String, conversationId: String?): ChatResponse {
        val session = supabase.auth.currentSessionOrNull()
            ?: error("Tu sesión de Polaris no está disponible.")
        return client.post(BuildConfig.POLARIS_API_URL + "/v1/chat") {
            contentType(ContentType.Application.Json)
            header(HttpHeaders.Authorization, "Bearer " + session.accessToken)
            setBody(ChatRequest(conversationId, content))
        }.body()
    }
}
