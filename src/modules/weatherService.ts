import axios from 'axios';

export interface WeatherData {
    temperature: string;
    condition: string;
}

interface WeatherAPIResponse {
    main: {
        temp: number;
    };
    weather: Array<{
        description: string;
    }>;
}

interface ForecastAPIResponse {
    list: Array<{
        dt: number;
        main: {
            temp: number;
        };
        weather: Array<{
            description: string;
        }>;
    }>;
}

export class WeatherService {
    private readonly API_KEY = 'b14c4e5e40feeb6ce77efdc9ee4c68db';
    private readonly BASE_URL = 'https://api.openweathermap.org/data/2.5/';

    async getWeatherForDateAndLocation(date: string, location: string): Promise<WeatherData> {
        try {
            // Extrahiere Stadt aus Location (z.B. "84034 Landshut" -> "Landshut")
            const city = this.extractCityFromLocation(location);
            const targetDate = new Date(date);
            const today = new Date();

            // Berechne Differenz in Tagen
            const daysDiff = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff >= 0 && daysDiff <= 5) {
                // Für die nächsten 5 Tage: Verwende Forecast API
                return await this.getForecastWeather(city, targetDate);
            } else if (daysDiff > 5) {
                // Für weit in der Zukunft: Verwende saisonale Schätzung
                console.log(`Datum ${date} ist zu weit in der Zukunft. Verwende saisonale Schätzung.`);
                return this.getTypicalWeatherForSeason(targetDate);
            } else {
                // Für vergangene Daten: Verwende saisonale Schätzung
                console.log(`Datum ${date} liegt in der Vergangenheit. Verwende saisonale Schätzung.`);
                return this.getTypicalWeatherForSeason(targetDate);
            }
        } catch (error) {
            console.error('Error fetching weather data:', error);
            // Fallback auf lokale Wettervorhersage basierend auf Saison
            return this.getTypicalWeatherForSeason(new Date(date));
        }
    }

    private async getForecastWeather(city: string, targetDate: Date): Promise<WeatherData> {
        try {
            const forecastResponse = await axios.get<ForecastAPIResponse>(
                `${this.BASE_URL}forecast?q=${city}&appid=${this.API_KEY}&units=metric&lang=de`
            );

            if (!forecastResponse.data?.list?.length) {
                throw new Error('Invalid forecast data received');
            }

            const forecastList = forecastResponse.data.list;

            // Stelle sicher, dass wir mindestens einen Eintrag haben
            if (forecastList.length === 0) {
                throw new Error('No forecast data available');
            }

            // Finde den Forecast-Eintrag, der am nächsten zum Zieldatum liegt
            const targetTimestamp = targetDate.getTime();
            let closestForecast = forecastList[0]!; // Non-null assertion da wir bereits überprüft haben
            let closestDiff = Math.abs(closestForecast.dt * 1000 - targetTimestamp);

            for (let i = 1; i < forecastList.length; i++) {
                const forecast = forecastList[i]!; // Non-null assertion
                const diff = Math.abs(forecast.dt * 1000 - targetTimestamp);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestForecast = forecast;
                }
            }

            // Zusätzliche Sicherheitsüberprüfung
            if (!closestForecast?.weather?.[0]?.description) {
                throw new Error('No valid weather data found in forecast');
            }

            return {
                temperature: `${Math.round(closestForecast.main.temp)}°C`,
                condition: this.translateWeatherCondition(closestForecast.weather[0].description)
            };
        } catch (error) {
            console.error('Error fetching forecast data:', error);
            // Fallback auf saisonale Schätzung
            return this.getTypicalWeatherForSeason(targetDate);
        }
    }

    private extractCityFromLocation(location: string): string {
        // Extrahiere Stadt aus Format "PLZ Stadt" oder "Stadt"
        const parts = location.trim().split(' ');
        if (parts.length > 1) {
            // Wenn PLZ vorhanden ist, nimm alles nach der PLZ
            return parts.slice(1).join(' ');
        }
        return location;
    }

    private translateWeatherCondition(condition: string): string {
        const translations: { [key: string]: string } = {
            'clear sky': 'Sonnig',
            'few clouds': 'Leicht bewölkt',
            'scattered clouds': 'Bewölkt',
            'broken clouds': 'Stark bewölkt',
            'overcast clouds': 'Bedeckt',
            'light rain': 'Leichter Regen',
            'moderate rain': 'Regen',
            'heavy rain': 'Starker Regen',
            'thunderstorm': 'Gewitter',
            'snow': 'Schnee',
            'mist': 'Nebel',
            'fog': 'Nebel'
        };

        return translations[condition.toLowerCase()] || condition;
    }

    private getTypicalWeatherForSeason(date: Date): WeatherData {
        const month = date.getMonth() + 1;

        if (month >= 12 || month <= 2) {
            // Winter
            return { temperature: '3°C', condition: 'Bewölkt' };
        } else if (month >= 3 && month <= 5) {
            // Frühling
            return { temperature: '12°C', condition: 'Trocken' };
        } else if (month >= 6 && month <= 8) {
            // Sommer
            return { temperature: '22°C', condition: 'Sonnig' };
        } else {
            // Herbst
            return { temperature: '10°C', condition: 'Bewölkt' };
        }
    }
}
