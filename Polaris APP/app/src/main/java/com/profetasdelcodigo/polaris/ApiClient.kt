package com.profetasdelcodigo.polaris

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
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

@Serializable
data class ConversationSummary(
    val id: String,
    val title: String? = null,
    val created_at: String,
    val updated_at: String
)

@Serializable
data class ApiMessage(
    val id: String,
    val conversation_id: String,
    val role: String,
    val content: String,
    val created_at: String
)

@Serializable
data class MemoryRecord(
    val id: String,
    val category: String,
    val content: String,
    val importance: Int,
    val source: String = "manual",
    val created_at: String,
    val updated_at: String
)

@Serializable
data class CreateMemoryRequest(
    val content: String,
    val category: String = "CONTEXT",
    val importance: Int = 3
)

class PolarisApiClient(private val supabase: SupabaseClient) {
    private val client = HttpClient(Android) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    private fun baseUrl(): String = BuildConfig.POLARIS_API_URL.trimEnd('/')

    private fun authBuilder(): io.ktor.client.request.HttpRequestBuilder {
        return io.ktor.client.request.HttpRequestBuilder()
    }

    private suspend fun token(): String {
        return supabase.auth.currentSessionOrNull()?.accessToken
            ?: error("Tu sesión de Polaris no está disponible.")
    }

    private suspend fun configure(builder: io.ktor.client.request.HttpRequestBuilder) {
        builder.header(HttpHeaders.Authorization, "Bearer " + token())
    }

    suspend fun chat(content: String, conversationId: String?): ChatResponse {
        return client.post(baseUrl() + "/v1/chat") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(ChatRequest(conversationId, content))
        }.body()
    }

    suspend fun listConversations(): List<ConversationSummary> {
        return client.get(baseUrl() + "/v1/conversations") {
            configure(this)
        }.body()
    }

    suspend fun listMessages(conversationId: String): List<ApiMessage> {
        return client.get(baseUrl() + "/v1/conversations/" + conversationId + "/messages") {
            configure(this)
        }.body()
    }

    suspend fun listMemories(): List<MemoryRecord> {
        return client.get(baseUrl() + "/v1/memories") {
            configure(this)
        }.body()
    }

    suspend fun createMemory(
        content: String,
        category: String = "CONTEXT",
        importance: Int = 3
    ): MemoryRecord {
        return client.post(baseUrl() + "/v1/memories") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(CreateMemoryRequest(content, category, importance))
        }.body()
    }

    suspend fun deleteMemory(id: String) {
        client.delete(baseUrl() + "/v1/memories/" + id) {
            configure(this)
        }
    }

    fun close() {
        client.close()
    }
}
