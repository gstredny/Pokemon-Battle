// The Mountains: a green alpine meadow under the Alps, built in Blender from
// scanned CC0 models (dev/blender/places/mountains.py; credits in
// mountains/LICENSES.md).
import { photoPlace } from './photo-place.js';

export default photoPlace({
  id: 'mountains', name: 'Mountains', icon: '⛰️', blurb: 'A green meadow under the Alps',
  css: 'linear-gradient(180deg, #3f7fd6 0%, #cfe3ff 40%, #9aa8a0 50%, #5f8a3a 66%, #3f6a2a 100%)',
  look: { sunStrength: 2.2, hemisphere: 0.3, sky: '#e2ecff', ground: '#4a5a2a', tint: { meadow: '#a8d070' } },
});
