var admin = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level2"),
    s1 = ee.ImageCollection("COPERNICUS/S1_GRD");

var before_start = '2022-03-04'
var before_end = '2022-05-20'
var after_start = '2022-05-04'
var after_end = '2022-06-01'

var bd_area = admin.filter(ee.Filter.eq('ADM1_NAME', 'Sylhet'))
var ind_area = admin.filter(ee.Filter.eq('ADM1_NAME', 'Meghalaya'))

var geometry1 = bd_area.geometry()
var geometry2 = ind_area.geometry()

var geometry = geometry1.union(geometry2);


var polarization = "VH"; 
var pass_direction = "DESCENDING"; 
var difference_threshold = 1.07; 


var aoi = ee.FeatureCollection(geometry);


var collection= ee.ImageCollection('COPERNICUS/S1_GRD')
  .filter(ee.Filter.eq('instrumentMode','IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', polarization))
  .filter(ee.Filter.eq('orbitProperties_pass',pass_direction)) 
  .filter(ee.Filter.eq('resolution_meters',10))
  .filterBounds(aoi)
  .select(polarization);
  

var before_collection = collection.filterDate(before_start, before_end);
var after_collection = collection.filterDate(after_start,after_end);


      function dates(imgcol){
        var range = imgcol.reduceColumns(ee.Reducer.minMax(), ["system:time_start"]);
        var printed = ee.String('from ')
          .cat(ee.Date(range.get('min')).format('YYYY-MM-dd'))
          .cat(' to ')
          .cat(ee.Date(range.get('max')).format('YYYY-MM-dd'));
        return printed;
      }

      var before_count = before_collection.size();
      print(ee.String('Tiles selected: Before Flood ').cat('(').cat(before_count).cat(')'),
        dates(before_collection), before_collection);
      
      
      var after_count = before_collection.size();
      print(ee.String('Tiles selected: After Flood ').cat('(').cat(after_count).cat(')'),
        dates(after_collection), after_collection);


var before = before_collection.mosaic().clip(geometry);
var after = after_collection.mosaic().clip(geometry);


var smoothing_radius = 50;
var before_filtered = before.focal_mean(smoothing_radius, 'circle', 'meters');
var after_filtered = after.focal_mean(smoothing_radius, 'circle', 'meters');



var difference = after_filtered.divide(before_filtered);


var threshold = difference_threshold;
var difference_binary = difference.gt(threshold);

      var swater = ee.Image('JRC/GSW1_0/GlobalSurfaceWater').select('seasonality');
      var swater_mask = swater.gte(10).updateMask(swater.gte(10));
      
      var flooded_mask = difference_binary.where(swater_mask,0);
      
      var flooded = flooded_mask.updateMask(flooded_mask);
      
      var connections = flooded.connectedPixelCount();    
      var flooded = flooded.updateMask(connections.gte(8));
      
      
      var DEM = ee.Image('WWF/HydroSHEDS/03VFDEM');
      var terrain = ee.Algorithms.Terrain(DEM);
      var slope = terrain.select('slope');
      var flooded = flooded.updateMask(slope.lt(5));

// Calculate flood extent area
// Create a raster layer containing the area information of each pixel 
var flood_pixelarea = flooded.select(polarization)
  .multiply(ee.Image.pixelArea());

var flood_stats = flood_pixelarea.reduceRegion({
  reducer: ee.Reducer.sum(),              
  geometry: aoi,
  scale: 10, 
  bestEffort: true
  });

var flood_area_ha = flood_stats
  .getNumber(polarization)
  .divide(10000)
  .round(); 



var population_count = ee.Image('JRC/GHSL/P2016/POP_GPW_GLOBE_V1/2015').clip(aoi);


var GHSLprojection = population_count.projection();


var flooded_res1 = flooded
    .reproject({
    crs: GHSLprojection
  });


var population_exposed = population_count
  .updateMask(flooded_res1)
  .updateMask(population_count);


