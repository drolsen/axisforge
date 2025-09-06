import HeightfieldCDLOD from '../../packages/terrain/src/HeightfieldCDLOD.js';

const params = new URLSearchParams(location.search);
const dist = parseFloat(params.get('dist') || '0');
const cd = new HeightfieldCDLOD();
const lod = cd.getLOD(dist);
const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff'];

document.body.style.margin = '0';
document.body.style.width = '64px';
document.body.style.height = '64px';
document.body.style.background = colors[lod];
