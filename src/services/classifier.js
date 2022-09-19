// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error

// https://github.com/DAM-Project/machine-learning/blob/main/sentinel-water-detection/model-development/js/sentinelWaterDetectionPolygonApp.js
// TODO: set this up in S3 and link to as a CDN <script src=""></script>

import ee from '@google/earthengine';
// var map;
let mapId;
let eeTileSource;
let overlay;
let cart_classifier;
let Sentinel2A;
let classifier_string;
let classifier;
let BANDS;
let ic;

async function classifyData(geometry, map) {
  const doGaussBlur = false
  if(!cart_classifier){
    cart_classifier = ee.FeatureCollection("users/arunetckumar/cart_classifier_3")
    Sentinel2A = ee.ImageCollection("COPERNICUS/S2_SR");
  }
  
  // Load using this
  if(!classifier_string)
    classifier_string = cart_classifier.first().get('classifier');
  
  if(!classifier)
    classifier = ee.Classifier.decisionTree(classifier_string);

  if(!ic){
    BANDS = ['B2', 'B3', 'B4', 'B8'];
    ic = Sentinel2A
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15))
      .select(BANDS);
  }
  ic = ic.filterDate('2022-06-01', '2022-06-30')
  
  var final = ic.median().classify(classifier);
  
  if(doGaussBlur === true){
    let skinny = ee.Kernel.gaussian({
      radius: 25,
      sigma: 15,
      units: 'meters',
      normalize: true
    });
    
    let fat = ee.Kernel.gaussian({
      radius: 25,
      sigma: 20,
      units: 'meters',
      normalize: true
    });
    
    let skinnyBlur = await final.convolve(skinny);
    let fatBlur = await final.convolve(fat);
    
    let edges = await ee.Algorithms.CannyEdgeDetector(fatBlur, 0.2, 0).multiply(ee.Image(5)).add(ee.Image(1)).convolve(fat);
    
    final = await edges.multiply(skinnyBlur);
  }
  
  const palette = [
    '3f608f', // Water
    '3a9e78', // Veg
    '698549' // Land
  ]
  
  final = await final.clip(geometry);
  
  mapId = await final.getMap({palette: palette, min: 0, max: 1});
  eeTileSource = new ee.layers.EarthEngineTileSource(mapId);
  overlay = new ee.layers.ImageOverlay(eeTileSource);
  
  await map.overlayMapTypes.push(overlay);
  return {};
}
