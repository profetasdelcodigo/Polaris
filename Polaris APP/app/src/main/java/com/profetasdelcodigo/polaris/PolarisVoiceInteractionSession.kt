package com.profetasdelcodigo.polaris

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.service.voice.VoiceInteractionSession
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
private data class AssistantChatRequest(
    val message: String,
    val conversationId: String? = null
)

@Serializable
private data class AssistantChatResponse(
    val conversationId: String,
    val content: String
)

/**
 * Floating Polaris assistant surface shown by the Android system assistant invocation.
 *
 * Text commands are sent to the same Polaris Core API used by the main Android client,
 * using the current Supabase session held by the app process.
 */
class PolarisVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {

    init {
        setTheme(com.profetasdelcodigo.polaris.R.style.Theme_Polaris_Assistant)
    }

    private val cyan = Color.rgb(93, 230, 255)
    private val violet = Color.rgb(155, 130, 255)
    private val midnight = Color.rgb(7, 11, 20)
    private val surface = Color.rgb(13, 20, 34)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val http = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    private var conversationId: String? = null
    private var speechRecognizer: SpeechRecognizer? = null

    override fun onCreateContentView(): View {
        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.BOTTOM
            setPadding(dp(18), dp(18), dp(18), dp(24))
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.argb(40, 7, 11, 20), Color.argb(235, 7, 11, 20))
            )
        }

        val sheet = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(18))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(surface, Color.rgb(17, 27, 44))
            ).apply {
                cornerRadius = dp(26).toFloat()
                setStroke(dp(1), Color.argb(55, 93, 230, 255))
            }
        }

        val mascot = TextView(context).apply {
            text = "✦"
            textSize = 34f
            gravity = Gravity.CENTER
            setTextColor(cyan)
            typeface = Typeface.DEFAULT_BOLD
            alpha = .78f
        }
        mascot.setOnClickListener {
            mascot.alpha = if (mascot.alpha < .9f) 1f else .72f
        }
        sheet.addView(mascot, LinearLayout.LayoutParams(dp(64), dp(64)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
        })

        val title = TextView(context).apply {
            text = "¿Qué hacemos?"
            textSize = 26f
            setTextColor(Color.rgb(236, 248, 255))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER_HORIZONTAL
        }
        sheet.addView(title, lp())

        val subtitle = TextView(context).apply {
            text = "Polaris está listo. Escribe una instrucción y la enviaré al mismo Core de Web, Android y PC."
            textSize = 14f
            setTextColor(Color.rgb(154, 172, 196))
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(6), 0, dp(14))
        }
        sheet.addView(subtitle, lp())

        val input = EditText(context).apply {
            hint = "¿En qué te ayudo?"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.rgb(128, 146, 168))
            setSingleLine(false)
            minLines = 1
            maxLines = 4
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = GradientDrawable().apply {
                cornerRadius = dp(18).toFloat()
                setColor(Color.argb(75, 93, 230, 255))
                setStroke(dp(1), Color.argb(75, 93, 230, 255))
            }
        }
        sheet.addView(input, lp().apply {
            bottomMargin = dp(12)
        })

        val actions = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        lateinit var sendButton: Button
        val listen = Button(context).apply {
            text = "Voz"
            setTextColor(cyan)
            setOnClickListener {
                startVoiceRecognition(input, subtitle, sendButton)
            }
        }
        actions.addView(listen, LinearLayout.LayoutParams(0, dp(48), 1f).apply {
            rightMargin = dp(8)
        })

        sendButton = Button(context).apply {
            text = "Preguntar"
            setOnClickListener {
                val query = input.text?.toString()?.trim().orEmpty()
                if (query.isBlank()) {
                    subtitle.text = "Dime qué necesitas y Polaris lo enviará al Core."
                    return@setOnClickListener
                }

                sendToCore(query, subtitle, sendButton)
            }
            setTextColor(midnight)
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(cyan, violet)
            ).apply {
                cornerRadius = dp(18).toFloat()
            }
        }
        actions.addView(sendButton, LinearLayout.LayoutParams(0, dp(48), 1f).apply {
            leftMargin = dp(8)
        })

        sheet.addView(actions, lp())

        val close = TextView(context).apply {
            text = "Cerrar"
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(154, 172, 196))
            setPadding(0, dp(14), 0, 0)
            setOnClickListener { finish() }
        }
        sheet.addView(close, lp())

        root.addView(
            sheet,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        return root
    }

    private fun startVoiceRecognition(input: EditText, status: TextView, sendButton: Button) {
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            status.text = "Activa el permiso de micrófono en la aplicación Polaris para usar voz."
            return
        }

        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            status.text = "Este dispositivo no tiene un servicio de reconocimiento de voz disponible."
            return
        }

        destroySpeechRecognizer()
        speechRecognizer = if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
        ) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        } else {
            SpeechRecognizer.createSpeechRecognizer(context)
        }

        val recognizer = speechRecognizer ?: return
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                status.text = "Te escucho…"
                sendButton.isEnabled = false
            }

            override fun onBeginningOfSpeech() {
                status.text = "Escuchando…"
            }

            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit

            override fun onEndOfSpeech() {
                status.text = "Procesando voz…"
            }

            override fun onError(error: Int) {
                sendButton.isEnabled = true
                status.text = when (error) {
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Falta permiso de micrófono."
                    SpeechRecognizer.ERROR_NETWORK,
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "La red no está disponible para reconocimiento de voz."
                    SpeechRecognizer.ERROR_NO_MATCH -> "No entendí lo que dijiste. Inténtalo de nuevo."
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No detecté voz."
                    else -> "No pude procesar la voz (código $error)."
                }
                destroySpeechRecognizer()
            }

            override fun onResults(results: Bundle?) {
                val spoken = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.trim()
                    .orEmpty()

                destroySpeechRecognizer()

                if (spoken.isBlank()) {
                    sendButton.isEnabled = true
                    status.text = "No se obtuvo una frase. Inténtalo de nuevo."
                    return
                }

                input.setText(spoken)
                input.setSelection(spoken.length)
                sendToCore(spoken, status, sendButton)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val spoken = partialResults
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.trim()
                    .orEmpty()

                if (spoken.isNotBlank()) {
                    input.setText(spoken)
                    input.setSelection(spoken.length)
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-PE")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }

        recognizer.startListening(intent)
    }

    private fun destroySpeechRecognizer() {
        speechRecognizer?.cancel()
        speechRecognizer?.destroy()
        speechRecognizer = null
    }

    private fun sendToCore(query: String, status: TextView, button: Button) {
        button.isEnabled = false
        button.text = "…"

        val localPlan = PolarisLocalAutomation.parsePlan(query)
        if (localPlan.isNotEmpty()) {
            scope.launch {
                try {
                    val messages = mutableListOf<String>()
                    for ((index, action) in localPlan.withIndex()) {
                        status.text = "Ejecutando ${index + 1}/${localPlan.size}…"
                        val result = PolarisAccessibilityService.execute(action)
                        messages += result.message
                        if (!result.success) break
                        if (index < localPlan.lastIndex) kotlinx.coroutines.delay(300)
                    }
                    status.text = messages.joinToString("\n")
                } finally {
                    button.isEnabled = true
                    button.text = "Preguntar"
                }
            }
            return
        }

        status.text = "Polaris está pensando…"
        scope.launch {
            try {
                val session = SupabaseProvider.client.auth.currentSessionOrNull()
                val token = session?.accessToken
                if (token.isNullOrBlank()) {
                    status.text = "La sesión de Polaris no está disponible. Abre la app y vuelve a iniciar sesión."
                    return@launch
                }

                val baseUrl = BuildConfig.POLARIS_API_URL.trimEnd('/')
                val response = http.post(baseUrl + "/v1/chat") {
                    header(HttpHeaders.Authorization, "Bearer " + token)
                    contentType(ContentType.Application.Json)
                    setBody(
                        AssistantChatRequest(
                            message = query,
                            conversationId = conversationId
                        )
                    )
                }

                if (response.status.value !in 200..299) {
                    status.text = "El Core respondió " + response.status.value + ". Revisa la conexión."
                    return@launch
                }

                val result = response.body<AssistantChatResponse>()
                conversationId = result.conversationId
                status.text = result.content.ifBlank { "El Core no devolvió contenido." }
            } catch (error: Throwable) {
                status.text = "No pude conectar con Polaris Core: " + (error.message ?: "error de red")
            } finally {
                button.isEnabled = true
                button.text = "Preguntar"
            }
        }
    }

    override fun onDestroy() {
        destroySpeechRecognizer()
        scope.cancel()
        http.close()
        super.onDestroy()
    }

    private fun lp(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
