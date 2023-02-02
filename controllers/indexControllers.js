const geolib = require('geolib');
const datos = require('../data');

const index = (req, res) => {

    const { id, direccion } = req.query

    if (!id || !direccion) {
        res.status(400).json({ "error": "Faltan parámetros" })

    } else {
        const parada = {
            parada_id: parseInt(id),
            direccion
        }


        fetchGPS().then(bus_array => {
            if (bus_array) {
                const { arr_menor, arr_igual, user_indice, user_coords } = filtrarArray(bus_array, parada)


                if (arr_menor === undefined || arr_igual === undefined) {
                    res.status(400).json({ "error": "Ha ocurrido un error" })

                }
                else if (!arr_menor.length && !arr_igual.length) {
                    res.status(200).json({
                        "disponible": false,
                        "array_completo": bus_array
                    })


                } else if (!arr_menor.length && arr_igual.length) {
                    verificarIgualArea(arr_igual, user_indice, user_coords, parada).then(datos_bus => {
                        if (datos_bus) {

                            res.status(200).json({
                                "disponible": true,
                                "array_completo": bus_array,
                                "bus": datos_bus.bus,
                                "tiempo": datos_bus.variables.tiempo,
                                "distancia": datos_bus.variables.distancia
                            })
                        } else {
                            res.status(200).json({
                                "disponible": false,
                                "array_completo": bus_array
                            })
                        }
                    })

                } else if (arr_menor.length && !arr_igual.length) {

                    verificarMenorArea(arr_menor, user_coords, parada).then(datos_bus => {
                        if (datos_bus) {
                            res.status(200).json({
                                "disponible": true,
                                "array_completo": bus_array,
                                "bus": datos_bus.bus,
                                "tiempo": datos_bus.variables.tiempo,
                                "distancia": datos_bus.variables.distancia
                            })
                        }
                    })

                } else if (arr_menor.length && arr_igual.length) {
                    verificarIgualArea(arr_igual, user_indice, user_coords, parada).then(datos_bus => {
                        if (datos_bus) {
                            res.status(200).json({
                                "disponible": true,
                                "array_completo": bus_array,
                                "bus": datos_bus.bus,
                                "tiempo": datos_bus.variables.tiempo,
                                "distancia": datos_bus.variables.distancia
                            })
                        } else {
                            verificarMenorArea(arr_menor, user_coords, parada).then(datos_bus => {
                                if (datos_bus) {
                                    res.status(200).json({
                                        "disponible": true,
                                        "array_completo": bus_array,
                                        "bus": datos_bus.bus,
                                        "tiempo": datos_bus.variables.tiempo,
                                        "distancia": datos_bus.variables.distancia
                                    })
                                }
                            })
                        }
                    })

                }
            }
        })
    }



}



const verificarMenorArea = async (arr_menor, user_coords, parada) => {
    if (arr_menor.length === 1) {

        return getDirecciones(arr_menor[0], user_coords, parada).then(variables => {
            return { bus: arr_menor[0], variables }
        })

    } else {

        let array_puntos = arr_menor.map(bus => {
            return bus ? [parseFloat(bus.lng), parseFloat(bus.lat)] : []
        })

        array_puntos.push(user_coords)

        return await getMatriz(array_puntos).then(matriz => {

            console.log("matriz",)
            if (matriz) {
                const resp_arr = []

                matriz.durations?.forEach(fila => {
                    const length = matriz.durations[0].length
                    resp_arr.push(fila[length - 1])
                })

                resp_arr.pop()
                const indice = resp_arr.indexOf(Math.min(...resp_arr))
                const bus = arr_menor[indice]

                return getDirecciones(bus, user_coords, parada).then(variables => {
                    return { bus, variables }
                })

            }

        }).catch(error => {

            console.log(error.message)
        })
    }


}


