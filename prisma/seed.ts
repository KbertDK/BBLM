import { PrismaClient, MatchStatus, SkillCategory } from '@prisma/client'

const prisma = new PrismaClient()

const SKILLS: { skillId: number; name: string; category: SkillCategory; skillRule: string }[] = [
  // General (G) — IDs 1–14
  { skillId:  1, name: 'Block',            category: 'G', skillRule: 'A player with the Block skill never falls down when they push an opponent in a Block or Blitz action (i.e. they ignore both Both Down results on the Block dice).' },
  { skillId:  2, name: 'Dauntless',        category: 'G', skillRule: 'If a player with this skill attempts to block an opponent who has a higher Strength, they may roll a D6 and add their own Strength. If the total exceeds the opponent\'s Strength, they may use the higher value for the block this turn.' },
  { skillId:  3, name: 'Dirty Player',     category: 'G', skillRule: 'When this player commits a Foul action, they may modify either the Armour roll or the Injury roll by +1.' },
  { skillId:  4, name: 'Frenzy',           category: 'G', skillRule: 'This player must always follow up a Block and must block the same target a second time if still adjacent. In a Blitz, the player must keep blocking until they can no longer reach the target or the target is knocked down.' },
  { skillId:  5, name: 'Fend',             category: 'G', skillRule: 'A player who is hit by a player with this skill may not follow up. This skill cannot be used if the player who was hit is Prone.' },
  { skillId:  6, name: 'Kick',             category: 'G', skillRule: 'If this player is nominated as the kicker at kick-off, the coach may choose which square in the opponent\'s half the ball lands in, rather than rolling for scatter.' },
  { skillId:  7, name: 'Kick-Off Return',  category: 'G', skillRule: 'After a kick-off but before the game resumes, a player with this skill on the receiving team may move up to 3 squares. This move does not cause a Turnover.' },
  { skillId:  8, name: 'Pass Block',       category: 'G', skillRule: 'If an opposing player declares a Pass action, a player with this skill who is not in an opponent\'s tackle zone may immediately move up to 2 squares to get into position, after which the pass is resolved.' },
  { skillId:  9, name: 'Pro',              category: 'G', skillRule: 'Once per turn, this player may re-roll a single D6 roll they have just made. They must roll a D6 first; on a 3+ the re-roll is granted.' },
  { skillId: 10, name: 'Shadowing',        category: 'G', skillRule: 'If an opposing player voluntarily moves out of a tackle zone of a player with this skill, the player with Shadowing may immediately follow them, moving into the square just vacated, as long as it does not take them off the pitch.' },
  { skillId: 11, name: 'Strip Ball',       category: 'G', skillRule: 'When a player with this skill makes a block, the target drops the ball if they are pushed back, even if they are not knocked down. Opponents with Sure Hands may not use that skill against this player\'s Strip Ball.' },
  { skillId: 12, name: 'Sure Hands',       category: 'G', skillRule: 'This player may re-roll a failed Pick Up attempt. In addition, opponents with Strip Ball cannot use that skill against this player.' },
  { skillId: 13, name: 'Tackle',           category: 'G', skillRule: 'Opponents who are in a tackle zone of this player may not use the Dodge skill to avoid blocking attempts made by this player.' },
  { skillId: 14, name: 'Wrestle',          category: 'G', skillRule: 'This player may use this skill instead of choosing a block die result. Both the active player and the target are placed Prone, but neither is considered knocked down. No Armour roll is made.' },
  // Agility (A) — IDs 20–29
  { skillId: 20, name: 'Catch',            category: 'A', skillRule: 'A player with this skill may re-roll a failed Catch roll.' },
  { skillId: 21, name: 'Diving Catch',     category: 'A', skillRule: 'This player may attempt to catch a pass, hand-off or kick-off even if the ball lands in an adjacent square. If they catch it in the adjacent square, the catch is made in the square the ball landed in.' },
  { skillId: 22, name: 'Diving Tackle',    category: 'A', skillRule: 'After an opposing player dodges out of a tackle zone of this player, this player may be placed Prone. If they are, the opposing player must re-roll their successful Dodge roll.' },
  { skillId: 23, name: 'Dodge',            category: 'A', skillRule: 'This player may re-roll a failed Dodge roll once per action. Opposing players with the Tackle skill cancel this ability.' },
  { skillId: 24, name: 'Jump Up',          category: 'A', skillRule: 'A Prone player with this skill may stand up without spending movement, and may still take their full action as normal.' },
  { skillId: 25, name: 'Leap',             category: 'A', skillRule: 'A player with this skill may jump over any occupied or empty adjacent square. Make an Agility roll, modified by the squares being leaped over. If failed the player falls into the square leaped over.' },
  { skillId: 26, name: 'Side Step',        category: 'A', skillRule: 'When this player is pushed back, their coach may choose which adjacent square they move to, rather than following the push-back rules.' },
  { skillId: 27, name: 'Sneaky Git',       category: 'A', skillRule: 'If this player commits a Foul action and the Armour roll does not result in a Casualty, the player is not automatically ejected; a D6 is rolled and on a 2+ they are not sent off.' },
  { skillId: 28, name: 'Sprint',           category: 'A', skillRule: 'This player may attempt up to three extra Go For It moves per action, rather than the normal two.' },
  { skillId: 29, name: 'Sure Feet',        category: 'A', skillRule: 'This player may re-roll a failed Go For It roll.' },
  // Passing (P) — IDs 40–46
  { skillId: 40, name: 'Accurate',         category: 'P', skillRule: 'This player may add 1 to the D6 roll when making a Pass action.' },
  { skillId: 41, name: 'Dump-Off',         category: 'P', skillRule: 'If an opposing player declares a Block or Blitz action against this player while they are holding the ball, they may immediately make a Quick Pass before the block is resolved.' },
  { skillId: 42, name: 'Hail Mary Pass',   category: 'P', skillRule: 'This player may throw the ball to any square on the pitch regardless of range. The pass always counts as Inaccurate and cannot be re-rolled.' },
  { skillId: 43, name: 'Leader',           category: 'P', skillRule: 'As long as this player is on the pitch and not in the Reserves box, their team gains one additional Team Re-Roll each half. This bonus is lost if the player leaves the pitch.' },
  { skillId: 44, name: 'Nerves of Iron',   category: 'P', skillRule: 'This player ignores tackle zone modifiers when making a Pass or Catch roll.' },
  { skillId: 45, name: 'Pass',             category: 'P', skillRule: 'This player may re-roll a failed Pass roll.' },
  { skillId: 46, name: 'Safe Throw',       category: 'P', skillRule: 'If this player fumbles or fails a pass while in a tackle zone, the ball is not turned over. Instead the player retains the ball.' },
  // Strength (S) — IDs 50–59
  { skillId: 50, name: 'Break Tackle',     category: 'S', skillRule: 'Once per action, this player may use their Strength characteristic in place of their Agility when making a Dodge roll.' },
  { skillId: 51, name: 'Grab',             category: 'S', skillRule: 'When this player pushes back an opponent, they may move the target to any unoccupied adjacent square instead of following normal push-back direction rules.' },
  { skillId: 52, name: 'Guard',            category: 'S', skillRule: 'A player with this skill may assist a team-mate making a block even when they are in the tackle zone of an opposing player.' },
  { skillId: 53, name: 'Juggernaut',       category: 'S', skillRule: 'When this player performs a Blitz action, the target cannot use the Fend, Stand Firm, or Wrestle skills. In addition a Both Down result may be treated as a Pushed result.' },
  { skillId: 54, name: 'Mighty Blow',      category: 'S', skillRule: 'When this player makes a successful Block and an Armour or Injury roll is required, they may add 1 to either the Armour roll or the Injury roll (not both).' },
  { skillId: 55, name: 'Multiple Block',   category: 'S', skillRule: 'At the start of a Block action, this player may declare a Multiple Block. They block two adjacent opposing players simultaneously, but lose all assists for both blocks.' },
  { skillId: 56, name: 'Piling On',        category: 'S', skillRule: 'Once per turn, after a block that results in the opposing player being Prone or Stunned, this player may be placed Prone to add 1 to either the Armour or Injury roll of the opposing player.' },
  { skillId: 57, name: 'Stand Firm',       category: 'S', skillRule: 'This player is never pushed back as a result of a block, unless they choose to be. This skill has no effect against Grab or Throw-In results.' },
  { skillId: 58, name: 'Strong Arm',       category: 'S', skillRule: 'This player may add 1 to the D6 roll when throwing a team-mate with the Right Stuff skill.' },
  { skillId: 59, name: 'Thick Skull',      category: 'S', skillRule: 'When an Injury roll against this player results in a Stunned result, treat it as KO\'d instead. Casualty results still apply as normal.' },
  // Mutation (M) — IDs 70–79
  { skillId: 70, name: 'Big Hand',         category: 'M', skillRule: 'This player ignores any negative modifiers from opposing tackle zones or weather when attempting to pick up the ball.' },
  { skillId: 71, name: 'Claws',            category: 'M', skillRule: 'When this player makes a block that requires an Armour roll, the target\'s Armour Value is reduced by 1 for that roll (to a minimum of 2).' },
  { skillId: 72, name: 'Disturbing Presence', category: 'M', skillRule: 'All opposing players in squares adjacent to this player must apply a -1 modifier to any Pass, Catch, or Intercept roll they make.' },
  { skillId: 73, name: 'Extra Arms',       category: 'M', skillRule: 'This player may add 1 to any Catch, Intercept, or Pass roll they make.' },
  { skillId: 74, name: 'Foul Appearance',  category: 'M', skillRule: 'Opposing players who wish to block this player must first roll a D6. On a roll of 1, they cannot make the block and their action ends.' },
  { skillId: 75, name: 'Horns',            category: 'M', skillRule: 'This player may add 1 to their Strength characteristic when performing a Blitz action only.' },
  { skillId: 76, name: 'Prehensile Tail',  category: 'M', skillRule: 'Any opposing player attempting to dodge out of a tackle zone of this player must subtract 1 from their Dodge roll.' },
  { skillId: 77, name: 'Tentacles',        category: 'M', skillRule: 'When an opposing player attempts to dodge, move or be pushed out of a square adjacent to this player, roll a D6 and add this player\'s Strength. If the total beats the moving player\'s Strength + D6, they are held in place and their action ends.' },
  { skillId: 78, name: 'Two Heads',        category: 'M', skillRule: 'This player may add 1 to all Dodge rolls they make.' },
  { skillId: 79, name: 'Very Long Legs',   category: 'M', skillRule: 'This player may subtract 1 from all Kick-Off Throw-In distance rolls. Opposing players may not use the Leap skill to jump over this player.' },
  // Extraordinary (E) — IDs 80, 91–113
  { skillId:  80, name: 'Always Hungry',   category: 'E', skillRule: 'This player must roll a D6 each time they attempt to throw a team-mate with the Right Stuff skill. On a 1, the team-mate is eaten before the throw and is removed as a casualty.' },
  { skillId:  91, name: 'Ball & Chain',    category: 'E', skillRule: 'This player must always move the full number of squares and cannot control direction — scatter each square moved. At the end of movement, if they entered an occupied square, resolve a block. A player with this skill can never voluntarily stop moving and must always Go For It.' },
  { skillId:  92, name: 'Blood Lust',      category: 'E', skillRule: 'Players with this skill are Vampires. After declaring their action but before performing it, they must roll a D6, adding 1 if they declared a Block or Blitz. On a 1 they go Bloodthirsty and must bite an adjacent friendly player (Armour roll). If no friendly is adjacent, they bite themselves and move to the Reserves box.' },
  { skillId:  93, name: 'Bombardier',      category: 'E', skillRule: 'This player may perform a Throw Bomb special action instead of a normal Pass action. Throw a bomb as if making a Quick Pass. The bomb is not the ball; if it lands in an occupied square, an Armour roll is made against all players in that square.' },
  { skillId:  94, name: 'Bone Head',       category: 'E', skillRule: 'At the start of this player\'s activation, roll a D6. On a 1 they stand around doing nothing and their activation ends immediately. They lose their tackle zones until next activation.' },
  { skillId:  95, name: 'Chainsaw',        category: 'E', skillRule: 'This player is equipped with a chainsaw. When making an Armour roll against a player blocked by this player, roll 3D6 and drop the lowest die. This also counts as a Secret Weapon.' },
  { skillId:  96, name: 'Decay',           category: 'E', skillRule: 'Whenever this player suffers a Casualty result on the Injury table, the opposing coach may select any one result from the Casualty table instead of rolling randomly.' },
  { skillId:  97, name: 'Foul Appearance', category: 'E', skillRule: 'Opposing players who wish to block or foul this player must first roll a D6. On a 1 they cannot perform the block or foul and their action ends. (Extraordinary version — stacks with Big Guy frame.)' },
  { skillId:  98, name: 'Hypnotic Gaze',   category: 'E', skillRule: 'This player may use their gaze to mesmerise an adjacent opposing player. The target player loses their tackle zones until the end of the current turn. This may only be used once per turn.' },
  { skillId:  99, name: 'Loner',           category: 'E', skillRule: 'Before using a Team Re-Roll, a player with this skill must first roll a D6. On a 1-3 the Team Re-Roll is wasted and the result stands.' },
  { skillId: 100, name: 'No Hands',        category: 'E', skillRule: 'This player can never catch, intercept, or pick up the ball under any circumstances.' },
  { skillId: 101, name: 'Nurgle\'s Rot',  category: 'E', skillRule: 'Whenever this player causes a Casualty, the victim permanently gains the Decay skill if they do not already have it.' },
  { skillId: 102, name: 'Really Stupid',   category: 'E', skillRule: 'At the start of this player\'s activation, roll a D6. On a 1-3 they stand around doing nothing unless there is an adjacent friendly player without this skill, in which case the test is passed automatically.' },
  { skillId: 103, name: 'Regeneration',    category: 'E', skillRule: 'After this player suffers a Casualty result, roll a D6. On a 4+ the result is ignored and the player is placed in the Reserves box at the end of the drive.' },
  { skillId: 104, name: 'Right Stuff',     category: 'E', skillRule: 'This player can be thrown by a team-mate with the Throw Team-Mate skill. They must be Standing and adjacent to the thrower to be picked up and thrown.' },
  { skillId: 105, name: 'Secret Weapon',   category: 'E', skillRule: 'At the end of any drive in which this player took part, they are automatically sent off regardless of whether they committed a foul. The opposing team receives a free Kick-Off Result roll.' },
  { skillId: 106, name: 'Stab',            category: 'E', skillRule: 'Instead of making a normal Block, this player may Stab an adjacent opposing player. Make an unmodified Armour roll; if it beats the target\'s AV, make an Injury roll. No Block dice are rolled.' },
  { skillId: 107, name: 'Stakes',          category: 'E', skillRule: 'Any Vampire player removed from the pitch as a Casualty as a result of this player\'s action is automatically Killed rather than rolling on the Casualty table.' },
  { skillId: 108, name: 'Stunty',          category: 'E', skillRule: 'Opposing players may add 1 to Armour rolls against this player. However this player may ignore enemy tackle zones when dodging, and may be thrown by a player with Throw Team-Mate.' },
  { skillId: 109, name: 'Take Root',       category: 'E', skillRule: 'At the start of this player\'s activation, roll a D6. On a 1, the player Takes Root: they cannot move for the rest of the drive but may still block adjacent opponents and perform other actions in place.' },
  { skillId: 110, name: 'Throw Team-Mate', category: 'E', skillRule: 'Instead of throwing the ball, this player may pick up and throw an adjacent friendly player with the Right Stuff skill. Resolve as a normal pass using Strength instead of Agility.' },
  { skillId: 111, name: 'Itchy',           category: 'E', skillRule: 'At the start of this player\'s activation, if they have not yet acted this turn and roll a 1 on a D6, they spend their turn scratching and may not perform any action.' },
  { skillId: 112, name: 'Titchy',          category: 'E', skillRule: 'This player is very small. They may ignore enemy tackle zones when dodging. However, opposing players do not benefit from this player\'s assists when blocking.' },
  { skillId: 113, name: 'Animosity',       category: 'E', skillRule: 'At the start of this player\'s activation, if they wish to Hand-Off or Pass to a team-mate of a different race, they must roll a D6. On a 2+ they may proceed normally; on a 1 they refuse and must perform a different action or do nothing.' },
]

