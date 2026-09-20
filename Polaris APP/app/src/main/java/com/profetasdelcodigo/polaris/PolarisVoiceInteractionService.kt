package com.profetasdelcodigo.polaris

import android.service.voice.VoiceInteractionService

/**
 * System-level voice assistant entry point.
 *
 * The system keeps the selected assistant service available so the user can invoke it
 * from the device's assistant gesture/button where supported.
 */
class PolarisVoiceInteractionService : VoiceInteractionService() {
    override fun onReady() {
        super.onReady()
    }
}