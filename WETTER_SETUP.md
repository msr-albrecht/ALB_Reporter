# Wetter-API Konfiguration

## OpenWeatherMap API Key erforderlich

Um die automatische Wetterabfrage zu nutzen, müssen Sie einen kostenlosen API-Key von OpenWeatherMap besorgen:

1. Registrieren Sie sich auf https://openweathermap.org/api
2. Erstellen Sie einen kostenlosen API-Key
3. Ersetzen Sie in `src/modules/weatherService.ts` den Platzhalter:
   ```typescript
   private readonly API_KEY = 'your_api_key_here';
   ```
   mit Ihrem echten API-Key:
   ```typescript
   private readonly API_KEY = 'ihr_echter_api_key';
   ```

## Ohne API-Key

Ohne API-Key funktioniert das System trotzdem und verwendet:
- Saisonale Schätzungen für Deutschland
- Typische Temperaturen basierend auf Jahreszeit
- Standard-Wetterbedingungen

## Test der Funktionalität

Sie können jetzt einen neuen Bautagesbericht erstellen und sehen, dass:
- Die Temperatur-Spalte automatisch gefüllt wird
- Die Wetter-Spalte die entsprechenden Bedingungen anzeigt
- Bei Fehlern automatisch Fallback-Werte verwendet werden
