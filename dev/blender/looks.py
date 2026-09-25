"""What each trainer wears: a palette plus a few outfit choices.

Keys match the trainer ids in index.html. Outfit choices:
  hair     cap | ponytail                         (headwear.py)
  top      jacket | tank                          torso cut
  sleeve   none | short | long                    how far the sleeve reaches
  glove    none | fingerless
  legs     long | shorts
  extras   straps, cheek_marks
Palette names are the paint keys body.py and headwear.py use.
"""

LOOKS = {
    'ash': {
        'hair': 'cap', 'top': 'jacket', 'sleeve': 'short', 'glove': 'fingerless', 'legs': 'long',
        'extras': ['cheek_marks'],
        'palette': {
            'skin': '#f3c99a', 'hair': '#1b1b1b', 'iris': '#3b2616', 'mouth': '#7a2e2e',
            'cap': '#d8322b', 'capPanel': '#ffffff', 'capMark': '#3ba55c',
            'top': '#2153a8', 'sleeve': '#ffffff', 'trim': '#f4d03f',
            'pants': '#5b7fbf', 'glove': '#2e9e4a', 'shoe': '#222222', 'sole': '#f2f2f2',
        },
    },
    'misty': {
        'hair': 'ponytail', 'top': 'tank', 'sleeve': 'none', 'glove': 'none', 'legs': 'shorts',
        'extras': ['straps'],
        'palette': {
            'skin': '#f6d2b0', 'hair': '#ff7a1f', 'iris': '#2aa198', 'mouth': '#a8423c',
            'top': '#ffd23f', 'pants': '#4f78c2', 'straps': '#e53935',
            'shoe': '#e53935', 'sole': '#f2f2f2',
        },
    },
}
