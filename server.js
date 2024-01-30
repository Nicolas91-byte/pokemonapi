const express = require('express');
const app = express();
const http = require('http').createServer(app);
const port = 3000;
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs'); // Añadir esta línea para importar el módulo 'fs'

app.use(express.static('public'));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    fs.readFile('public/index.html', 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo HTML', err);
            res.status(500).send('Error interno del servidor');
            return;
        }

        // Envía el contenido del archivo HTML como respuesta
        res.send(data);
    });
});

async function obtenerDatosPokeAPIRecursivo(pagina, tamanoPagina, offset, acumulado = []) {
    try {
        const limite = 151; // Establecer el límite a los primeros 151 Pokémon

        // Realizar la solicitud a la PokeAPI con paginación y límite
        const respuestaPokeAPI = await axios.get('https://pokeapi.co/api/v2/pokemon', {
            params: {
                offset: offset,
                limit: tamanoPagina
            }
        });

        // Obtener detalles adicionales para cada Pokémon
        const detallesPromesas = respuestaPokeAPI.data.results.map(async (pokemon) => {
            const detalleRespuesta = await axios.get(pokemon.url);
            return detalleRespuesta.data;
        });

        // Esperar a que todas las solicitudes de detalles se completen
        const detallesPokemon = await Promise.all(detallesPromesas);

        // Combina la información de la lista principal con los detalles de cada Pokémon
        const datosCompletos = respuestaPokeAPI.data.results.map((pokemon, index) => {
            return {
                nombre: pokemon.name,
                detalles: detallesPokemon[index]
            };
        });

        // Agregar los datos de la página actual al acumulado
        acumulado = acumulado.concat(datosCompletos);

        // Verificar si hay más páginas y si el límite no se ha alcanzado
        if (respuestaPokeAPI.data.next && acumulado.length < limite) {
            // Calcular el offset para la próxima página
            const proximoOffset = offset + tamanoPagina;

            // Calcular el número de Pokémon restantes para alcanzar el límite
            const restantesParaLimite = Math.min(limite - acumulado.length, tamanoPagina);

            // Obtener los datos de la próxima página de manera recursiva con el nuevo límite
            return obtenerDatosPokeAPIRecursivo(pagina + 1, restantesParaLimite, proximoOffset, acumulado);
        } else {
            // Si no hay más páginas o se alcanzó el límite, devolver los datos acumulados
            return acumulado;
        }
    } catch (error) {
        console.error('Error al obtener datos de la PokeAPI:', error.message);
        throw new Error('Error al obtener datos de la PokeAPI');
    }
}

app.get('/obtenerDatosPokeAPI', async (req, res) => {
    try {
        const paginaInicial = 1;
        const tamanoPagina = 50;

        // Llamar a la función recursiva para obtener datos de todas las páginas
        const datosCompletos = await obtenerDatosPokeAPIRecursivo(paginaInicial, tamanoPagina, 0);

        // Envía los datos completos como respuesta JSON
        res.json(datosCompletos);
    } catch (error) {
        console.error('Error al obtener datos de la PokeAPI:', error.message);
        res.status(500).json({ error: 'Error al obtener datos de la PokeAPI' });
    }
});
app.get('/obtenerDatosPokemon', async (req, res) => {
    try {
        let nombrePokemon = req.query.valor; // Obtener el valor desde la query

        // Construir la URL con el nombre o número del Pokémon
        const respuestaPokeAPI = await axios.get(`https://pokeapi.co/api/v2/pokemon/${nombrePokemon}`);
        res.json(respuestaPokeAPI.data);
    } catch (error) {
        console.error('Error al obtener datos del Pokémon:', error.message);
        res.status(500).json({ error: 'Error al obtener datos del Pokémon' });
    }
});

app.get('/obtenerTiposPokemon', async (req, res) => {
    try {
        // Realizar la solicitud a la PokeAPI para obtener la lista de tipos
        const respuestaTipos = await axios.get('https://pokeapi.co/api/v2/type');
        
        // Extraer los nombres de los tipos desde la respuesta
        const tipos = respuestaTipos.data.results.map(tipo => tipo.name);

        // Envía la lista de tipos como respuesta JSON
        res.json({ tipos });
    } catch (error) {
        console.error('Error al obtener tipos de Pokémon:', error.message);
        res.status(500).json({ error: 'Error al obtener tipos de Pokémon' });
    }
});

app.get('/obtenerPokemonPorTipo/:tipo', async (req, res) => {
    try {
        const tipoPokemon = req.params.tipo.toLowerCase(); // Obtener el tipo desde los parámetros de la ruta

        // Realizar la solicitud a la PokeAPI para obtener la lista de Pokémon de un tipo específico
        const respuestaPokemonPorTipo = await axios.get(`https://pokeapi.co/api/v2/type/${tipoPokemon}`);
        
        // Verificar si la respuesta contiene la propiedad esperada
        if (respuestaPokemonPorTipo.data && respuestaPokemonPorTipo.data.pokemon && Array.isArray(respuestaPokemonPorTipo.data.pokemon)) {
            // Obtener detalles adicionales para cada Pokémon del tipo especificado
            const detallesPromesas = respuestaPokemonPorTipo.data.pokemon.map(async (pokemon) => {
                const detalleRespuesta = await axios.get(pokemon.pokemon.url);
                return {
                    numero: detalleRespuesta.data.id,
                    nombre: detalleRespuesta.data.name,
                    sprite: detalleRespuesta.data.sprites.front_default
                };
            });

            // Esperar a que todas las solicitudes de detalles se completen
            const detallesPokemon = await Promise.all(detallesPromesas);

            // Envía la lista de Pokémon del tipo especificado con detalles adicionales como respuesta JSON
            res.json({ pokemonPorTipo: detallesPokemon });
        } else {
            console.error('Respuesta inesperada al obtener Pokémon por tipo:', respuestaPokemonPorTipo.data);
            res.status(500).json({ error: `Respuesta inesperada al obtener Pokémon por tipo ${req.params.tipo}` });
        }
    } catch (error) {
        console.error(`Error al obtener Pokémon del tipo ${req.params.tipo}:`, error.message);
        res.status(500).json({ error: `Error al obtener Pokémon del tipo ${req.params.tipo}` });
    }
});

http.listen(3000, () => {
    console.log('Escuchando en el puerto 3000');
});