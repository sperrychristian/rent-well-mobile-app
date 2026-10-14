import glyph_map from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

// the Hearth pass uses line icons only, so any filled Ionicons name gets swapped for its outline twin
// ("alert-circle" becomes "alert-circle-outline"), names that are already outline or have no twin stay as they are
export function lineIcon(name) {
  if (!name || typeof name !== 'string') {
    return name;
  }
  if (name.endsWith('-outline') || name.endsWith('-sharp')) {
    return name;
  }
  const outline = name + '-outline';
  return glyph_map[outline] !== undefined ? outline : name;
}
