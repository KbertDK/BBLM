import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const events = [
  // Apothecary
  { name: 'Apothecary', causesCasualty: false, description: 'Once per match you are allowed to re-roll a casualty roll with your apothecary. You must use the re-rolled result.', dieRoll: null, eventType: 'Apothecary', ssp: null },

  // Gate
  { name: 'Gate', causesCasualty: false, description: 'Calculation of total amount of spectators', dieRoll: null, eventType: 'Gate', ssp: null },

  // Casualty results
  { name: 'Badly Hurt (Miss Rest of Game)', causesCasualty: false, description: 'Miss rest of game', dieRoll: 11, eventType: 'Casualty', ssp: null },
  { name: 'Serious Injury (Miss Next Game)', causesCasualty: false, description: 'Write an "M" in the injuries box on the team roster, and rub it out at the end of the next match.', dieRoll: 41, eventType: 'Casualty', ssp: null },
  { name: 'Damaged Back (Niggling)', causesCasualty: false, description: 'Niggling Injury: Miss next game. Write an "N" in the Injuries box on the team roster. Each Niggling Injury adds 1 to any subsequent Injury roll made against this player.', dieRoll: 51, eventType: 'Casualty', ssp: null },
  { name: 'Smashed Knee (Niggling)', causesCasualty: false, description: 'Niggling Injury: Miss next game. Write an "N" in the Injuries box on the team roster. Each Niggling Injury adds 1 to any subsequent Injury roll made against this player.', dieRoll: 52, eventType: 'Casualty', ssp: null },
  { name: 'Smashed Hip (-1 MA)', causesCasualty: false, description: '-1 MA: Miss the next match. Record the characteristic change on the team roster. No characteristic may be reduced by more than 2 points or below a value of 1.', dieRoll: 53, eventType: 'Casualty', ssp: null },
  { name: 'Smashed Ankle (-1 MA)', causesCasualty: false, description: '-1 MA: Miss the next match. Record the characteristic change on the team roster. No characteristic may be reduced by more than 2 points or below a value of 1.', dieRoll: 54, eventType: 'Casualty', ssp: null },
  { name: 'Serious Concussion (-1 AV)', causesCasualty: false, description: '-1 AV: Miss the next match. Record the characteristic change on the team roster. No characteristic may be reduced by more than 2 points or below a value of 1.', dieRoll: 55, eventType: 'Casualty', ssp: null },
  { name: 'Fractured Skull (-1 AV)', causesCasualty: false, description: '-1 AV: Miss the next match. Record the characteristic change on the team roster. No characteristic may be reduced by more than 2 points or below a value of 1.', dieRoll: 56, eventType: 'Casualty', ssp: null },
  { name: 'Broken Neck (-1 AG)', causesCasualty: false, description: '-1 AG: Miss the next match. Record the characteristic change on the team roster. No characteristic may be reduced by more than 2 points or below a value of 1.', dieRoll: 57, eventType: 'Casualty', ssp: null },
  { name: 'Smashed Collar Bone (-1 ST)', causesCasualty: false, description: '-1 ST: Miss the next match. Record the characteristic change on the team roster. No characteristic may be reduced by more than 2 points or below a value of 1.', dieRoll: 58, eventType: 'Casualty', ssp: null },
  { name: '💀 DEAD 💀', causesCasualty: false, description: 'Dead', dieRoll: 61, eventType: 'Casualty', ssp: null },

  // Casualty Inflicted
  { name: 'Block', causesCasualty: true, description: null, dieRoll: null, eventType: 'Casualty Inflicted', ssp: 2 },
  { name: 'Blitz!', causesCasualty: true, description: null, dieRoll: null, eventType: 'Casualty Inflicted', ssp: 2 },
  { name: 'Foul', causesCasualty: true, description: null, dieRoll: null, eventType: 'Casualty Inflicted', ssp: null },
  { name: 'Secret Weapon', causesCasualty: true, description: null, dieRoll: null, eventType: 'Casualty Inflicted', ssp: null },

  // Completion
  { name: 'Completion', causesCasualty: false, description: null, dieRoll: null, eventType: 'Completion', ssp: 1 },

  // Indirect Casualty
  { name: 'Dodge', causesCasualty: true, description: null, dieRoll: null, eventType: 'Indirect Casualty', ssp: null },
  { name: 'Going For It', causesCasualty: true, description: null, dieRoll: null, eventType: 'Indirect Casualty', ssp: null },
  { name: 'Wizard', causesCasualty: true, description: null, dieRoll: null, eventType: 'Indirect Casualty', ssp: null },
  { name: 'Card', causesCasualty: true, description: null, dieRoll: null, eventType: 'Indirect Casualty', ssp: null },
  { name: 'Flying Player (Throw)', causesCasualty: true, description: null, dieRoll: null, eventType: 'Indirect Casualty', ssp: null },

  // Interception
  { name: 'Interception', causesCasualty: false, description: null, dieRoll: null, eventType: 'Interception', ssp: 2 },

  // Kick off table
  { name: 'Get the Ref', causesCasualty: false, description: "The fans exact gruesome revenge on the referee. His replacement is so intimidated that for the rest of the half he will not send players off for making a foul nor ban players using secret weapons.", dieRoll: 2, eventType: 'Kick off', ssp: null },
  { name: 'Riot', causesCasualty: false, description: "The trash talk between two opposing players explodes and rapidly degenerates. If the receiving team's turn marker is on turn 7 for the half, both teams move their turn marker back one space. If the receiving team has not yet taken a turn this half both teams' turn markers are moved forward one space. Otherwise roll a D6: on 1-3 forward one space, on 4-6 back one space.", dieRoll: 3, eventType: 'Kick off', ssp: null },
  { name: 'Perfect Defence', causesCasualty: false, description: "The kicking team's coach may reorganize his players — he can set them up again. The receiving team must remain in the set-up chosen by their coach.", dieRoll: 4, eventType: 'Kick off', ssp: null },
  { name: 'High Kick', causesCasualty: false, description: "The ball is kicked very high, allowing a player on the receiving team time to move into the perfect position to catch it. Any one player on the receiving team who is not in an opposing player's tackle zone may be moved into the square where the ball will land, as long as the square is unoccupied.", dieRoll: 5, eventType: 'Kick off', ssp: null },
  { name: 'Cheering Fans', causesCasualty: false, description: "Each coach rolls a D3 and adds their team's FAME and the number of cheerleaders on their team. The team with the highest score gets an extra re-roll this half. If both teams have the same score, both get a reroll.", dieRoll: 6, eventType: 'Kick off', ssp: null },
  { name: 'Changing Weather', causesCasualty: false, description: "Make a new roll on the Weather table. Apply the new result. If the new result was \"Nice\", a gentle gust of wind makes the ball scatter one extra square in a random direction before landing.", dieRoll: 7, eventType: 'Kick off', ssp: null },
  { name: 'Brilliant Coaching', causesCasualty: false, description: "Each coach rolls a D3 and adds their FAME and the number of assistant coaches on their team. The team with the highest total gets an extra team re-roll this half. In case of a tie both teams get an extra team re-roll.", dieRoll: 8, eventType: 'Kick off', ssp: null },
  { name: 'Quick Snap!', causesCasualty: false, description: "The offense starts their drive a fraction before the defense is ready. All players on the receiving team may move one square freely into any adjacent empty square, ignoring tackle zones. This may be used to enter the opposing half.", dieRoll: 9, eventType: 'Kick off', ssp: null },
  { name: 'Blitz! (Kick Off)', causesCasualty: false, description: "The defense starts their drive a fraction before the offence is ready. The kicking team receives a free bonus turn; however, players in an enemy tackle zone may not perform an Action. If any player suffers a turnover the bonus turn ends immediately.", dieRoll: 10, eventType: 'Kick off', ssp: null },
  { name: 'Throw a Rock', causesCasualty: true, description: "An enraged fan hurls a large rock at one of the players on the opposing team. Each coach rolls a D6 and adds their FAME. The fans of the team that rolls higher threw the rock. In case of a tie a rock is thrown at each team! Decide randomly which player was hit and roll for the injury immediately. No Armour roll is required.", dieRoll: 11, eventType: 'Kick off', ssp: null },
  { name: 'Pitch Invasion', causesCasualty: true, description: "Both coaches roll a D6 for each opposing player on the pitch and add their FAME. If a roll is 6 or more after modification the player is Stunned (Ball & Chain players are KO'd). A roll of 1 before adding FAME always has no effect.", dieRoll: 12, eventType: 'Kick off', ssp: null },

  // Match Statistics
  { name: 'Winnings', causesCasualty: false, description: null, dieRoll: null, eventType: 'Match Statistics', ssp: null },
  { name: 'New FF', causesCasualty: false, description: null, dieRoll: null, eventType: 'Match Statistics', ssp: null },

  // MVP
  { name: 'MVP', causesCasualty: false, description: null, dieRoll: null, eventType: 'MVP', ssp: 5 },

  // Regeneration
  { name: 'Regeneration', causesCasualty: false, description: null, dieRoll: null, eventType: 'Regeneration', ssp: null },

  // Skill up
  { name: 'Skill up', causesCasualty: false, description: null, dieRoll: null, eventType: 'Skill up', ssp: null },

  // Touch Down
  { name: 'Touch Down', causesCasualty: false, description: null, dieRoll: null, eventType: 'Touch Down', ssp: 3 },

  // Weather
  { name: 'Sweltering Heat', causesCasualty: false, description: "It's so hot and humid that some players collapse from heat exhaustion. Roll a D6 for each player on the field after a touchdown is scored. On a roll of 1 the player collapses and may not be set up for the next kick-off.", dieRoll: 2, eventType: 'Weather', ssp: null },
  { name: 'Very Sunny', causesCasualty: false, description: "A glorious day, but the blinding sunshine causes a -1 modifier on all attempts to pass the ball.", dieRoll: 3, eventType: 'Weather', ssp: null },
  { name: 'Nice', causesCasualty: false, description: "Perfect Blood Bowl Weather.", dieRoll: 10, eventType: 'Weather', ssp: null },
  { name: 'Pouring Rain', causesCasualty: false, description: "It's raining, making the ball slippery and difficult to hold. A -1 modifier applies to all catch, intercept or pick-up rolls.", dieRoll: 11, eventType: 'Weather', ssp: null },
  { name: 'Blizzard', causesCasualty: false, description: "It's cold and snowing! The ice on the field means that any player attempting to move an extra square will slip and fall on a roll of 1-2, while the snow means that only quick or short passes can be attempted.", dieRoll: 12, eventType: 'Weather', ssp: null },
]

async function main() {
  console.log(`Seeding ${events.length} MdMatchEvent records...`)
  await prisma.mdMatchEvent.createMany({ data: events })
  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
