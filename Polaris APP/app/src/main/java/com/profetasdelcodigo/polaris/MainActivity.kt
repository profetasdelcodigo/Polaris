package com.profetasdelcodigo.polaris

import android.Manifest
import android.app.role.RoleManager
import android.content.Intent
import android.provider.Settings
import android.os.Build
import android.os.Bundle
import java.util.UUID
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.intOrNull


private suspend fun executeAndroidSkill(
    context: android.content.Context,
    program: JsonElement
): LocalAutomationResult {
    val root = program.jsonObject
    val steps = root["steps"]?.jsonArray
        ?: return LocalAutomationResult(false, "La Skill no contiene pasos.")

    var completed = 0
    for (step in steps) {
        val action = step.jsonObject["action"]?.jsonPrimitive?.contentOrNull
            ?: return LocalAutomationResult(false, "La Skill contiene un paso sin acción.")

        val result = when (action) {
            "open_url" -> {
                val url = step.jsonObject["url"]?.jsonPrimitive?.contentOrNull
                if (url.isNullOrBlank() || !(url.startsWith("https://") || url.startsWith("http://"))) {
                    LocalAutomationResult(false, "La URL de la Skill no es segura.")
                } else {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                        LocalAutomationResult(true, "Abrí la URL solicitada.")
                    } catch (_: Throwable) {
                        LocalAutomationResult(false, "Android no pudo abrir la URL.")
                    }
                }
            }
            "copy_text" -> {
                val value = step.jsonObject["text"]?.jsonPrimitive?.contentOrNull
                if (value == null || value.length > 20_000) LocalAutomationResult(false, "El texto para copiar no es válido.")
                else {
                    val clipboard = context.getSystemService(android.content.ClipboardManager::class.java)
                    clipboard?.setPrimaryClip(android.content.ClipData.newPlainText("Polaris", value))
                    LocalAutomationResult(true, "Texto copiado al portapapeles.")
                }
            }
            "scroll_top" -> PolarisAccessibilityService.execute(LocalAutomationAction.SCROLL_UP)
            "scroll_bottom" -> PolarisAccessibilityService.execute(LocalAutomationAction.SCROLL_DOWN)
            "system_info" -> LocalAutomationResult(true, "Android ${Build.VERSION.RELEASE} · ${Build.MANUFACTURER} ${Build.MODEL}", "Información del sistema obtenida localmente.")
            "wait" -> {
                val ms = step.jsonObject["ms"]?.jsonPrimitive?.intOrNull ?: 0
                delay(ms.coerceIn(0, 10_000).toLong())
                LocalAutomationResult(true, "Espera completada.")
            }
            "focus_chat", "reveal_path" -> LocalAutomationResult(false, "La acción $action no está disponible en Android.")
            else -> LocalAutomationResult(false, "Acción de Skill no soportada en Android: $action")
        }

        if (!result.success) return result
        completed++
    }

    return LocalAutomationResult(true, "Skill ejecutada en Android: $completed pasos.", "Todos los pasos permitidos finalizaron correctamente.")
}
private val PolarisMidnight = Color(0xFF070B14)
private val PolarisSurface = Color(0xFF0D1422)
private val PolarisSurface2 = Color(0xFF111B2C)
private val PolarisCyan = Color(0xFF5DE6FF)
private val PolarisBlue = Color(0xFF79A9FF)
private val PolarisViolet = Color(0xFF9B82FF)
private val PolarisMint = Color(0xFF6FF1C1)

private data class ChatItem(val role: String, val content: String)

class MainActivity : ComponentActivity() {
    private var assistantRoleEnabled by mutableStateOf(false)

