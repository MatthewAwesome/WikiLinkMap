import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Map } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, GeoJsonLayer, ArcLayer } from '@deck.gl/layers';
import {HeatmapLayer} from '@deck.gl/aggregation-layers';
import axios from 'axios';
import type { PickingInfo, MapViewState, GlobeViewState } from '@deck.gl/core';
import {
    COORDINATE_SYSTEM,
    _GlobeView as GlobeView,
    LightingEffect,
    AmbientLight,
    _SunLight as SunLight,
} from '@deck.gl/core';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { SphereGeometry } from '@luma.gl/engine';
import wikiEditData from './changesWithLocations.json';

const EARTH_RADIUS_METERS = 6.3e6;

type WikiEdit = {
    coordinates: [longitude: number, latitude: number];
};
const wikiEdits: WikiEdit[] = wikiEditData.map((edit: any) => ({
    coordinates: [edit.longitude, edit.latitude],
  }));

type BikeRack = {
ADDRESS: string;
SPACES: number;
COORDINATES: [longitude: number, latitude: number];
};

const INITIAL_VIEW_STATE: MapViewState = {
    latitude: 40.7127,
    longitude: -74.0059,
    zoom: 4.5,
    maxZoom: 16,
    pitch: 50,
    bearing: 0
};

const INITIAL_VIEW_STATE_GLOBE: GlobeViewState = {
    longitude: 0,
    latitude: 20,
    zoom: 0
};


// const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
const BORDERS_DATA_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson'; // URL to GeoJSON data


// The main component. with a lineWidth prop (so we can change the width of the arcs if we want to)
export default function App({
    lineWidth = 2,
}: {
    lineWidth?: number;
}) {
    // const [wikiData, setWikiData] = useState([]);
    // const [wikiLinks, setWikiLinks] = useState([]);
    useEffect(() => {
        console.log('fetching data');
    }, []);

    const backgroundLayers = useMemo(
        () => [
            new SimpleMeshLayer({
                id: 'earth-sphere',
                data: [0],
                mesh: new SphereGeometry({ radius: EARTH_RADIUS_METERS, nlat: 18, nlong: 36 }),
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                getPosition: [0, 0, 0],
                getColor: [0, 0, 0],
            }),
            new GeoJsonLayer({
                id: 'earth-land',
                data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson',
                // Styles
                stroked: false,
                filled: true,
                opacity: 0.2,
                getFillColor: [30, 80, 120, 180],
            })
        ],
        []
    );
    const bordersLayer = new GeoJsonLayer({
        id: 'borders',
        data: BORDERS_DATA_URL,
        stroked: true,
        filled: false,
        lineWidthMinPixels: 1,
        getLineColor: [80, 80, 100, 50]
    });

    const dataLayers = [
        new HeatmapLayer<BikeRack>({
            id: 'HeatmapLayer',
            data: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/sf-bike-parking.json',
        
            aggregation: 'SUM',
            getPosition: (d: BikeRack) => d.COORDINATES,
            getWeight: (d: BikeRack) => d.SPACES,
            radiusPixels: 25
          })
    ];

    return (
        <DeckGL
            views={new GlobeView()}
            layers={[backgroundLayers, bordersLayer, dataLayers]}
            initialViewState={INITIAL_VIEW_STATE_GLOBE}
            controller={true}
            pickingRadius={5}
            parameters={{
                blendColorOperation: 'add',
                blendColorSrcFactor: 'src-alpha',
                blendColorDstFactor: 'one',
                blendAlphaOperation: 'add',
                blendAlphaSrcFactor: 'one-minus-dst-alpha',
                blendAlphaDstFactor: 'one'
            }}
        >
        </DeckGL>
    );
}

export function renderToDOM(container: HTMLDivElement) {
    createRoot(container).render(<App />);
}