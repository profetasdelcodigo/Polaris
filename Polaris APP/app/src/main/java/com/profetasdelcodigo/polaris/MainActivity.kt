package com.profetasdelcodigo.polaris

import android.app.role.RoleManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
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
import androidx.compose.foundation.layout.weight
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

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

    private val assistantRoleLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            assistantRoleEnabled = isDefaultAssistant()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        assistantRoleEnabled = isDefaultAssistant()
        setContent {
            PolarisApp(
                assistantRoleEnabled = assistantRoleEnabled,
                onRequestAssistantRole = ::requestAssistantRole
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
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val roleManager = getSystemService(RoleManager::class.java) ?: return
        if (!roleManager.isRoleAvailable(RoleManager.ROLE_ASSISTANT)) return
        assistantRoleLauncher.launch(roleManager.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT))
    }
}

@Composable
private fun PolarisApp(
    assistantRoleEnabled: Boolean,
    onRequestAssistantRole: () -> Unit
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
                    onRequestAssistantRole = onRequestAssistantRole
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
    onRequestAssistantRole: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val supabase = remember { SupabaseProvider.client }
    var authenticated by remember { mutableStateOf(supabase.auth.currentSessionOrNull() != null) }

    if (authenticated) {
        HomeScreen(
            assistantRoleEnabled = assistantRoleEnabled,
            onRequestAssistantRole = onRequestAssistantRole,
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

@Composable
private fun HomeScreen(
    assistantRoleEnabled: Boolean,
    onRequestAssistantRole: () -> Unit,
    onSignOut: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val supabase = remember { SupabaseProvider.client }
    val api = remember { PolarisApiClient(supabase) }
    var draft by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var conversationId by remember { mutableStateOf<String?>(null) }
    var messages by remember {
        mutableStateOf(listOf(ChatItem("assistant", "Hola. Soy Polaris. El cliente Android ya está conectado a tu mismo Core.")))
    }

    Column(
        modifier = Modifier.fillMaxSize().background(PolarisMidnight)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text("POLARIS", fontWeight = FontWeight.Bold)
                Text("Core conectado", color = PolarisMint, style = MaterialTheme.typography.labelSmall)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!assistantRoleEnabled) {
                    TextButton(onClick = onRequestAssistantRole) {
                        Text("Usar como asistente")
                    }
                } else {
                    Text("Asistente activo", color = PolarisMint, style = MaterialTheme.typography.labelMedium)
                }
                TextButton(onClick = onSignOut) { Text("Salir") }
            }
        }

        PolarisMascotMini(
            active = busy,
            modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp)
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
            error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
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
                onClick = {
                    val content = draft.trim()
                    draft = ""
                    error = null
                    messages = messages + ChatItem("user", content)
                    busy = true
                    scope.launch {
                        try {
                            val result = api.chat(content, conversationId)
                            conversationId = result.conversationId
                            messages = messages + ChatItem("assistant", result.content)
                        } catch (t: Throwable) {
                            error = t.message ?: "No fue posible contactar con Polaris API."
                        } finally {
                            busy = false
                        }
                    }
                }
            ) {
                Text(if (busy) "…" else "Enviar")
            }
        }
    }
}