    private val microphonePermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val assistantRoleLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            assistantRoleEnabled = isDefaultAssistant()
            if (assistantRoleEnabled) requestMicrophonePermission()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        assistantRoleEnabled = isDefaultAssistant()
        setContent {
            PolarisApp(
                assistantRoleEnabled = assistantRoleEnabled,
                onRequestAssistantRole = ::requestAssistantRole,
                onOpenAutomationSettings = ::openAutomationSettings
            )
        }
    }

    override fun onResume() {
        super.onResume()
        assistantRoleEnabled = isDefaultAssistant()
    }

    private fun isDefaultAssistant(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
        val roleManager = getSystemService(RoleManager::class.java) ?: return false
        return roleManager.isRoleAvailable(RoleManager.ROLE_ASSISTANT) &&
            roleManager.isRoleHeld(RoleManager.ROLE_ASSISTANT)
    }

    private fun requestAssistantRole() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            requestMicrophonePermission()
            return
        }
        val roleManager = getSystemService(RoleManager::class.java) ?: return
        if (!roleManager.isRoleAvailable(RoleManager.ROLE_ASSISTANT)) {
            requestMicrophonePermission()
            return
        }
        if (roleManager.isRoleHeld(RoleManager.ROLE_ASSISTANT)) {
            requestMicrophonePermission()
            return
        }
        assistantRoleLauncher.launch(roleManager.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT))
    }

    private fun openAutomationSettings() {
        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    private fun requestMicrophonePermission() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }
}

@Composable
private fun PolarisApp(
    assistantRoleEnabled: Boolean,
    onRequestAssistantRole: () -> Unit,
    onOpenAutomationSettings: () -> Unit
) {
    MaterialTheme(
        colorScheme = androidx.compose.material3.darkColorScheme(
            background = PolarisMidnight,
            surface = PolarisSurface,
            surfaceVariant = PolarisSurface2,
            primary = PolarisCyan,
            secondary = PolarisViolet,
            tertiary = PolarisMint
        )
    ) {
        Surface(modifier = Modifier.fillMaxSize()) {
            if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_PUBLISHABLE_KEY.isBlank()) {
                ConfigurationScreen()
            } else {
                AuthenticatedShell(
                    assistantRoleEnabled = assistantRoleEnabled,
                    onRequestAssistantRole = onRequestAssistantRole,
                    onOpenAutomationSettings = onOpenAutomationSettings
                )
            }
        }
    }
}

@Composable
private fun ConfigurationScreen() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("✦ POLARIS", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text("La aplicación Android ya está preparada, pero necesita la publishable key de Supabase.")
        Spacer(Modifier.height(12.dp))
        Text("Configura POLARIS_SUPABASE_PUBLISHABLE_KEY en gradle.properties y vuelve a ejecutar Android Studio.")
    }
}

@Composable
private fun AuthenticatedShell(
    assistantRoleEnabled: Boolean,
    onRequestAssistantRole: () -> Unit,
    onOpenAutomationSettings: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val supabase = remember { SupabaseProvider.client }
    var authenticated by remember { mutableStateOf(supabase.auth.currentSessionOrNull() != null) }

    if (authenticated) {
        HomeScreen(
            assistantRoleEnabled = assistantRoleEnabled,
            onRequestAssistantRole = onRequestAssistantRole,
            onOpenAutomationSettings = onOpenAutomationSettings,
            onSignOut = {
                scope.launch {
                    supabase.auth.signOut()
                    authenticated = false
                }
            }
        )
    } else {
        AuthScreen(onAuthenticated = { authenticated = true })
    }
}

