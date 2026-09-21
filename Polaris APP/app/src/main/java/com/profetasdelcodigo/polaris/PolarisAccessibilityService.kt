package com.profetasdelcodigo.polaris

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityEvent

/**
 * Local, permissioned Android automation bridge.
 * Build-verified path: bounded navigation, settings, scroll and visible taps.
 * Android requires the user to grant Accessibility access explicitly.
 */
class PolarisAccessibilityService : AccessibilityService() {
    companion object {
        @Volatile private var instance: PolarisAccessibilityService? = null
        fun isEnabled(): Boolean = instance != null
        fun execute(action: LocalAutomationAction): LocalAutomationResult =
            instance?.executeInternal(action)
                ?: LocalAutomationResult(false, "La automatización de Android no está habilitada.")
    }

    override fun onServiceConnected() { super.onServiceConnected(); instance = this }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit
    override fun onDestroy() { instance = null; super.onDestroy() }

    private fun executeInternal(action: LocalAutomationAction): LocalAutomationResult = when (action) {
        LocalAutomationAction.BACK -> globalAction(GLOBAL_ACTION_BACK, "Volví atrás.")
        LocalAutomationAction.HOME -> globalAction(GLOBAL_ACTION_HOME, "Fui al inicio.")
        LocalAutomationAction.NOTIFICATIONS -> globalAction(GLOBAL_ACTION_NOTIFICATIONS, "Abrí las notificaciones.")
        LocalAutomationAction.QUICK_SETTINGS -> globalAction(GLOBAL_ACTION_QUICK_SETTINGS, "Abrí los ajustes rápidos.")
        LocalAutomationAction.RECENTS -> globalAction(GLOBAL_ACTION_RECENTS, "Abrí las aplicaciones recientes.")
        LocalAutomationAction.OPEN_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_SETTINGS, "Ajustes")
        LocalAutomationAction.OPEN_WIFI_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_WIFI_SETTINGS, "los ajustes de Wi-Fi")
        LocalAutomationAction.OPEN_BLUETOOTH_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS, "los ajustes de Bluetooth")
        LocalAutomationAction.OPEN_DISPLAY_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_DISPLAY_SETTINGS, "los ajustes de pantalla")
        LocalAutomationAction.OPEN_SOUND_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_SOUND_SETTINGS, "los ajustes de sonido")
        LocalAutomationAction.OPEN_BATTERY_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_BATTERY_SAVER_SETTINGS, "los ajustes de batería")
        LocalAutomationAction.OPEN_LOCATION_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS, "los ajustes de ubicación")
        LocalAutomationAction.OPEN_NOTIFICATION_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_NOTIFICATION_SETTINGS, "los ajustes de notificaciones")
        LocalAutomationAction.OPEN_ACCESSIBILITY_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS, "los ajustes de accesibilidad")
        LocalAutomationAction.OPEN_LANGUAGE_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_LOCALE_SETTINGS, "los ajustes de idioma")
        LocalAutomationAction.OPEN_INPUT_SETTINGS -> openSystemSettings(android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS, "los ajustes de teclado")
        LocalAutomationAction.DESCRIBE_SCREEN -> describeScreen()
        LocalAutomationAction.SCROLL_DOWN -> scroll(false)
        LocalAutomationAction.SCROLL_UP -> scroll(true)
        is LocalAutomationAction.TAP_TEXT -> tapVisibleText(action.text)
    }

    private fun globalAction(action: Int, successMessage: String) =
        if (performGlobalAction(action)) LocalAutomationResult(true, successMessage)
        else LocalAutomationResult(false, "Android no permitió ejecutar esa acción.")

    private fun openSystemSettings(action: String, label: String): LocalAutomationResult = try {
        startActivity(android.content.Intent(action).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
        LocalAutomationResult(true, "Abrí $label.")
    } catch (_: Throwable) {
        LocalAutomationResult(false, "Android no pudo abrir $label.")
    }

    private fun describeScreen(): LocalAutomationResult {
        val root = rootInActiveWindow ?: return LocalAutomationResult(false, "No pude observar la pantalla actual.")
        val visible = mutableListOf<String>()

        fun collect(node: AccessibilityNodeInfo) {
            if (visible.size >= 40 || !node.isVisibleToUser) return

            val text = node.text?.toString()?.trim().orEmpty()
            val description = node.contentDescription?.toString()?.trim().orEmpty()
            val candidate = when {
                text.isNotBlank() -> text
                description.isNotBlank() -> description
                else -> ""
            }

            if (candidate.isNotBlank() && candidate.length <= 180 &&
                visible.none { it.equals(candidate, ignoreCase = true) }) {
                visible += candidate
            }

            for (index in 0 until node.childCount) {
                val child = node.getChild(index) ?: continue
                collect(child)
            }
        }

        collect(root)
        val summary = visible.joinToString(" · ").take(2_400)
        val message = if (summary.isBlank()) {
            "Pantalla observada, pero no expone texto accesible."
        } else {
            "Veo: " + summary
        }
        return LocalAutomationResult(
            true,
            message,
            verification = "Accesibilidad devolvió " + visible.size + " elementos visibles."
        )
    }

    private fun scroll(up: Boolean): LocalAutomationResult {
        val root = rootInActiveWindow ?: return LocalAutomationResult(false, "No pude observar la pantalla actual.")
        val scrollable = findScrollable(root) ?: return LocalAutomationResult(false, "No encontré un elemento desplazable visible.")
        val action = if (up) AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD else AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        return if (scrollable.performAction(action))
            LocalAutomationResult(true, if (up) "Desplacé hacia arriba." else "Desplacé hacia abajo.")
        else LocalAutomationResult(false, "El elemento visible no aceptó el desplazamiento.")
    }

    private fun findScrollable(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (node.isVisibleToUser && node.isScrollable) return node
        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue
            val result = findScrollable(child)
            if (result != null) return result
        }
        return null
    }

    private fun tapVisibleText(text: String): LocalAutomationResult {
        val root = rootInActiveWindow ?: return LocalAutomationResult(false, "No pude observar la pantalla actual.")
        val normalized = text.trim()
        if (normalized.isBlank()) return LocalAutomationResult(false, "El texto a pulsar está vacío.")
        val nodes = root.findAccessibilityNodeInfosByText(normalized)
        val candidate = nodes.firstOrNull { it.isVisibleToUser } ?: findByContentDescription(root, normalized)
        if (candidate == null) return LocalAutomationResult(false, "No encontré «$normalized» en la pantalla visible.")
        val clickable = nearestClickable(candidate)
        return if (clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true)
            LocalAutomationResult(true, "Pulsé «$normalized».")
        else LocalAutomationResult(false, "Encontré «$normalized», pero Android no permitió pulsarlo.")
    }

    private fun findByContentDescription(node: AccessibilityNodeInfo, text: String): AccessibilityNodeInfo? {
        if (node.isVisibleToUser && node.contentDescription?.toString()?.contains(text, ignoreCase = true) == true) return node
        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue
            val result = findByContentDescription(child, text)
            if (result != null) return result
        }
        return null
    }

    private fun nearestClickable(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var current: AccessibilityNodeInfo? = node
        repeat(8) {
            if (current?.isClickable == true) return current
            current = current?.parent
        }
        return null
    }
}

