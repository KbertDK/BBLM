import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const inducements = [
  {
    name: 'Bloodweiser Babes',
    maxCount: 2,
    price: 50000,
    rule: 'You purchase a keg of extra-special Bloodweiser magic ale, and get a lovely lady to serve players before going out for each drive. The combination of the ale and the young lady serving it means that for each purchase of this inducement, players on the team gain a +1 modifier to recover from KO\'d for this match.',
  },
  {
    name: 'Bribes',
    maxCount: 3,
    price: 100000,
    rule: 'Each bribe allows you to attempt to ignore one call by the referee for a player who has committed a foul to be sent off, or a player armed with a secret weapon to be banned from the match. Roll a D6: on a roll of 2-6 the bribe is effective (preventing a turnover if the player was ejected for fouling), but on a roll of 1 the bribe is wasted and the call still stands! Each bribe may be used once per match. Goblin teams pay only 50,000 gp per bribe.',
  },
  {
    name: 'Extra Team Training',
    maxCount: 4,
    price: 100000,
    rule: 'Each extra team training session allows the team to take one extra Team re-roll that may be used for this match only.',
  },
  {
    name: 'Halfling Master Chef',
    maxCount: 1,
    price: 300000,
    rule: 'Roll 3D6 at the start of each half to see what effect the chef\'s cooking has on the team. For each dice that rolls 4 or more, the team is so inspired that they gain a Team Re-roll, and in addition the opposing team is so distracted by the fantastic cooking smells emanating from their opponent\'s dug-out that they lose a Team Re-roll (but only if they have any left to lose). Halfling teams pay only 100,000 gp instead of 300,000.',
  },
  {
    name: 'Wandering Apothecary',
    maxCount: 2,
    price: 100000,
    rule: 'Any team may hire a Wandering Apothecary or two to help your team during the match for 100,000 gold pieces each if your team can normally purchase a permanent Apothecary. Often these Apothecaries are powerful priests of the local deity. While they would never allow themselves to be a permanent part of a heathen Blood Bowl team, they have been known to assist for a single match for a generous donation to their faith. The rules for Wandering Apothecaries are identical to the rules for purchased Apothecaries. Only one Apothecary may be used to re-roll each Casualty roll.',
  },
  {
    name: 'Wizards',
    maxCount: 1,
    price: 150000,
    rule: 'Once per game, the Wizard is allowed to cast either a fireball spell or a lightning bolt spell. Wizards may only cast spells at the start of their own turn before any player performs an Action OR immediately after their own team\'s turn has ended even if it ended with a turnover.\n\nFireball: Choose a target square anywhere on the pitch. Roll one dice to hit each standing player (from either team) that is either in the target square or a square adjacent to it. If the \'to hit\' roll is a 4 or more then the target is Knocked Down. If it is a 3 or less he manages to dodge the fireball\'s blast. Make an Armour roll (and possible Injury as well) for any player that is Knocked Down as if they had been Knocked Down by a player with the Mighty Blow skill. If a player on the moving team is Knocked Down by a fireball, then the moving team does not suffer a turnover unless the player was carrying the ball at the time.\n\nLightning Bolt: Pick a standing player anywhere on the pitch, and roll one dice. If the score is a 2 or higher, then he has been hit by the lightning bolt. If the roll is a 1 then he manages to dodge out of the way. A player hit by a lightning bolt is Knocked Down and must make an Armour roll (and possible Injury as well) as if hit by a player with the Mighty Blow skill.',
  },
  {
    name: 'Igor',
    maxCount: 1,
    price: 100000,
    rule: 'Any team that cannot purchase a permanent Apothecary can hire an Igor for 100,000 gold pieces to assist the team. An Igor is a master of needle and thread on rotting flesh, connecting hip bone to leg bone, rewrapping funeral wraps and so on. He can really get the boys shambling back to the pitch. An Igor may only be used once per a game to re-roll one failed Regeneration roll for a player. Only purchasable by teams with no access to a permanent Apothecary.',
  },
]

async function main() {
  console.log(`Seeding ${inducements.length} MdInducement records...`)
  for (const ind of inducements) {
    await prisma.mdInducement.upsert({
      where:  { name: ind.name },
      update: ind,
      create: ind,
    })
  }
  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