const RACES = [
  { name: 'Amazon',           rosterSource: 'CRP/LRB6 core',   rerollPrice: 50000, hasApothecary: true  },
  { name: 'Apes of Wrath',    rosterSource: '3DB',              rerollPrice: 60000, hasApothecary: true  },
  { name: 'Brettonia',        rosterSource: 'LRB6/NAF extra',   rerollPrice: 60000, hasApothecary: true  },
  { name: 'Chaos',            rosterSource: 'CRP/LRB6 core',   rerollPrice: 60000, hasApothecary: true  },
  { name: 'Chaos Dwarf',      rosterSource: 'CRP/LRB6 core',   rerollPrice: 70000, hasApothecary: true  },
  { name: 'Chaos Pact',       rosterSource: 'LRB6/NAF extra',   rerollPrice: 70000, hasApothecary: true  },
  { name: 'Daemons of Khorne',rosterSource: 'LRB6/NAF extra',   rerollPrice: 70000, hasApothecary: true  },
  { name: 'Dark Elf',         rosterSource: 'CRP/LRB6 core',   rerollPrice: 50000, hasApothecary: true  },
  { name: 'Dwarf',            rosterSource: 'CRP/LRB6 core',   rerollPrice: 50000, hasApothecary: true  },
  { name: 'Elf / Pro Elf',    rosterSource: 'CRP/LRB6 core',   rerollPrice: 50000, hasApothecary: true  },
  { name: 'Goblin',           rosterSource: 'CRP/LRB6 core',   rerollPrice: 60000, hasApothecary: true  },
  { name: 'Halfling',         rosterSource: 'CRP/LRB6 core',   rerollPrice: 60000, hasApothecary: true  },
  { name: 'High Elf',         rosterSource: 'CRP/LRB6 core',   rerollPrice: 50000, hasApothecary: true  },
  { name: 'Human',            rosterSource: 'CRP/LRB6 core',   rerollPrice: 50000, hasApothecary: true  },
  { name: 'Khemri',           rosterSource: 'CRP/LRB6 core',   rerollPrice: 70000, hasApothecary: false },
  { name: 'Lizardmen',        rosterSource: 'CRP/LRB6 core',   rerollPrice: 60000, hasApothecary: true  },
  { name: 'Necromantic',      rosterSource: 'CRP/LRB6 core',   rerollPrice: 70000, hasApothecary: false },
  { name: 'Norse',            rosterSource: 'CRP/LRB6 core',   rerollPrice: 60000, hasApothecary: true  },
  { name: 'Nurgle',           rosterSource: 'CRP/LRB6 core',   rerollPrice: 70000, hasApothecary: false },
  { name: 'Ogre',             rosterSource: 'CRP/LRB6 core',   rerollPrice: 70000, hasApothecary: true  },
  { name: 'Orc',              rosterSource: 'CRP/LRB6 core',   rerollPrice: 60000, hasApothecary: true  },
  { name: 'Skaven',           rosterSource: 'CRP/LRB6 core',   rerollPrice: 60000, hasApothecary: true  },
  { name: 'Slann',            rosterSource: 'LRB6/NAF extra',   rerollPrice: 50000, hasApothecary: true  },
  { name: 'Undead',           rosterSource: 'CRP/LRB6 core',   rerollPrice: 70000, hasApothecary: false },
  { name: 'Underworld',       rosterSource: 'LRB6/NAF extra',   rerollPrice: 70000, hasApothecary: true  },
  { name: 'Vampire',          rosterSource: 'CRP/LRB6 core',   rerollPrice: 70000, hasApothecary: true  },
  { name: 'Wood Elf',         rosterSource: 'CRP/LRB6 core',   rerollPrice: 50000, hasApothecary: true  },
]

