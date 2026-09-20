package com.profetasdelcodigo.polaris

/**
 * Deterministic parser for low-risk Android commands.
 * Only commands represented by LocalAutomationAction are executed locally.
 * Everything else remains a normal Core/AI request.
 */
object PolarisLocalAutomation {
    fun parsePlan(raw: String): List<LocalAutomationAction> {
        val parts = raw.trim()
            .split(Regex("\\s+(?:y luego|luego|después|despues|y)\\s+|\\s*[;,]\\s*"))
            .map { it.trim() }
            .filter { it.isNotBlank() }

        if (parts.isEmpty()) return emptyList()

        val actions = parts.map { parse(it) ?: return emptyList() }
        return actions.takeIf { it.size <= 8 } ?: emptyList()
    }

    fun parse(raw: String): LocalAutomationAction? {
        val text = raw.trim().lowercase().replace(Regex("\\s+"), " ")
        return when {
            text.matches(Regex("(volver|atrás|atras|regresa|retrocede)")) -> LocalAutomationAction.BACK
            text.matches(Regex("(inicio|ir al inicio|ve al inicio|pantalla principal|volver al inicio)")) -> LocalAutomationAction.HOME
            text.matches(Regex("(abre|abrir|muestra|mostrar) las notificaciones")) || text == "notificaciones" -> LocalAutomationAction.NOTIFICATIONS
            text.matches(Regex("(abre|abrir|muestra|mostrar) ajustes rápidos")) || text == "ajustes rápidos" || text == "ajustes rapidos" -> LocalAutomationAction.QUICK_SETTINGS
            text.matches(Regex("(abre|abrir|muestra|mostrar) recientes")) || text == "recientes" || text == "aplicaciones recientes" -> LocalAutomationAction.RECENTS
            text.matches(Regex("(abre|abrir) ajustes")) || text == "ajustes" || text == "configuración" || text == "configuracion" -> LocalAutomationAction.OPEN_SETTINGS
            text.matches(Regex("(abre|abrir) ajustes de wifi")) || text == "wifi" || text == "wi-fi" -> LocalAutomationAction.OPEN_WIFI_SETTINGS
            text.matches(Regex("(abre|abrir) bluetooth")) || text == "bluetooth" -> LocalAutomationAction.OPEN_BLUETOOTH_SETTINGS
            text.matches(Regex("(baja|bajar|desplaza hacia abajo|haz scroll hacia abajo|scroll abajo)")) -> LocalAutomationAction.SCROLL_DOWN
            text.matches(Regex("(sube|subir|desplaza hacia arriba|haz scroll hacia arriba|scroll arriba)")) -> LocalAutomationAction.SCROLL_UP
            else -> parseTap(text)
        }
    }

    private fun parseTap(text: String): LocalAutomationAction? {
        val match = Regex("^(?:pulsa|presiona|toca|clic|click|haz clic|haz click)(?: en)?[ \"]+(.+?)[\"]*$").find(text)
            ?: return null
        val target = match.groupValues[1].trim().trim('"', '\'')
        return target.takeIf { it.isNotBlank() && it.length <= 120 }?.let { LocalAutomationAction.TAP_TEXT(it) }
    }
}
