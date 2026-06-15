export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'datetime'

export interface FieldMeta {
  type?: FieldType      // default: 'text'
  options?: string[]    // for 'select'
  readonly?: boolean    // default: false
}

export interface TableMeta {
  key: string
  label: string
  description: string
  fields: string[]
  fieldMeta: Record<string, FieldMeta>
}

export const TABLE_META: TableMeta[] = [
  {
    key: 'coach',
    label: 'Coach',
    description: 'User accounts — coaches, commissioners, and admins.',
    fields: ['id', 'name', 'alias', 'email', 'role', 'isActive', 'createdAt'],
    fieldMeta: {
      id:        { readonly: true },
      role:      { type: 'select', options: ['ADMIN', 'COMMISH', 'COACH'] },
      isActive:  { type: 'boolean' },
      createdAt: { type: 'datetime', readonly: true },
    },
  },
  {
    key: 'league',
    label: 'League',
    description: 'Leagues with seasons and status.',
    fields: ['id', 'name', 'season', 'status', 'isHidden', 'ruleSetId', 'createdAt'],
    fieldMeta: {
      id:        { readonly: true },
      season:    { type: 'number' },
      status:    { type: 'select', options: ['READY', 'ACTIVE', 'ENDED'] },
      isHidden:  { type: 'boolean' },
      ruleSetId: { readonly: true },
      createdAt: { type: 'datetime', readonly: true },
    },
  },
  {
    key: 'division',
    label: 'Division',
    description: 'Divisions nested inside a league.',
    fields: ['id', 'name', 'leagueId', 'isHidden', 'createdAt'],
    fieldMeta: {
      id:        { readonly: true },
      leagueId:  { readonly: true },
      isHidden:  { type: 'boolean' },
      createdAt: { type: 'datetime', readonly: true },
    },
  },
  {
    key: 'ruleSet',
    label: 'RuleSet',
    description: 'Rule configurations applied to leagues.',
    fields: ['id', 'name', 'gameType', 'startIncome', 'numberOfPlayers', 'pointsWin', 'pointsDraw', 'pointsLoss', 'status', 'createdAt'],
    fieldMeta: {
      id:              { readonly: true },
      gameType:        { type: 'select', options: ['BLOOD_BOWL', 'DUNGEON_BOWL', 'BB7'] },
      startIncome:     { type: 'number' },
      numberOfPlayers: { type: 'number' },
      pointsWin:       { type: 'number' },
      pointsDraw:      { type: 'number' },
      pointsLoss:      { type: 'number' },
      status:          { type: 'select', options: ['ACTIVE', 'INACTIVE'] },
      createdAt:       { type: 'datetime', readonly: true },
    },
  },
  {
    key: 'team',
    label: 'Team',
    description: 'Teams registered in a league, owned by a coach.',
    fields: ['id', 'name', 'raceId', 'coachId', 'leagueId', 'divisionId', 'isActive', 'wins', 'losses', 'draws', 'createdAt'],
    fieldMeta: {
      id:         { readonly: true },
      raceId:     { readonly: true },
      coachId:    { readonly: true },
      leagueId:   { readonly: true },
      divisionId: { readonly: true },
      isActive:   { type: 'boolean' },
      wins:       { type: 'number' },
      losses:     { type: 'number' },
      draws:      { type: 'number' },
      createdAt:  { type: 'datetime', readonly: true },
    },
  },
  {
    key: 'teamPlayer',
    label: 'TeamPlayer',
    description: 'Individual players on a team with stats and status.',
    fields: ['id', 'teamId', 'playerTypeId', 'number', 'name', 'status', 'touchdowns', 'casualties', 'ssp', 'value', 'createdAt'],
    fieldMeta: {
      id:           { readonly: true },
      teamId:       { readonly: true },
      playerTypeId: { readonly: true },
      number:       { type: 'number' },
      status:       { type: 'select', options: ['ACTIVE', 'MNG', 'SACKED', 'DEAD'] },
      touchdowns:   { type: 'number' },
      casualties:   { type: 'number' },
      ssp:          { type: 'number' },
      value:        { type: 'number' },
      createdAt:    { type: 'datetime', readonly: true },
    },
  },
  {
    key: 'match',
    label: 'Match',
    description: 'Scheduled or completed matches between two teams.',
    fields: ['id', 'leagueId', 'homeTeamId', 'awayTeamId', 'round', 'status', 'homeScore', 'awayScore', 'scheduledAt', 'createdAt'],
    fieldMeta: {
      id:         { readonly: true },
      leagueId:   { readonly: true },
      homeTeamId: { readonly: true },
      awayTeamId: { readonly: true },
      round:      { type: 'number' },
      status:     { type: 'select', options: ['SCHEDULED', 'LIVE', 'COMPLETED'] },
      homeScore:  { type: 'number' },
      awayScore:  { type: 'number' },
      scheduledAt:{ type: 'datetime' },
      createdAt:  { type: 'datetime', readonly: true },
    },
  },
  {
    key: 'matchEvent',
    label: 'MatchEvent',
    description: 'Events recorded during a match (touchdowns, casualties, etc.).',
    fields: ['id', 'matchId', 'type', 'label', 'scoringTeam', 'createdAt'],
    fieldMeta: {
      id:        { readonly: true },
      matchId:   { readonly: true },
      label:     { type: 'textarea' },
      createdAt: { type: 'datetime', readonly: true },
    },
  },
  {
    key: 'race',
    label: 'Race',
    description: 'Playable races available for team creation.',
    fields: ['id', 'name', 'rerollPrice', 'hasApothecary', 'rosterSource'],
    fieldMeta: {
      id:            { readonly: true },
      rerollPrice:   { type: 'number' },
      hasApothecary: { type: 'boolean' },
    },
  },
  {
    key: 'playerType',
    label: 'PlayerType',
    description: 'Player positions / types defined per race.',
    fields: ['id', 'raceId', 'name', 'cost', 'maxCount', 'ma', 'st', 'ag', 'av'],
    fieldMeta: {
      id:       { readonly: true },
      raceId:   { readonly: true },
      cost:     { type: 'number' },
      maxCount: { type: 'number' },
      ma:       { type: 'number' },
      st:       { type: 'number' },
      ag:       { type: 'number' },
      av:       { type: 'number' },
    },
  },
  {
    key: 'skill',
    label: 'Skill',
    description: 'Skills that players can acquire during their career.',
    fields: ['id', 'skillId', 'name', 'category', 'skillRule'],
    fieldMeta: {
      id:        { readonly: true },
      skillId:   { type: 'number', readonly: true },
      category:  { type: 'select', options: ['G', 'A', 'P', 'S', 'M', 'E'] },
      skillRule: { type: 'textarea' },
    },
  },
  {
    key: 'newsPost',
    label: 'NewsPost',
    description: 'News articles posted by coaches or admins.',
    fields: ['id', 'title', 'authorId', 'teamId', 'playerId', 'createdAt', 'updatedAt'],
    fieldMeta: {
      id:        { readonly: true },
      authorId:  { readonly: true },
      teamId:    { readonly: true },
      playerId:  { readonly: true },
      createdAt: { type: 'datetime', readonly: true },
      updatedAt: { type: 'datetime', readonly: true },
    },
  },
]
