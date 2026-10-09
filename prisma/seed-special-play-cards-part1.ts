export const deckDataPart1 = [
  {
    name: 'Miscellaneous Mayhem',
    price: 50000,
    cards: [
      {
        cardLabel: '2 ♥',
        name: 'BADYEAR GIT',
        description:
          'A goblin doom diver who was too cheap to pay for admission is hit by the kick-off while flying over the stadium.',
        timing:
          'Play at any kick-off after all players have been set up and the ball placed, but before any scatter has been rolled.',
        effect: 'The ball scatters 2d6, instead of 1d6, on this kick-off.',
      },
      {
        cardLabel: '9 ♥',
        name: 'HOMETOWN FANS',
        description:
          "Your team's fans start the match very willing to help their favourite team by throwing the ball to the perfect place for you.",
        timing: 'Play during the pre-game after all inducements are purchased.',
        effect:
          'You may choose the direction the ball is thrown in on the Throw-in Template every time it goes out of bounds during the first half. During the second half, all throw-ins are done as normal.',
      },
      {
        cardLabel: '3 ♥',
        name: 'SPRINKLER MALFUNCTION',
        description:
          'Somebody triggered the sprinkler system, on accident of course. The ball becomes difficult to handle and the mist makes it difficult to see until it is shut off.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'All attempts to pass, catch, or pick up the ball have an additional -1 modifier for this drive.',
      },
      {
        cardLabel: '10 ♥',
        name: 'INCOMING!',
        description:
          'The crowd received souvenir balls today and has decided to use them as ammunition instead of keepsakes.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'For this turn, any player from the opposing team must dodge any time they leave a square within 2 squares of either sideline or end zone.',
      },
      {
        cardLabel: '4 ♥',
        name: 'ECLIPSE',
        description:
          "Suddenly all light is blocked out by a total eclipse. Maybe it’s the complete darkness, or maybe it's astrological magic, but for one brief moment all players are equal.",
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          "For your turn and your opponent's turn, all players on the pitch have only the characteristics and skills of a rookie Goblin.",
      },
      {
        cardLabel: 'J ♥',
        name: 'ROGUE WIZARD',
        description: 'A wizard in the stands starts to get a little bored and bombs the pitch with a fireball!',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'Place a marker on the pitch, scatter the marker 5 times. If it does not scatter off the pitch at any point, the fireball explodes as the spell; the centre is where the marker is.',
      },
      {
        cardLabel: '5 ♥',
        name: 'FANATIC INVASION',
        description: 'A crazed goblin fan talks an ogre into tossing him onto the pitch!',
        timing:
          'Play after your turn has ended but before your opponent’s turn begins. You may not play this card after a kick-off is resolved.',
        effect:
          "Place a miniature to represent the Goblin Fanatic into any empty square on the pitch. He has the same stats as a rookie Goblin Fanatic. The coach playing this card may immediately move the Fanatic. Each coach can only take a Move Action with the Fanatic after his turn has ended but before his opponent's turn. This Fanatic has no tackle zones and blocks without any offensive assists. At the end of the drive the ref automatically ejects the Fanatic from the game.",
      },
      {
        cardLabel: 'Q ♥',
        name: 'BALL CLONE',
        description: 'The random chaos of Tzeentch has affected the ball.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'If the ball is on the ground, a 2nd ball materializes in the square and one of them is bounced from it. The first player that crosses into the end zone with one of the balls rolls a D6. On a 1-3, the ball vanishes and a touchdown is not scored. This effect ends when a drive ends. Players may not pick-up, catch, or intercept a ball if they already are carrying one. A ball bouncing into the square with the other ball will bounce again.',
      },
      {
        cardLabel: '6 ♥',
        name: 'FRIENDLY FANS',
        description:
          "The crowd loves your team, and wouldn't ever consider ripping one of your players apart...well, not this game anyway.",
        timing: 'Play during the pre-game after all inducements are purchased.',
        effect: 'Any player on your team that is pushed into the crowd this game is only Stunned, do not roll injury.',
      },
      {
        cardLabel: 'K ♥',
        name: 'JOHNNY WATERBOY',
        description:
          'He must be a magician as that is some mighty fine H2O. One drink from this minor wizard of water seems to revive any bashed up players.',
        timing: 'Play during the pre-game after all inducements are purchased.',
        effect:
          'For this match, your players gain a +1 modifier to recover from KO’d for this match (a roll of 1 is still a failure).',
      },
      {
        cardLabel: '7 ♥',
        name: 'ROWDY FANS',
        description:
          'Your fans have shown up today and it’s with an extra evil glint in their eyes. They want a LOT of blood and are in the mood to help see it.',
        timing: 'Play during the pre-game after all inducements are purchased.',
        effect:
          'For this match, any block or foul made by or against an opposing player adjacent to the sidelines is treated as having one extra assist from your team. In addition, no opposing player adjacent to the sidelines can assist a block or foul.',
      },
      {
        cardLabel: 'A ♥',
        name: "THAT BABE'S GOT TALENT!",
        description:
          'Your team visits the local tavern the night before the game. One of the dancers offers to bring some friends to help the cheerleader squad, and some patrons to help with some new play ideas and to see their performance at your match.',
        timing: 'Play during the pre-game after all inducements are purchased.',
        effect:
          'You automatically win all Cheering Fan and Brilliant Coaching rolls on the Kick-Off table for this match. In addition, you get an additional +1 to your FAME (see page 18) for any other Kick-Off table result for this match but not for the winning roll.',
      },
      {
        cardLabel: '8 ♥',
        name: 'HECKLER',
        description: 'An overeager fan heckles and distracts one opponent especially well.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'An opposing player of your choice may not use any skills (including block and dodge defensively) other than those that must be used (frenzy, loner, etc.) for this turn and the following opposing turn.',
      },
    ],
  },
  {
    name: 'Special Team Plays',
    price: 50000,
    cards: [
      {
        cardLabel: '2 ♦',
        name: 'COME TO PAPA!',
        description: 'You have read the kick-off almost perfectly and are ready to receive it.',
        timing:
          'Play when you are receiving a kick-off after all players have been set up and the ball has been scattered, but before any kick-off result is rolled.',
        effect: 'Move one player not on the line of scrimmage to the square where the ball will land.',
      },
      {
        cardLabel: '9 ♦',
        name: 'PERFECT KICK',
        description: 'You try and kick the ball to just the right spot to help your defence.',
        timing: 'Play after all players have been set up for a kick-off, but before any kick-off result is rolled.',
        effect:
          "Place the ball anywhere in the line of scrimmage or the end zone of the opponent's half excluding the wide zones. To determine the landing square for the ball, instead of the normal kick-off scatter, scatter the ball for one square 3 times using the sideline throw-in template for each scatter, you may choose how the template is facing on each scatter as long as it is facing a sideline or end zone.",
      },
      {
        cardLabel: '3 ♦',
        name: 'DOGGED DEFENSE',
        description:
          'Your players give everything they have to defend the end zone, trying to trip the opposition from the ground.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'For this turn all your players that are Prone (not Stunned) exert tackle zones as if they were standing, however they cannot assist or cancel assists, catch, or take any other Action that requires a standing player.',
      },
      {
        cardLabel: '10 ♦',
        name: 'OPTION PLAY',
        description:
          'This play is designed so your ball carrier can choose either to keep the ball himself or dump it off to someone else.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect: 'A player of your choice gains the Dump-Off and Pass skill until the drive ends.',
      },
      {
        cardLabel: '4 ♦',
        name: 'FLEA FLICKER',
        description:
          'A trick play is on. You trick the opponent into thinking one person will run the ball, but he tosses it to someone else who throws the ball.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'You may take an extra Pass Action, however the first Pass Action you take must be a Quick Pass.',
      },
      {
        cardLabel: 'J ♦',
        name: 'PUNT',
        description: 'Time to get rid of the ball and pin the opponent deep!',
        timing: 'Play after your turn has ended, but before your opponent’s turn begins.',
        effect:
          'If a player you control has the ball, you may place the ball in any square you want and scatter the ball three times. If the ball is not caught it will bounce as normal.',
      },
      {
        cardLabel: '5 ♦',
        name: 'FUMBLEROOSKI',
        description:
          'The players on your team intentionally fumble the ball to open up some funny and spectacular plays.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          "For this turn any failed pick up, catch, or fumbled pass rolls do not cause turnovers. Also a player can intentionally fail to pick up or catch the ball, or fumble a pass. Any failed attempt to pick up or throw the ball ends the player’s Action. Any player failing a catch roll counts as having taken an Action for the turn as well, even if they have not performed an Action yet.",
      },
      {
        cardLabel: 'Q ♦',
        name: 'SPECTACULAR CATCH',
        description: 'A player puts himself on the line to try for an amazing catch',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect: 'For this turn a player of your choice gains Catch and Diving Catch.',
      },
      {
        cardLabel: '6 ♦',
        name: 'GOING THE EXTRA MILE',
        description: 'A player on your team throws it into high gear to cover some extra ground.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'A player of your choice may Go For It any number of times this turn. Each Go For It after the second has a cumulative modifier of -1 to the roll (example: the 4th GFI would have a -2 modifier to the D6 roll). If the player has Sprint he may add 1 to one Go For It roll made this turn (a natural 1 will still result in a failure though).',
      },
      {
        cardLabel: 'K ♦',
        name: 'SUICIDE BLITZ',
        description: 'A player gets a good jump over the line of scrimmage and launches himself at the opponents.',
        timing:
          'Play after a kick-off to your opponent has been resolved (including the ball landing), but before your opponent’s turn begins.',
        effect:
          'A player of your choice not holding the ball may take a Blitz Action immediately. This player suffers from the No Hands skill for this Action only.',
      },
      {
        cardLabel: '7 ♦',
        name: 'HEROIC LEAP',
        description: 'The player has one chance to be a hero, and tries for it all!',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          "Choose a player with strength four or less. This turn the chosen player may leap, as the skill, with a 3+ to land regardless of that player's agility or skills.",
      },
      {
        cardLabel: 'A ♦',
        name: 'WAKE UP CALL',
        description:
          'Desperate times call for desperate measures. Time to get some extra players on the pitch, ready or not.',
        timing: 'Play before you set up any players for a drive.',
        effect:
          "Instead of rolling for a player to come back from being KO’d, you may have the player automatically recover by placing the player on the pitch Stunned. You may do this with any number of KO’d players. After placing as many players from KO'd on the pitch as you desire, roll a D6 for each player that is Stunned. On a 4+, that player is turned to Prone.",
      },
      {
        cardLabel: '8 ♦',
        name: 'NEW BLOCKING SCHEME',
        description: 'A clever blocking play gives you a one-up on your opponents.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          "A player on your team that is in an opponent's tackle zones and adjacent to another player on your team may switch squares with the adjacent player from your team, unless either one has the ball. This may be done with only one set of two players.",
      },
    ],
  },
  {
    name: 'Magic Items',
    price: 50000,
    cards: [
      {
        cardLabel: '2 ♣',
        name: 'BEGUILING BRACERS',
        description:
          'A player has come across the bracers of Count Luthor to use for the match. They are so good that they even distract the player wearing them sometimes.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'Choose one player on your team. That player gains the skills Hypnotic Gaze, Side Step, and Bone-head for the remainder of this game.',
      },
      {
        cardLabel: '9 ♣',
        name: 'LUCKY CHARM',
        description: 'The player has acquired some lucky charms from a Halfling in a green coat before the game.',
        timing: 'Play during the pre-game after all inducements are purchased.',
        effect:
          'A player of your choice may ignore the first time his armour is broken, and just be Placed Prone. Any roll that ignores armour, such as the crowd or throw a rock, is not affected by a lucky charm.',
      },
      {
        cardLabel: '3 ♣',
        name: 'BELT OF INVUNERABILITY',
        description: 'Your player really has found a way to become a man of steel.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'Armour rolls made against a player of your choice may not be modified or re-rolled by any positive modifiers for the remainder of this game. This includes (but is not limited to) Claw, Mighty Blow, Dirty Player, Piling On, fouling assists, Stunty and Chainsaw attacks.',
      },
      {
        cardLabel: '10 ♣',
        name: 'MAGIC GLOVES OF JARK LONGARM',
        description: 'Your team is featured in Spike! magazine and the magazine gives you these gloves for your upcoming game.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'A player of your choice gains the Pass Block skill, and an additional +1 modifier to all interception rolls until the drive ends.',
      },
      {
        cardLabel: '4 ♣',
        name: "FAWNDOUGH'S HEADBAND",
        description:
          'One of the great passers of all time has loaned your player his headband for this game, but you had better make sure you get it back before he notices it missing!',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'A player of your choice gains Pass and Accurate for this turn, but an additional +1 modifier on any interception rolls against him is applied as well.',
      },
      {
        cardLabel: 'J ♣',
        name: 'GOOD OLD MAGIC CODPIECE',
        description:
          'Mother always said "never play without your codpiece". After years of being passed from one generation to the next, the magic is still working.',
        timing: 'Play during the pre-game after all inducements are purchased.',
        effect:
          'A player of your choice may not be fouled for this game and injury rolls against this player cannot be modified or re-rolled by anything including (but not limited to) Dirty Player, Mighty Blow, Piling On, and Stunty.',
      },
      {
        cardLabel: '5 ♣',
        name: 'FORCE SHIELD',
        description:
          "Your player paid top gold for a Ring of Invincibility, but it's not all that was advertised.",
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'The player on your team holding the ball gains the Sure Hands and Fend skills until he no longer has the ball.',
      },
      {
        cardLabel: "Q ♣",
        name: "RABBIT'S FOOT",
        description: "One player finds himself a lucky rabbit's foot after the pre-game meal of, well, rabbit.",
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect: 'A player of your choice without Loner gains the Pro skill for the remainder of this game.',
      },
      {
        cardLabel: '6 ♣',
        name: "GIKTA'S STRENGTH OF da BEAR",
        description: 'A scroll found in the house of a retired legendary coach contains a spell of Bear strength.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'A player of your choice on your team gains +1 Strength until the drive ends. After this the player has -1 Strength for the remainder of this game.',
      },
      {
        cardLabel: 'K ♣',
        name: 'RING OF TELEPORTATION',
        description: "Where'd he go? The player uses a teleportation ring to get out of a tight spot.",
        timing: 'Play after your turn has ended (unless your turn ending would end the half.)',
        effect:
          'One player on your team of your choice can be moved D6 squares in a single direction of your choice (note: you must move the full D6 squares and must choose the direction before rolling the D6). Treat this movement as if the player had been thrown with the Throw Team-Mate skill but without the 3 scatters to determine the landing square. The landing roll from the teleportation is automatically successful unless he has bounced off another player.',
      },
      {
        cardLabel: '7 ♣',
        name: 'GLOVES OF HOLDING',
        description: "A player puts a magic salve, Grisnick's Stickum, onto his gloves before the drive.",
        timing:
          'Play at any kick-off after all players have been set up and the ball placed, but before any scatter has been rolled.',
        effect:
          'A player of your choice on your team gains the Catch and Sure Hands skills, but may not take Pass or Hand-off Actions for the remainder of this game.',
      },
      {
        cardLabel: 'A ♣',
        name: 'WAND OF SMASHING',
        description: 'Stick! Smash!',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect: 'Choose one player on your team. That player gains +1 strength and the Mighty Blow skill for this turn.',
      },
      {
        cardLabel: '8 ♣',
        name: 'INERTIA DAMPNER',
        description:
          'The player has come across a magic amulet that slows the speed of any large objects that happen to intersect with his location.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'Choose one player on your team. For the remainder of this drive, any opponent moving one square or more first and then blitzing this player suffers a -1 modifier to his Strength (minimum Strength of 1) for the block attempt.',
      },
    ],
  },
  {
    name: 'Dirty Tricks',
    price: 50000,
    cards: [
      {
        cardLabel: '2 ♠',
        name: 'BLATANT FOUL',
        description: 'A player on your team is determined to take out the opposition, no matter what.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'The armour roll for your Foul Action this turn automatically succeeds and is considered a non-doubles roll, however the injury roll for the foul must be rolled as normal with the player sent off on doubles.',
      },
      {
        cardLabel: '9 ♠',
        name: 'KICKING BOOTS',
        description: 'These boots were made for stomping, and that is just what they will do!',
        timing: 'Play after all players have been set up for a kick-off, but before any kick-off result is rolled.',
        effect:
          'A player of your choice on your team gains the Kick and Dirty Player skills and a -1 MA for the remainder of this game.',
      },
      {
        cardLabel: '3 ♠',
        name: 'CHOP BLOCK',
        description: 'A player throws a dirty block on the opponent.',
        timing:
          'Play after your turn has ended but before your opponent’s turn begins. You may not play this card after a kick-off is resolved.',
        effect:
          'This card may only be played on one of your Standing players that did not take an Action during your last turn. Your player is Placed Prone and an opposing player in a square adjacent to him is now considered Stunned.',
      },
      {
        cardLabel: '10 ♠',
        name: 'PIT TRAP',
        description: 'A devious groundskeeper has set up a pit trap for you.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect: 'Choose a player: that player is Placed Prone, no Armour roll is made. If the player had the ball, bounce it as normal.',
      },
      {
        cardLabel: '4 ♠',
        name: 'CUSTARD PIE',
        description: 'One of your players thrusts a cleverly concealed custard pie in the face of an opposing player.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'Choose one player on the opposing team adjacent to one of your Standing or Prone players (not Stunned). That opposing player is so flabbergasted by the pie hit that he loses his tackle zones for the remainder of this turn as per a successful Hypnotic Gaze roll.',
      },
      {
        cardLabel: 'J ♠',
        name: 'SPIKED BALL',
        description:
          'A Bloodthirster is in the crowd today, so in honour of this event a spiked ball is swapped with the real ball. More blood for the blood god and the fans!',
        timing: 'Play after all players have been set up for a kick-off, but before any kick-off result is rolled.',
        effect:
          'Until the drive ends any failed pick up or catch roll (but not interception roll) is treated as the player being attacked with the Stab skill by an opponent.',
      },
      {
        cardLabel: '5 ♠',
        name: 'DISTRACT',
        description: 'Your player is very good at distracting all those around him.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'The chosen player gains the skill Disturbing Presence for this turn and all opposing players starting their Action within 3 squares of the player count as having Bone-head (lost tackle zones from failed Bone-head rolls return at the end of this turn).',
      },
      {
        cardLabel: 'Q ♠',
        name: 'STOLEN PLAYBOOK',
        description:
          'You nabbed a playbook from the opponent’s coach! He sure will be surprised when you know exactly how to ruin his play.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect: 'A player of your choice gains Pass Block and Shadowing until the drive ends.',
      },
      {
        cardLabel: '6 ♠',
        name: 'GREASED SHOES',
        description: 'The magic grease applied to your opponents’ shoes has finally taken effect.',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect: 'This turn all opposing players need to roll a 5+ to Go For It instead of the normal 2+.',
      },
      {
        cardLabel: 'K ♠',
        name: 'TRAMPOLINE TRAP',
        description: 'Someone set up a deep pit trap...with a trampoline in it!',
        timing:
          'Play after your turn has ended or your kick-off to an opponent is resolved, but before your opponent’s turn begins.',
        effect:
          'Choose any opposing player. Using all the rules for the Throw Team-Mate skill, the player is automatically thrown (i.e., cannot be fumbled) to a target square that is D6 squares away in a random direction from his own square (use the scatter template). The player will need to make a landing roll as normal if they land on the pitch.',
      },
      {
        cardLabel: '7 ♠',
        name: "GROMSKULL'S EXPLODING RUNES",
        description:
          'A player purchased some exploding runes from a dwarven runesmith before the game. Although they are illegal, they are highly effective.',
        timing: 'Play before setting up for a drive.',
        effect:
          'Choose one player on your team. That player gains the Bombardier, No Hands, and Secret Weapon skills for this game. Because the Rune can be very volatile, any Pass roll made with a Rune bomb is performed with a -1 modifier.',
      },
      {
        cardLabel: "A ♠",
        name: "WITCH'S BREW",
        description: "You've spiked the opponent’s Kroxorade bottle with a witch's concoction!",
        timing: 'Play after all players have been set up for a kick-off, but before any kick-off result is rolled.',
        effect:
          'Choose an opponent and roll on this table. 1- Whoops! Mad Cap Mushroom potion! The player gains the Jump Up and No Hands skills until the drive ends. 2- Snake Oil! Bad taste, but no effect. 3-6 Sedative! The player gains the Really Stupid skill until the drive ends.',
      },
      {
        cardLabel: '8 ♠',
        name: 'ILLEGAL SUBSTITUTION',
        description: 'A reserve sneaks onto the pitch while the ref is cleaning his glasses.',
        timing: 'Play at the beginning of your turn before any player takes an Action.',
        effect:
          'You may place any player from the reserves box in an unoccupied square in the end zone you are defending. This player may only take a Move Action this turn. This may take your team to 12 players for the remainder of the drive.',
      },
    ],
  },
]
