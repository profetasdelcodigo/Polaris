package com.profetasdelcodigo.polaris

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Permissioned local automation surface.
 *
 * Polaris never enables Accessibility itself. The user must explicitly enable this service
 * in Android Settings. Only low-risk, user-visible actions are exposed here.
 */
class PolarisAutomationService : AccessibilityService() {
    override fun onServiceConnected() {
        super.onServiceConnected()
        PolarisAutomationController.attach(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        PolarisAutomationController.updateRoot(rootInActiveWindow)
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        PolarisAutomationController.detach(this)
        super.onDestroy()
    }
}

object PolarisAutomationController {
    private var service: PolarisAutomationService? = null
    private var root: AccessibilityNodeInfo? = null

    fun attach(value: PolarisAutomationService) {
        service = value
        root = value.rootInActiveWindow
    }

    fun detach(value: PolarisAutomationService) {
        if (service === value) {
            root = null
            service = null
        }
    }

    fun updateRoot(value: AccessibilityNodeInfo?) {
        root = value
    }

    fun isEnabled(): Boolean = service != null

    /**
     * Returns a deterministic result so callers can show the user what actually happened.
     */
    fun execute(command: String): AutomationResult {
        val currentService = service ?: return AutomationResult(false, "La automatización de Android no está habilitada.")
        val normalized = command.trim().lowercase()

        return when {
            normalized in setOf("atrás", "atras", "volver", "retroceder") ->
                AutomationResult(currentService.performGlobalAction(GLOBAL_ACTION_BACK), "Volví atrás.")

            normalized in setOf("inicio", "ir al inicio", "pantalla de inicio", "home") ->
                AutomationResult(currentService.performGlobalAction(GLOBAL_ACTION_HOME), "Fui a la pantalla de inicio.")

            normalized in setOf("notificaciones", "abrir notificaciones", "mostrar notificaciones") ->
                AutomationResult(currentService.performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS), "Abrí las notificaciones.")

            normalized in setOf("ajustes rápidos", "ajustes rapidos", "panel rápido", "panel rapido") ->
                AutomationResult(currentService.performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS), "Abrí los ajustes rápidos.")

            normalized in setOf("ajustes", "configuración", "configuracion", "abrir ajustes") ->
                AutomationResult(currentService.performGlobalAction(GLOBAL_ACTION_SETTINGS), "Abrí Ajustes.")

            normalized in setOf("desplázate", "desplazate", "desplázate hacia abajo", "desplazate hacia abajo", "baja") ->
                AutomationResult(findScrollable(root)?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) == true, "Desplacé hacia abajo.")

            normalized in setOf("desplázate hacia arriba", "desplazate hacia arriba", "sube") ->
                AutomationResult(findScrollable(root)?.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD) == true, "Desplacé hacia arriba.")

            normalized.startsWith("pulsa ") || normalized.startsWith("presiona ") || normalized.startsWith("toca ") ->
                clickVisibleText(currentService, command.substringAfter(' ').trim())

            else -> AutomationResult(false, "No es una acción local segura reconocida.")
        }
    }

    private fun clickVisibleText(service: PolarisAutomationService, target: String): AutomationResult {
        if (target.isBlank()) return AutomationResult(false, "Falta indicar qué elemento pulsar.")
        val node = findText(root, target) ?: return AutomationResult(false, "No encontré "$target" en la pantalla actual.")
        var cursor: AccessibilityNodeInfo? = node
        while (cursor != null) {
            if (cursor.isClickable) {
                val ok = cursor.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                return AutomationResult(ok, if (ok) "Pulsé "$target"." else "Encontré "$target", pero Android no permitió pulsarlo.")
            }
            cursor = cursor.parent
        }
        return AutomationResult(false, "Encontré "$target", pero no es pulsable.")
    }

    private fun findText(node: AccessibilityNodeInfo?, target: String): AccessibilityNodeInfo? {
        if (node == null) return null
        val exact = target.equals(node.text?.toString(), ignoreCase = true) ||
            target.equals(node.contentDescription?.toString(), ignoreCase = true)
        if (exact) return node

        for (index in 0 until node.childCount) {
            val found = findText(node.getChild(index), target)
            if (found != null) return found
        }
        return null
    }

    private fun findScrollable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isScrollable) return node
        for (index in 0 until node.childCount) {
            val found = findScrollable(node.getChild(index))
            if (found != null) return found
        }
        return null
    }
}

data class AutomationResult(
    val success: Boolean,
    val message: String
)
