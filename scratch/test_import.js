async function test() {
  try {
    const ChartGeo = await import('chartjs-chart-geo');
    console.log('Keys of ChartGeo:', Object.keys(ChartGeo));
    if (ChartGeo.topojson) {
      console.log('topojson helper is present on ChartGeo');
    } else {
      console.log('topojson helper is NOT present on ChartGeo');
    }
  } catch (e) {
    console.error('Error importing chartjs-chart-geo:', e);
  }
}
test();