sealed interface LocalAutomationAction {
    data object BACK : LocalAutomationAction
    data object HOME : LocalAutomationAction
    data object NOTIFICATIONS : LocalAutomationAction
    data object QUICK_SETTINGS : LocalAutomationAction
    data object RECENTS : LocalAutomationAction
    data object OPEN_SETTINGS : LocalAutomationAction
    data object OPEN_WIFI_SETTINGS : LocalAutomationAction
    data object OPEN_BLUETOOTH_SETTINGS : LocalAutomationAction
    data object OPEN_DISPLAY_SETTINGS : LocalAutomationAction
    data object OPEN_SOUND_SETTINGS : LocalAutomationAction
    data object OPEN_BATTERY_SETTINGS : LocalAutomationAction
    data object OPEN_LOCATION_SETTINGS : LocalAutomationAction
    data object OPEN_NOTIFICATION_SETTINGS : LocalAutomationAction
    data object OPEN_ACCESSIBILITY_SETTINGS : LocalAutomationAction
    data object OPEN_LANGUAGE_SETTINGS : LocalAutomationAction
    data object OPEN_INPUT_SETTINGS : LocalAutomationAction
    data object DESCRIBE_SCREEN : LocalAutomationAction
    data object SCROLL_DOWN : LocalAutomationAction
    data object SCROLL_UP : LocalAutomationAction
    data class TAP_TEXT(val text: String) : LocalAutomationAction
}

data class LocalAutomationResult(
    val success: Boolean,
    val message: String,
    val verification: String? = null
)
