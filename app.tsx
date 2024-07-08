import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Map } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, GeoJsonLayer, ArcLayer } from '@deck.gl/layers';
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

const EARTH_RADIUS_METERS = 6.3e6;
type WikiPage = {
    title: string;
    coordinates: [longitude: number, latitude: number];
};

type WikiLink = {
    start: [longitude: number, latitude: number];
    end: [longitude: number, latitude: number];
    title: string;
    distance: number;
    startTitle: string;
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

// To make the map interactive. 
function getTooltip({ object }: PickingInfo) {
    if (object && 'coordinates' in object) {
        // This is a WikiPage
        return `Title: ${(object as WikiPage).title}`;
    } else if (object) {
        // This is a WikiLink
        return `From: ${(object as WikiLink).startTitle},\nTo: ${(object as WikiLink).title}`;
    }
}

// The main component. with a lineWidth prop (so we can change the width of the arcs if we want to)
export default function App({
    lineWidth = 2,
}: {
    lineWidth?: number;
}) {
    const [wikiData, setWikiData] = useState([]);
    const [wikiLinks, setWikiLinks] = useState([]);
    useEffect(() => {
        // Arrays to hold data. 
        let pagesArray = [];
        let linksArray = [];
        // Fetch data from wikipedia
        const fetchData = async () => {
            try {

                // The initial fetch: 
                const wikipediaEndpoint = 'https://en.wikipedia.org/w/api.php';
                const title = 'Tehran';
                const response = await axios.get(wikipediaEndpoint, {
                    params: {
                        action: 'query',
                        titles: title,
                        prop: 'links|coordinates',
                        pllimit: 'max',
                        plnamespace: 0,
                        format: 'json',
                        origin: '*'
                    }
                });

                // Get the page object from the response
                const page: any = Object.values(response.data.query.pages)[0];
                // Grab the coordinates. 
                if (page.coordinates) {
                    const coords = page.coordinates[0];
                    let coordinates = [coords.lon, coords.lat]
                    pagesArray.push({ 'title': title, 'coordinates': coordinates });
                }

                // Now I want to find coordiantes for all the links, doing so in batches of 50. 
                let links = page.links;
                let linkTitles = links.map(link => link.title);
                let linkTitlesBatches = [];
                let batchSize = 50;
                // Make the batches of 50. 
                for (let i = 0; i < linkTitles.length; i += batchSize) {
                    linkTitlesBatches.push(linkTitles.slice(i, i + batchSize));
                }
                // Iterate over the batches
                for (let i = 0; i < linkTitlesBatches.length; i++) {
                    let batch = linkTitlesBatches[i];
                    let response = await axios.get(wikipediaEndpoint, {
                        params: {
                            action: 'query',
                            titles: batch.join('|'),
                            prop: 'coordinates',
                            format: 'json',
                            origin: '*'
                        }
                    });
                    // Grab the pages from the response. 
                    let pages = Object.values(response.data.query.pages);
                    // Iterate over the pages: 
                    for (let j = 0; j < pages.length; j++) {
                        let linkPage: any = pages[j];
                        // Check for coords: 
                        if (linkPage.coordinates) {
                            console.log(linkPage);
                            const coords = linkPage.coordinates[0];
                            let coordinates = [coords.lon, coords.lat]
                            // Now add to the pages array
                            pagesArray.push({ 'title': linkPage.title, 'coordinates': coordinates });
                            linksArray.push({ 'start': coordinates, 'end': pagesArray[0].coordinates, 'title': linkPage.title, distance: 1, startTitle: pagesArray[0].title });
                        }
                    }
                }
                // We now want to look for second-order links.
                let linksWithCoords = pagesArray.slice(1).map(page => page.title);
                // Lets make the batches again.
                let linksWithCoordsBatches = [];
                for (let i = 0; i < linksWithCoords.length; i += batchSize) {
                    linksWithCoordsBatches.push(linksWithCoords.slice(i, i + batchSize));
                }
                // Iterate over these links: 
                // for (let i = 0; i < linksWithCoordsBatches.length; i++) {
                //     let batch = linksWithCoordsBatches[i];
                //     let response = await axios.get(wikipediaEndpoint, {
                //         params: {
                //           action: 'query',
                //           titles: batch.join('|'),
                //           prop: 'links',
                //           pllimit: 'max',
                //           plnamespace:0,
                //           format: 'json',
                //           origin: '*'
                //         }
                //       });
                //     // Grab the pages in the response (e.g links of links)
                //     let pages = Object.values(response.data.query.pages);
                //     // Iterate over links of links. 
                //     for (let j = 0; j < pages.length; j++) {
                //         let linkPage: any = pages[j]; 
                //         // Check for coords: 
                //         if (linkPage.links) {
                //             let secondaryLinks = linkPage.links;
                //             let secondaryLinkTitles = secondaryLinks.map(link => link.title);
                //             let secondaryLinkTitlesBatches = [];
                //             for (let k = 0; k < secondaryLinkTitles.length; k += batchSize) {
                //                 secondaryLinkTitlesBatches.push(secondaryLinkTitles.slice(k, k + batchSize));
                //             }
                //             // Now we call the API again, on the secondary link batches. 
                //             for (let ii = 0; ii < secondaryLinkTitlesBatches.length; ii++) {
                //                 let secondaryBatch = secondaryLinkTitlesBatches[ii];
                //                 let secondaryResponse = await axios.get(wikipediaEndpoint, {
                //                     params: {
                //                       action: 'query',
                //                       titles: secondaryBatch.join('|'),
                //                       prop: 'coordinates',
                //                       format: 'json',
                //                       origin: '*'
                //                     }
                //                   });
                //                 let secondaryPages = Object.values(secondaryResponse.data.query.pages);
                //                 for (let jj = 0; jj < secondaryPages.length; jj++) {
                //                     let secondaryPage: any = secondaryPages[jj]; // Add type assertion here
                //                     if (secondaryPage.coordinates) {
                //                         const secondaryCoords = secondaryPage.coordinates[0];
                //                         let secondaryCoordinates = [secondaryCoords.lon, secondaryCoords.lat]
                //                         // Lets find the index of page.title in the pagesArray
                //                         let index = pagesArray.findIndex(page => page.title === linkPage.title);
                //                         pagesArray.push({'title': secondaryPage.title, 'coordinates': secondaryCoordinates});
                //                         linksArray.push({'start': secondaryCoordinates, 'end':pagesArray[index].coordinates, 'title': secondaryPage.title, distance: 2, startTitle: pagesArray[index].title});
                //                     }
                //                 }
                //             }
                //         }
                //     }
                // }
                console.log(linksArray);
                setWikiData(pagesArray);
                setWikiLinks(linksArray);

            } catch (error) {
                console.error(error);
            }
        };
        fetchData();
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
        new ScatterplotLayer<WikiPage>({
            id: 'wiki-titles',
            data: wikiData,
            radiusScale: 20,
            getPosition: d => d.coordinates,
            getFillColor: [255, 140, 0],
            getRadius: d => {
                return 1;
            },
            pickable: true
        }),
        new ArcLayer<WikiLink>({
            id: 'wiki-links',
            data: wikiLinks,
            opacity: 0.8,
            getSourcePosition: d => d.start,
            getTargetPosition: d => d.end,
            getSourceColor: d => {
                const r = d.distance;
                return [255 * (1 - r * 2), 128 * r, 255 * r, 128];
            },
            getTargetColor: d => {
                const r = d.distance;
                return [255 * (1 - r * 2), 128 * r, 255 * r, 128];
            },
            getHeight: () => 0.1, // Make the arcs flat
            getWidth: lineWidth,
            pickable: true
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
            getTooltip={getTooltip}
        >
        </DeckGL>
    );
}

export function renderToDOM(container: HTMLDivElement) {
    createRoot(container).render(<App />);
}