package com.profetasdelcodigo.polaris

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private data class ChatItem(val role: String, val content: String)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { PolarisApp() }
    }
}

@Composable
private fun PolarisApp() {
    MaterialTheme(
        colorScheme = androidx.compose.material3.darkColorScheme(
            background = Color(0xFF080A10),
            surface = Color(0xFF10131C),
            primary = Color(0xFFBFD3FF)
        )
    ) {
        Surface(modifier = Modifier.fillMaxSize()) {
            if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_PUBLISHABLE_KEY.isBlank()) {
                ConfigurationScreen()
            } else {
                AuthenticatedShell()
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
private fun AuthenticatedShell() {
    val scope = rememberCoroutineScope()
    val supabase = remember { SupabaseProvider.client }
    var authenticated by remember { mutableStateOf(supabase.auth.currentSessionOrNull() != null) }

    if (authenticated) {
        HomeScreen(
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
private fun HomeScreen(onSignOut: () -> Unit) {
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
        modifier = Modifier.fillMaxSize().background(Color(0xFF080A10))
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text("POLARIS", fontWeight = FontWeight.Bold)
                Text("Core conectado", color = Color(0xFF8DE0A7), style = MaterialTheme.typography.labelSmall)
            }
            TextButton(onClick = onSignOut) { Text("Salir") }
        }

        LazyColumn(
            modifier = Modifier.weight(1f).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(messages) { message ->
                Surface(
                    color = if (message.role == "user") Color(0xFF172033) else Color(0xFF111720),
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