var stats = population_exposed.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi,
  scale: 250,
  maxPixels:1e9 
});


var number_pp_exposed = stats.getNumber('population_count').round();


var startDate = '2022-01-01';
var endDate = '2022-06-30'; 

var LC = ee.ImageCollection('MODIS/061/MCD12Q1')
          .filterDate(startDate, endDate)
          .sort('system:index', false)
          .select("LC_Type1")
          .first();


var cropmask = LC
  .eq(12)
  .or(LC.eq(14));
var cropland = LC
  .updateMask(cropmask)
  .clip(geometry);
  

var MODISprojection = LC.projection();


var flooded_res = flooded
    .reproject({
    crs: MODISprojection
  });


var cropland_affected = flooded_res
  .updateMask(cropland)


var crop_pixelarea = cropland_affected
  .multiply(ee.Image.pixelArea());


var crop_stats = crop_pixelarea.reduceRegion({
  reducer: ee.Reducer.sum(),              
  geometry: geometry,
  scale: 500,
  maxPixels: 1e9
  });
  
// convert area to hectares
var crop_area_ha = crop_stats
  .getNumber(polarization)
  .divide(10000)
  .round();


var urbanmask = LC.eq(13);
var urban = LC
  .updateMask(urbanmask)
  .clip(geometry);


var urban_affected = urban
  .mask(flooded_res)
  .updateMask(urban);


var urban_pixelarea = urban_affected
  .multiply(ee.Image.pixelArea()); 
var urban_stats = urban_pixelarea.reduceRegion({
  reducer: ee.Reducer.sum(),              
  geometry: aoi,
  scale: 500,
  bestEffort: true,
  });


var urban_area_ha = urban_stats
  .getNumber('LC_Type1')
  .divide(10000)
  .round();


Map.centerObject(aoi,8);
Map.addLayer(before_filtered, {min:-25,max:0}, 'Before Flood',0);
Map.addLayer(after_filtered, {min:-25,max:0}, 'After Flood',1);


Map.addLayer(difference,{min:0,max:2},"Difference Layer",0);


Map.addLayer(flooded,{palette:"0000FF"},'Flooded areas');


var populationCountVis = {
  min: 0,
  max: 200.0,
  palette: ['060606','337663','337663','ffffff'],
};
Map.addLayer(population_count, populationCountVis, 'Population Density',0);


var populationExposedVis = {
  min: 0,
  max: 500.0,
  palette: ['#fef08a', '#fde047', '#eab308', '#ea580c', '#ef4444', '#b91c1c'],
};
Map.addLayer(population_exposed, populationExposedVis, 'Exposed Population');


var LCVis = {
  min: 1.0,
  max: 17.0,
  palette: [
    '05450a', '086a10', '54a708', '78d203', '009900', 'c6b044', 'dcd159',
    'dade48', 'fbff13', 'b6ff05', '27ff87', 'c24f44', 'a5a5a5', 'ff6d4c',
    '69fff8', 'f9ffa4', '1c0dff'
  ],
};


var croplandVis = {
  min: 0,
  max: 17,
  palette: [
    '05450a', '086a10', '54a708', '78d203', '009900', 'c6b044', 'dcd159',
    'dade48', 'fbff13', 'b6ff05', '27ff87', 'c24f44', 'a5a5a5', 'ff6d4c',
    '69fff8', 'f9ffa4', '1c0dff'
  ]
};


var urbanVis = {
  min: 0,
  max: 17,
  palette: [
    '05450a', '086a10', '54a708', '78d203', '009900', 'c6b044', 'dcd159',
    'dade48', 'fbff13', 'b6ff05', '27ff87', 'c24f44', 'a5a5a5', 'ff6d4c',
    '69fff8', 'f9ffa4', '1c0dff'
  ]
};


Map.addLayer(LC, LCVis, 'Land Cover',0); 
var cropmask = LC
  .eq(12)
  .or(LC.eq(14));
