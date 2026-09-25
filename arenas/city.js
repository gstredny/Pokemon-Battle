// The City: a paved plaza between tall buildings on a sunny day, built in
// Blender from ambientCG building fronts and Poly Haven street scans
// (dev/blender/places/city.py; credits in city/LICENSES.md).
import { photoPlace } from './photo-place.js';

export default photoPlace({
  id: 'city', name: 'City', icon: '🏙️', blurb: 'A plaza between tall buildings',
  css: 'linear-gradient(180deg, #4a8ad8 0%, #bcd8f6 38%, #7d8794 52%, #5b626c 70%, #3a3f46 100%)',
  look: { sunStrength: 2.0, hemisphere: 0.3, sky: '#dbe8ff', ground: '#5a5a5a' },
});
