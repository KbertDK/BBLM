export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'datetime'

// Override metadata — only for things DMMF can't derive
export interface FieldMetaOverride {
  type?: FieldType    // use only for 'textarea'; or 'select' with custom options on non-enum Strings
  readonly?: boolean  // explicit override (e.g. loose FK strings, stable unique IDs)
  options?: string[]  // only used when type='select' on a non-enum String field
}

export interface TableMetaOverride {
  key: string
  label?: string
  description?: string
  fields?: string[]                           // custom field display order (omit to use DMMF order)
  fieldMeta?: Record<string, FieldMetaOverride>
}

// Resolved field metadata — pre-computed server-side and passed to DataTable
export interface ResolvedField {
  name: string
  type: FieldType
  readonly: boolean
  options?: string[]
}

export interface ResolvedMeta {
  key: string
  label: string
  description: string
  fields: ResolvedField[]
}

// Enhancement layer only — types/enums/readonly are auto-derived from DMMF
export const TABLE_META_OVERRIDES: TableMetaOverride[] = [
  {
    key: 'coach',
    description: 'User accounts — coaches, commissioners, and admins.',
    // Exclude passwordHash and contact fields from admin view
    fields: ['id', 'name', 'alias', 'email', 'role', 'isActive', 'primaryLeagueId', 'createdAt'],
  },
  { key: 'league',     description: 'Leagues with seasons and status.' },
  { key: 'division',   description: 'Divisions nested inside a league.' },
  { key: 'tournament', description: 'Tournaments grouping divisions for cross-division play.' },
  { key: 'ruleSet',    description: 'Rule configurations applied to leagues.' },
  { key: 'team',       description: 'Teams registered in a league, owned by a coach.' },
  {
    key: 'teamPlayer',
    description: 'Individual players on a team with stats and status.',
    fields: ['id', 'teamId', 'playerTypeId', 'number', 'name', 'status', 'touchdowns',
      'completePasses', 'interceptions', 'casualties', 'mvp', 'ssp', 'niggling',
      'value', 'teamGamesAtSack', 'createdAt'],
  },
  { key: 'match', description: 'Scheduled or completed matches between two teams.' },
  {
    key: 'matchEvent',
    description: 'Events recorded during a match (touchdowns, casualties, etc.).',
    // mdMatchEventId shown as resolved name via page enrichment; type (short code) is readonly
    fieldMeta: {
      label:          { type: 'textarea' },
      type:           { readonly: true },
      mdMatchEventId: { readonly: true },
    },
  },
  { key: 'race',       description: 'Playable races available for team creation.' },
  { key: 'playerType', description: 'Player positions / types defined per race.' },
  {
    key: 'skill',
    description: 'Skills that players can acquire during their career.',
    fieldMeta: {
      skillId:   { readonly: true },
      skillRule: { type: 'textarea' },
    },
  },
  {
    key: 'mdMatchEvent',
    description: 'Master data for match event types used in Blood Bowl.',
    fieldMeta: {
      description: { type: 'textarea' },
      eventType: {
        type: 'select',
        options: ['Apothecary', 'Casualty', 'Casualty Inflicted', 'Completion', 'Gate',
          'Indirect Casualty', 'Interception', 'Kick off', 'Match Statistics', 'MVP',
          'Regeneration', 'Skill up', 'Touch Down', 'Weather'],
      },
    },
  },
  {
    key: 'mdStarPlayer',
    description: 'Blood Bowl star players available for hire.',
    fieldMeta: {
      notes:          { type: 'textarea' },
      includedWithId: { readonly: true },
    },
  },
  {
    key: 'newsPost',
    description: 'News articles posted by coaches or admins.',
    fieldMeta: {
      body:      { type: 'textarea' },
      coachNote: { type: 'textarea' },
      teamId:    { readonly: true },
      playerId:  { readonly: true },
    },
  },
]