var cropland = LC
  .updateMask(cropmask)
  .clip(geometry);

var urbanmask = LC.eq(13);
var urban = LC
  .updateMask(urbanmask)
  .clip(geometry);

Map.addLayer(cropland, croplandVis, 'Cropland',0)
Map.addLayer(cropland_affected, croplandVis, 'Affected Cropland'); 


var cropland_affected = flooded_res
  .updateMask(cropland)
  .clip(geometry);

var urban_affected = urban
  .mask(flooded_res)
  .updateMask(urban)
  .clip(geometry);

Map.addLayer(urban, urbanVis, 'Urban',0)


Map.addLayer(urban_affected, urbanVis, 'Affected Urban'); 



Export.image.toDrive({
  image: flooded, 
  description: 'Flood_extent_raster',
  fileNamePrefix: 'flooded',
  region: aoi, 
  maxPixels: 1e10
});


var flooded_vec = flooded.reduceToVectors({
  scale: 10,
  geometryType:'polygon',
  geometry: geometry,
  eightConnected: false,
  bestEffort:true,
  tileScale:2,
});


Export.table.toDrive({
  collection:flooded_vec,
  description:'Flood_extent_vector',
  fileFormat:'SHP',
  fileNamePrefix:'flooded_vec'
});


// Exposed population density
Export.image.toDrive({
  image:population_exposed,
  description:'Exposed_Populuation',
  scale: 250,
  fileNamePrefix:'population_exposed',
  region: aoi,
  maxPixels:1e10
});

var pop_vec = urban_affected.reduceToVectors({
  scale: 10,
  geometryType:'polygon',
  geometry: geometry,
  eightConnected: false,
  bestEffort:true,
  tileScale:2,
});

Export.table.toDrive({
  collection:pop_vec,
  description:'pop_vector',
  fileFormat:'SHP',
  fileNamePrefix:'pop_vec'
});


//population_exposed
var exposed_vec = population_exposed.reduceToVectors({
  scale: 10,
  geometryType:'polygon',
  geometry: geometry,
  eightConnected: false,
  bestEffort:true,
  tileScale:2,
});

Export.table.toDrive({
  collection:exposed_vec,
  description:'exposed_vec',
  fileFormat:'SHP',
  fileNamePrefix:'exposed_vec'
});



//cropland_affected

Export.image.toDrive({
  image:cropland_affected,
  description:'Cropland_Affected',
  scale: 250,
  fileNamePrefix:'cropland_affected',
  region: aoi,
  maxPixels:1e10
});

var pop_vec = cropland_affected.reduceToVectors({
  scale: 10,
  geometryType:'polygon',
  geometry: geometry,
  eightConnected: false,
  bestEffort:true,
  tileScale:2,
});

Export.table.toDrive({
  collection:cropland_affected,
  description:'cropland_affected',
  fileFormat:'SHP',
  fileNamePrefix:'cropland_affected'
});

//exporting before_after

Export.image.toDrive({
  image:after,
  description:'After Flood',
  scale: 250,
  fileNamePrefix:'After Flood',
  region: aoi,
  maxPixels:1e10
});

Export.image.toDrive({
  image:before,
  description:'Before Flood',
  scale: 250,
  fileNamePrefix:'Before Flood',
  region: aoi,
  maxPixels:1e10
});


var results = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px',
    width: '350px'
  }
});


var textVis = {
  'margin':'0px 8px 2px 0px',
  'fontWeight':'bold'
  };
var numberVIS = {
  'margin':'0px 0px 15px 0px', 
  'color':'bf0f19',
  'fontWeight':'bold'
  };
var subTextVis = {
  'margin':'0px 0px 2px 0px',
  'fontSize':'12px',
  'color':'grey'
  };

var titleTextVis = {
  'margin':'0px 0px 15px 0px',
  'fontSize': '18px', 
  'font-weight':'', 
  'color': '3333ff'
  };


