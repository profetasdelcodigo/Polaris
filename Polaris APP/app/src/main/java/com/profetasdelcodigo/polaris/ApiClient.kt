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
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject

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

@Serializable
data class RegisterDeviceRequest(
    val clientId: String,
    val name: String,
    val type: String,
    val platform: String,
    val status: String,
    val metadata: Map<String, String> = emptyMap()
)

@Serializable
data class DeviceRecord(
    val id: String,
    val client_id: String? = null,
    val name: String,
    val type: String,
    val platform: String,
    val status: String,
    val last_seen: String? = null
)

@Serializable
data class SkillExecutionTarget(
    val id: String,
    val name: String,
    val type: String,
    val status: String
)

@Serializable
data class SkillExecutionResponse(
    val queued: Boolean,
    val runtime: String,
    val fingerprint: String,
    val target: SkillExecutionTarget,
    val command: RelayCommandRecord
)
@Serializable
data class RelayCommandRecord(
    val id: String,
    val target_device_id: String,
    val capability_id: String,
    val action: String,
    val payload: Map<String, JsonElement> = emptyMap(),
    val status: String,
    val requires_confirmation: Boolean,
    val error_message: String? = null
)

class PolarisApiClient(
    private val supabase: SupabaseClient,
    private val clientId: String? = null
) {
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

    suspend fun registerAndroidDevice(): String {
        val id = requireNotNull(clientId) { "Falta clientId de Android." }
        return client.post(baseUrl() + "/v1/devices") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(
                RegisterDeviceRequest(
                    clientId = id,
                    name = "Polaris Android",
                    type = "ANDROID",
                    platform = "Android",
                    status = "ONLINE",
                    metadata = mapOf("client" to "android", "version" to BuildConfig.VERSION_NAME)
                )
            )
        }.body<DeviceRecord>().id
    }

    suspend fun listPendingRelayCommands(deviceId: String): List<RelayCommandRecord> {
        return client.get(
            baseUrl() + "/v1/relay/commands?targetDeviceId=" +
                java.net.URLEncoder.encode(deviceId, "UTF-8")
        ) {
            configure(this)
        }.body()
    }

    suspend fun claimRelayCommand(commandId: String, deviceId: String): RelayCommandRecord {
        return client.post(baseUrl() + "/v1/relay/commands/" + commandId + "/claim") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject { put("targetDeviceId", kotlinx.serialization.json.JsonPrimitive(deviceId)) })
        }.body()
    }

    suspend fun updateRelayCommand(
        commandId: String,
        status: String,
        result: Map<String, JsonElement> = emptyMap(),
        errorMessage: String? = null
    ): RelayCommandRecord {
        return client.patch(baseUrl() + "/v1/relay/commands/" + commandId) {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(
                buildJsonObject {
                    put("status", kotlinx.serialization.json.JsonPrimitive(status))
                    put("result", kotlinx.serialization.json.JsonObject(result))
                    if (errorMessage != null) put("errorMessage", kotlinx.serialization.json.JsonPrimitive(errorMessage))
                }
            )
        }.body()
    }

    suspend fun getDeviceFabricProtocols(): JsonElement {
        return client.get(baseUrl() + "/v1/devices/fabric/protocols") {
            configure(this)
        }.body()
    }

    suspend fun executeDeviceCommand(
        targetDeviceId: String,
        device: JsonElement,
        action: String,
        value: JsonElement? = null,
        confirmed: Boolean = false
    ): JsonElement {
        return client.post(baseUrl() + "/v1/devices/fabric/execute") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(
                buildJsonObject {
                    put("targetDeviceId", kotlinx.serialization.json.JsonPrimitive(targetDeviceId))
                    put("device", device)
                    put("action", kotlinx.serialization.json.JsonPrimitive(action))
                    if (value != null) put("value", value)
                    put("confirmed", kotlinx.serialization.json.JsonPrimitive(confirmed))
                }
            )
        }.body()
    }

    suspend fun executeSkill(
        task: String,
        preferredDevice: String? = null,
        targetDeviceId: String? = null
    ): SkillExecutionResponse {
        return client.post(baseUrl() + "/v1/skills/execute") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(
                buildJsonObject {
                    put("task", kotlinx.serialization.json.JsonPrimitive(task))
                    if (preferredDevice != null) put("preferredDevice", kotlinx.serialization.json.JsonPrimitive(preferredDevice))
                    if (targetDeviceId != null) put("targetDeviceId", kotlinx.serialization.json.JsonPrimitive(targetDeviceId))
                    put("requireConfirmation", kotlinx.serialization.json.JsonPrimitive(false))
                }
            )
        }.body()
    }

    suspend fun getExperienceBrief(task: String, preferredMode: String? = null): JsonElement {
        return client.post(baseUrl() + "/v1/experience/brief") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("task", kotlinx.serialization.json.JsonPrimitive(task))
                if (preferredMode != null) put("preferredMode", kotlinx.serialization.json.JsonPrimitive(preferredMode))
            })
        }.body()
    }

    suspend fun resolveDevice(query: String): JsonElement {
        return client.post(baseUrl() + "/v1/devices/resolve") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject { put("query", kotlinx.serialization.json.JsonPrimitive(query)) })
        }.body()
    }

    suspend fun compileScene(scene: JsonElement): JsonElement {
        return client.post(baseUrl() + "/v1/automation/scene/compile") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(scene)
        }.body()
    }

    suspend fun designSkill(task: String): JsonElement {
        return client.post(baseUrl() + "/v1/skills/studio") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject { put("task", kotlinx.serialization.json.JsonPrimitive(task)) })
        }.body()
    }

    suspend fun getOrbitVisual(mode: String, state: String): JsonElement {
        return client.post(baseUrl() + "/v1/visuals/orbit") {
            configure(this)
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("mode", kotlinx.serialization.json.JsonPrimitive(mode))
                put("state", kotlinx.serialization.json.JsonPrimitive(state))
            })
        }.body()
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
