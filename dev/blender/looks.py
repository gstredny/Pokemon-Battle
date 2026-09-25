"""What each trainer wears: a palette plus a few outfit choices.

Keys match the trainer ids in index.html; colours follow TRAINER_LOOKS in
battle3d.js so a trainer looks the same as its primitive figure. Choices:
  hair     cap | ponytail | spiky | short | long | bob        (headwear.py)
  top      jacket | tank | shirt | vest | coat | suit          torso cut (body.py)
  sleeve   none | short | long                                 how far the sleeve reaches
  glove    none | fingerless | full
  legs     long | shorts | wide | skirt                        skirt: bare legs under a flared skirt
  extras   straps, cape, scarf, tie, pendant (outfit.py), headband (headwear.py),
           cheek_marks, squint, mustache (body.py)
  size     optional, 1 by default: the whole trainer is scaled by it (the kids are smaller)
  head     optional, 1 by default: the head and hair are scaled by it (kids have big heads)
Palette names are the paint keys those builders use.
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
    'brock': {
        'hair': 'spiky', 'top': 'vest', 'sleeve': 'long', 'glove': 'none', 'legs': 'long',
        'extras': ['squint'],
        'palette': {
            'skin': '#c98d5e', 'hair': '#3f2a18', 'mouth': '#6e2f24',
            'top': '#3e8e41', 'sleeve': '#3e8e41', 'vest': '#e8892a',
            'pants': '#5a3d22', 'shoe': '#333333', 'sole': '#d8d8d8',
        },
    },
    'gary': {
        'hair': 'spiky', 'top': 'shirt', 'sleeve': 'long', 'glove': 'none', 'legs': 'long',
        'extras': ['pendant'],
        'palette': {
            'skin': '#f3c99a', 'hair': '#7a4a1e', 'iris': '#3b2616', 'mouth': '#7a2e2e',
            'top': '#6a1b9a', 'sleeve': '#6a1b9a', 'pendant': '#f4d03f',
            'pants': '#2b2b2b', 'shoe': '#111111', 'sole': '#d8d8d8',
        },
    },
    'sabrina': {
        'hair': 'long', 'top': 'shirt', 'sleeve': 'long', 'glove': 'none', 'legs': 'long',
        'extras': [],
        'palette': {
            'skin': '#f7dcc8', 'hair': '#1f3b30', 'iris': '#b0305a', 'mouth': '#a8423c',
            'top': '#c62828', 'sleeve': '#c62828',
            'pants': '#f2f2f2', 'shoe': '#c62828', 'sole': '#f2f2f2',
        },
    },
    'koga': {
        'hair': 'short', 'top': 'shirt', 'sleeve': 'long', 'glove': 'full', 'legs': 'long',
        'extras': ['scarf'],
        'palette': {
            'skin': '#e8c39e', 'hair': '#111111', 'iris': '#2a1a10', 'mouth': '#6e2f24',
            'top': '#4a148c', 'sleeve': '#4a148c', 'glove': '#4a148c', 'scarf': '#d32f2f',
            'pants': '#4a148c', 'shoe': '#222222', 'sole': '#444444',
        },
    },
    'lance': {
        'hair': 'spiky', 'top': 'shirt', 'sleeve': 'long', 'glove': 'none', 'legs': 'long',
        'extras': ['cape'],
        'palette': {
            'skin': '#f3c99a', 'hair': '#d32f2f', 'iris': '#3b2616', 'mouth': '#7a2e2e',
            'top': '#1a237e', 'sleeve': '#1a237e', 'cape': '#1c1c1c', 'capeInner': '#d32f2f',
            'pants': '#1a237e', 'shoe': '#222222', 'sole': '#444444',
        },
    },
    'erika': {
        'hair': 'bob', 'top': 'shirt', 'sleeve': 'long', 'glove': 'none', 'legs': 'wide',
        'extras': ['headband'],
        'palette': {
            'skin': '#f7dcc8', 'hair': '#263238', 'iris': '#3b2616', 'mouth': '#b04a4a',
            'top': '#d9c56a', 'sleeve': '#d9c56a', 'headband': '#d32f2f',
            'pants': '#b23a48', 'shoe': '#333333', 'sole': '#f2f2f2',
        },
    },
    'prof': {
        'hair': 'short', 'top': 'coat', 'sleeve': 'long', 'glove': 'none', 'legs': 'long',
        'extras': [],
        'palette': {
            'skin': '#f3c99a', 'hair': '#c9c9c9', 'iris': '#3b2616', 'mouth': '#7a2e2e',
            'top': '#7b1fa2', 'coat': '#f5f5f5', 'sleeve': '#f5f5f5',
            'pants': '#5d4037', 'shoe': '#222222', 'sole': '#444444',
        },
    },
    'giovanni': {
        'hair': 'short', 'top': 'suit', 'sleeve': 'long', 'glove': 'none', 'legs': 'long',
        'extras': ['tie'],
        'palette': {
            'skin': '#e8c39e', 'hair': '#111111', 'iris': '#2a1a10', 'mouth': '#6e2f24',
            'top': '#e65100', 'sleeve': '#e65100', 'shirt': '#f2f2f2', 'tie': '#111111',
            'pants': '#e65100', 'shoe': '#111111', 'sole': '#333333',
        },
    },
}
