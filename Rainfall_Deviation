var chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/PENTAD"),
    bd = ee.FeatureCollection("projects/ee-paulrainfall/assets/shp");
var lpaYears = ee.List.sequence(1986, 2021)
var months = ee.List.sequence(1, 12)


var monthlyImages = lpaYears.map(function(year) {
  return months.map(function(month) {
    var filtered = chirps
      .filter(ee.Filter.calendarRange(year, year, 'year'))
      .filter(ee.Filter.calendarRange(month, month, 'month'))
    var monthly = filtered.sum()
    return monthly.set({'month': month, 'year': year})
  })
}).flatten()

var monthlyCol = ee.ImageCollection.fromImages(monthlyImages)

var longTermMeans = months.map(function(month) {
    var filtered = monthlyCol.filter(ee.Filter.eq('month', month))
    var monthlyMean = filtered.mean()
    return monthlyMean.set('month', month)
})
var monthlyRainfall = ee.ImageCollection.fromImages(longTermMeans)

var filtered = chirps
  .filter(ee.Filter.date('2022-01-01', '2022-12-31'))

var monthlyTotals = months
  .map(function(month) {
    return filtered
      .filter(ee.Filter.calendarRange(month, month, 'month'))
        .sum()
        .set('month', month);
});
var currentRainfall = ee.ImageCollection.fromImages(monthlyTotals)


var startMonth = 6
var endEnd = startMonth

var combinedFilter = ee.Filter.and(
  ee.Filter.gte('month', startMonth), ee.Filter.lte('month', startMonth))
var rainfallNormal = monthlyRainfall.filter(combinedFilter).sum()
var rainfallObserved = currentRainfall.filter(combinedFilter).sum()
var seasonalDeviation = (rainfallObserved.subtract(rainfallNormal)
    .divide(rainfallNormal)).multiply(100)
    
var visParams = {
  min:-60,
  max:100,
  palette: ['white', '#E3F2FD', '#64B5F6', '#2979FF', '#1565C0', '#0D47A1', '#26A69A', '#00796B', '#D4E157', '#AFB42B', '#FB8C00', '#E65100', '#E64A19', '#BF360C', 'FE0000', 'F76DF9', 'FB00FF']
}
Map.addLayer(seasonalDeviation.clip(bd), visParams, 'Deviation')

Export.image.toAsset({
  image: seasonalDeviation,
  description: 'Seasonal_Deviation_2022_4',
  assetId: 'users/ujavalgandhi/e2e_projects/2022_4_rainfall_deviation',
  region: bd.geometry(),
  scale: 5000})
  
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});


var addColorLegend = function(palette, min, max, title) {
  
  var paletteLabels = ee.List.sequence(min, max, (max-min)/palette.length);
  var colors = palette.map(function(color) {
    return ui.Label({
      style: {
        backgroundColor: color,
        padding: '8px',
        margin: '0 0.1em'
      }
    });
  });
  
 
  var legendTitle = ui.Label({
    value: title,
    style: {fontWeight: 'bold'}
  });
  var legendPanel = ui.Panel(colors.concat(ui.Panel([legendTitle], 'flow', {margin: '1px 3px'})));
  legend.add(legendPanel);
};


addColorLegend(visParams.palette, visParams.min, visParams.max, 'Deviation (%)');
Map.add(legend);


var deviation = months.map(function(month) {
  var longTermMean = monthlyRainfall
    .filter(ee.Filter.eq('month', month)).first();
  var monthlyObserved = currentRainfall
    .filter(ee.Filter.eq('month', month)).first();
  var deviation = (monthlyObserved.subtract(longTermMean)
    .divide(longTermMean)).multiply(100)
    .set('month', month);
  return deviation;
});