var title = ui.Label('Results', titleTextVis);
var text1 = ui.Label('Flood status between:',textVis);
var number1 = ui.Label(after_start.concat(" and ",after_end),numberVIS);


var text2 = ui.Label('Estimated flood extent:',textVis);
var text2_2 = ui.Label('Please wait...',subTextVis);
dates(after_collection).evaluate(function(val){text2_2.setValue('based on Senintel-1 imagery '+val)});
var number2 = ui.Label('Please wait...',numberVIS); 
flood_area_ha.evaluate(function(val){number2.setValue(val+' hectares')}),numberVIS;


var text3 = ui.Label('Estimated number of exposed people: ',textVis);
var text3_2 = ui.Label('based on GHSL 2015 (250m)',subTextVis);
var number3 = ui.Label('Please wait...',numberVIS);
number_pp_exposed.evaluate(function(val){number3.setValue(val)}),numberVIS;


var MODIS_date = ee.String(LC.get('system:index')).slice(0,4);
var text4 = ui.Label('Estimated affected cropland:',textVis);
var text4_2 = ui.Label('Please wait', subTextVis)
MODIS_date.evaluate(function(val){text4_2.setValue('based on MODIS Land Cover '+val +' (500m)')}), subTextVis;
var number4 = ui.Label('Please wait...',numberVIS);
crop_area_ha.evaluate(function(val){number4.setValue(val+' hectares')}),numberVIS;


var text5 = ui.Label('Estimated affected urban areas:',textVis);
var text5_2 = ui.Label('Please wait', subTextVis)
MODIS_date.evaluate(function(val){text5_2.setValue('based on MODIS Land Cover '+val +' (500m)')}), subTextVis;
var number5 = ui.Label('Please wait...',numberVIS);
urban_area_ha.evaluate(function(val){number5.setValue(val+' hectares')}),numberVIS;


var text6 = ui.Label('Disclaimer: This product has been derived automatically without validation data. All geographic information has limitations due to the scale, resolution, date and interpretation of the original source materials. No liability concerning the content or the use thereof is assumed by the producer.',subTextVis)


var text7 = ui.Label('Script produced by: UN-SPIDER December 2022', subTextVis)


results.add(ui.Panel([
        title,
        text1,
        number1,
        text2,
        text2_2,
        number2,
        text3,
        text3_2,
        number3,
        text4,
        text4_2,
        number4,
        text5,
        text5_2,
        number5,
        text6,
        text7]
      ));


Map.add(results);


var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px 15px',
  }
});
 

var legendTitle = ui.Label('Legend',titleTextVis);
 

legend.add(legendTitle);
 

var makeRow = function(color, name) {
 
      
      var colorBox = ui.Label({
        style: {
          backgroundColor: color,
          
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });
 
     
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
 
      
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
};
 

var palette =['#0000FF', '#30b21c', 'grey'];

var names = ['potentially flooded areas','affected cropland','affected urban'];
 
for (var i = 0; i < 3; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  


var legendTitle2 = ui.Label({
value: 'Exposed population density',
style: {
fontWeight: 'bold',
fontSize: '15px',
margin: '10px 0 0 0',
padding: '0'
}
});

legend.add(legendTitle2);


var lon = ee.Image.pixelLonLat().select('latitude');
var gradient = lon.multiply((populationExposedVis.max-populationExposedVis.min)/100.0).add(populationExposedVis.min);
var legendImage = gradient.visualize(populationExposedVis);
 

var panel = ui.Panel({
widgets: [
ui.Label('> '.concat(populationExposedVis['max']))
],
});
 
legend.add(panel);
 

var thumbnail = ui.Thumbnail({
image: legendImage,
params: {bbox:'0,0,10,100', dimensions:'10x50'},
style: {padding: '1px', position: 'bottom-center'}
});

legend.add(thumbnail);
 
var panel = ui.Panel({
widgets: [
ui.Label(populationExposedVis['min'])
],
});
 
legend.add(panel);
 
Map.add(legend);
