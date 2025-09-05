import HeightfieldCDLOD from '../../packages/terrain/src/HeightfieldCDLOD.js';

const canvas = document.getElementById('gfx');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const dist = parseFloat(params.get('dist') || '10');

const lodDistances = [20, 60, 180, 540];
const terrain = new HeightfieldCDLOD({ tileCount: 1, tileSize: 1, lodDistances, morphRange: 10 });
const lod = terrain.getLod(dist);

const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
ctx.fillStyle = colors[lod];
ctx.fillRect(0, 0, canvas.width, canvas.height);

window.__rendered = true;
