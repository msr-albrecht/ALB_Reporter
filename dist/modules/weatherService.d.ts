export interface WeatherData {
    temperature: string;
    condition: string;
}
export declare class WeatherService {
    private readonly API_KEY;
    private readonly BASE_URL;
    getWeatherForDateAndLocation(date: string, location: string): Promise<WeatherData>;
    private getForecastWeather;
    private extractCityFromLocation;
    private translateWeatherCondition;
    private getTypicalWeatherForSeason;
}
//# sourceMappingURL=weatherService.d.ts.map