const verificarIgualArea = async (arr_igual, user_indice, user_coords, parada) => {
    let waypoint_direccion = null
    let bus = null

    if (parada.direccion === "ida") {
        waypoint_direccion = datos.waypoints_ida
    } else if (parada.direccion === "vuelta") {
        waypoint_direccion = datos.waypoints_vuelta
    }


    let array_puntos = arr_igual.map(bus => ([parseFloat(bus.lng), parseFloat(bus.lat)]))
    const wayPoint = waypoint_direccion[user_indice].geometry.coordinates
    array_puntos.unshift(wayPoint, user_coords)



    return await getMatriz(array_puntos).then(matriz => {


        if (matriz.durations[0][1] > matriz.durations[0][2]) {
            const bus = arr_igual[0]
            return getDirecciones(bus, user_coords, parada).then(variables => {
                return { bus, variables }
            })


        }
    }).catch(error => {
        console.log(error.message)
    })

}


const getDirecciones = async (bus, user_coords, parada) => {

    const bus_coords = [parseFloat(bus.lng), parseFloat(bus.lat)]

    const bus_indice = getIndiceArea(bus_coords, parada.direccion)
    const user_indice = getIndiceArea(user_coords, parada.direccion)
    const waypoints = []


    let waypoint_direccion = null


    if (parada.direccion === "ida") {
        waypoint_direccion = datos.waypoints_ida
    } else {
        waypoint_direccion = datos.waypoints_vuelta
    }

    for (let i = bus_indice + 1; i < user_indice; i++) {
        waypoints.push(waypoint_direccion[i].geometry.coordinates)
    }

    const coordinates = [bus_coords, ...waypoints, user_coords]


    const params = {
        'coordinates': coordinates,
        'maximum_speed': 80
    }

    try {
        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-hgv', {
            method: 'POST',
            body: JSON.stringify(params),
            headers: {
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                'Content-type': 'application/json;charset=UTF-8',
                'Authorization': process.env.API_KEY
            }
        })


        if (response) {
            const direcciones = await response.json()
            let distancia = direcciones.routes[0].summary.distance
            let tiempo = direcciones.routes[0].summary.duration

            distancia = parseFloat((distancia / 1000).toFixed(2))
            tiempo = Math.ceil((tiempo * 1.25) / 60)

            return { distancia, tiempo }


        }
    }
    catch (error) {

        console.log(error.message)
    }

}


const getMatriz = async (array_puntos) => {

    try {


        const coords = {
            'locations': array_puntos,
        }


        const response = await fetch('https://api.openrouteservice.org/v2/matrix/driving-hgv', {
            method: 'POST',
            body: JSON.stringify(coords),
            headers: {
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                'Content-type': 'application/json;charset=UTF-8',
                'Authorization': process.env.API_KEY
            }
        })

        const matriz = await response.json()

        return matriz
    }
    catch (error) {

        console.log(error.message)
    }
}


const filtrarArray = (bus_array, parada) => {

    const bus_arr_direccion = bus_array.filter(item => item.direccion === parada.direccion)
    const parada_cords = datos.paradas.find(p => p.id === parada.parada_id)?.coords

    if (parada_cords) {
        const user_coords = [parada_cords.lng, parada_cords.lat]
        const user_indice = getIndiceArea(user_coords, parada.direccion)

        const arr_menor = bus_arr_direccion.filter(bus => {
            const indice_bus = getIndiceArea([bus.lng, bus.lat], parada.direccion)
            return indice_bus >= 0 && indice_bus < user_indice
        })

        const arr_igual = bus_arr_direccion.filter(bus => {
            const indice_bus = getIndiceArea([bus.lng, bus.lat], parada.direccion)
            return indice_bus === user_indice
        })

        return { arr_menor, arr_igual, user_indice, user_coords }
    } else {
        return undefined
    }

}


const fetchGPS = async () => {
    let url = "https://cors-proxy-alt.onrender.com/https://www.gpsbahia.com.ar/frontend/track_data/3.json"
    let req_info = { headers: { 'X-Requested-With': 'XMLHttpRequest' } }
    const response = await fetch(url, req_info)

    if (response.ok) {
        const parsed = await response.json()
        return parsed.data
    }
    else {
        return false
    }
}


const getIndiceArea = (punto, direccion) => {

    let areas_direccion = {}

    if (direccion === "ida") {
        areas_direccion = datos.areas_ida
    } else {
        areas_direccion = datos.areas_vuelta
    }

    const area = areas_direccion.features.find((area) => (geolib.isPointInPolygon(punto, area.geometry.coordinates[0])))
    const indice = areas_direccion.features.indexOf(area)

    return indice
}



module.exports = {
    index
};