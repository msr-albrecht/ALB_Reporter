import axios from 'axios';

export interface WeatherData {
    temperatureMin: string;
    temperatureMax: string;
    condition: string;
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
            const city = this.extractCityFromLocation(location);
            const targetDate = new Date(date);
            const today = new Date();
            const daysDiff = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff >= 0 && daysDiff <= 5) {
                return await this.getForecastWeather(city, targetDate);
            } else {
                return this.getTypicalWeatherForSeason(targetDate);
            }
        } catch {
            return this.getTypicalWeatherForSeason(new Date(date));
        }
    }

    private async getForecastWeather(city: string, targetDate: Date): Promise<WeatherData> {
        try {
            const forecastResponse = await axios.get<ForecastAPIResponse>(
                `${this.BASE_URL}forecast?q=${city}&appid=${this.API_KEY}&units=metric&lang=de`
            );
            const forecastList = forecastResponse.data.list;
            const targetDay = targetDate.getDate();
            const targetMonth = targetDate.getMonth();
            const targetYear = targetDate.getFullYear();
            const dayForecasts = forecastList.filter(f => {
                const d = new Date(f.dt * 1000);
                return d.getDate() === targetDay && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
            });
            let minTemp: number;
            let maxTemp: number;
            let condition: string;
            if (dayForecasts.length > 0) {
                minTemp = Math.min(...dayForecasts.map(f => f.main.temp));
                maxTemp = Math.max(...dayForecasts.map(f => f.main.temp));
                let firstWeather = '';
                const first = dayForecasts[0];
                if (first && Array.isArray(first.weather) && first.weather.length > 0 && first.weather[0] && typeof first.weather[0].description === 'string') {
                    firstWeather = first.weather[0].description;
                }
                condition = this.translateWeatherCondition(firstWeather);
            } else {
                const targetTimestamp = targetDate.getTime();
                let closestForecast = forecastList[0]!;
                let closestDiff = Math.abs(closestForecast.dt * 1000 - targetTimestamp);
                for (let i = 1; i < forecastList.length; i++) {
                    const forecast = forecastList[i]!;
                    const diff = Math.abs(forecast.dt * 1000 - targetTimestamp);
                    if (diff < closestDiff) {
                        closestDiff = diff;
                        closestForecast = forecast;
                    }
                }
                minTemp = maxTemp = closestForecast.main.temp;
                let closestWeather = '';
                if (closestForecast && Array.isArray(closestForecast.weather) && closestForecast.weather.length > 0 && closestForecast.weather[0] && typeof closestForecast.weather[0].description === 'string') {
                    closestWeather = closestForecast.weather[0].description;
                }
                condition = this.translateWeatherCondition(closestWeather);
            }
            return {
                temperatureMin: `${Math.round(minTemp)}°C`,
                temperatureMax: `${Math.round(maxTemp)}°C`,
                condition
            };
        } catch {
            const fallback = this.getTypicalWeatherForSeason(targetDate);
            return {
                temperatureMin: fallback.temperatureMin,
                temperatureMax: fallback.temperatureMax,
                condition: fallback.condition
            };
        }
    }

    private extractCityFromLocation(location: string): string {
        const parts = location.trim().split(' ');
        if (parts.length > 1) {
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
        let temp: string;
        let condition: string;
        if (month >= 12 || month <= 2) {
            temp = '3°C'; condition = 'Bewölkt';
        } else if (month >= 3 && month <= 5) {
            temp = '12°C'; condition = 'Trocken';
        } else if (month >= 6 && month <= 8) {
            temp = '22°C'; condition = 'Sonnig';
        } else {
            temp = '10°C'; condition = 'Bewölkt';
        }
        return { temperatureMin: temp, temperatureMax: temp, condition };
    }
}
