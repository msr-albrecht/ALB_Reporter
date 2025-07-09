"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherService = void 0;
const axios_1 = __importDefault(require("axios"));
class WeatherService {
    constructor() {
        this.API_KEY = 'b14c4e5e40feeb6ce77efdc9ee4c68db';
        this.BASE_URL = 'https://api.openweathermap.org/data/2.5/';
    }
    async getWeatherForDateAndLocation(date, location) {
        try {
            const city = this.extractCityFromLocation(location);
            const targetDate = new Date(date);
            const today = new Date();
            const daysDiff = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff >= 0 && daysDiff <= 5) {
                return await this.getForecastWeather(city, targetDate);
            }
            else if (daysDiff > 5) {
                console.log(`Datum ${date} ist zu weit in der Zukunft. Verwende saisonale Schätzung.`);
                return this.getTypicalWeatherForSeason(targetDate);
            }
            else {
                console.log(`Datum ${date} liegt in der Vergangenheit. Verwende saisonale Schätzung.`);
                return this.getTypicalWeatherForSeason(targetDate);
            }
        }
        catch (error) {
            console.error('Error fetching weather data:', error);
            return this.getTypicalWeatherForSeason(new Date(date));
        }
    }
    async getForecastWeather(city, targetDate) {
        try {
            const forecastResponse = await axios_1.default.get(`${this.BASE_URL}forecast?q=${city}&appid=${this.API_KEY}&units=metric&lang=de`);
            if (!forecastResponse.data?.list?.length) {
                throw new Error('Invalid forecast data received');
            }
            const forecastList = forecastResponse.data.list;
            if (forecastList.length === 0) {
                throw new Error('No forecast data available');
            }
            const targetTimestamp = targetDate.getTime();
            let closestForecast = forecastList[0];
            let closestDiff = Math.abs(closestForecast.dt * 1000 - targetTimestamp);
            for (let i = 1; i < forecastList.length; i++) {
                const forecast = forecastList[i];
                const diff = Math.abs(forecast.dt * 1000 - targetTimestamp);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestForecast = forecast;
                }
            }
            if (!closestForecast?.weather?.[0]?.description) {
                throw new Error('No valid weather data found in forecast');
            }
            return {
                temperature: `${Math.round(closestForecast.main.temp)}°C`,
                condition: this.translateWeatherCondition(closestForecast.weather[0].description)
            };
        }
        catch (error) {
            console.error('Error fetching forecast data:', error);
            return this.getTypicalWeatherForSeason(targetDate);
        }
    }
    extractCityFromLocation(location) {
        const parts = location.trim().split(' ');
        if (parts.length > 1) {
            return parts.slice(1).join(' ');
        }
        return location;
    }
    translateWeatherCondition(condition) {
        const translations = {
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
    getTypicalWeatherForSeason(date) {
        const month = date.getMonth() + 1;
        if (month >= 12 || month <= 2) {
            return { temperature: '3°C', condition: 'Bewölkt' };
        }
        else if (month >= 3 && month <= 5) {
            return { temperature: '12°C', condition: 'Trocken' };
        }
        else if (month >= 6 && month <= 8) {
            return { temperature: '22°C', condition: 'Sonnig' };
        }
        else {
            return { temperature: '10°C', condition: 'Bewölkt' };
        }
    }
}
exports.WeatherService = WeatherService;
//# sourceMappingURL=weatherService.js.map