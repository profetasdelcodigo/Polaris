package com.profetasdelcodigo.polaris

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityEvent

/**
 * Local, permissioned Android automation bridge.
 *
 * Polaris never enables this service itself. Android requires the user to grant
 * Accessibility access explicitly. Only bounded navigation, scrolling and
 * visible-element clicks are exposed here.
 */
class PolarisAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile
        private var instance: PolarisAccessibilityService? = null

        fun isEnabled(): Boolean = instance != null

        fun execute(action: LocalAutomationAction): LocalAutomationResult {
            val service = instance
                ?: return LocalAutomationResult(false, "La automatización de Android no está habilitada.")

            return service.executeInternal(action)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    private fun executeInternal(action: LocalAutomationAction): LocalAutomationResult {
        return when (action) {
            LocalAutomationAction.BACK ->
                globalAction(GLOBAL_ACTION_BACK, "Volví atrás.")
            LocalAutomationAction.HOME ->
                globalAction(GLOBAL_ACTION_HOME, "Fui al inicio.")
            LocalAutomationAction.NOTIFICATIONS ->
                globalAction(GLOBAL_ACTION_NOTIFICATIONS, "Abrí las notificaciones.")
            LocalAutomationAction.QUICK_SETTINGS ->
                globalAction(GLOBAL_ACTION_QUICK_SETTINGS, "Abrí los ajustes rápidos.")
            LocalAutomationAction.RECENTS ->
                globalAction(GLOBAL_ACTION_RECENTS, "Abrí las aplicaciones recientes.")
            LocalAutomationAction.SCROLL_DOWN ->
                scroll(false)
            LocalAutomationAction.SCROLL_UP ->
                scroll(true)
            is LocalAutomationAction.TAP_TEXT ->
                tapVisibleText(action.text)
        }
    }

    private fun globalAction(action: Int, successMessage: String): LocalAutomationResult =
        if (performGlobalAction(action)) {
            LocalAutomationResult(true, successMessage)
        } else {
            LocalAutomationResult(false, "Android no permitió ejecutar esa acción.")
        }

    private fun scroll(up: Boolean): LocalAutomationResult {
        val root = rootInActiveWindow
            ?: return LocalAutomationResult(false, "No pude observar la pantalla actual.")

        val scrollable = findScrollable(root)
            ?: return LocalAutomationResult(false, "No encontré un elemento desplazable visible.")

        val action = if (up) {
            AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        } else {
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        }

        return if (scrollable.performAction(action)) {
            LocalAutomationResult(true, if (up) "Desplacé hacia arriba." else "Desplacé hacia abajo.")
        } else {
            LocalAutomationResult(false, "El elemento visible no aceptó el desplazamiento.")
        }
    }

    private fun findScrollable(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (node.isScrollable) return node
        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue
            val result = findScrollable(child)
            if (result != null) return result
        }
        return null
    }

    private fun tapVisibleText(text: String): LocalAutomationResult {
        val root = rootInActiveWindow
            ?: return LocalAutomationResult(false, "No pude observar la pantalla actual.")

        val normalized = text.trim()
        if (normalized.isBlank()) {
            return LocalAutomationResult(false, "El texto a pulsar está vacío.")
        }

        val nodes = root.findAccessibilityNodeInfosByText(normalized)
        val candidate = nodes.firstOrNull { it.isVisibleToUser && (it.isClickable || it.parent != null) }
            ?: findByContentDescription(root, normalized)

        if (candidate == null) {
            return LocalAutomationResult(false, "No encontré «$normalized» en la pantalla visible.")
        }

        val clickable = nearestClickable(candidate)
        return if (clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) {
            LocalAutomationResult(true, "Pulsé «$normalized».")
        } else {
            LocalAutomationResult(false, "Encontré «$normalized», pero Android no permitió pulsarlo.")
        }
    }

    private fun findByContentDescription(node: AccessibilityNodeInfo, text: String): AccessibilityNodeInfo? {
        if (node.isVisibleToUser && node.contentDescription?.toString()?.contains(text, ignoreCase = true) == true) {
            return node
        }
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
    data object SCROLL_DOWN : LocalAutomationAction
    data object SCROLL_UP : LocalAutomationAction
    data class TAP_TEXT(val text: String) : LocalAutomationAction
}

data class LocalAutomationResult(
    val success: Boolean,
    val message: String
)
