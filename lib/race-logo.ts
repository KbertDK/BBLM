const RACE_LOGO_FILES: Record<string, string> = {
  'Amazon':            'amazon',
  'Apes of Wrath':     'apresofwrath',
  'Brettonia':         'brettonian',
  'Chaos':             'chaos',
  'Chaos Dwarf':       'chaosdwarf',
  'Chaos Pact':        'chaospact',
  'Daemons of Khorne': 'khorne',
  'Dark Elf':          'darkelf',
  'Dwarf':             'dwarf',
  'Elf / Pro Elf':     'elf',
  'Goblin':            'goblin',
  'Halfling':          'halfling',
  'High Elf':          'highelf',
  'Human':             'human',
  'Khemri':            'khemri',
  'Lizardmen':         'lizardmen',
  'Necromantic':       'necromantic',
  'Norse':             'norse',
  'Nurgle':            'nurgle',
  'Ogre':              'ogros',
  'Orc':               'orc',
  'Skaven':            'skaven',
  'Slann':             'slann',
  'Undead':            'undead',
  'Underworld':        'underworld',
  'Vampire':           'vampire',
  'Wood Elf':          'woodelf',
}

export function getRaceLogo(raceName: string): string | null {
  const file = RACE_LOGO_FILES[raceName]
  return file ? `/race-logos/${file}.png` : null
}