@Composable
private fun AuthScreen(onAuthenticated: () -> Unit) {
    val scope = rememberCoroutineScope()
    val supabase = remember { SupabaseProvider.client }
    var signUp by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("✦ POLARIS", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(if (signUp) "Una identidad para Web, Android y PC." else "Un asistente. Una memoria. Un norte.")
        Spacer(Modifier.height(24.dp))

        if (signUp) {
            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Nombre") },
                singleLine = true
            )
            Spacer(Modifier.height(12.dp))
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Correo") },
            singleLine = true
        )
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Contraseña") },
            singleLine = true
        )

        Spacer(Modifier.height(12.dp))
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        info?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
        Spacer(Modifier.height(12.dp))

        Button(
            enabled = !busy && email.isNotBlank() && password.length >= 8,
            onClick = {
                busy = true
                error = null
                info = null
                scope.launch {
                    try {
                        if (signUp) {
                            supabase.auth.signUpWith(Email) {
                                this.email = email.trim()
                                this.password = password
                                if (displayName.isNotBlank()) {
                                    data = buildJsonObject {
                                        put("display_name", displayName.trim())
                                    }
                                }
                            }
                            if (supabase.auth.currentSessionOrNull() != null) {
                                onAuthenticated()
                            } else {
                                info = "Cuenta creada. Revisa tu correo si Supabase solicita confirmación."
                            }
                        } else {
                            supabase.auth.signInWith(Email) {
                                this.email = email.trim()
                                this.password = password
                            }
                            onAuthenticated()
                        }
                    } catch (t: Throwable) {
                        error = t.message ?: "No fue posible completar la autenticación."
                    } finally {
                        busy = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (busy) "Procesando…" else if (signUp) "Crear cuenta" else "Entrar")
        }

        TextButton(onClick = {
            signUp = !signUp
            error = null
            info = null
        }) {
            Text(if (signUp) "Ya tengo una cuenta" else "Crear una cuenta")
        }
    }
}

@Composable
private fun PolarisMascotMini(
    active: Boolean,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "polaris-mini")
    val floatOffset by transition.animateFloat(
        initialValue = 0f,
        targetValue = if (active) 5f else 2f,
        animationSpec = infiniteRepeatable(
            animation = tween(if (active) 750 else 1800),
            repeatMode = RepeatMode.Reverse
        ),
        label = "float"
    )
    val rotateY by transition.animateFloat(
        initialValue = -3f,
        targetValue = 3f,
        animationSpec = infiniteRepeatable(
            animation = tween(if (active) 700 else 2200),
            repeatMode = RepeatMode.Reverse
        ),
        label = "rotate"
    )

    Box(
        modifier = modifier
            .size(118.dp)
            .graphicsLayer {
                translationY = -floatOffset
                rotationY = rotateY
                cameraDistance = 18f * density
            }
            .shadow(18.dp, RoundedCornerShape(28.dp), clip = false),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .background(
                    Brush.radialGradient(
                        listOf(
                            PolarisCyan.copy(alpha = .22f),
                            PolarisViolet.copy(alpha = .10f),
                            Color.Transparent
                        )
                    ),
                    RoundedCornerShape(32.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .offset(y = (-12).dp)
                    .size(70.dp, 48.dp)
                    .shadow(8.dp, RoundedCornerShape(16.dp))
                    .background(
                        Brush.horizontalGradient(
                            listOf(PolarisCyan, PolarisBlue, PolarisViolet)
                        ),
                        RoundedCornerShape(16.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(9.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    repeat(2) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .background(Color.White, RoundedCornerShape(50))
                        )
                    }
                }
            }

            Box(
                modifier = Modifier
                    .offset(y = 22.dp)
                    .size(48.dp, 34.dp)
                    .shadow(7.dp, RoundedCornerShape(11.dp))
                    .background(
                        Brush.verticalGradient(
                            listOf(PolarisSurface2, PolarisMidnight)
                        ),
                        RoundedCornerShape(11.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(14.dp)
                        .background(PolarisCyan, RoundedCornerShape(50))
                )
            }

            Box(
                modifier = Modifier
                    .offset(y = (-39).dp)
                    .size(8.dp, 13.dp)
                    .background(PolarisCyan, RoundedCornerShape(6.dp))
            )
        }
    }
}

private enum class AndroidSection {
    CHAT,
    HISTORY,
    MEMORY
}