async function main() {
  console.log('Seeding database...')

  await prisma.skill.createMany({ data: SKILLS, skipDuplicates: true })
  console.log(`Seeded ${SKILLS.length} skills.`)

  await prisma.race.createMany({ data: RACES, skipDuplicates: true })
  const races = await prisma.race.findMany()
  const raceByName = Object.fromEntries(races.map((r) => [r.name, r]))

  const league = await prisma.league.create({
    data: { name: 'The Reikland Rumble League', season: 1 },
  })

  const [grimtusk, skavenslick, aldric] = await Promise.all([
    prisma.coach.create({ data: { name: 'Grimtusk Ironjaw',    email: 'grimtusk@greentide.bb' } }),
    prisma.coach.create({ data: { name: 'Skavenslick Ratbane', email: 'slick@ratrunners.bb'   } }),
    prisma.coach.create({ data: { name: 'Aldric the Bold',     email: 'aldric@reavers.bb'      } }),
  ])

  const [greenTide, ratrunners, reavers] = await Promise.all([
    prisma.team.create({ data: { name: 'Da Green Tide',      raceId: raceByName['Orc'].id,   coachId: grimtusk.id,   leagueId: league.id, wins: 3, draws: 1, losses: 1 } }),
    prisma.team.create({ data: { name: 'The Ratrunners',     raceId: raceByName['Skaven'].id, coachId: skavenslick.id, leagueId: league.id, wins: 4, draws: 0, losses: 1 } }),
    prisma.team.create({ data: { name: 'Reikland Reavers',   raceId: raceByName['Human'].id,  coachId: aldric.id,     leagueId: league.id, wins: 2, draws: 2, losses: 1 } }),
  ])

  const now = new Date()
  const daysAgo  = (n: number) => new Date(now.getTime() - n * 86400000)
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000)

  await prisma.match.createMany({
    data: [
      { leagueId: league.id, homeTeamId: greenTide.id,  awayTeamId: reavers.id,    scheduledAt: daysAgo(7),      status: MatchStatus.COMPLETED, round: 1, homeScore: 2, awayScore: 1 },
      { leagueId: league.id, homeTeamId: ratrunners.id, awayTeamId: reavers.id,    scheduledAt: daysAgo(3),      status: MatchStatus.COMPLETED, round: 1, homeScore: 3, awayScore: 0 },
      { leagueId: league.id, homeTeamId: ratrunners.id, awayTeamId: greenTide.id,  scheduledAt: now,             status: MatchStatus.LIVE,      round: 2, homeScore: 1, awayScore: 1 },
      { leagueId: league.id, homeTeamId: reavers.id,    awayTeamId: greenTide.id,  scheduledAt: daysFromNow(3),  status: MatchStatus.SCHEDULED, round: 3, homeScore: null, awayScore: null },
      { leagueId: league.id, homeTeamId: greenTide.id,  awayTeamId: ratrunners.id, scheduledAt: daysFromNow(7),  status: MatchStatus.SCHEDULED, round: 3, homeScore: null, awayScore: null },
      { leagueId: league.id, homeTeamId: reavers.id,    awayTeamId: ratrunners.id, scheduledAt: daysFromNow(10), status: MatchStatus.SCHEDULED, round: 4, homeScore: null, awayScore: null },
    ],
  })

  await prisma.newsPost.createMany({
    data: [
      {
        title: 'Season 1 Kicks Off with Brutal Opening Round',
        body: "The inaugural season of the Reikland Rumble League exploded onto the pitch with a weekend of savage action that left fans breathless and apothecaries busy. Da Green Tide crushed the Reikland Reavers 2-1 in a match that Commissioner Volkar called 'exactly the kind of carnage we hoped for.' Three players were carted off in stretchers, and the crowd loved every second of it. Grimtusk Ironjaw's boys showed they mean business this season, with their star Blitzer racking up two touchdowns and a casualty in the opening fixture. 'We iz da strongest,' Grimtusk commented after the match, wiping blood — presumably not his own — from his tusks.",
        authorId: grimtusk.id,
        createdAt: daysAgo(6),
      },
      {
        title: "Ratrunners' Skavenslick Claims No Foul Play in Last Match",
        body: "Skaven coach Skavenslick Ratbane has vigorously denied allegations that his team employed illicit tactics during their 3-0 demolition of the Reikland Reavers, despite three separate referee reviews flagging suspicious activity near the opposition dugout. 'We iz fast, yes-yes, but we play clean,' the twitchy coach insisted, his eyes darting nervously. 'Those bites are from... training accidents.' The league has announced a formal inquiry, though Commissioner Volkar privately admitted that the Ratrunners' dominance was 'quite impressive, whatever the method.' The Reavers' coach Aldric the Bold has filed an official protest, calling the match 'an embarrassment to the sport and to human dignity.'",
        authorId: skavenslick.id,
        createdAt: daysAgo(2),
      },
      {
        title: 'Rookie Thrower Sets New League Completion Record',
        body: "Reikland Reavers quarterback Stefan 'Steadyhands' Müller made history last week by setting a new league record for completion percentage in a single half — a feat made all the more remarkable given that his team lost 3-0. 'The boy can throw, no question,' admitted opposing coach Skavenslick. 'We just made sure no one was there to catch it.' Müller, playing only his third professional match, completed 8 of 9 passes for 160 yards before being knocked unconscious in the final quarter. He has been cleared to play in this week's fixture and is reportedly 'excited to get back out there,' which team physicians consider either inspiring or deeply concerning.",
        authorId: aldric.id,
        createdAt: daysAgo(1),
      },
      {
        title: 'League Commissioner Announces Playoff Format',
        body: "Commissioner Volkar Steinhammer unveiled the Reikland Rumble League's playoff structure today, confirming that the top two teams after the regular season will compete in a single-match Grand Final for the coveted Reikland Skull Trophy — a genuine skull, former owner unspecified. 'We want the most violent teams to get the most violent prize,' Steinhammer explained. He also confirmed that the league will introduce a 'Player of the Season' award, judged on a combined score of touchdowns and casualties caused. 'We reward excellence in all its forms,' he noted. The announcement was well received, particularly by Grimtusk Ironjaw, who reportedly began practicing his trophy speech — or, as Orcish linguistics experts noted, his victory roar.",
        authorId: grimtusk.id,
        createdAt: daysAgo(0),
      },
    ],
  })

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
