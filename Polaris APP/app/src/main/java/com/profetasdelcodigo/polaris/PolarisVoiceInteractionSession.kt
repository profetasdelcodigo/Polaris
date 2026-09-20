package com.profetasdelcodigo.polaris

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.service.voice.VoiceInteractionSession
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Lightweight floating assistant surface.
 *
 * The system supplies the current foreground app behind this session. The UI is deliberately
 * independent from the main Activity so the assistant can appear over another app.
 */
class PolarisVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {

    init {
        setTheme(com.profetasdelcodigo.polaris.R.style.Theme_Polaris_Assistant)
    }

    private val cyan = Color.rgb(93, 230, 255)
    private val violet = Color.rgb(155, 130, 255)
    private val midnight = Color.rgb(7, 11, 20)
    private val surface = Color.rgb(13, 20, 34)

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
            setBackgroundColor(Color.TRANSPARENT)
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
            text = "Polaris está listo. Escribe una instrucción y luego conectaremos voz y acciones del sistema."
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
            singleLine = false
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

        val listen = Button(context).apply {
            text = "Escuchar"
            setTextColor(cyan)
            setOnClickListener {
                subtitle.text = "La interfaz de voz se habilitará en el siguiente incremento."
            }
        }
        actions.addView(listen, LinearLayout.LayoutParams(0, dp(48), 1f).apply {
            rightMargin = dp(8)
        })

        val send = Button(context).apply {
            text = "Continuar"
            setOnClickListener {
                val query = input.text?.toString()?.trim().orEmpty()
                subtitle.text = if (query.isBlank()) {
                    "Dime qué necesitas y Polaris preparará la acción."
                } else {
                    "Recibido: “$query”"
                }
            }
            setTextColor(midnight)
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(cyan, violet)
            ).apply {
                cornerRadius = dp(18).toFloat()
            }
        }
        actions.addView(send, LinearLayout.LayoutParams(0, dp(48), 1f).apply {
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

        root.addView(sheet, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ))

        return root
    }

    private fun lp(): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