@Composable
private fun HomeScreen(
    assistantRoleEnabled: Boolean,
    onRequestAssistantRole: () -> Unit,
    onOpenAutomationSettings: () -> Unit,
    onSignOut: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val supabase = remember { SupabaseProvider.client }
    val androidClientId = remember {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?.takeIf { it.isNotBlank() }
            ?: UUID.randomUUID().toString()
    }
    val api = remember(androidClientId) { PolarisApiClient(supabase, androidClientId) }

    var section by remember { mutableStateOf(AndroidSection.CHAT) }
    var draft by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }

    var conversationId by remember { mutableStateOf<String?>(null) }
    var messages by remember {
        mutableStateOf(
            listOf(
                ChatItem(
                    "assistant",
                    "Hola. Soy Polaris. Ya estamos conectados al mismo Core."
                )
            )
        )
    }
    var conversations by remember { mutableStateOf<List<ConversationSummary>>(emptyList()) }
    var memories by remember { mutableStateOf<List<MemoryRecord>>(emptyList()) }
    var memoryDraft by remember { mutableStateOf("") }
    var memoryBusy by remember { mutableStateOf(false) }

    LaunchedEffect(api) {
        var deviceId: String? = null
        try {
            deviceId = api.registerAndroidDevice()
            while (true) {
                val target = deviceId ?: break
                val commands = api.listPendingRelayCommands(target)
                for (command in commands.take(3)) {
                    if (command.requires_confirmation) continue

                    val claimed = try {
                        api.claimRelayCommand(command.id, target)
                    } catch (_: Throwable) {
                        null
                    } ?: continue

                    try {
                        val action = when (claimed.action) {
                            "android.back" -> LocalAutomationAction.BACK
                            "android.home" -> LocalAutomationAction.HOME
                            "android.notifications" -> LocalAutomationAction.NOTIFICATIONS
                            "android.quick_settings" -> LocalAutomationAction.QUICK_SETTINGS
                            "android.recents" -> LocalAutomationAction.RECENTS
                            "android.open_settings" -> LocalAutomationAction.OPEN_SETTINGS
                            "android.open_wifi" -> LocalAutomationAction.OPEN_WIFI_SETTINGS
                            "android.open_bluetooth" -> LocalAutomationAction.OPEN_BLUETOOTH_SETTINGS
                            "android.open_display" -> LocalAutomationAction.OPEN_DISPLAY_SETTINGS
                            "android.open_sound" -> LocalAutomationAction.OPEN_SOUND_SETTINGS
                            "android.open_battery" -> LocalAutomationAction.OPEN_BATTERY_SETTINGS
                            "android.open_location" -> LocalAutomationAction.OPEN_LOCATION_SETTINGS
                            "android.open_notifications" -> LocalAutomationAction.OPEN_NOTIFICATION_SETTINGS
                            "android.open_accessibility" -> LocalAutomationAction.OPEN_ACCESSIBILITY_SETTINGS
                            "android.open_language" -> LocalAutomationAction.OPEN_LANGUAGE_SETTINGS
                            "android.open_input" -> LocalAutomationAction.OPEN_INPUT_SETTINGS
                            "android.describe_screen" -> LocalAutomationAction.DESCRIBE_SCREEN
                            "android.scroll_up" -> LocalAutomationAction.SCROLL_UP
                            "android.scroll_down" -> LocalAutomationAction.SCROLL_DOWN
                            "android.tap_text" -> {
                                val text = claimed.payload["text"]?.jsonPrimitive?.contentOrNull
                                if (text.isNullOrBlank()) {
                                    throw IllegalArgumentException("Falta el texto que se debe pulsar.")
                                }
                                LocalAutomationAction.TAP_TEXT(text)
                            }
                            else -> null
                        }

                        api.updateRelayCommand(claimed.id, "RUNNING")
                        val result = if (claimed.action == "android.run_skill") {
                            val program = claimed.payload["program"]
                                ?: throw IllegalArgumentException("Falta el programa de Skill.")
                            executeAndroidSkill(context, program)
                        } else {
                            PolarisAccessibilityService.execute(
                                action ?: throw IllegalArgumentException("Acción Android no soportada: " + claimed.action)
                            )
                        }
                        if (result.success) {
                            api.updateRelayCommand(
                                claimed.id,
                                "SUCCEEDED",
                                mapOf("message" to kotlinx.serialization.json.JsonPrimitive(result.message))
                            )
                        } else {
                            api.updateRelayCommand(
                                claimed.id,
                                "FAILED",
                                errorMessage = result.message
                            )
                        }
                    } catch (error: Throwable) {
                        api.updateRelayCommand(
                            claimed.id,
                            "FAILED",
                            errorMessage = error.message ?: "La ejecución remota falló."
                        )
                    }
                }
                delay(2500)
            }
        } catch (_: Throwable) {
            // Relay remoto es opcional; el resto de Polaris sigue funcionando.
        }
    }

    LaunchedEffect(section) {
        error = null
        when (section) {
            AndroidSection.HISTORY -> {
                loading = true
                try {
                    conversations = api.listConversations()
                } catch (t: Throwable) {
                    error = t.message ?: "No fue posible cargar el historial."
                } finally {
                    loading = false
                }
            }
            AndroidSection.MEMORY -> {
                loading = true
                try {
                    memories = api.listMemories()
                } catch (t: Throwable) {
                    error = t.message ?: "No fue posible cargar la memoria."
                } finally {
                    loading = false
                }
            }
            AndroidSection.CHAT -> Unit
        }
    }

    fun openConversation(id: String) {
        loading = true
        error = null
        scope.launch {
            try {
                val next = api.listMessages(id)
                conversationId = id
                messages = next.map { ChatItem(it.role, it.content) }
                section = AndroidSection.CHAT
            } catch (t: Throwable) {
                error = t.message ?: "No fue posible abrir la conversación."
            } finally {
                loading = false
            }
        }
    }

    fun sendMessage(content: String) {
        val clean = content.trim()
        if (clean.isBlank() || busy) return

        draft = ""
        error = null
        messages = messages + ChatItem("user", clean)
        busy = true
        scope.launch {
            try {
                val skill = try { api.executeSkill(clean, preferredDevice = "ANDROID", targetDeviceId = deviceId) } catch (_: Throwable) { null }
                if (skill != null) {
                    messages = messages + ChatItem("assistant", "✓ Skill ${skill.fingerprint} enviada a ${skill.target.name}. Ejecutando pasos permitidos y verificando el resultado.")
                } else {
                    val localPlan = PolarisLocalAutomation.parsePlan(clean)
                    if (localPlan.isNotEmpty() && PolarisAccessibilityService.isEnabled()) {
                    val execution = PolarisLocalAutomation.executePlan(localPlan)
                    val summary = execution.joinToString("\\n") { step ->
                        (if (step.success) "✓ " else "⚠ ") + step.message
                    }
                    messages = messages + ChatItem("assistant", summary)
                    if (execution.any { !it.success }) {
                        error = "La automatización se detuvo al encontrar un paso que no pudo ejecutarse."
                    }
                    } else {
                        val result = api.chat(clean, conversationId)
                        conversationId = result.conversationId
                        messages = messages + ChatItem("assistant", result.content)
                    }
                }
            } catch (t: Throwable) {
                error = t.message ?: "No fue posible contactar con Polaris API."
            } finally {
                busy = false
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(PolarisMidnight)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("POLARIS", fontWeight = FontWeight.Bold)
                Text(
                    when (section) {
                        AndroidSection.CHAT -> "Asistente"
                        AndroidSection.HISTORY -> "Historial"
                        AndroidSection.MEMORY -> "Memoria"
                    },
                    color = PolarisMint,
                    style = MaterialTheme.typography.labelSmall
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!assistantRoleEnabled) {
                    TextButton(onClick = onRequestAssistantRole) {
                        Text("Usar como asistente")
                    }
                } else {
                    Text(
                        "Asistente activo",
                        color = PolarisMint,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
                TextButton(onClick = onOpenAutomationSettings) {
                    Text(if (PolarisAccessibilityService.isEnabled()) "Auto ✓" else "Auto")
                }
                TextButton(onClick = onSignOut) { Text("Salir") }
            }
        }

        when (section) {
            AndroidSection.CHAT -> {
                PolarisMascotMini(
                    active = busy,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(bottom = 8.dp)
                )

                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(messages) { message ->
                        Surface(
                            color = if (message.role == "user") PolarisSurface2 else Color(0xFF0B1220),
                            shape = MaterialTheme.shapes.large,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(message.content, modifier = Modifier.padding(14.dp))
                        }
                    }
                    error?.let {
                        item {
                            Text(it, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Habla con Polaris…") },
                        enabled = !busy
                    )
                    Button(
                        enabled = !busy && draft.isNotBlank(),
                        onClick = { sendMessage(draft) }
                    ) {
                        Text(if (busy) "…" else "Enviar")
                    }
                }
            }

            AndroidSection.HISTORY -> {
                if (loading) {
                    Box(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Cargando historial…", color = PolarisCyan)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (conversations.isEmpty()) {
                            item {
                                Surface(
                                    color = PolarisSurface,
                                    shape = RoundedCornerShape(22.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        "Todavía no hay conversaciones.",
                                        modifier = Modifier.padding(20.dp)
                                    )
                                }
                            }
                        }

                        items(conversations) { conversation ->
                            Surface(
                                color = PolarisSurface,
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                TextButton(
                                    onClick = { openConversation(conversation.id) },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier.fillMaxWidth().padding(6.dp)
                                    ) {
                                        Text(
                                            conversation.title ?: "Sin título",
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            conversation.updated_at.take(16).replace("T", " · "),
                                            color = PolarisBlue,
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                    }
                                }
                            }
                        }

                        error?.let {
                            item { Text(it, color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }

            AndroidSection.MEMORY -> {
                Column(
                    modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Surface(
                        color = PolarisSurface,
                        shape = RoundedCornerShape(22.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Guardar memoria", fontWeight = FontWeight.SemiBold)
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = memoryDraft,
                                onValueChange = { memoryDraft = it },
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = { Text("Ej.: Polaris es mi proyecto principal.") },
                                enabled = !memoryBusy
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                enabled = !memoryBusy && memoryDraft.isNotBlank(),
                                onClick = {
                                    val clean = memoryDraft.trim()
                                    memoryBusy = true
                                    error = null
                                    scope.launch {
                                        try {
                                            api.createMemory(clean)
                                            memoryDraft = ""
                                            memories = api.listMemories()
                                        } catch (t: Throwable) {
                                            error = t.message ?: "No se pudo guardar la memoria."
                                        } finally {
                                            memoryBusy = false
                                        }
                                    }
                                }
                            ) {
                                Text(if (memoryBusy) "Guardando…" else "Guardar")
                            }
                        }
                    }

                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (loading) {
                            item {
                                Text("Cargando memoria…", color = PolarisCyan)
                            }
                        }

                        if (!loading && memories.isEmpty()) {
                            item {
                                Text(
                                    "No hay memorias guardadas todavía.",
                                    color = PolarisBlue
                                )
                            }
                        }

                        items(memories) { memory ->
                            Surface(
                                color = PolarisSurface,
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(memory.content)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            memory.category,
                                            color = PolarisCyan,
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                        TextButton(
                                            onClick = {
                                                scope.launch {
                                                    try {
                                                        api.deleteMemory(memory.id)
                                                        memories = api.listMemories()
                                                    } catch (t: Throwable) {
                                                        error = t.message ?: "No se pudo eliminar la memoria."
                                                    }
                                                }
                                            }
                                        ) {
                                            Text("Eliminar")
                                        }
                                    }
                                }
                            }
                        }

                        error?.let {
                            item { Text(it, color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(PolarisSurface)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            AndroidNavButton(
                selected = section == AndroidSection.CHAT,
                label = "Polaris",
                onClick = { section = AndroidSection.CHAT }
            )
            AndroidNavButton(
                selected = section == AndroidSection.HISTORY,
                label = "Historial",
                onClick = { section = AndroidSection.HISTORY }
            )
            AndroidNavButton(
                selected = section == AndroidSection.MEMORY,
                label = "Memoria",
                onClick = { section = AndroidSection.MEMORY }
            )
        }
    }
}

@Composable
private fun AndroidNavButton(
    selected: Boolean,
    label: String,
    onClick: () -> Unit
) {
    TextButton(onClick = onClick) {
        Text(
            label,
            color = if (selected) PolarisCyan else PolarisBlue,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
        )
    }
}
