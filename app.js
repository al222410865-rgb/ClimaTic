
const form = document.getElementById("search-form");
const input = document.getElementById("place-input");
const button = document.getElementById("search-button");
const message = document.getElementById("message");

// Crear el mapa y mostrar inicialmente una zona de México.
const map = L.map("map").setView([19.4326, -99.1332], 5);


L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri"
    }
).addTo(map);


let marker = null;

// Descripción e icono según el código meteorológico de Open-Meteo.
const weatherDescriptions = {
    0: ["Despejado", "☀️"],
    1: ["Mayormente despejado", "🌤️"],
    2: ["Parcialmente nublado", "⛅"],
    3: ["Nublado", "☁️"],
    45: ["Niebla", "🌫️"],
    48: ["Niebla con escarcha", "🌫️"],
    51: ["Llovizna ligera", "🌦️"],
    53: ["Llovizna moderada", "🌦️"],
    55: ["Llovizna intensa", "🌧️"],
    61: ["Lluvia ligera", "🌦️"],
    63: ["Lluvia moderada", "🌧️"],
    65: ["Lluvia intensa", "🌧️"],
    71: ["Nevada ligera", "🌨️"],
    73: ["Nevada moderada", "🌨️"],
    75: ["Nevada intensa", "❄️"],
    80: ["Chubascos ligeros", "🌦️"],
    81: ["Chubascos moderados", "🌧️"],
    82: ["Chubascos fuertes", "⛈️"],
    95: ["Tormenta eléctrica", "⛈️"],
    96: ["Tormenta con granizo", "⛈️"],
    99: ["Tormenta fuerte con granizo", "⛈️"]
};

function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
}

function setText(id, value) {
    document.getElementById(id).textContent = value;
}

// Buscar el nombre de una ciudad y obtener sus coordenadas.
async function findPlace(query) {
    const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("No se pudo consultar el servicio de ubicaciones.");
    }

    const results = await response.json();

    if (results.length === 0) {
        throw new Error("No se encontró esa ubicación. Prueba con otro nombre.");
    }

    return results[0];
}

// Consultar el clima de acuerdo con la latitud y longitud.
async function getWeather(latitude, longitude) {
    const params = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        current:
            "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m",
        hourly: "uv_index",
        forecast_days: "1",
        timezone: "auto"
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("No se pudieron consultar los datos meteorológicos.");
    }

    return await response.json();
}

// Mostrar los datos recibidos en la página.
function renderWeather(place, data) {
    const current = data.current;
    const code = current.weather_code;

    const description = weatherDescriptions[code] ||
        ["Condición no identificada", "🌡️"];

    // Buscar el índice UV de la hora actual según la zona horaria devuelta.
    let uvIndex = null;

    if (data.hourly && data.hourly.time && data.hourly.uv_index) {
        const currentHour = current.time.slice(0, 13);
        const index = data.hourly.time.findIndex(time =>
            time.startsWith(currentHour)
        );

        if (index !== -1) {
            uvIndex = data.hourly.uv_index[index];
        }
    }

    setText("place-name", place.name || input.value.trim());
    setText("place-detail", place.display_name || "Ubicación encontrada");

    setText("temperature",
        `${Math.round(current.temperature_2m)}°C`);

    setText("condition", description[0]);

    setText("feels-like",
        `Sensación térmica: ${Math.round(current.apparent_temperature)} °C`);

    setText("humidity", `${current.relative_humidity_2m}%`);
    setText("wind", `${Math.round(current.wind_speed_10m)} km/h`);
    setText("pressure", `${Math.round(current.pressure_msl)} hPa`);

    setText(
        "uv",
        uvIndex === null ? "No disponible" : Number(uvIndex).toFixed(1)
    );

    setText(
        "coordinates",
        `Lat: ${Number(place.lat).toFixed(4)} · Lon: ${Number(place.lon).toFixed(4)}`
    );

    document.getElementById("weather-symbol").textContent = description[1];

    // Centrar el mapa en la ciudad encontrada.
    const latitude = Number(place.lat);
    const longitude = Number(place.lon);

    map.setView([latitude, longitude], 10);

    if (marker) {
        map.removeLayer(marker);
    }

    marker = L.marker([latitude, longitude]).addTo(map);

    marker.bindPopup(
        `<strong>${escapeHtml(place.name || input.value.trim())}</strong>
        <br>${escapeHtml(description[0])}
        <br>${Math.round(current.temperature_2m)} °C`
    ).openPopup();
}

// Evitar que el texto de la ubicación se interprete como HTML.
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Evento que se ejecuta al presionar el botón de búsqueda.
form.addEventListener("submit", async function(event) {
    event.preventDefault();

    const query = input.value.trim();

    if (!query) {
        showMessage("Escribe una ciudad o localidad antes de buscar.", true);
        input.focus();
        return;
    }

    button.disabled = true;
    button.textContent = "Consultando...";

    showMessage("Buscando la ubicación y consultando el clima actual...");

    try {
        const place = await findPlace(query);

        const weather = await getWeather(
            Number(place.lat),
            Number(place.lon)
        );

        renderWeather(place, weather);

        showMessage(
            "Consulta completada. Datos obtenidos de Open-Meteo."
        );

    } catch (error) {
        console.error(error);

        showMessage(
            error.message || "Ocurrió un error. Intenta nuevamente.",
            true
        );

    } finally {
        button.disabled = false;
        button.innerHTML = "Buscar ubicación →";
    }
});
